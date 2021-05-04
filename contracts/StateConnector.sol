// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

contract StateConnector {

//====================================================================
// Data Structures
//====================================================================

    address private governanceContract;
    bool private initialised;
    uint32 private numChains;
    uint256 private currentRewardSchedule;
    uint256 private rewardScheduleLastUpdated;

    struct Chain {
        bool        exists;
        uint64      genesisLedger;
        uint16      claimPeriodLength; // Number of ledgers in a claim period
        uint16      numConfirmations; // Number of confirmations required to consider this claim period finalised
        uint64      finalisedClaimPeriodIndex;
        uint64      finalisedLedgerIndex;
        uint256     finalisedTimestamp;
        uint256     timeDiffExpected;
        uint256     timeDiffAvg;
    }

    struct HashExists {
        bool        exists;
        bytes32     hashBytes;
        uint256     timestamp;
    }

    // Chain ID mapping to Chain struct
    mapping(uint32 => Chain) private chains;
    // Location hash => claim period
    mapping(bytes32 => HashExists) private finalisedClaimPeriods;
    // Finalised payment hashes
    mapping(uint32 => mapping(bytes32 => HashExists)) private finalisedPayments;
    // Mapping of how many claim periods an address has successfully mined
    mapping(address => mapping(uint256 => uint64)) private claimPeriodsMined;
    // Accounts that the governance contract voted to block from submitting proofs
    mapping(address => bool) private governanceBlockedAccounts;

//====================================================================
// Constructor for pre-compiled code
//====================================================================

    constructor() {
    }

    modifier onlyGovernance() {
        require(msg.sender == governanceContract, 'msg.sender != governanceContract');
        _;
    }

    modifier chainExists(uint32 chainId) {
        require(chains[chainId].exists, 'chainId does not exist');
        _;
    }

    modifier senderNotGovernanceBlocked() {
        require(!governanceBlockedAccounts[msg.sender], 'this account is governance blocked');
        _;
    }

    function initialiseChains() public returns (bool success) {
        require(!initialised, 'initialised != false');
        governanceContract = 0xfffEc6C83c8BF5c3F4AE0cCF8c45CE20E4560BD7;
        chains[0] = Chain(true, 62880000, 30, 0, 0, 62880000, block.timestamp, 120, 0); //XRP
        numChains = 1;
        currentRewardSchedule = 0;
        rewardScheduleLastUpdated = block.timestamp;
        initialised = true;
        return true;
    }

//====================================================================
// Functions
//====================================================================  

    function getGovernanceContract() external view returns (address _governanceContract) {
        return governanceContract;
    }

    function setGovernanceContract(address _governanceContract) external onlyGovernance {
        require(_governanceContract != address(0x0), '_governanceContract == 0x0');
        governanceContract = _governanceContract;
    }

    function addChain(uint64 genesisLedger, uint16 claimPeriodLength, uint16 numConfirmations, uint256 timeDiffExpected) external onlyGovernance returns (uint32 currNumChains) {
        require(!chains[numChains].exists, 'chainId already exists'); // Can happen if numChains is overflowed
        require(claimPeriodLength > 0, 'claimPeriodLength == 0');
        require(block.coinbase == governanceContract || block.coinbase == address(0x0100000000000000000000000000000000000000), 'Invalid block.coinbase value');
        uint32 _currNumChains = numChains;
        if (block.coinbase == governanceContract && block.coinbase != address(0x0100000000000000000000000000000000000000)) {
            chains[numChains] = Chain(true, genesisLedger, claimPeriodLength, numConfirmations, 0, genesisLedger, block.timestamp, timeDiffExpected, 0);
            numChains = numChains+1;
        }
        return _currNumChains;
    }

    // Solution if an underlying chain loses liveness is to disable that chain temporarily
    function disableChain(uint32 chainId) external onlyGovernance chainExists(chainId) {
        chains[chainId].exists = false;
    }

    function enableChain(uint32 chainId) external onlyGovernance {
        require(chainId < numChains, 'chainId >= numChains');
        require(chains[chainId].exists == false, 'chains[chainId].exists == true');
        chains[chainId].exists = true;
    }

    function updateChainTiming(uint32 chainId, uint256 timeDiffExpected) external onlyGovernance chainExists(chainId) {
        chains[chainId].timeDiffExpected = timeDiffExpected;
    }

    function getClaimPeriodsMined(address miner, uint256 rewardSchedule) external view returns (uint64 numMined) {
        require(rewardSchedule <= currentRewardSchedule, 'rewardSchedule > currentRewardSchedule');
        return claimPeriodsMined[miner][rewardSchedule];
    }

    function getRewardSchedule() external view returns (uint256 rewardSchedule) {
        return currentRewardSchedule;
    }

    function bumpRewardSchedule() external onlyGovernance {
        require(block.timestamp > rewardScheduleLastUpdated, 'block.timestamp <= rewardScheduleLastUpdated');
        require(block.timestamp - rewardScheduleLastUpdated > 604800, 'block.timestamp - rewardScheduleLastUpdated <= 604800, i.e. 1 week');
        require(currentRewardSchedule < 2**256-1, 'currentRewardSchedule >= 2**256-1');
        currentRewardSchedule = currentRewardSchedule + 1;
        rewardScheduleLastUpdated = block.timestamp;
    }

    function blockAddress(address blockedAddress) external onlyGovernance {
        require(blockedAddress != governanceContract, 'blockedAddress == governanceContract');
        governanceBlockedAccounts[blockedAddress] = true;
    }

    function unblockAddress(address blockedAddress) external onlyGovernance {
        require(governanceBlockedAccounts[blockedAddress], '!governanceBlockedAccounts[blockedAddress]');
        governanceBlockedAccounts[blockedAddress] = false;
    }

    function getLatestIndex(uint32 chainId) external view chainExists(chainId) returns (uint64 genesisLedger, uint64 finalisedClaimPeriodIndex, uint16 claimPeriodLength, uint64 finalisedLedgerIndex, uint256 finalisedTimestamp, uint256 timeDiffAvg) {
        return (chains[chainId].genesisLedger, chains[chainId].finalisedClaimPeriodIndex, chains[chainId].claimPeriodLength, chains[chainId].finalisedLedgerIndex, chains[chainId].finalisedTimestamp, chains[chainId].timeDiffAvg);
    }

    function getClaimPeriodIndexFinality(uint32 chainId, uint64 claimPeriodIndex) external view chainExists(chainId) returns (bool finality) {
        bytes32 locationHash =  keccak256(abi.encodePacked(chainId,claimPeriodIndex));
        return (finalisedClaimPeriods[locationHash].exists);
    }

    function proveClaimPeriodFinality(uint32 chainId, uint64 ledger, uint64 claimPeriodIndex, bytes32 claimPeriodHash) external chainExists(chainId) senderNotGovernanceBlocked returns (uint32 _chainId, uint64 _ledger, uint16 _numConfirmations, bytes32 _claimPeriodHash) {
        require(ledger == chains[chainId].finalisedLedgerIndex + chains[chainId].claimPeriodLength, 'invalid ledger');
        require(claimPeriodIndex == chains[chainId].finalisedClaimPeriodIndex, 'invalid claimPeriodIndex');
        require(block.timestamp > chains[chainId].finalisedTimestamp, 'block.timestamp <= chains[chainId].finalisedTimestamp');
        if (2*chains[chainId].timeDiffAvg < chains[chainId].timeDiffExpected) {
        	require(3*(block.timestamp-chains[chainId].finalisedTimestamp) >= 2*chains[chainId].timeDiffAvg, 'not enough time elapsed since prior finality');
        } else {
        	require(block.timestamp-chains[chainId].finalisedTimestamp+15 >= chains[chainId].timeDiffAvg, 'not enough time elapsed since prior finality');
        }
        bytes32 locationHash =  keccak256(abi.encodePacked(chainId,claimPeriodIndex));
        require(!finalisedClaimPeriods[locationHash].exists, 'locationHash already finalised');
        if (claimPeriodIndex > 0) {
            bytes32 prevLocationHash =  keccak256(abi.encodePacked(chainId,claimPeriodIndex-1));
            require(finalisedClaimPeriods[prevLocationHash].exists, 'previous claim period not yet finalised');
        }
        require(block.coinbase == msg.sender || block.coinbase == address(0x0100000000000000000000000000000000000000), 'Invalid block.coinbase value');
        if (block.coinbase == msg.sender && block.coinbase != address(0x0100000000000000000000000000000000000000)) {
            // Node checked claimPeriodHash, and it was valid
            claimPeriodsMined[msg.sender][currentRewardSchedule] = claimPeriodsMined[msg.sender][currentRewardSchedule] + 1;
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

    function getClaimPeriodFinality(bytes32 claimPeriodHash, uint32 chainId, uint64 claimPeriodIndex) private view chainExists(chainId) returns (uint256 timestamp) {
        bytes32 locationHash =  keccak256(abi.encodePacked(chainId,claimPeriodIndex));
        require(finalisedClaimPeriods[locationHash].exists, 'finalisedClaimPeriods[locationHash] does not exist');
        require(finalisedClaimPeriods[locationHash].hashBytes == claimPeriodHash, 'Invalid claimPeriodHash');
        return finalisedClaimPeriods[locationHash].timestamp;
    }

    function provePaymentFinality(uint32 chainId, uint64 claimPeriodIndex, bytes32 claimPeriodHash, bytes32 paymentHash, string memory txId) external chainExists(chainId) returns (uint32 _chainId, uint64 finalisedLedgerIndex, bytes32 _paymentHash, string memory _txId) {
        bytes32 txIdHash = keccak256(abi.encodePacked(txId));
        require(!finalisedPayments[chainId][txIdHash].exists, 'txId already proven');
        uint256 timestamp = getClaimPeriodFinality(claimPeriodHash, chainId, claimPeriodIndex);
        require(block.coinbase == msg.sender || block.coinbase == address(0x0100000000000000000000000000000000000000), 'Invalid block.coinbase value');
        if (block.coinbase == msg.sender && block.coinbase != address(0x0100000000000000000000000000000000000000)) {
        	finalisedPayments[chainId][txIdHash] = HashExists(true, paymentHash, timestamp);
        }
        return (chainId, chains[chainId].finalisedLedgerIndex, paymentHash, txId);
    }

    function getPaymentFinality(uint32 chainId, bytes32 txId, uint64 ledger, bytes32 sourceHash, bytes32 destinationHash, uint64 destinationTag, uint64 amount) external view chainExists(chainId) returns (bool finality, uint256 timestamp) {
        require(finalisedPayments[chainId][txId].exists, 'txId does not exist');
        bytes32 paymentHash = keccak256(abi.encodePacked(
        							txId,
        							keccak256(abi.encode(ledger)),
        							sourceHash,
        							destinationHash,
        							keccak256(abi.encode(destinationTag)),
        							keccak256(abi.encode(amount))));
    	require(finalisedPayments[chainId][txId].hashBytes == paymentHash, 'invalid paymentHash');
    	return (true, finalisedPayments[chainId][txId].timestamp);
    }
}