// SPDX-License-Identifier: MIT
pragma solidity ^0.7.3;
pragma experimental ABIEncoderV2;

contract stateConnector {

//====================================================================
// Data Structures
//====================================================================

    //==================================
    // Unique Node Lists (UNL)
    //==================================

    struct UNL {
        bool        exists;
        address[]   list;
        uint256     lastUpdated;
    }
    uint32 private UNLsize;
    uint32 private finalityThreshold;
    // UNL definitions
    mapping(address => UNL) private UNLmap;

    //==================================
    // Claim Periods
    //==================================

    uint256 private genesisLedger;
    uint256 private claimPeriodLength;		// Number of ledgers in a claim period
    uint256 private finalisedClaimPeriodIndex;
    uint256 private finalisedLedgerIndex;

    // Hash( Hash(ledger index, claim period index), Hash of claim period) => accounts that have registered this claim period
    mapping(bytes32 => mapping(address => bool)) private claimPeriodRegisteredBy;
    // Hash(ledger index, claim period index) => hash of claim period
    mapping(bytes32 => bytes32) private finalisedClaimPeriods;
    

//====================================================================
// Constructor
//====================================================================

    constructor(uint256 _genesisLedger, uint256 _claimPeriodLength, uint32 _UNLsize, uint32 _finalityThreshold) payable {
        genesisLedger = _genesisLedger;
        claimPeriodLength = _claimPeriodLength;
        UNLsize = _UNLsize;
        finalityThreshold = _finalityThreshold;
        finalisedClaimPeriodIndex = 0;
        finalisedLedgerIndex = _genesisLedger;
    }

//====================================================================
// Functions
//====================================================================

    function getLedgerClaimPeriodHash(uint256 ledger) private view returns (bytes32 finalisedClaimPeriodHash) {
        require(ledger >= genesisLedger, 'ledger < genesisLedger');
        require(ledger < finalisedLedgerIndex, 'ledger >= finalisedLedgerIndex');
        uint256 currClaimPeriodIndex = (ledger - genesisLedger)/claimPeriodLength;
        return finalisedClaimPeriods[keccak256(abi.encodePacked('flare', keccak256(abi.encodePacked('ledger', genesisLedger + currClaimPeriodIndex*claimPeriodLength)), keccak256(abi.encodePacked('claimPeriodIndex', currClaimPeriodIndex))))];        
    }

    function verifyMerkleProof(bytes32 root, bytes32 leaf, bytes32[] memory proof) private pure returns (bool) {
        bytes32 computedHash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];
            if (computedHash < proofElement) {
                // Hash(current computed hash + current element of the proof)
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                // Hash(current element of the proof + current computed hash)
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }
        // Check if the computed hash (root) is equal to the provided root
        return computedHash == root;
    }

    function provePaymentFinality(uint256 ledger, string memory txHash, string memory sender, string memory receiver, uint256 amount, address memo, bytes32 memory proof) public view returns (bool) {
        bytes32 leaf = sha3(abi.encodePacked(
            sha3('ledger', item.tx.inLedger),
            sha3('txHash', item.tx.hash),
            sha3('sender', item.tx.Account),
            sha3('destination', item.tx.Destination),
            sha3('amount', item.tx.Amount),
            sha3('memo', memo))
        );



    }

    function updateUNL(address[] memory list) public {
        require(list.length == UNLsize, "Invalid UNL size");
        UNLmap[msg.sender].list = list;
        UNLmap[msg.sender].lastUpdated = block.number;
        if (UNLmap[msg.sender].exists != true) {
            UNLmap[msg.sender].exists = true;
        }
    }

    function getlatestIndex() public view returns (uint256 _genesisLedger, uint256 _claimPeriodIndex,
        uint256 _claimPeriodLength, uint256 _ledger, address _coinbase, address[] memory _UNL) {
        require(UNLmap[msg.sender].exists == true);
        return (genesisLedger, finalisedClaimPeriodIndex, claimPeriodLength,
            finalisedLedgerIndex, block.coinbase, UNLmap[block.coinbase].list);
    }

    function registerClaimPeriod(uint256 ledger, uint256 claimPeriodIndex, bytes32 claimPeriodHash) public returns (bool finality) {
        require(UNLmap[msg.sender].exists == true, 'msg.sender does not exist in UNLmap[]');
        bytes32 locationHash = keccak256(abi.encodePacked('flare', keccak256(abi.encodePacked('ledger', ledger)), keccak256(abi.encodePacked('claimPeriodIndex', claimPeriodIndex))));
        bytes32 registrationHash = keccak256(abi.encodePacked(locationHash, claimPeriodHash));
        require(claimPeriodRegisteredBy[registrationHash][msg.sender] == false, 'This claim period was already registered by msg.sender');
        if (finalisedClaimPeriods[locationHash] == claimPeriodHash) {
            return true;
        } else {
            claimPeriodRegisteredBy[registrationHash][msg.sender] = true;
            if (getLocalFinality(registrationHash) == true) {
                finalisedClaimPeriods[locationHash] = claimPeriodHash;
                finalisedClaimPeriodIndex = claimPeriodIndex+1;
                finalisedLedgerIndex = ledger;
                return true;
            } else {
                return false;
            }
        }
    }

    function getGlobalFinality(bytes32 locationHash, bytes32 claimPeriodHash) public view returns (bool finality) {
        return (finalisedClaimPeriods[locationHash] == claimPeriodHash);
    }

    // Just check for > 50 % participation

    // To change quorum set, just need > 50 % vote

    function getLocalFinality(bytes32 registrationHash) private view returns (bool finality) {
        require(UNLmap[block.coinbase].exists == true, 'UNLmap[block.coinbase].exists != true');
        uint32 outerRegistered = 0;
        uint32 innerRegistered1 = 0;
        uint32 innerRegistered2 = 0;
        // Compute quorum directly registered
        for (uint32 i=0; i<UNLsize; i++) {
            if (claimPeriodRegisteredBy[registrationHash][UNLmap[block.coinbase].list[i]] == true) {
                outerRegistered = outerRegistered + 1;
            }
        }
        if (outerRegistered > UNLsize - finalityThreshold) {
            return true;
        } else {
            // Compute whether a v-blocking set directly has a quorum registered
            outerRegistered = 0;
            for (uint32 i=0; i<UNLsize; i++) {
                innerRegistered1 = 0;
                for (uint32 j=0; j<UNLsize; j++) {
                    if (claimPeriodRegisteredBy[registrationHash][UNLmap[UNLmap[block.coinbase].list[i]].list[j]] == true) {
                        innerRegistered1 = innerRegistered1 + 1;
                    }
                }
                if (innerRegistered1 > UNLsize - finalityThreshold) {
                    outerRegistered = outerRegistered + 1;
                }
            }
            if (outerRegistered >= finalityThreshold) {
                return true;
            } else {
                // Compute whether a v-blocking set has a v-blocking set that has a quorum registered
                outerRegistered = 0;
                for (uint32 i=0; i<UNLsize; i++) {
                    innerRegistered1 = 0;
                    for (uint32 j=0; j<UNLsize; j++) {
                        innerRegistered2 = 0;
                        for (uint32 k=0; k<UNLsize; k++) {
                            if (claimPeriodRegisteredBy[registrationHash][UNLmap[UNLmap[UNLmap[block.coinbase].list[i]].list[j]].list[k]] == true) {
                                innerRegistered2 = innerRegistered2 + 1;
                            }
                        }
                        if (innerRegistered2 > UNLsize - finalityThreshold) {
                            innerRegistered1 = innerRegistered1 + 1;
                        }
                    }
                    if (innerRegistered1 >= finalityThreshold) {
                        outerRegistered = outerRegistered + 1;
                    }
                }
                if (outerRegistered >= finalityThreshold) {
                    return true;
                } else {
                    return false;
                }
            }
        }
    }

}