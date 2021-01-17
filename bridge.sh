#!/bin/bash

PORT=$1
while true; do
	if ! lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
	    node stateConnector $1 --unhandled-rejections=strict
	else
		echo "System already activated."
	fi;
	sleep 5;
done