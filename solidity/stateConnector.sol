// SPDX-License-Identifier: MIT
pragma solidity ^0.7.3;
pragma experimental ABIEncoderV2;

contract stateConnector {

//====================================================================
// Data Structures
//====================================================================
    
    address payable public governanceContract;
    uint256 public registrationFee;

    struct Chain {
        bool    exists;
        uint256 genesisLedger;
        uint256 claimPeriodLength; // Number of ledgers in a claim period
        uint256 finalisedClaimPeriodIndex;
        uint256 finalisedLedgerIndex;
        uint256 finalisedTimestamp;
    }

    struct ClaimPeriodHash {
        bool    exists;
        bytes32 claimPeriodHash;
    }

    // Chain ID mapping to Chain struct
    mapping(uint256 => Chain) public Chains;
    // Location hash => claim period
    mapping(bytes32 => ClaimPeriodHash) public finalisedClaimPeriods;
    // Mapping of how much value is owed back to addresses that successfully registered claim periods
    // They can claim this later on at any time from the governance contract
    mapping(address => uint256) public registrationFeesDue;
    
//====================================================================
// Constructor
//====================================================================

    constructor(address payable _governanceContract, uint256 _registrationFee) {
        governanceContract = _governanceContract;
        registrationFee = _registrationFee;
    }

//====================================================================
// Functions
//====================================================================  

    function setGovernanceContract(address payable _governanceContract) public returns (bool success) {
        require(msg.sender == governanceContract, 'msg.sender != governanceContract');
        governanceContract = _governanceContract;
        return true;
    }

    function addChain(uint256 chainID, uint256 genesisLedger, uint256 claimPeriodLength) public returns (bool success) {
        require(msg.sender == governanceContract, 'msg.sender != governanceContract');
        require(Chains[chainID].exists == false, 'chainID already exists');
        Chains[chainID] = Chain(true, genesisLedger, claimPeriodLength, 0, genesisLedger, block.timestamp);
        return true;
    }

    function setRegistrationFee(uint256 _registrationFee) public returns (bool success) {
        require(msg.sender == governanceContract, 'msg.sender != governanceContract');
        registrationFee = _registrationFee;
        return true;
    }

    function resetRegistrationFeesDue(address recipient) public returns (bool success) {
        require(msg.sender == governanceContract, 'msg.sender != governanceContract');
        registrationFeesDue[recipient] = 0;
        return true;
    } 

    function checkRootFinality(bytes32 root, uint256 chainID, uint256 ledger) private view returns (bool finality) {
        require(Chains[chainID].exists == true, 'chainID does not exist');
        require(ledger >= Chains[chainID].genesisLedger, 'ledger < genesisLedger');
        require(ledger < Chains[chainID].finalisedLedgerIndex, 'ledger >= finalisedLedgerIndex');
        uint256 claimPeriodIndex = (ledger - Chains[chainID].genesisLedger)/Chains[chainID].claimPeriodLength;
        bytes32 locationHash =  keccak256(abi.encodePacked(
                                    keccak256(abi.encodePacked('chainID', chainID)),
                                    keccak256(abi.encodePacked('ledger', ledger)),
                                    keccak256(abi.encodePacked('claimPeriodIndex', claimPeriodIndex)))
                                );
        require(finalisedClaimPeriods[locationHash].exists == true, 'claimPeriodHash does not exist');
        return finalisedClaimPeriods[locationHash].claimPeriodHash == root;
    }

    function verifyMerkleProof(bytes32 root, bytes32 leaf, bytes32[] memory proof) private pure returns (bool verified) {
        bytes32 computedHash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];
            if (computedHash < proofElement) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }
        return computedHash == root;
    }

    function provePaymentFinality(uint256 chainID, uint256 ledger, uint32 indexInLedger, string memory txId, string memory source, string memory destination, string memory currency, uint256 value, bytes32 memo, bytes32[] memory proof, bytes32 root) public view returns (bool success) {
        require(Chains[chainID].exists == true, 'chainID does not exist');
        require(checkRootFinality(root, chainID, ledger) == true, 'Claim period not finalised');
        bytes32 leaf = keccak256(abi.encodePacked(
            keccak256(abi.encodePacked('chainID', chainID)),
            keccak256(abi.encodePacked('ledger', ledger)),
            keccak256(abi.encodePacked('indexInLedger', indexInLedger)),
            keccak256(abi.encodePacked('txId', txId)),
            keccak256(abi.encodePacked('source', source)),
            keccak256(abi.encodePacked('destination', destination)),
            keccak256(abi.encodePacked('currency', currency)),
            keccak256(abi.encodePacked('value', value)),
            keccak256(abi.encodePacked('memo', memo)))
        );
        require(verifyMerkleProof(root, leaf, proof) == true, 'Payment not verified');
        return true;
    }

    function getlatestIndex(uint256 chainID) public view returns (uint256 genesisLedger, uint256 finalisedClaimPeriodIndex, uint256 claimPeriodLength, uint256 finalisedLedgerIndex, uint256 finalisedTimestamp, uint256 _registrationFee) {
        require(Chains[chainID].exists == true, 'chainID does not exist');
        return (Chains[chainID].genesisLedger, Chains[chainID].finalisedClaimPeriodIndex, Chains[chainID].claimPeriodLength, Chains[chainID].finalisedLedgerIndex, Chains[chainID].finalisedTimestamp, registrationFee);
    }

    function registerClaimPeriod(uint256 chainID, uint256 ledger, uint256 claimPeriodIndex, bytes32 claimPeriodHash) public payable returns (bool finality) {
        require(msg.value == registrationFee, 'msg.value != registrationFee');
        governanceContract.transfer(registrationFee);
        require(Chains[chainID].exists == true, 'chainID does not exist');
        bytes32 locationHash =  keccak256(abi.encodePacked(
                                    keccak256(abi.encodePacked('chainID', chainID)),
                                    keccak256(abi.encodePacked('ledger', ledger)),
                                    keccak256(abi.encodePacked('claimPeriodIndex', claimPeriodIndex)))
                                );
        require(finalisedClaimPeriods[locationHash].exists == false, 'claimPeriodHash already finalised');
        if (block.coinbase != address(uint160(uint256(keccak256(abi.encodePacked(block.number, locationHash, claimPeriodHash)))))) {
            // msg.sender loses registration fee
            return false;
        } else {
            registrationFeesDue[msg.sender] = registrationFeesDue[msg.sender] + registrationFee;
            finalisedClaimPeriods[locationHash] = ClaimPeriodHash(true, claimPeriodHash);
            Chains[chainID].finalisedClaimPeriodIndex = claimPeriodIndex+1;
            Chains[chainID].finalisedLedgerIndex = ledger;
            Chains[chainID].finalisedTimestamp = block.timestamp;
            return true;
        }
    }

}