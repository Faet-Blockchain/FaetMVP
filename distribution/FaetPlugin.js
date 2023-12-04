/*:
 * @target MZ
 * @author Suepaphly
 * @plugindesc FaetPlugin
 * @help FaetPlugin
 * 
 * This plugin is the MVP implementation for the Faet Blockchain connection service.
 */
const liskCrypto = require('@liskhq/lisk-cryptography');
const liskTx = require('@liskhq/lisk-transactions');
const liskCodec = require('@liskhq/lisk-codec');
const { io } = require("socket.io-client");
const jsome = require('jsome');
const bip39 = require('bip39');

//----------------------------------------------   Generate Passphrase  ---------------------------------------------------


function generatePassphrase(){
    // Generate a random mnemonic (uses crypto.randomBytes under the hood), 128 - 256 bit
    const mnemonic = bip39.generateMnemonic(256);

    console.log(mnemonic);
    // Return the mnemonic
    return mnemonic;
}


//----------------------------------------------   Fund Account  ---------------------------------------------------

async function fundAccount(recipientPassphrase){
    try {

        const recipientAddress = await get_Lisk32AddressfromPassphrase(recipientPassphrase);
        
        //lskbx988tt7xybrk7mohau8c7s6a5vxo95c3sj3jn
        const privateKeyBuffer = Buffer.from("d6cd6cf732cae8be22a8cb55a5f3148fb0cf8dddc98f5786fc44422443b9422429f9ab6a552a58b3294147de22514665708094683a0373bc16aafdb911fa0a9a", 'hex');
        

        const publicKeyBuffer = liskCrypto.ed.getPublicKeyFromPrivateKey(privateKeyBuffer);

        const senderLisk32Address = await liskCrypto.address.getLisk32AddressFromPublicKey(publicKeyBuffer);

        //sign transaction

        const nonce = await get_Nonce(senderLisk32Address);
        const unsignedTransaction = build_FundingTransaction(publicKeyBuffer, recipientAddress, nonce);

        const signedTransaction = liskTx.signTransaction(unsignedTransaction, Buffer.from('13371337', 'hex'), privateKeyBuffer, transactionParamsSchema);

        const encodedTx = encodeTransaction(signedTransaction, signedTransaction.params, transactionSchema, transactionParamsSchema);

        const WS_RPC_ENDPOINT = 'ws://207.246.73.137:9901/rpc-v3';

        const requestObject = {
            jsonrpc: '2.0',
            method: 'post.transactions',
            params: {
                "transaction": encodedTx
            }
        };

        // Use the abstracted function for WebSocket communication
        const answer = await callWebSocket(WS_RPC_ENDPOINT, requestObject);
        return true;
    } catch (error) {
        console.error('Error:', error);
        return false;
    }
}


//----------------------------------------------   Post NFT  ---------------------------------------------------


async function postNFT(passphrase){
    try {
        const recipientAddress = await get_Lisk32AddressfromPassphrase(passphrase);        

        const privateKeyBuffer = await liskCrypto.ed.getPrivateKeyFromPhraseAndPath(passphrase, "m/44'/134'/0'");
        
        const publicKeyBuffer = liskCrypto.ed.getPublicKeyFromPrivateKey(privateKeyBuffer);

        //sign transaction

        const nonce = await get_Nonce(recipientAddress);

        const unsignedTransaction = build_NFTMintTransaction(publicKeyBuffer, recipientAddress,  nonce);

        const signedTransaction = liskTx.signTransaction(unsignedTransaction, Buffer.from('13371337', 'hex'), privateKeyBuffer, mintNftParamsSchema);

        const encodedTx = encodeTransaction(signedTransaction, signedTransaction.params, transactionSchema, mintNftParamsSchema);

        const WS_RPC_ENDPOINT = 'ws://207.246.73.137:9901/rpc-v3';

        const requestObject = {
            jsonrpc: '2.0',
            method: 'post.transactions',
            params: {
                "transaction": encodedTx
            }
        };

        const answer = await callWebSocket(WS_RPC_ENDPOINT, requestObject);
        return true;
    } catch (error) {
        console.error('Error:', error);
        return false;
    }
}


//----------------------------------------------   Show Balances  ---------------------------------------------------



function getNFTs(passphrase) {
    return new Promise(async (resolve, reject) => {
        try {
            const lisk32Address = await get_Lisk32AddressfromPassphrase(passphrase);
            const WS_RPC_ENDPOINT = 'ws://207.246.73.137:7887/rpc-ws';
            const requestObject = {
                jsonrpc: "2.0",
                method: "nft_getNFTs",
                params: { address: lisk32Address },
                id: 1
            };

            const ws = new WebSocket(WS_RPC_ENDPOINT);

            ws.onopen = () => {
                // Connection is open, send the request
                ws.send(JSON.stringify(requestObject));
            };

            ws.onmessage = (event) => {
                // Message received from the server

                const parsedResponse = JSON.parse(event.data);
                ws.close();
                if (parsedResponse.result.nfts[0] != null) {                    
                    resolve("1337 Armor");
                } else {
                    resolve(0);
                }
            };

            ws.onerror = (error) => {
                // An error occurred during the connection
                console.error('WebSocket Error:', error);
                ws.close();
                reject(error);
            };

        } catch (error) {
            console.error('Error:', error);
            reject(error);
        }
    });
}

async function getBalance(passphrase){

    try {
        const lisk32Address = await get_Lisk32AddressfromPassphrase(passphrase);

        const WS_RPC_ENDPOINT = 'ws://207.246.73.137:9901/rpc-v3';

        const requestObject = {
            jsonrpc: '2.0',
            method: 'get.token.balances',
            params: {
                "address": lisk32Address
            }
        };

        // Use the abstracted function for WebSocket communication
        const answer = await callWebSocket(WS_RPC_ENDPOINT, requestObject);
        const balanceStr = answer.result.data[0].availableBalance;
        const formattedBalance = balanceStr.length > 8 
            ? balanceStr.slice(0, -8) + "." + balanceStr.slice(-8) 
            : "0." + balanceStr.padStart(8, '0');

        return formattedBalance;
        
    } catch (error) {
        console.error('Error:', error);
    }

}


//----------------------------------------------   Utilities  ---------------------------------------------------


async function get_Lisk32AddressfromPassphrase(passphrase){
    try {
        const privateKeyBuffer = await liskCrypto.ed.getPrivateKeyFromPhraseAndPath(passphrase, "m/44'/134'/0'");
        const publicKeyBuffer = liskCrypto.ed.getPublicKeyFromPrivateKey(privateKeyBuffer);
        const lisk32Address = liskCrypto.address.getLisk32AddressFromPublicKey(publicKeyBuffer);
        return lisk32Address;
    } catch (error) {
        console.error('Error:', error);
    }
}

async function get_Nonce(lisk32Address){
    
    try {
        const WS_RPC_ENDPOINT = 'ws://207.246.73.137:9901/rpc-v3';

        const requestObject = {
            jsonrpc: '2.0',
            method: 'get.auth',
            params: {
                "address": lisk32Address
            }
        };

        // Use the abstracted function for WebSocket communication
        const answer = await callWebSocket(WS_RPC_ENDPOINT, requestObject);
        return answer.result.data.nonce;
        
    } catch (error) {
        console.error('Error:', error);
    }

}


function build_FundingTransaction(publicKeyBuffer, recipientAddressX, nonceX){
    // Adjust the values of the unsigned transaction manually
    const unsignedTransaction = {
        module: "token",
        command: "transfer",
        fee: BigInt(17600000),
        nonce: BigInt(nonceX),
        senderPublicKey: publicKeyBuffer,
        params: Buffer.alloc(0),
        signatures: [],
    };

    // Create the asset for the Token Transfer transaction
    const transferParams = {
        tokenID: Buffer.from('1337133700000000', 'hex'),
        amount: BigInt(200000000000),
        recipientAddress: Buffer.from(liskCrypto.address.getAddressFromLisk32Address(recipientAddressX), 'hex'),
        data: 'Welcome to Faet!'
    };

    // Add the transaction params to the transaction object
    unsignedTransaction.params = transferParams;

    // Return the unsigned transaction object
    return unsignedTransaction;
}

function build_NFTMintTransaction(publicKeyBuffer, recipientAddress, nonceX){
    // Adjust the values of the unsigned transaction manually
    const unsignedTransaction = {
        module: "testNft",
        command: "mintNft",
        fee: BigInt(10000000),
        nonce: BigInt(nonceX),
        senderPublicKey: publicKeyBuffer,
        params: Buffer.alloc(0),
        signatures: [],
    };

    const addressBuffer = liskCrypto.address.getAddressFromLisk32Address(recipientAddress);

    // Create the asset for the Token Transfer transaction
    const transferParams = {
        address: addressBuffer, 
        collectionID: Buffer.from("00000000", "hex"),
        attributesArray: [{
            module: "testNft",
            attributes: Buffer.from('1337', 'utf-8')
        }]
    };

    // Add the transaction params to the transaction object
    unsignedTransaction.params = transferParams;

    // Return the unsigned transaction object
    return unsignedTransaction;
}

function encodeTransaction(transaction, transactionParams, transactionSchema, paramsSchema) {
    
    const liskEncode = new liskCodec.Codec();

    // Encode the transaction parameters
    const encodedTxParams = liskEncode.encode(paramsSchema, transactionParams);
    transaction.params = encodedTxParams;

    // Encode the complete transaction
    const encodedTx = liskEncode.encode(transactionSchema, transaction);

    // Return the encoded transaction in hex string format
    return encodedTx.toString('hex');
}


async function callWebSocket(endpoint, requestObject) {
    return new Promise((resolve, reject) => {
        // Connect to Lisk Service via WebSockets
        const socket = io(endpoint, {
            forceNew: true,
            transports: ['websocket']
        });

        // Handle WebSocket connection
        socket.on('connect', () => {
            console.log('WebSocket connection established successfully.');

            // Emit the remote procedure call
            socket.emit('request', requestObject, answer => {
                jsome(answer);
                console.log(answer);
                resolve(answer); // Resolve with the answer
                socket.disconnect(); // Disconnect after receiving the response
            });
        });

        // Handle connection errors
        socket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
            reject(error); // Reject the promise on error
        });

        // Handle disconnection
        socket.on('disconnect', (reason) => {
            console.log('WebSocket disconnected:', reason);
        });
    });
}

//----------------------------------------------   Schemas  ---------------------------------------------------

const transactionSchema = {
    $id: '/lisk/transaction',
    type: 'object',
    required: ['module', 'command', 'nonce', 'fee', 'senderPublicKey', 'params'],
    properties: {
        module: {
            dataType: 'string',
            fieldNumber: 1,
            minLength: 1,
            maxLength: 32,
        },
        command: {
            dataType: 'string',
            fieldNumber: 2,
            minLength: 1,
            maxLength: 32,
        },
        nonce: {
            dataType: 'uint64',
            fieldNumber: 3,
        },
        fee: {
            dataType: 'uint64',
            fieldNumber: 4,
        },
        senderPublicKey: {
            dataType: 'bytes',
            fieldNumber: 5,
            minLength: 32,
            maxLength: 32,
        },
        params: {
            dataType: 'bytes',
            fieldNumber: 6,
        },
        signatures: {
            type: 'array',
            items: {
                dataType: 'bytes',
            },
            fieldNumber: 7,
        },
    },
};

const transactionParamsSchema = {
    $id: '/lisk/transferParams',
    title: 'Transfer transaction params',
    type: 'object',
    required: ['tokenID', 'amount', 'recipientAddress', 'data'],
    properties: {
        tokenID: {
            dataType: 'bytes',
            fieldNumber: 1,
            minLength: 8,
            maxLength: 8,
        },
        amount: {
            dataType: 'uint64',
            fieldNumber: 2,
        },
        recipientAddress: {
            dataType: 'bytes',
            fieldNumber: 3,
            format: 'lisk32',
        },
        data: {
            dataType: 'string',
            fieldNumber: 4,
            minLength: 0,
            maxLength: 64,
        },
    },
};

const mintNftParamsSchema = {
	$id: '/lisk/nftTransferParams',    
    title: 'Transfer NFT transaction params',
	type: 'object',
	required: ['address', 'collectionID', 'attributesArray'],
	properties: {
		address: {
			dataType: 'bytes',
			format: 'lisk32',
			fieldNumber: 1,
		},
		collectionID: {
			dataType: 'bytes',
			minLength: 4,
			maxLength: 4,
			fieldNumber: 2,
		},
		attributesArray: {
			type: 'array',
			fieldNumber: 4,
			items: {
				type: 'object',
				required: ['module', 'attributes'],
				properties: {
					module: {
						dataType: 'string',
						minLength: 1,
						maxLength: 32,
						pattern: '^[a-zA-Z0-9]*$',
						fieldNumber: 1,
					},
					attributes: {
						dataType: 'bytes',
						fieldNumber: 2,
					},
				},
			},
		},
	},
};
