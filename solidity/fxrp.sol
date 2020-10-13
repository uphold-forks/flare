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
        uint256     UNLupdateTime;
        uint256     claimPeriodIndex;
        uint256     ledger;
        uint256     agent;
        uint256     payloadSkipIndex;
        bytes32     pendingClaimPeriodHash;
    }
    uint256 private UNLsize;
    // UNL definitions
    mapping(address => UNL) private UNLmap;

    //==================================
    // Payloads -> application-specific logic
    //==================================

    struct Payload {
    	uint256 			ledger;
    	string 				txHash;
    	string				sender;
    	string				receiver;
    	uint256				amount;
    	address payable 	memo;
    }

    //==================================
    // Claims -> application-invariant interface to payloads
    //==================================

    struct Claim {
        bool        			 	exists;
        uint256     			 	timestamp;      // Timestamp of claim creation (first registration)
        bytes32     				hash;           // Hash of payload
        uint256     				claimPeriod;    // Claim period the claim exists in
        Payload     				payload;
    }
    // Hash of claim payload => claim
    mapping(bytes32 => Claim) private claimMap;

    // Hash of claim payload => accounts that have registered this claim
    mapping(bytes32 => mapping(address => bool)) private claimRegisteredBy;
        
    // accountClaimMap should be cleared upon every claim period finality as it contains 
    // redundant information. Need to be careful to not incur a gas cost in freeing up of
    // this storage that exceeds the block gas limit.

    // accountClaimMap[account][claimPeriodIndex][ledger][index] => Claim Hash
    mapping(address => mapping(uint256 => mapping(uint256 => bytes32[]))) private accountClaimMap;
   

    //==================================
    // Claim Periods
    //==================================

    uint256 private genesisLedger;
    uint256 private claimPeriodLength;		// Number of ledgers in a claim period
    uint256 private finalityThreshold;
    uint256 private finalisedClaimPeriodIndex;

    struct ClaimPeriod {
        bool                        	exists;
        bool                        	finalised;         // Finalised if registered by a quorum or
                                                    	   // accepted by a v-blocking set
        bytes32                     	hash;              // Hash of (num + claims[0].hash + ... + claims[max].hash + 
                                        	               //          prevHash + prevClaimPeriod.registeredBy)
        uint256                         ledger;
        uint256                     	num;               // Claim period number
        address                         firstRegisteredBy; // Account that first registered the claimPeriod
        uint256                         numRegistrations;
    }
    // Claim period mapping
    mapping(bytes32 => ClaimPeriod) private claimPeriodsMap;

    // Hash of claim period => accounts that have registered this claim period
    mapping(bytes32 => mapping(address => bool)) private claimPeriodRegisteredBy;

//====================================================================
// Constructor
//====================================================================

    constructor(uint256 _genesisLedger, uint256 _claimPeriodLength, uint256 _UNLsize, uint256 _finalityThreshold) payable {
        genesisLedger = _genesisLedger;
        claimPeriodLength = _claimPeriodLength;
        UNLsize = _UNLsize;
        finalityThreshold = _finalityThreshold;
        finalisedClaimPeriodIndex = 0;
    }

//====================================================================
// Functions
//====================================================================

    //==================================
    // Unique Node Lists (UNL)
    //==================================

    function updateUNL(address[] memory list) public {
        require(list.length == UNLsize, "Invalid UNL size");
        UNLmap[msg.sender].list = list;
        UNLmap[msg.sender].UNLupdateTime = block.timestamp;
        if (UNLmap[msg.sender].exists != true) {
            UNLmap[msg.sender].exists = true;
            UNLmap[msg.sender].claimPeriodIndex = 0;
            UNLmap[msg.sender].ledger = genesisLedger;
            UNLmap[msg.sender].agent = 0;
            UNLmap[msg.sender].payloadSkipIndex = 0;
            UNLmap[msg.sender].pendingClaimPeriodHash = keccak256(abi.encode(address(this), genesisLedger, claimPeriodLength, UNLsize, finalityThreshold, 'flare'));
        }
    }

    function bootstrap(address leader) public {
        UNLmap[msg.sender] = UNLmap[leader];
        UNLmap[msg.sender].UNLupdateTime = block.timestamp;
    }

    function getlatestIndex() public view returns (uint256 _genesisLedger, uint256 _claimPeriodIndex,
        uint256 _claimPeriodLength, uint256 _ledger, uint256 _agent, uint256 _payloadSkipIndex, address _coinbase, address[] memory _UNL, uint256 _finalisedClaimPeriodIndex) {
        require(UNLmap[msg.sender].exists == true);

        return (genesisLedger, UNLmap[msg.sender].claimPeriodIndex, claimPeriodLength,
            UNLmap[msg.sender].ledger, UNLmap[msg.sender].agent, UNLmap[msg.sender].payloadSkipIndex, block.coinbase, UNLmap[block.coinbase].list, finalisedClaimPeriodIndex);
    }

    //==================================
    // Payloads
    //==================================

    function registerPayloads(uint256 currClaimPeriodIndex, uint256 latestLedger, uint256[] memory ledgers, string[] memory txHashes, string[] memory senders, string[] memory receivers, uint256[] memory amounts, address payable[] memory memos, bool partialRegistration, uint256 agent, uint256 payloadSkipIndex) public returns (bool success) {
    	require(UNLmap[msg.sender].exists == true, "UNL definition does not exist.");
    	uint256 totalPayloads = ledgers.length;
    	require((txHashes.length == totalPayloads) && (senders.length == totalPayloads) && (receivers.length == totalPayloads) && (amounts.length == totalPayloads) && (memos.length == totalPayloads), 'Mismatched payload sizes.');
    	for (uint256 i = 0; i < totalPayloads; i++) {
    		registerPayload(ledgers[i], txHashes[i], senders[i], receivers[i], amounts[i], memos[i]);
    	}
        if (partialRegistration == false) {
            return registerClaimPeriod(currClaimPeriodIndex, latestLedger);
        } else {
            UNLmap[msg.sender].agent = agent;
            UNLmap[msg.sender].payloadSkipIndex = payloadSkipIndex;
            return true;
        }
    }

    function registerPayload(uint256 ledger, string memory txHash, string memory sender, string memory receiver, uint256 amount, address payable memo) private returns (bool success) {
        Payload memory payload = Payload(ledger, txHash, sender, receiver, amount, memo);
  		bytes32 hash = payloadHash(payload);
    	return registerClaim(ledger, hash, payload);
    }

    function payloadHash(Payload memory payload) pure internal returns (bytes32 result) {
        return keccak256(abi.encode(payload.ledger, payload.txHash, payload.sender, payload.receiver, payload.amount, payload.memo));
    }

    function settlePayload(Payload memory payload) private returns (bool success) {
    	if (payload.amount > 0) {
    		payload.memo.transfer(payload.amount);
    		return true;
    	}
    	return false;
    }

    //==================================
    // Claims
    //==================================

    function registerClaim(uint256 claimIndex, bytes32 hash, Payload memory payload) private returns (bool success) {
        uint256 claimPeriodIndex = UNLmap[msg.sender].claimPeriodIndex;
        // Check if claim already exists
        if (claimMap[hash].exists != true) {
            // Claim doesn't exist yet, create a new one
            Claim memory newClaim = Claim(true, block.timestamp, hash, claimPeriodIndex, payload);
            claimMap[hash] = newClaim;
        } else if (claimRegisteredBy[hash][msg.sender] == true) {
        	// This claim has already been registered by this state connector
        	return false;
        }
        accountClaimMap[msg.sender][claimPeriodIndex][claimIndex].push(hash);
        claimRegisteredBy[hash][msg.sender] = true;
        return true;
    }

    //==================================
    // Claim Period Registration
    //==================================

    function registerClaimPeriod(uint256 currClaimPeriodIndex, uint256 ledger) private returns (bool success) {
        require(UNLmap[msg.sender].exists == true, 'msg.sender does not exist in UNLmap[]');
    	require(UNLmap[msg.sender].claimPeriodIndex == currClaimPeriodIndex, 'claimPeriodIndex incorrect');
        UNLmap[msg.sender].ledger = ledger;
        UNLmap[msg.sender].agent = 0;
        UNLmap[msg.sender].payloadSkipIndex = 0;

        // Get claimPeriodHash 
        bytes32 claimPeriodHash = keccak256(abi.encode(UNLmap[msg.sender].pendingClaimPeriodHash, currClaimPeriodIndex, 'flare'));
        for (uint256 i=ledger-claimPeriodLength; i<ledger; i++) {
        	// If there are any transactions in this ledger, include them in the
        	// claimPeriodHash calculation
        	if (accountClaimMap[msg.sender][currClaimPeriodIndex][i].length > 0) {
        		claimPeriodHash = keccak256(abi.encode(claimPeriodHash, accountClaimMap[msg.sender][currClaimPeriodIndex][i]));
			}
        }
        // Check if this claimPeriod has already been registered
        if (claimPeriodsMap[claimPeriodHash].exists != true) {
            claimPeriodsMap[claimPeriodHash] = ClaimPeriod(true, false, claimPeriodHash, ledger, currClaimPeriodIndex, msg.sender, 0);
        } 
        claimPeriodRegisteredBy[claimPeriodHash][msg.sender] = true;
        claimPeriodsMap[claimPeriodHash].numRegistrations = claimPeriodsMap[claimPeriodHash].numRegistrations + 1;
        UNLmap[msg.sender].claimPeriodIndex = currClaimPeriodIndex+1;

        if (currClaimPeriodIndex > 0) {
            if (claimPeriodsMap[claimPeriodHash].numRegistrations > UNLsize - finalityThreshold && claimPeriodsMap[UNLmap[msg.sender].pendingClaimPeriodHash].numRegistrations > UNLsize - finalityThreshold) {
                if (computeFinality(claimPeriodHash) == true) {
                    if (computeFinality(UNLmap[msg.sender].pendingClaimPeriodHash) == true && claimPeriodsMap[UNLmap[msg.sender].pendingClaimPeriodHash].finalised == false) {
                        finaliseClaimPeriod(UNLmap[msg.sender].pendingClaimPeriodHash);
                    }
                }
            }
        }
        UNLmap[msg.sender].pendingClaimPeriodHash = claimPeriodHash;
        return true;
    }

    function computeFinality(bytes32 claimPeriodHash) private view returns (bool finality) {
        require(claimPeriodsMap[claimPeriodHash].exists == true);
        require(UNLmap[block.coinbase].exists == true);
        // Check if a quorum of nodes from your perspective has at least 
        // REGISTERED the claimPeriodHash. If yes -> Then you ACCEPT the 
        // claimPeriodHash. 
        return computeRegistrations(UNLmap[block.coinbase].list, claimPeriodHash);
    }

    function computeRegistrations(address[] memory nodes, bytes32 claimPeriodHash) private view returns (bool quorum) {
        uint256 outerRegistered = 0;
        for (uint256 i=0; i<UNLsize; i++) {
            uint256 innerRegistered = 0;
            if (UNLmap[nodes[i]].exists == true) {
                for (uint256 j=0; j<UNLsize; j++) {
                    if (claimPeriodRegisteredBy[claimPeriodHash][UNLmap[nodes[i]].list[j]] == true) {
                        innerRegistered = innerRegistered + 1;
                    }
                }
                if (uint(2)*innerRegistered > UNLsize) {
                    outerRegistered = outerRegistered + 1;
                }
            }
        }
        if (outerRegistered >= finalityThreshold) {
            return true;
        } else {
            return false;
        }
    }

    function finaliseClaimPeriod(bytes32 claimPeriodHash) private returns (bool success) {
        for (uint256 i=claimPeriodsMap[claimPeriodHash].ledger-claimPeriodLength; i<claimPeriodsMap[claimPeriodHash].ledger; i++) {
            for (uint256 j=0; j<accountClaimMap[claimPeriodsMap[claimPeriodHash].firstRegisteredBy][claimPeriodsMap[claimPeriodHash].num][i].length; j++) {
                settlePayload(claimMap[accountClaimMap[claimPeriodsMap[claimPeriodHash].firstRegisteredBy][claimPeriodsMap[claimPeriodHash].num][i][j]].payload);
            }
        }
        claimPeriodsMap[claimPeriodHash].finalised = true;
        finalisedClaimPeriodIndex = finalisedClaimPeriodIndex + 1;
        return true;
    }    
}