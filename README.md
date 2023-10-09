# faet6.1.0


Changes from "lisk init"

add the repository
add to config file before running, and to .lisk/faetapp/config file after running 

{
 "rpc": {
   "modes": ["ipc", "ws"], // Only specify the modes you need to enable
   "port": 7887,
   "host": "127.0.0.1", // Use `0.0.0.0` to expose them on all available ethernet IP instances
   "allowedMethods": ["*"]
 },
}

use "npm run build" and delete the .lisk/faetapp folder to reset the app from block 0


pm2 start -n faet "./bin/run start --api-ws --api-host=127.0.0.1 --api-port=7887 --overwrite-config"



----------------

you call commands via "./bin/run endpoint:invoke app_getRegisteredCommands"


-------------------

[
   "app_getRegisteredEndpoints",
   "app_getRegisteredEvents",
   "auth_getAuthAccount",
   "auth_isValidSignature",
   "auth_isValidNonce",
   "auth_getMultiSigRegMsgSchema",
   "auth_sortMultisignatureGroup",
   "auth_getMultiSigRegMsgTag",
   "validators_validateBLSKey",
   "validators_getValidator",
   "token_getBalances",
   "token_getBalance",
   "token_getTotalSupply",
   "token_getSupportedTokens",
   "token_isSupported",
   "token_getEscrowedAmounts",
   "token_getInitializationFees",
   "token_hasUserAccount",
   "token_hasEscrowAccount",
   "fee_getFeeTokenID",
   "fee_getMinFeePerByte",
   "interoperability_getMainchainID",
   "interoperability_getChainAccount",
   "interoperability_getAllChainAccounts",
   "interoperability_getChannel",
   "interoperability_getOwnChainAccount",
   "interoperability_getTerminatedStateAccount",
   "interoperability_getTerminatedOutboxAccount",
   "interoperability_getChainValidators",
   "interoperability_getCCMSchema",
   "pos_getStaker",
   "pos_getValidator",
   "pos_getAllValidators",
   "pos_getLockedStakedAmount",
   "pos_getConstants",
   "pos_getPendingUnlocks",
   "pos_getPoSTokenID",
   "pos_getValidatorsByStake",
   "pos_getLockedReward",
   "pos_getClaimableRewards",
   "pos_getRegistrationFee",
   "pos_getExpectedSharedRewards",
   "random_isSeedRevealValid",
   "random_setHashOnion",
   "random_getHashOnionSeeds",
   "random_hasHashOnion",
   "random_getHashOnionUsage",
   "random_setHashOnionUsage",
   "dynamicReward_getExpectedValidatorRewards",
   "dynamicReward_getDefaultRewardAtHeight",
   "dynamicReward_getRewardTokenID",
   "dynamicReward_getAnnualInflation",
   "nft_getNFTs",
   "nft_hasNFT",
   "nft_getNFT",
   "nft_getCollectionIDs",
   "nft_collectionExists",
   "nft_getEscrowedNFTIDs",
   "nft_isNFTSupported",
   "nft_getSupportedNFTs"
]
