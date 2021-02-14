// SPDX-License-Identifier: MIT
pragma solidity ^0.7.3;
pragma experimental ABIEncoderV2;

contract stateConnector {

//====================================================================
// Data Structures
//====================================================================
    
    address private governanceContract;
    bool private initialised;

    struct Chain {
        bool        exists;
        uint64      genesisLedger;
        uint16      claimPeriodLength; // Number of ledgers in a claim period
        uint16		numConfirmations; // Number of confirmations required to consider this claim period finalised
        uint64      finalisedClaimPeriodIndex;
        uint64      finalisedLedgerIndex;
        uint256     finalisedTimestamp;
        uint256     timeDiffExpected;
        uint256     timeDiffAvg;
    }

    struct HashExists {
        bool        exists;
        bytes32     hash;
        uint256		timestamp;
    }

    // Chain ID mapping to Chain struct
    mapping(uint32 => Chain) private chains;
    // Location hash => claim period
    mapping(bytes32 => HashExists) private finalisedClaimPeriods;
    // Finalised payment hashes
    mapping(bytes32 => HashExists) private finalisedPayments;
    // Mapping of how many claim periods an address has successfully mined
    mapping(address => uint64) private claimPeriodsMined;
    
//====================================================================
// Constructor for pre-compiled code
//====================================================================

    constructor() {
    }

    function initialiseChains() public returns (bool success) {
        require(initialised == false, 'initialised != false');
        governanceContract = 0x1000000000000000000000000000000000000000;
        chains[0] = Chain(true, 61050250, 30, 0, 0, 61050250, block.timestamp, 120, 0); //XRP
        initialised = true;
        return true;
    }

//====================================================================
// Functions
//====================================================================  

    function getGovernanceContract() public view returns (address _governanceContract) {
        return governanceContract;
    }

    function setGovernanceContract(address _governanceContract) public returns (bool success) {
        require(msg.sender == governanceContract, 'msg.sender != governanceContract');
        governanceContract = _governanceContract;
        return true;
    }

    function addChain(uint32 chainId, uint64 genesisLedger, uint16 claimPeriodLength, uint16 numConfirmations, uint256 timeDiffExpected) public returns (bool success) {
        require(msg.sender == governanceContract, 'msg.sender != governanceContract');
        require(chains[chainId].exists == false, 'chainId already exists');
        require(claimPeriodLength > 0, 'claimPeriodLength == 0');
        chains[chainId] = Chain(true, genesisLedger, claimPeriodLength, numConfirmations, 0, genesisLedger, block.timestamp, timeDiffExpected, 0);
        return true;
    }

    function updateChainTiming(uint32 chainId, uint256 timeDiffExpected) public returns (bool success) {
        require(msg.sender == governanceContract, 'msg.sender != governanceContract');
        require(chains[chainId].exists == true, 'chainId does not exist');
        chains[chainId].timeDiffExpected = timeDiffExpected;
        return true;
    }

    function getClaimPeriodsMined(address miner) public view returns (uint64 numMined) {
        return claimPeriodsMined[miner];
    }

    function getLatestIndex(uint32 chainId) public view returns (uint64 genesisLedger, uint64 finalisedClaimPeriodIndex, uint16 claimPeriodLength, uint16 numConfirmations, uint64 finalisedLedgerIndex, uint256 finalisedTimestamp, uint256 timeDiffAvg) {
        require(chains[chainId].exists == true, 'chainId does not exist');
        return (chains[chainId].genesisLedger, chains[chainId].finalisedClaimPeriodIndex, chains[chainId].claimPeriodLength, chains[chainId].numConfirmations, chains[chainId].finalisedLedgerIndex, chains[chainId].finalisedTimestamp, chains[chainId].timeDiffAvg);
    }

    function getClaimPeriodIndexFinality(uint32 chainId, uint64 claimPeriodIndex) public view returns (bool finality) {
        require(chains[chainId].exists == true, 'chainId does not exist');
        bytes32 locationHash =  keccak256(abi.encodePacked(
                                    keccak256(abi.encodePacked(chainId)),
                                    keccak256(abi.encodePacked(claimPeriodIndex))
                                ));
        return (finalisedClaimPeriods[locationHash].exists);
    }

    function proveClaimPeriodFinality(uint32 chainId, uint64 ledger, uint64 claimPeriodIndex, bytes32 claimPeriodHash) public returns (uint32 _chainId, uint64 _ledger, uint16 _numConfirmations, bytes32 _claimPeriodHash) {
        require(msg.sender == tx.origin, 'msg.sender != tx.origin');
        require(chains[chainId].exists == true, 'chainId does not exist');
        require(ledger == chains[chainId].finalisedLedgerIndex + chains[chainId].claimPeriodLength, 'invalid ledger');
        require(ledger == chains[chainId].genesisLedger + (claimPeriodIndex+1)*chains[chainId].claimPeriodLength, 'invalid claimPeriodIndex');
        require(block.timestamp > chains[chainId].finalisedTimestamp, 'block.timestamp <= chains[chainId].finalisedTimestamp');
        if (2*chains[chainId].timeDiffAvg < chains[chainId].timeDiffExpected) {
        	require(3*(block.timestamp-chains[chainId].finalisedTimestamp) >= 2*chains[chainId].timeDiffAvg, 'not enough time elapsed since prior finality');
        } else {
        	require(block.timestamp-chains[chainId].finalisedTimestamp+15 >= chains[chainId].timeDiffAvg, 'not enough time elapsed since prior finality');
        }
        bytes32 locationHash =  keccak256(abi.encodePacked(
                                    keccak256(abi.encodePacked(chainId)),
                                    keccak256(abi.encodePacked(claimPeriodIndex))
                                ));
        require(finalisedClaimPeriods[locationHash].exists == false, 'locationHash already finalised');
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
            finalisedClaimPeriods[locationHash] = HashExists(true, claimPeriodHash, block.timestamp);
            chains[chainId].finalisedClaimPeriodIndex = claimPeriodIndex+1;
            chains[chainId].finalisedLedgerIndex = ledger;
            uint256 timeDiffAvgUpdate = (chains[chainId].timeDiffAvg + (block.timestamp-chains[chainId].finalisedTimestamp))/2;
            if (timeDiffAvgUpdate > 2*chains[chainId].timeDiffExpected) {
                chains[chainId].timeDiffAvg = 2*chains[chainId].timeDiffExpected;
            } else {
                chains[chainId].timeDiffAvg = timeDiffAvgUpdate;
            }
            chains[chainId].finalisedTimestamp = block.timestamp;
        }
        return (chainId, ledger-1, chains[chainId].numConfirmations, claimPeriodHash);
    }

    function getClaimPeriodFinality(bytes32 claimPeriodHash, uint32 chainId, uint64 claimPeriodIndex) private view returns (uint256 timestamp) {
        require(chains[chainId].exists == true, 'chainId does not exist');
        bytes32 locationHash =  keccak256(abi.encodePacked(
                                    keccak256(abi.encodePacked(chainId)),
                                    keccak256(abi.encodePacked(claimPeriodIndex))
                                ));
        require(finalisedClaimPeriods[locationHash].exists == true, 'finalisedClaimPeriods[locationHash] does not exist');
        require(finalisedClaimPeriods[locationHash].hash == claimPeriodHash, 'Invalid claimPeriodHash');
        return finalisedClaimPeriods[locationHash].timestamp;
    }

    function provePaymentFinality(uint32 chainId, uint64 claimPeriodIndex, bytes32 claimPeriodHash, bytes32 paymentHash, string memory txId) public returns (uint32 _chainId, uint64 finalisedLedgerIndex, bytes32 _paymentHash, string memory _txId) {
    	require(msg.sender == tx.origin, 'msg.sender != tx.origin');
        require(chains[chainId].exists == true, 'chainId does not exist');
        bytes32 txIdHash = keccak256(abi.encodePacked(txId));
        require(finalisedPayments[txIdHash].exists == false, 'txId already proven');
        uint256 timestamp = getClaimPeriodFinality(claimPeriodHash, chainId, claimPeriodIndex);
        require(block.coinbase == msg.sender || block.coinbase == address(0x0100000000000000000000000000000000000000), 'Invalid block.coinbase value');
        if (block.coinbase == msg.sender && block.coinbase != address(0x0100000000000000000000000000000000000000)) {
        	finalisedPayments[txIdHash] = HashExists(true, paymentHash, timestamp);
        }
        return (chainId, chains[chainId].finalisedLedgerIndex, paymentHash, txId);
    }

    function getPaymentFinality(bytes32 txId, uint64 ledger, bytes32 sourceHash, bytes32 destinationHash, uint64 destinationTag, uint64 amount) public view returns (bool finality, uint256 timestamp) {
        require(finalisedPayments[txId].exists == true, 'txId does not exist');
        bytes32 paymentHash = keccak256(abi.encodePacked(
        							txId,
        							keccak256(abi.encode(ledger)),
        							sourceHash,
        							destinationHash,
        							keccak256(abi.encode(destinationTag)),
        							keccak256(abi.encode(amount))));
    	require(finalisedPayments[txId].hash == paymentHash, 'invalid paymentHash');
    	return (true, finalisedPayments[txId].timestamp);
    }
}