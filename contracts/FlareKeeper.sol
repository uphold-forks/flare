// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "./IFlareKeep.sol";


contract FlareKeeper {

//====================================================================
// Data Structures
//====================================================================

    uint256 constant public MAX_KEEP_CONTRACTS = 10;
    IFlareKeep[] public keepContracts;
    uint256 public systemLastTriggeredAt;
    address public governanceContract;
    bool private initialised;

    event RegisterContractToKeep (IFlareKeep theContract, bool add);

//====================================================================
// Constructor for pre-compiled code
//====================================================================

    constructor() {
        /* empty block */
    }

    modifier onlyGovernance() {
        require(msg.sender == governanceContract, "msg.sender != governanceContract");
        _;
    }

    function initialise() external {
        require(initialised == false, "initialised != false");
        governanceContract = 0xff50eF6F4b0568493175defa3655b10d68Bf41FB;
        initialised = true;
    }

//====================================================================
// Functions
//====================================================================  

    function registerToKeep(IFlareKeep _keep) external onlyGovernance {

        uint256 len = keepContracts.length;
        require(len + 1 < MAX_KEEP_CONTRACTS, "Too many contracts");

        for (uint256 i = 0; i < len; i++) {
            if (_keep == keepContracts[i]) {
                return; // already registered
            }
        }

        keepContracts.push(_keep);
        emit RegisterContractToKeep (_keep, true);
    }

    function unregisterToKeep(IFlareKeep _keep) external onlyGovernance {

        uint256 len = keepContracts.length;

        for (uint256 i = 0; i < len; i++) {
            if (_keep == keepContracts[i]) {
                keepContracts[i] = keepContracts[len -1];
                keepContracts.pop();
                emit RegisterContractToKeep (_keep, false);
                return;
            }
        }

        revert("Can't find contract");
    }

    function trigger() public {
        require(block.number > systemLastTriggeredAt, "block.number small");
        systemLastTriggeredAt = block.number;
        
        // Perform trigger operations here
        uint256 len = keepContracts.length;

        for (uint256 i = 0; i < len; i++) {
            keepContracts[i].keep();
        }
    }
}
