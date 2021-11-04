FROM golang:1.15-alpine AS builder

# can either be `local` or `songbird`
ARG network_identifier

# path to GO
ENV PATH="$PATH:/usr/local/go/bin"

# path to setting GOPATH https://gitlab.com/flarenetwork/flare#dependencies
ENV GOPATH="$HOME/go"

# install build dependencies
RUN apk update && apk add --no-cache git curl openssh gcc g++ musl-dev jq linux-headers bash

WORKDIR /opt/data/flare

COPY . /opt/data/flare/

# force shell to use bash for compile.sh
SHELL ["/bin/bash", "-c"]

# build daemon
RUN ./compile.sh $network_identifier

FROM node:alpine as runner

# enable use of arg in second stage of build
ARG network_identifier

# copy daemon build and configuration files
COPY --from=builder /go/src/github.com/ava-labs/avalanchego /go/src/github.com/ava-labs/avalanchego
COPY --from=builder /opt/data/flare/conf /conf
COPY --from=builder /opt/data/flare/cmd /cmd

# set environment variables required during runtime
# mimics the behaviour of export_chain_apis.sh
ENV WEB3_API=debug
ENV FBA_VALs="/conf/$network_identifier/fba_validators.json"
ENV LTC_U_36f30e5b=public
ENV LTC_P_36f30e5b=gA4Yv3cnuXrIvP_7VIZjW1yliZ9GAclj1Td6tRITc6s=
ENV LTC_U_1c14eef5=public
ENV LTC_P_1c14eef5=gA4Yv3cnuXrIvP_7VIZjW1yliZ9GAclj1Td6tRITc6s=
ENV LTC_APIs=https://litecoin.flare.network/,https://litecoin-0.flare.network/
ENV XRP_U_a6f3687b=null
ENV XRP_P_a6f3687b=null
ENV XRP_U_a322e2c3=null
ENV XRP_P_a322e2c3=null
ENV XRP_APIs=https://xrpl.flare.network/,https://xrpl-1.flare.network/
