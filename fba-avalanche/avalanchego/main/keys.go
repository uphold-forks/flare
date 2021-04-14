// (c) 2019-2020, Ava Labs, Inc. All rights reserved.
// See the file LICENSE for licensing terms.

package main

const (
	defaultString                           = "default"
	configFileKey                           = "config-file"
	versionKey                              = "version"
	genesisConfigFileKey                    = "genesis"
	networkNameKey                          = "network-id"
	txFeeKey                                = "tx-fee"
	creationTxFeeKey                        = "creation-tx-fee"
	uptimeRequirementKey                    = "uptime-requirement"
	minValidatorStakeKey                    = "min-validator-stake"
	maxValidatorStakeKey                    = "max-validator-stake"
	minDelegatorStakeKey                    = "min-delegator-stake"
	minDelegatorFeeKey                      = "min-delegation-fee"
	minStakeDurationKey                     = "min-stake-duration"
	maxStakeDurationKey                     = "max-stake-duration"
	stakeMintingPeriodKey                   = "stake-minting-period"
	assertionsEnabledKey                    = "assertions-enabled"
	signatureVerificationEnabledKey         = "signature-verification-enabled"
	dbEnabledKey                            = "db-enabled"
	dbPathKey                               = "db-dir"
	publicIPKey                             = "public-ip"
	dynamicUpdateDurationKey                = "dynamic-update-duration"
	dynamicPublicIPResolverKey              = "dynamic-public-ip"
	connMeterResetDurationKey               = "conn-meter-reset-duration"
	connMeterMaxConnsKey                    = "conn-meter-max-conns"
	httpHostKey                             = "http-host"
	httpPortKey                             = "http-port"
	httpsEnabledKey                         = "http-tls-enabled"
	httpsKeyFileKey                         = "http-tls-key-file"
	httpsCertFileKey                        = "http-tls-cert-file"
	httpAllowedOrigins                      = "http-allowed-origins"
	apiAuthRequiredKey                      = "api-auth-required"
	apiAuthPasswordFileKey                  = "api-auth-password-file" // #nosec G101
	bootstrapIPsKey                         = "bootstrap-ips"
	bootstrapIDsKey                         = "bootstrap-ids"
	stakingPortKey                          = "staking-port"
	stakingEnabledKey                       = "staking-enabled"
	p2pTLSEnabledKey                        = "p2p-tls-enabled"
	stakingKeyPathKey                       = "staking-tls-key-file"
	stakingCertPathKey                      = "staking-tls-cert-file"
	stakingDisabledWeightKey                = "staking-disabled-weight"
	maxNonStakerPendingMsgsKey              = "max-non-staker-pending-msgs"
	stakerMsgReservedKey                    = "staker-msg-reserved"
	stakerCPUReservedKey                    = "staker-cpu-reserved"
	maxPendingMsgsKey                       = "max-pending-msgs"
	networkInitialTimeoutKey                = "network-initial-timeout"
	networkMinimumTimeoutKey                = "network-minimum-timeout"
	networkMaximumTimeoutKey                = "network-maximum-timeout"
	networkTimeoutHalflifeKey               = "network-timeout-halflife"
	networkTimeoutCoefficientKey            = "network-timeout-coefficient"
	networkHealthMinPeersKey                = "network-health-min-conn-peers"
	networkHealthMaxTimeSinceMsgReceivedKey = "network-health-max-time-since-msg-received"
	networkHealthMaxTimeSinceMsgSentKey     = "network-health-max-time-since-msg-sent"
	networkHealthMaxPortionSendQueueFillKey = "network-health-max-portion-send-queue-full"
	networkHealthMaxSendFailRateKey         = "network-health-max-send-fail-rate"
	networkHealthMaxOutstandingDurationKey  = "network-health-max-outstanding-request-duration"
	sendQueueSizeKey                        = "send-queue-size"
	benchlistFailThresholdKey               = "benchlist-fail-threshold"
	benchlistPeerSummaryEnabledKey          = "benchlist-peer-summary-enabled"
	benchlistDurationKey                    = "benchlist-duration"
	benchlistMinFailingDurationKey          = "benchlist-min-failing-duration"
	pluginDirKey                            = "plugin-dir"
	logsDirKey                              = "log-dir"
	logLevelKey                             = "log-level"
	logDisplayLevelKey                      = "log-display-level"
	logDisplayHighlightKey                  = "log-display-highlight"
	snowSampleSizeKey                       = "snow-sample-size"
	snowQuorumSizeKey                       = "snow-quorum-size"
	snowVirtuousCommitThresholdKey          = "snow-virtuous-commit-threshold"
	snowRogueCommitThresholdKey             = "snow-rogue-commit-threshold"
	snowAvalancheNumParentsKey              = "snow-avalanche-num-parents"
	snowAvalancheBatchSizeKey               = "snow-avalanche-batch-size"
	snowConcurrentRepollsKey                = "snow-concurrent-repolls"
	snowOptimalProcessingKey                = "snow-optimal-processing"
	snowMaxProcessingKey                    = "snow-max-processing"
	snowMaxTimeProcessingKey                = "snow-max-time-processing"
	snowEpochFirstTransition                = "snow-epoch-first-transition"
	snowEpochDuration                       = "snow-epoch-duration"
	whitelistedSubnetsKey                   = "whitelisted-subnets"
	adminAPIEnabledKey                      = "api-admin-enabled"
	infoAPIEnabledKey                       = "api-info-enabled"
	keystoreAPIEnabledKey                   = "api-keystore-enabled"
	metricsAPIEnabledKey                    = "api-metrics-enabled"
	healthAPIEnabledKey                     = "api-health-enabled"
	ipcAPIEnabledKey                        = "api-ipcs-enabled"
	xputServerPortKey                       = "xput-server-port"
	xputServerEnabledKey                    = "xput-server-enabled"
	ipcsChainIDsKey                         = "ipcs-chain-ids"
	ipcsPathKey                             = "ipcs-path"
	consensusGossipFrequencyKey             = "consensus-gossip-frequency"
	consensusShutdownTimeoutKey             = "consensus-shutdown-timeout"
	fdLimitKey                              = "fd-limit"
	corethConfigKey                         = "coreth-config"
	disconnectedCheckFreqKey                = "disconnected-check-frequency"
	disconnectedRestartTimeoutKey           = "disconnected-restart-timeout"
	restartOnDisconnectedKey                = "restart-on-disconnected"
	routerHealthMaxDropRateKey              = "router-health-max-drop-rate"
	routerHealthMaxOutstandingRequestsKey   = "router-health-max-outstanding-requests"
	healthCheckFreqKey                      = "health-check-frequency"
	healthCheckAveragerHalflifeKey          = "health-check-averager-halflife"
	retryBootstrap                          = "bootstrap-retry-enabled"
	retryBootstrapMaxAttempts               = "bootstrap-retry-max-attempts"
	peerAliasTimeoutKey                     = "peer-alias-timeout"
	validatorsFileKey                       = "validators-file"
	alertAPIsKey                            = "alert-apis"
	xrpAPIsKey                              = "xrp-apis"
)
