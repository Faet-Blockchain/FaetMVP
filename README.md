# faet6.1.0

This is an example implementation of a blockchain using the Lisk-SDK and the 6.1.0 Version NFT Module and example testNFT custom module, located here: 
https://github.com/LiskHQ/lisk-sdk/tree/v6.1.0-rc.0/examples/interop/pos-mainchain-fast

[This project is deprecated since Lisk has moved to L2 on the OP Stack]

How to Use: 

Clone this repository, and follow the instructions for launching a lisk-sdk blockchain here: 
https://lisk.com/documentation/lisk-sdk/quickstart.html

Install PM2 and navigate to the directory. Once there, use this command to launch the blockchain: 

pm2 start -n faet "./bin/run start --api-ws --api-host=127.0.0.1 --api-port=7887"

----------------

you call commands via "./bin/run endpoint:invoke [Command]"

------------------
Here is the list of commands available from the endpoint: app_getRegisteredCommands

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


Changelog: 

Goal #1 of Milestone 3: 

-Integrated Wallet Functionality

-Users able to log-in with their passphrase

-Users able to store their passphrases inside games and password protect them

-Users able to check their balance via the status menu in-game

-Users able to send transactions to other public addresses


Goal #2 of Milestone 3: 

-Created utility functions assisting in compiling and decompiling NFTs

-Altered the blockchain NFT format to be able to operate with the JSON of an item including the image in base64 format

-Updated in-game functions that dynamically inject the item into the game's memory and associate it with a weapon
