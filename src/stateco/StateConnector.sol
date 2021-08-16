// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

contract StateConnector {

    enum DataAvailPeriodFinalityType {
        PROPOSED,
        LOW_FINALISED_CLAIM_PERIOD_INDEX,
        REWARDED,
        BANNED
    }

//====================================================================
// Data Structures
//====================================================================

    struct Chain {
        bool        exists;
        uint64      genesisLedger;
        // Range of ledgers below finalisedLedgerIndex that can be searched when proving a payment
        uint64      ledgerHistorySize;
        // Number of ledgers in a claim period
        uint16      dataAvailPeriodLength; 
        // Number of confirmations required to consider this claim period finalised
        uint16      numConfirmations; 
        uint64      finalisedDataAvailPeriodIndex;
        uint64      finalisedLedgerIndex;
        uint256     finalisedTimestamp;
        uint256     timeDiffExpected;
        uint256     timeDiffAvg;
    }

    struct HashExists {
        bool        exists;
        bytes32     dataAvailPeriodHash;
        bytes32     commitHash;
        uint256     commitTime;
        uint256     permittedRevealTime;
        bytes32     revealHash;
        uint64      index;
        uint64      indexSearchRegion;
        bool        proven;
        address     provenBy;
    }

    address internal constant GENESIS_COINBASE = address(0x0100000000000000000000000000000000000000);
    bool public initialised;
    uint32 public numChains;
    uint256 public initialiseTime;
    uint64 public rewardPeriodTimespan;

    // Chain ID mapping to Chain struct
    mapping(uint32 => Chain) public chains;
    // msg.sender => Location hash => claim period
    mapping(address => mapping(bytes32 => HashExists)) public proposedProofs;
    // Location hash => claim period
    mapping(bytes32 => HashExists) public finalisedDataAvailPeriods;
    // Finalised payment hashes
    mapping(uint32 => mapping(bytes32 => HashExists)) public finalisedPayments;
    // Mapping of how many claim periods an address has successfully mined
    mapping(address => mapping(uint256 => uint64)) public dataAvailPeriodsMined;
    // Mapping of how many claim periods were successfully mined
    mapping(uint256 => uint64) public totalDataAvailPeriodsMined;
    // Data avail provers are banned temporarily for submitting chainTipHash values that do not ultimately
    // become accepted, if their submitted chainTipHash value is accepted then they will earn a reward
    mapping(address => uint256) public senderBannedUntil;

//====================================================================
// Events
//====================================================================

    event DataAvailPeriodFinalityProved(uint32 chainId, uint64 ledger, DataAvailPeriodFinalityType finType, address sender);
    event PaymentFinalityProved(uint32 chainId, uint64 ledger, string txId, bytes32 paymentHash, address sender);
    event PaymentFinalityDisproved(uint32 chainId, uint64 ledger, string txId, bytes32 paymentHash, address sender);

//====================================================================
// Modifiers
//====================================================================

    modifier chainExists(uint32 chainId) {
        require(chains[chainId].exists, "chainId does not exist");
        _;
    }

    modifier senderNotBanned() {
        require(block.timestamp > senderBannedUntil[msg.sender], 
            "msg.sender is currently banned for sending an unaccepted chainTipHash");
        _;
    }

//====================================================================
// Constructor for genesis-deployed code
//====================================================================

    constructor() {
    }

    function initialiseChains() external returns (bool success) {
        require(!initialised, "initialised != false");
        chains[0] = Chain(true, 689300, 0, 1, 4, 0, 689300, block.timestamp, 900, 0); //BTC
        chains[1] = Chain(true, 2086110, 0, 1, 12, 0, 2086110, block.timestamp, 150, 0); //LTC
        chains[2] = Chain(true, 3768500, 0, 2, 40, 0, 3768500, block.timestamp, 120, 0); //DOGE
        chains[3] = Chain(true, 62880000, 0, 30, 1, 0, 62880000, block.timestamp, 120, 0); //XRP
        chains[4] = Chain(true, 35863000, 0, 20, 1, 0, 35863000, block.timestamp, 120, 0); //XLM
        numChains = 5;
        rewardPeriodTimespan = 7 days; //604800
        initialiseTime = block.timestamp;
        initialised = true;
        return true;
    }

//====================================================================
// Functions
//====================================================================  

    function proveDataAvailPeriodFinality(
        uint32 chainId,
        uint64 ledger,
        bytes32 dataAvailPeriodHash,
        bytes32 chainTipHash
    ) external chainExists(chainId) senderNotBanned returns (
        uint32 _chainId,
        uint64 _ledger,
        uint16 _numConfirmations,
        bytes32 _dataAvailPeriodHash
    ) {
        require(dataAvailPeriodHash > 0x0, "dataAvailPeriodHash == 0x0");
        require(chainTipHash > 0x0, "chainTipHash == 0x0");
        require(block.coinbase == msg.sender || block.coinbase == GENESIS_COINBASE, "invalid block.coinbase value");
        require(ledger == chains[chainId].finalisedLedgerIndex + chains[chainId].dataAvailPeriodLength, "invalid ledger");
        require(block.timestamp > chains[chainId].finalisedTimestamp, 
            "block.timestamp <= chains[chainId].finalisedTimestamp");
        if (2 * chains[chainId].timeDiffAvg < chains[chainId].timeDiffExpected) {
            require(3 * (block.timestamp - chains[chainId].finalisedTimestamp) >= 2 * chains[chainId].timeDiffAvg, 
                "not enough time elapsed since prior finality");
        } else {
            require(block.timestamp - chains[chainId].finalisedTimestamp + 15 >= chains[chainId].timeDiffAvg, 
                "not enough time elapsed since prior finality");
        }

        bytes32 locationHash = keccak256(abi.encodePacked(chainId, chains[chainId].finalisedDataAvailPeriodIndex));
        require(!finalisedDataAvailPeriods[locationHash].proven, "locationHash already finalised");

        if (chains[chainId].finalisedDataAvailPeriodIndex > 0) {
            bytes32 prevLocationHash = keccak256(abi.encodePacked(
                    chainId, chains[chainId].finalisedDataAvailPeriodIndex - 1));
            require(finalisedDataAvailPeriods[prevLocationHash].proven, "previous claim period not yet finalised");
        }

        if (proposedProofs[msg.sender][locationHash].exists) {
            require(block.timestamp >= proposedProofs[msg.sender][locationHash].permittedRevealTime, 
                "block.timestamp < proposedProofs[msg.sender][locationHash].permittedRevealTime");
            require(proposedProofs[msg.sender][locationHash].commitHash == 
                keccak256(abi.encodePacked(msg.sender, chainTipHash)), 
                "invalid chainTipHash");
        } else if (block.coinbase != msg.sender && block.coinbase == GENESIS_COINBASE) {
            dataAvailPeriodHash = 0x0;
        }

        if (block.coinbase == msg.sender && block.coinbase != GENESIS_COINBASE) {
            if (!proposedProofs[msg.sender][locationHash].exists) {
                proposedProofs[msg.sender][locationHash] = HashExists(
                    true,
                    dataAvailPeriodHash,
                    chainTipHash,
                    block.timestamp,
                    block.timestamp + chains[chainId].timeDiffAvg / 2,
                    0x0,
                    ledger,
                    0,
                    false,
                    address(0x0)
                );
                emit DataAvailPeriodFinalityProved(chainId, ledger, DataAvailPeriodFinalityType.PROPOSED, msg.sender);
            } else {
                // Node checked dataAvailPeriodHash, and it was valid
                // Now determine whether to reward or ban the sender of the suggested chainTipHash
                // from 'numConfirmations' dataAvailPeriodIndexes ago
                if (chains[chainId].finalisedDataAvailPeriodIndex > chains[chainId].numConfirmations) {
                    bytes32 prevLocationHash = keccak256(abi.encodePacked(
                        chainId, chains[chainId].finalisedDataAvailPeriodIndex - chains[chainId].numConfirmations));
                    if (finalisedDataAvailPeriods[prevLocationHash].revealHash == dataAvailPeriodHash) {
                        // Reward
                        uint256 currentRewardPeriod = getRewardPeriod();
                        dataAvailPeriodsMined[finalisedDataAvailPeriods[prevLocationHash].provenBy][currentRewardPeriod] += 1; 
                        totalDataAvailPeriodsMined[currentRewardPeriod] += 1;
                        emit DataAvailPeriodFinalityProved(chainId, ledger, DataAvailPeriodFinalityType.REWARDED, 
                            finalisedDataAvailPeriods[prevLocationHash].provenBy);
                    } else {
                        // Temporarily ban
                        senderBannedUntil[finalisedDataAvailPeriods[prevLocationHash].provenBy] = 
                            block.timestamp + chains[chainId].numConfirmations * chains[chainId].timeDiffExpected;
                        emit DataAvailPeriodFinalityProved(chainId, ledger, DataAvailPeriodFinalityType.BANNED, 
                            finalisedDataAvailPeriods[prevLocationHash].provenBy);
                    }
                } else {
                    // this is only true for the first few method calls 
                    emit DataAvailPeriodFinalityProved(chainId, ledger, 
                        DataAvailPeriodFinalityType.LOW_FINALISED_CLAIM_PERIOD_INDEX, msg.sender);
                }

                finalisedDataAvailPeriods[locationHash] = HashExists(
                    true,
                    dataAvailPeriodHash,
                    0x0,
                    proposedProofs[msg.sender][locationHash].commitTime,
                    block.timestamp,
                    chainTipHash,
                    ledger,
                    0,
                    true,
                    msg.sender
                );

                chains[chainId].finalisedDataAvailPeriodIndex += 1;
                chains[chainId].finalisedLedgerIndex = ledger;

                uint256 timeDiffAvgUpdate = (proposedProofs[msg.sender][locationHash].commitTime -
                    chains[chainId].finalisedTimestamp + chains[chainId].timeDiffAvg) / 2;
                if (timeDiffAvgUpdate > 2 * chains[chainId].timeDiffExpected) {
                    chains[chainId].timeDiffAvg = 2 * chains[chainId].timeDiffExpected;
                } else {
                    chains[chainId].timeDiffAvg = timeDiffAvgUpdate;
                }

                chains[chainId].finalisedTimestamp = proposedProofs[msg.sender][locationHash].commitTime;
            }
        }
        return (chainId, ledger - 1, chains[chainId].numConfirmations, dataAvailPeriodHash);
    }

    // If ledger == payment's ledger -> return true
    function provePaymentFinality(
        uint32 chainId,
        bytes32 paymentHash,
        uint64 ledger,
        string memory txId
    ) external chainExists(chainId) returns (
        uint32 _chainId,
        uint64 _ledger,
        uint64 _finalisedLedgerIndex,
        bytes32 _paymentHash,
        string memory _txId
    ) {
        bytes32 txIdHash = keccak256(abi.encodePacked(txId));
        require(!finalisedPayments[chainId][txIdHash].proven, "txId already proven");
        require(ledger < chains[chainId].finalisedLedgerIndex, "ledger >= chains[chainId].finalisedLedgerIndex");

        uint64 indexSearchRegion = chains[chainId].genesisLedger;
        if (chains[chainId].ledgerHistorySize > 0) {
            require(chains[chainId].finalisedLedgerIndex - chains[chainId].genesisLedger > 
                chains[chainId].ledgerHistorySize, 
                "finalisedLedgerIndex - genesisLedger <= ledgerHistorySize");
            indexSearchRegion = chains[chainId].finalisedLedgerIndex - chains[chainId].ledgerHistorySize;
        }
        require(ledger >= indexSearchRegion, "ledger < indexSearchRegion");
        require(block.coinbase == msg.sender || block.coinbase == GENESIS_COINBASE, "invalid block.coinbase value");

        if (block.coinbase == msg.sender && block.coinbase != GENESIS_COINBASE) {
            finalisedPayments[chainId][txIdHash] = HashExists(
                true, 
                0x0, 
                0x0,
                0, 
                block.timestamp, 
                paymentHash, 
                ledger, 
                indexSearchRegion, 
                true,
                msg.sender
            );
            emit PaymentFinalityProved(chainId, ledger, txId, paymentHash, msg.sender);
        }
        return (chainId, ledger, chains[chainId].finalisedLedgerIndex, paymentHash, txId);
    }

    // If ledger < payment's ledger or payment does not exist within data-available region -> return true
    function disprovePaymentFinality(
        uint32 chainId,
        bytes32 paymentHash,
        uint64 ledger,
        string memory txId
    ) external chainExists(chainId) returns (
        uint32 _chainId,
        uint64 _ledger,
        uint64 _finalisedLedgerIndex,
        bytes32 _paymentHash,
        string memory _txId
    ) {
        bytes32 txIdHash = keccak256(abi.encodePacked(txId));
        require(!finalisedPayments[chainId][txIdHash].proven, "txId already proven");
        require(finalisedPayments[chainId][txIdHash].index < ledger,
            "finalisedPayments[chainId][txIdHash].index >= ledger");
        require(ledger < chains[chainId].finalisedLedgerIndex, "ledger >= chains[chainId].finalisedLedgerIndex");

        uint64 indexSearchRegion = chains[chainId].genesisLedger;
        if (chains[chainId].ledgerHistorySize > 0) {
            require(chains[chainId].finalisedLedgerIndex - chains[chainId].genesisLedger > 
                chains[chainId].ledgerHistorySize,
                "finalisedLedgerIndex - genesisLedger <= ledgerHistorySize");
            indexSearchRegion = chains[chainId].finalisedLedgerIndex - chains[chainId].ledgerHistorySize;
        }
        require(ledger >= indexSearchRegion, "ledger < indexSearchRegion");
        require(block.coinbase == msg.sender || block.coinbase == GENESIS_COINBASE, "invalid block.coinbase value");

        if (block.coinbase == msg.sender && block.coinbase != GENESIS_COINBASE) {
            finalisedPayments[chainId][txIdHash] = HashExists(
                true, 
                0x0, 
                0x0,
                0, 
                block.timestamp, 
                paymentHash, 
                ledger, 
                indexSearchRegion, 
                false,
                msg.sender
            );
            emit PaymentFinalityDisproved(chainId, ledger, txId, paymentHash, msg.sender);
        }

        return (chainId, ledger, chains[chainId].finalisedLedgerIndex, paymentHash, txId);
    }
    
    function getDataAvailPeriodsMined(address miner, uint256 rewardSchedule) external view returns (uint64 numMined) {
        return dataAvailPeriodsMined[miner][rewardSchedule];
    }

    function getTotalDataAvailPeriodsMined(uint256 rewardSchedule) external view returns (uint64 numMined) {
        return totalDataAvailPeriodsMined[rewardSchedule];
    }

    function getLatestIndex(uint32 chainId) external view chainExists(chainId) returns (
        uint64 genesisLedger,
        uint64 finalisedDataAvailPeriodIndex,
        uint16 dataAvailPeriodLength,
        uint64 finalisedLedgerIndex,
        uint256 finalisedTimestamp,
        uint256 timeDiffAvg
    ) {
        finalisedTimestamp = chains[chainId].finalisedTimestamp;
        timeDiffAvg = chains[chainId].timeDiffAvg;

        bytes32 locationHash = keccak256(abi.encodePacked(chainId, chains[chainId].finalisedDataAvailPeriodIndex));
        if (proposedProofs[msg.sender][locationHash].exists) {
            finalisedTimestamp = 0;
            timeDiffAvg = proposedProofs[msg.sender][locationHash].permittedRevealTime;
        }

        return (
            chains[chainId].genesisLedger,
            chains[chainId].finalisedDataAvailPeriodIndex,
            chains[chainId].dataAvailPeriodLength,
            chains[chainId].finalisedLedgerIndex,
            finalisedTimestamp,
            timeDiffAvg
        );
    }

    function getDataAvailPeriodIndexFinality(
        uint32 chainId,
        uint64 dataAvailPeriodIndex
    ) external view chainExists(chainId) returns (bool finality) {
        bytes32 locationHash = keccak256(abi.encodePacked(chainId, dataAvailPeriodIndex));
        return (finalisedDataAvailPeriods[locationHash].exists);
    }

    function getPaymentFinality(
        uint32 chainId,
        bytes32 txId,
        bytes32 destinationHash,
        uint64 amount,
        bytes32 currencyHash
    ) external view chainExists(chainId) returns (
        uint64 ledger,
        uint64 indexSearchRegion,
        bool finality
    ) {
        require(finalisedPayments[chainId][txId].exists, "txId does not exist");
        bytes32 paymentHash = keccak256(abi.encodePacked(
            txId,
            destinationHash,
            keccak256(abi.encode(amount)),
            currencyHash));
        require(finalisedPayments[chainId][txId].revealHash == paymentHash, "invalid paymentHash");

        return (
            finalisedPayments[chainId][txId].index,
            finalisedPayments[chainId][txId].indexSearchRegion,
            finalisedPayments[chainId][txId].proven
        );
    }

    function getRewardPeriod() public view returns (uint256 rewardSchedule) {
        require(block.timestamp > initialiseTime, "block.timestamp <= initialiseTime");
        return (block.timestamp - initialiseTime) / rewardPeriodTimespan;
    }
    
}
