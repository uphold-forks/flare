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

    struct UNLpointer {
        bool        exists;
        bytes32     pointer;
        bytes32     updatedPointer;
        uint256     createdBlock;
        uint256     updatedBlock;
    }

    struct UNLdefinition {
        bool        exists;
        address[]   list;
        uint256     createdBlock;
        uint256     updatedBlock;
    }

    // UNL definitions
    mapping(address => UNLpointer) private UNLpointerMap;
    mapping(bytes32 => UNLdefinition) private UNLdefinitionMap;

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

    constructor(uint256 _genesisLedger, uint256 _claimPeriodLength) {
        genesisLedger = _genesisLedger;
        claimPeriodLength = _claimPeriodLength;
        finalisedClaimPeriodIndex = 0;
        finalisedLedgerIndex = _genesisLedger;
    }

//====================================================================
// Functions
//====================================================================

    // function getLedgerClaimPeriodHash(uint256 ledger) private view returns (bytes32 finalisedClaimPeriodHash) {
    //     require(ledger >= genesisLedger, 'ledger < genesisLedger');
    //     require(ledger < finalisedLedgerIndex, 'ledger >= finalisedLedgerIndex');
    //     uint256 currClaimPeriodIndex = (ledger - genesisLedger)/claimPeriodLength;
    //     return finalisedClaimPeriods[keccak256(abi.encodePacked('flare', keccak256(abi.encodePacked('ledger', genesisLedger + currClaimPeriodIndex*claimPeriodLength)), keccak256(abi.encodePacked('claimPeriodIndex', currClaimPeriodIndex))))];        
    // }

    // function verifyMerkleProof(bytes32 root, bytes32 leaf, bytes32[] memory proof) private pure returns (bool) {
    //     bytes32 computedHash = leaf;
    //     for (uint256 i = 0; i < proof.length; i++) {
    //         bytes32 proofElement = proof[i];
    //         if (computedHash < proofElement) {
    //             // Hash(current computed hash + current element of the proof)
    //             computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
    //         } else {
    //             // Hash(current element of the proof + current computed hash)
    //             computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
    //         }
    //     }
    //     // Check if the computed hash (root) is equal to the provided root
    //     return computedHash == root;
    // }

    // function provePaymentFinality(uint256 ledger, string memory txHash, string memory sender, string memory receiver, uint256 amount, address memo, bytes32 memory proof) public view returns (bool) {
    //     bytes32 leaf = sha3(abi.encodePacked(
    //         sha3('ledger', item.tx.inLedger),
    //         sha3('txHash', item.tx.hash),
    //         sha3('sender', item.tx.Account),
    //         sha3('destination', item.tx.Destination),
    //         sha3('amount', item.tx.Amount),
    //         sha3('memo', memo))
    //     );



    // }

    function updateUNLpointer(address[] memory list) public {
        bytes32 hash = keccak256(abi.encodePacked('flare', list));
        if (UNLpointerMap[msg.sender].exists != true) {
            UNLpointerMap[msg.sender] = UNLpointer(true, hash, hash, block.number, block.number);
        } else {
            UNLpointerMap[msg.sender].pointer = hash;
            UNLpointerMap[msg.sender].updatedPointer = hash;
            UNLpointerMap[msg.sender].updatedBlock = block.number;
        }
        if (UNLdefinitionMap[hash].exists != true) {
            UNLdefinitionMap[hash] = UNLdefinition(true, list, block.number, block.number);
        }
    }

    function updateUNLdefinition(address[] memory list) public {
        require(UNLdefinitionMap[UNLpointerMap[msg.sender].pointer].exists == true, 'UNL definition does not exist.');
        bytes32 hash = keccak256(abi.encodePacked('flare', list));
        UNLpointerMap[msg.sender].updatedPointer = hash;
        uint32 updateCount = 0;
        for (uint32 i=0; i<UNLdefinitionMap[UNLpointerMap[msg.sender].pointer].list.length; i++) {
            if (UNLpointerMap[UNLdefinitionMap[UNLpointerMap[msg.sender].pointer].list[i]].updatedPointer == hash) {
                updateCount = updateCount + 1;
            }
        }
        if (uint(3)*updateCount >= uint(2)*UNLdefinitionMap[UNLpointerMap[msg.sender].pointer].list.length + 1) {
            UNLdefinitionMap[UNLpointerMap[msg.sender].pointer].list = list;
            UNLdefinitionMap[UNLpointerMap[msg.sender].pointer].updatedBlock = block.number;
        }
    }

    function getlatestIndex() public view returns (uint256 _genesisLedger, uint256 _claimPeriodIndex,
        uint256 _claimPeriodLength, uint256 _ledger, address _coinbase, address[] memory _UNL) {
        require(UNLdefinitionMap[UNLpointerMap[block.coinbase].pointer].exists == true, 'UNL definition does not exist.');
        return (genesisLedger, finalisedClaimPeriodIndex, claimPeriodLength,
            finalisedLedgerIndex, block.coinbase, UNLdefinitionMap[UNLpointerMap[block.coinbase].pointer].list);
    }

    function checkIfRegistered(uint256 ledger, uint256 claimPeriodIndex, bytes32 claimPeriodHash) public view returns (bool registered) {
        require(UNLdefinitionMap[UNLpointerMap[msg.sender].pointer].exists == true, 'UNL definition does not exist.');
        bytes32 locationHash = keccak256(abi.encodePacked('flare', keccak256(abi.encodePacked('ledger', ledger)), keccak256(abi.encodePacked('claimPeriodIndex', claimPeriodIndex))));
        bytes32 registrationHash = keccak256(abi.encodePacked(locationHash, claimPeriodHash));
        if (claimPeriodRegisteredBy[registrationHash][msg.sender] == true) {
            return true;
        } else {
            return false;
        }
    }

    function registerClaimPeriod(uint256 ledger, uint256 claimPeriodIndex, bytes32 claimPeriodHash) public returns (bool finality) {
        require(UNLdefinitionMap[UNLpointerMap[msg.sender].pointer].exists == true, 'UNL definition does not exist.');
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

    function getLocalFinality(bytes32 registrationHash) private view returns (bool finality) {
        require(UNLdefinitionMap[UNLpointerMap[block.coinbase].pointer].exists == true, 'UNL definition does not exist.');
        uint32 registered = 0;
        for (uint32 i=0; i<UNLdefinitionMap[UNLpointerMap[block.coinbase].pointer].list.length; i++) {
            if (claimPeriodRegisteredBy[registrationHash][UNLdefinitionMap[UNLpointerMap[block.coinbase].pointer].list[i]] == true) {
                registered = registered + 1;
            }
            if (uint(2)*registered > UNLdefinitionMap[UNLpointerMap[block.coinbase].pointer].list.length) {
                return true;
            }
        }
        return false;
    }

}