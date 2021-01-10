#!/bin/bash

PORT=$((8080+$1))
while true; do 
	nohup $(sleep 2; curl -s http://localhost:$PORT/stateConnector) >& /dev/null &
	if ! lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
	    node stateConnector $1 --unhandled-rejections=strict
	else
		echo "System already activated."
	fi;
	sleep 5;
done