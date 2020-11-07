// SPDX-License-Identifier: MIT
pragma solidity ^0.7.3;
pragma experimental ABIEncoderV2;

contract fxrp {

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
        uint256     claimPeriodIndex;
        uint256     ledger;
    }
    uint32 private UNLsize;
    // UNL definitions
    mapping(address => UNL) private UNLmap;

    //==================================
    // Claim Periods
    //==================================

    uint256 private genesisLedger;
    uint256 private claimPeriodLength;		// Number of ledgers in a claim period
    uint32 private finalityThreshold;

    // Hash of claim period => accounts that have registered this claim period
    mapping(bytes32 => mapping(address => bool)) private claimPeriodRegisteredBy;
    mapping(uint256 => bytes32) private finalisedClaimPeriods;
    uint256 private finalisedClaimPeriodIndex;

//====================================================================
// Constructor
//====================================================================

    constructor(uint256 _genesisLedger, uint256 _claimPeriodLength, uint32 _UNLsize, uint32 _finalityThreshold) payable {
        genesisLedger = _genesisLedger;
        claimPeriodLength = _claimPeriodLength;
        UNLsize = _UNLsize;
        finalityThreshold = _finalityThreshold;
        finalisedClaimPeriodIndex = 0;
    }

//====================================================================
// Functions
//====================================================================

    function updateUNL(address[] memory list) public {
        require(list.length == UNLsize, "Invalid UNL size");
        UNLmap[msg.sender].list = list;
        UNLmap[msg.sender].lastUpdated = block.number;
        if (UNLmap[msg.sender].exists != true) {
            UNLmap[msg.sender].exists = true;
            UNLmap[msg.sender].claimPeriodIndex = 0;
            UNLmap[msg.sender].ledger = genesisLedger;
        }
    }

    function getlatestIndex() public view returns (uint256 _genesisLedger, uint256 _claimPeriodIndex,
        uint256 _claimPeriodLength, uint256 _ledger, address _coinbase, address[] memory _UNL, uint256 _finalisedClaimPeriodIndex) {
        require(UNLmap[msg.sender].exists == true);

        return (genesisLedger, UNLmap[msg.sender].claimPeriodIndex, claimPeriodLength,
            UNLmap[msg.sender].ledger, block.coinbase, UNLmap[block.coinbase].list, finalisedClaimPeriodIndex);
    }

    function registerClaimPeriod(uint256 ledger, uint256 claimPeriodIndex, bytes32 claimPeriodHash) public returns (bool finality) {
        require(UNLmap[msg.sender].exists == true, 'msg.sender does not exist in UNLmap[]');
    	require(UNLmap[msg.sender].claimPeriodIndex == claimPeriodIndex, 'claimPeriodIndex incorrect');
        require(claimPeriodRegisteredBy[claimPeriodHash][msg.sender] == false, 'claimPeriodHash already registered');
        claimPeriodRegisteredBy[claimPeriodHash][msg.sender] = true;
        UNLmap[msg.sender].ledger = ledger;
        UNLmap[msg.sender].claimPeriodIndex = claimPeriodIndex+1;

        if (claimPeriodIndex <= finalisedClaimPeriodIndex) {
            return true;
        } else {
            if (computeFinality(claimPeriodHash) == true) {
                finalisedClaimPeriodIndex = claimPeriodIndex;
                return true;
            } else {
                return false;
            }
        }
    }

    function computeFinality(bytes32 claimPeriodHash) private view returns (bool finality) {
        require(UNLmap[block.coinbase].exists == true, 'UNLmap[block.coinbase].exists != true');
        uint32 outerRegistered = 0;
        uint32 innerRegistered1 = 0;
        uint32 innerRegistered2 = 0;
        // Compute quorum directly registered
        for (uint32 i=0; i<UNLsize; i++) {
            if (claimPeriodRegisteredBy[claimPeriodHash][UNLmap[block.coinbase].list[i]] == true) {
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
                    if (claimPeriodRegisteredBy[claimPeriodHash][UNLmap[UNLmap[block.coinbase].list[i]].list[j]] == true) {
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
                            if (claimPeriodRegisteredBy[claimPeriodHash][UNLmap[UNLmap[UNLmap[block.coinbase].list[i]].list[j]].list[k]] == true) {
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