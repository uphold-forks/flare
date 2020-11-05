#!/bin/bash -x

LOG_DIR=$(pwd)/logs
    
avapid=$(cat $LOG_DIR"/ava.pid")
echo $avapid
kill $avapid
echo -ne "\navalanchego stopped. \n"

clientpid=$(cat $LOG_DIR"/client/client.pid")
echo $clientpid
kill $clientpid
echo -ne "\nclient stopped. \n"