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

    function addChain(uint256 chainId, uint256 genesisLedger, uint256 claimPeriodLength) public returns (bool success) {
        require(msg.sender == governanceContract, 'msg.sender != governanceContract');
        require(Chains[chainId].exists == false, 'chainId already exists');
        Chains[chainId] = Chain(true, genesisLedger, claimPeriodLength, 0, genesisLedger, block.timestamp);
        return true;
    }

    function setRegistrationFee(uint256 _registrationFee) public returns (bool success) {
        require(msg.sender == governanceContract, 'msg.sender != governanceContract');
        require(_registrationFee > 0);
        registrationFee = _registrationFee;
        return true;
    }

    function resetRegistrationFeesDue(address recipient) public returns (bool success) {
        require(msg.sender == governanceContract, 'msg.sender != governanceContract');
        registrationFeesDue[recipient] = 0;
        return true;
    } 

    function checkRootFinality(bytes32 root, uint256 chainId, uint256 claimPeriodIndex) private view returns (bool finality) {
        require(Chains[chainId].exists == true, 'chainId does not exist');
        bytes32 locationHash =  keccak256(abi.encodePacked(
                                    keccak256(abi.encodePacked(chainId)),
                                    keccak256(abi.encodePacked(claimPeriodIndex))
                                ));
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

    function constructLeaf(uint256 chainId, uint256 ledger, string memory txId, string memory source, string memory destination, uint256 destinationTag, uint256 amount) public pure returns (bytes32 leaf) {
        bytes32 constructedLeaf = keccak256(
            abi.encode(
                keccak256(abi.encode(chainId)),
                keccak256(abi.encode(ledger)),
                keccak256(abi.encode(txId)),
                keccak256(abi.encode(source)),
                keccak256(abi.encode(destination)),
                keccak256(abi.encode(destinationTag)),
                keccak256(abi.encode(amount))
            )
        );
        return constructedLeaf;
    }

    function provePaymentFinality(uint256 chainId, uint256 claimPeriodIndex, uint256 ledger, string memory txId, string memory source, string memory destination, uint256 destinationTag, uint256 amount, bytes32 root, bytes32 leaf, bytes32[] memory proof) public view returns (bool success) {
        require(Chains[chainId].exists == true, 'chainId does not exist');
        require(checkRootFinality(root, chainId, claimPeriodIndex) == true, 'Claim period not finalised');
        require(constructLeaf(chainId, ledger, txId, source, destination, destinationTag, amount) == leaf, 'constructedLeaf != leaf');
        require(verifyMerkleProof(root, leaf, proof) == true, 'Payment not verified');
        return true;
    }

    function getlatestIndex(uint256 chainId) public view returns (uint256 genesisLedger, uint256 finalisedClaimPeriodIndex, uint256 claimPeriodLength, uint256 finalisedLedgerIndex, uint256 finalisedTimestamp, uint256 _registrationFee) {
        require(Chains[chainId].exists == true, 'chainId does not exist');
        return (Chains[chainId].genesisLedger, Chains[chainId].finalisedClaimPeriodIndex, Chains[chainId].claimPeriodLength, Chains[chainId].finalisedLedgerIndex, Chains[chainId].finalisedTimestamp, registrationFee);
    }

    function checkFinality(uint256 chainId, uint256 claimPeriodIndex) public view returns (bool finality) {
        require(Chains[chainId].exists == true, 'chainId does not exist');
        bytes32 locationHash =  keccak256(abi.encodePacked(
                                    keccak256(abi.encodePacked(chainId)),
                                    keccak256(abi.encodePacked(claimPeriodIndex))
                                ));
        return (finalisedClaimPeriods[locationHash].exists);
    }

    function registerClaimPeriod(uint256 chainId, uint256 ledger, uint256 claimPeriodIndex, bytes32 claimPeriodHash) public payable returns (bool finality) {
        require(msg.sender == tx.origin, 'msg.sender != tx.origin');
        require(msg.value == registrationFee, 'msg.value != registrationFee');
        governanceContract.transfer(registrationFee);
        require(Chains[chainId].exists == true, 'chainId does not exist');
        bytes32 locationHash =  keccak256(abi.encodePacked(
                                    keccak256(abi.encodePacked(chainId)),
                                    keccak256(abi.encodePacked(claimPeriodIndex))
                                ));
        require(finalisedClaimPeriods[locationHash].exists == false, 'claimPeriodHash already finalised');
        if (claimPeriodIndex > 0) {
            bytes32 prevLocationHash =  keccak256(abi.encodePacked(
                                            keccak256(abi.encodePacked(chainId)),
                                            keccak256(abi.encodePacked(claimPeriodIndex-1))
                                        ));
            require(finalisedClaimPeriods[prevLocationHash].exists == true, 'previous claim period not yet finalised');
        }
        require(block.coinbase == msg.sender && block.coinbase != address(0x0100000000000000000000000000000000000000), 'Invalid block.coinbase value');
        if (block.coinbase == msg.sender && block.coinbase != address(0x0100000000000000000000000000000000000000)) {
            // Node checked claimPeriodHash, and it was valid
            registrationFeesDue[msg.sender] = registrationFeesDue[msg.sender] + registrationFee;
            require(registrationFeesDue[msg.sender] > 0, 'Invalid registration fee');
            finalisedClaimPeriods[locationHash] = ClaimPeriodHash(true, claimPeriodHash);
            Chains[chainId].finalisedClaimPeriodIndex = claimPeriodIndex+1;
            Chains[chainId].finalisedLedgerIndex = ledger;
            Chains[chainId].finalisedTimestamp = block.timestamp;
            return true;
        } else {
            // Invalid claimPeriodHash
            return false;
        }
    }

}