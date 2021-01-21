#!/bin/bash
solc $1.sol --combined-json abi,asm,ast,bin,bin-runtime,devdoc,interface,opcodes,srcmap,srcmap-runtime,userdoc > $1.json
solc --bin-runtime --gas $1.sol
