// SPDX-License-Identifier: MIT
pragma solidity ^0.7.3;
pragma experimental ABIEncoderV2;

contract stateConnector {

//====================================================================
// Data Structures
//====================================================================
    
    address public governanceContract;
    bool public initialised;

    struct Chain {
        bool        exists;
        uint256     genesisLedger;
        uint256     claimPeriodLength; // Number of ledgers in a claim period
        uint256     finalisedClaimPeriodIndex;
        uint256     finalisedLedgerIndex;
        uint256     finalisedTimestamp;
        uint256     timeDiffExpected;
        uint256     timeDiffAvg;
    }

    struct ClaimPeriodHash {
        bool        exists;
        bytes32     claimPeriodHash;
    }

    // Chain ID mapping to Chain struct
    mapping(uint256 => Chain) private Chains;
    // Location hash => claim period
    mapping(bytes32 => ClaimPeriodHash) private finalisedClaimPeriods;
    // Mapping of how many claim periods an address has successfully mined
    mapping(address => uint256) private claimPeriodsMined;
    
//====================================================================
// Constructor for pre-compiled code
//====================================================================

    constructor() {
    }

    function initialiseChains() public returns (bool success) {
        require(initialised == false, 'initialised != false');
        governanceContract = 0x1000000000000000000000000000000000000000;
        Chains[0] = Chain(true, 61050250, 50, 0, 61050250, block.timestamp, 150, 0); //XRP
        initialised = true;
        return true;
    }

//====================================================================
// Functions
//====================================================================  

    function getGovernanceContract() public view returns (address _governanceContract) {
        return governanceContract;
    }

    function setGovernanceContract(address payable _governanceContract) public returns (bool success) {
        require(msg.sender == governanceContract, 'msg.sender != governanceContract');
        governanceContract = _governanceContract;
        return true;
    }

    function addChain(uint256 chainId, uint256 genesisLedger, uint256 claimPeriodLength, uint256 timeDiffExpected) public returns (bool success) {
        require(msg.sender == governanceContract, 'msg.sender != governanceContract');
        require(Chains[chainId].exists == false, 'chainId already exists');
        Chains[chainId] = Chain(true, genesisLedger, claimPeriodLength, 0, genesisLedger, block.timestamp, timeDiffExpected, 0);
        return true;
    }

    function getClaimPeriodsMined(address miner) public view returns (uint256 numMined) {
        return claimPeriodsMined[miner];
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

    function constructLeaf(uint256 chainId, uint256 ledger, bytes32 txHash, bytes32 accountsHash, uint256 amount) private pure returns (bytes32 leaf) {
        bytes32 constructedLeaf = keccak256(
            abi.encode(
                keccak256(abi.encode(chainId)),
                keccak256(abi.encode(ledger)),
                txHash,
                accountsHash,
                keccak256(abi.encode(amount))
            )
        );
        return constructedLeaf;
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

    function provePaymentFinality(uint256 chainId, uint256 claimPeriodIndex, uint256 ledger, bytes32 txHash, bytes32 accountsHash, uint256 amount, bytes32 root, bytes32 leaf, bytes32[] memory proof) public view returns (bool success, uint256 finalisedLedgerIndex) {
        require(Chains[chainId].exists == true, 'chainId does not exist');
        require(ledger >= Chains[chainId].genesisLedger + claimPeriodIndex*Chains[chainId].claimPeriodLength, 'ledger < claimPeriodIndex region');
        require(ledger < Chains[chainId].genesisLedger + (claimPeriodIndex+1)*Chains[chainId].claimPeriodLength, 'ledger > claimPeriodIndex region');
        require(checkRootFinality(root, chainId, claimPeriodIndex) == true, 'Claim period not finalised');
        require(constructLeaf(chainId, ledger, txHash, accountsHash, amount) == leaf, 'constructedLeaf != leaf');
        require(verifyMerkleProof(root, leaf, proof) == true, 'Payment not verified');
        return (true, Chains[chainId].finalisedLedgerIndex-1);
    }

    function getlatestIndex(uint256 chainId) public view returns (uint256 genesisLedger, uint256 finalisedClaimPeriodIndex, uint256 claimPeriodLength, uint256 finalisedLedgerIndex, uint256 finalisedTimestamp, uint256 timeDiffAvg) {
        require(Chains[chainId].exists == true, 'chainId does not exist');
        return (Chains[chainId].genesisLedger, Chains[chainId].finalisedClaimPeriodIndex, Chains[chainId].claimPeriodLength, Chains[chainId].finalisedLedgerIndex, Chains[chainId].finalisedTimestamp, Chains[chainId].timeDiffAvg);
    }

    function checkFinality(uint256 chainId, uint256 claimPeriodIndex) public view returns (bool finality) {
        require(Chains[chainId].exists == true, 'chainId does not exist');
        bytes32 locationHash =  keccak256(abi.encodePacked(
                                    keccak256(abi.encodePacked(chainId)),
                                    keccak256(abi.encodePacked(claimPeriodIndex))
                                ));
        return (finalisedClaimPeriods[locationHash].exists);
    }

    function registerClaimPeriod(uint256 chainId, uint256 ledger, uint256 claimPeriodIndex, bytes32 claimPeriodHash) public returns (bool finality, uint256 _chainId, uint256 _ledger, uint256 _claimPeriodLength, bytes32 _claimPeriodHash) {
        require(msg.sender == tx.origin, 'msg.sender != tx.origin');
        require(Chains[chainId].exists == true, 'chainId does not exist');
        require(ledger == Chains[chainId].finalisedLedgerIndex + Chains[chainId].claimPeriodLength, 'invalid ledger');
        require(ledger == Chains[chainId].genesisLedger + (claimPeriodIndex+1)*Chains[chainId].claimPeriodLength, 'invalid claimPeriodIndex');

        if (block.timestamp >= Chains[chainId].finalisedTimestamp) {
            require(2*(block.timestamp-Chains[chainId].finalisedTimestamp) > Chains[chainId].timeDiffAvg, 'not enough time elapsed since prior finality');
        }
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
        require(block.coinbase == msg.sender || block.coinbase == address(0x0100000000000000000000000000000000000000), 'Invalid block.coinbase value');
        if (block.coinbase == msg.sender && block.coinbase != address(0x0100000000000000000000000000000000000000)) {
            // Node checked claimPeriodHash, and it was valid
            claimPeriodsMined[msg.sender] = claimPeriodsMined[msg.sender] + 1;
            finalisedClaimPeriods[locationHash] = ClaimPeriodHash(true, claimPeriodHash);
            Chains[chainId].finalisedClaimPeriodIndex = claimPeriodIndex+1;
            Chains[chainId].finalisedLedgerIndex = ledger;
            if (block.timestamp >= Chains[chainId].finalisedTimestamp) {
                uint256 timeDiffAvgUpdate = (Chains[chainId].timeDiffAvg + (block.timestamp-Chains[chainId].finalisedTimestamp))/2;
                if (timeDiffAvgUpdate > Chains[chainId].timeDiffExpected) {
                    Chains[chainId].timeDiffAvg = Chains[chainId].timeDiffExpected;
                } else {
                    Chains[chainId].timeDiffAvg = timeDiffAvgUpdate;
                }
                Chains[chainId].finalisedTimestamp = block.timestamp;
            } else {
                Chains[chainId].timeDiffAvg = Chains[chainId].timeDiffExpected;
            }
            return (true, chainId, ledger, Chains[chainId].claimPeriodLength, claimPeriodHash);
        } else {
            // Invalid claimPeriodHash
            return (false, chainId, ledger, Chains[chainId].claimPeriodLength, claimPeriodHash);
        }
    }

}