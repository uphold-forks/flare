#!/bin/bash

PORT=8000
while true; do
	nohup $(sleep 2; curl -s http://localhost:$PORT/?prove=$1) >& /dev/null &
	if ! lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
	    node stateConnector $PORT --unhandled-rejections=strict
	else
		echo "System already activated."
	fi;
	sleep 5;
done