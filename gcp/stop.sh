#!/bin/bash -x

LOG_DIR=$(pwd)/logs
    
avapid=$(cat $LOG_DIR"/ava.pid")
echo $avapid
kill $avapid
echo -ne "avalanchego stopped. \n\n"

clientpid=$(cat $LOG_DIR"/client/client.pid")
echo $clientpid
kill $clientpid
echo -ne "client stopped. \n\n"