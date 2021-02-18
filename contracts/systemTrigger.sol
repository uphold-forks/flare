// SPDX-License-Identifier: MIT
pragma solidity ^0.7.3;
pragma experimental ABIEncoderV2;

contract systemTrigger {

//====================================================================
// Data Structures
//====================================================================
    
    uint256 public systemLastTriggeredAt;
    
//====================================================================
// Constructor for pre-compiled code
//====================================================================

    constructor() {
    }

//====================================================================
// Functions
//====================================================================  

    function trigger() public returns (bool success) {
        require(block.number > systemLastTriggeredAt, 'block.number <= systemLastTriggeredAt');
        systemLastTriggeredAt = block.number;
        // Perform trigger operations here
        return true;
    }

}