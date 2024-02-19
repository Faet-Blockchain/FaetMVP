//=============================================================================
// FaetPlugin.js v1.0
//=============================================================================

/*:
 * @target MZ
 * @author Suepaphly
 * @plugindesc FaetPlugin
 * @help FaetPlugin
 * 
 * This plugin is the MVP implementation for the Faet Blockchain connection service.
 * 
 * @Requires: getStringInput()
 * Ensure getStringInput.js is loaded in the Plugin Manager before this plugin.
 * 
 */

//NPM Libraries
const liskCrypto = require('@liskhq/lisk-cryptography');
const liskTx = require('@liskhq/lisk-transactions');
const liskCodec = require('@liskhq/lisk-codec');
const { io } = require("socket.io-client");
const jsome = require('jsome');
const bip39 = require('bip39');

//Static Constants
const publicKeyVariableId = 7; // ID to store the public key
const passphraseVariableId = 8; // ID to store the encrypted passphrase
const passwordProtectSwitch = 9; // ID to the switch that sets Passphrase protection via password

//----------------------------------------------   Generate Passphrase  ---------------------------------------------------


function generatePassphrase(){
    // Generate a random mnemonic (uses crypto.randomBytes under the hood), 128 - 256 bit
    const mnemonic = bip39.generateMnemonic(256);
    return mnemonic;
}

//----------------------------------------------  Input & Game Processing  ---------------------------------------------------

/*
    Handle New Game
        -Generate Passphrase
        -Would you like to password protect?
            Yes: Enter Password & Save Encrypted Passphrase
            No:  Save Public Key and mark "No Password" variable
*/

async function handleNewGame(passphrase, passwordProtect) {        
    // Define the variable IDs

    if (passwordProtect) {
        // If password protected, prompt for a password and save the encrypted passphrase        
        $gameSwitches.setValue(passwordProtectSwitch, true);
        const publicKey = await get_Lisk32AddressfromPassphrase(passphrase);
        let confirmedPassphrase = false;
        $gameVariables.setValue(publicKeyVariableId, publicKey);

        while (!confirmedPassphrase) {

            
            
            const passwordLabel = showLabelText('Enter your Password');
            const password = await window.getStringInputTextBox(-1);
            encryptPassphrase(passphrase, password, passphraseVariableId);


            SceneManager._scene.removeChild(passwordLabel);
            const passwordLabelConfirm = showLabelText('Confirm your Password');
            const confirmPassword = await window.getStringInputTextBox(-1);
            confirmedPassphrase = await decryptPassphrase(confirmPassword, passphraseVariableId);
            SceneManager._scene.removeChild(passwordLabelConfirm);

            if (!confirmedPassphrase) {
                // Notify the user about the mismatch and restart the process
                alert('Password confirmation failed. Please try again.');
                continue;
            }

            navigator.clipboard.writeText(confirmedPassphrase);
        }        
        
        showPassphraseOnStart();

    } else {
        $gameSwitches.setValue(passwordProtectSwitch, false);
        // If not password protected, save the public key
        const publicKey = await get_Lisk32AddressfromPassphrase(passphrase);
        $gameVariables.setValue(publicKeyVariableId, publicKey);
        showPassphraseOnStart();
    }
}

/*
    Handle Continue
    -Choose Save File or Enter Passphrase
        -If Passphrase Pub Key does not match a save file, tell the user they must overwrite a save file. 
        -Create Save file based on passphrase
    -Is Password Protected? 
        Yes: Enter Password
        No:  Enter Passphrase
*/

async function handleContinue() {
    let isValidPassphrase = false;
    let passphrase;
    let attempts = 0;

    while (!isValidPassphrase && attempts < 3) {
        try {
            // Prompt the user to input their passphrase
            
            showLabelText('Enter your passphrase');
            passphrase = await window.getStringInputTextArea(-1);

            if (passphrase && bip39.validateMnemonic(passphrase)) {
                // If the passphrase is valid according to BIP39
                isValidPassphrase = true;

                // Generate the public key from the passphrase
                const publicKey = await get_Lisk32AddressfromPassphrase(passphrase);

                // Save the public key in the game variable
                $gameVariables.setValue(publicKeyVariableId, publicKey);

                // Set a game switch to indicate successful passphrase entry
                $gameSwitches.setValue(6, true); // Assuming 7 is the switch ID for successful entry
                $gameSwitches.setValue(7, true); // Assuming 7 is the switch ID for successful entry
            } else {
                // Notify the user that the passphrase is invalid
                alert('Invalid passphrase. Please try again.');
                attempts++;
            }
        } catch (error) {
            console.error("Error in handleContinue:", error);
            break;
        }
    }

    if (isValidPassphrase) {
        return passphrase;
    } else {
        if (attempts >= 3) {
            // If three attempts have been made, set a game switch to indicate failure
            $gameSwitches.setValue(8, true); // Assuming 8 is the switch ID for failure
        }
        return false;
    }
}

const _Scene_Load_onLoadSuccess = Scene_Load.prototype.onLoadSuccess;
Scene_Load.prototype.onLoadSuccess = function() {
    _Scene_Load_onLoadSuccess.call(this);

    var key = [1, 2, 'A'];
    $gameSelfSwitches.setValue(key, false); // Ensure the game-load routine runs even if it's ran before on previous loads
    
    // The game has been successfully loaded, now check the password by transferring to the password/passphrase check scene
    SceneManager.goto(Scene_Map);
    $gamePlayer.reserveTransfer(11, 0, 0, 0, 0);

};

//----------------------------------------------   Crypto Menu Item ---------------------------------------------------

const _Window_MenuCommand_addOriginalCommands = Window_MenuCommand.prototype.addOriginalCommands;
Window_MenuCommand.prototype.addOriginalCommands = function() {
    _Window_MenuCommand_addOriginalCommands.call(this);
    this.addCommand("Crypto Wallet", "cryptoMenu");
};

const _Window_MenuCommand_makeCommandList = Window_MenuCommand.prototype.makeCommandList;
Window_MenuCommand.prototype.makeCommandList = function() {
    _Window_MenuCommand_makeCommandList.call(this);
    this.setHandler('cancel', this.closeCryptoMenu.bind(this));
};

Window_MenuCommand.prototype.closeCryptoMenu = function() {
    if (SceneManager._scene instanceof Scene_Menu && SceneManager._scene.cryptoMenuIsOpen()) {
        SceneManager._scene.closeCryptoMenuWindow();
    } else {
        SceneManager.pop();
    }
};

const _Scene_Menu_createCommandWindow = Scene_Menu.prototype.createCommandWindow;
Scene_Menu.prototype.createCommandWindow = function() {
    _Scene_Menu_createCommandWindow.call(this);
    this._commandWindow.setHandler('cryptoMenu', this.commandCryptoMenu.bind(this));
};

Scene_Menu.prototype.commandCryptoMenu = function() {
    this.createCryptoMenuWindow();
    this._commandWindow.deactivate();
};

Scene_Menu.prototype.createCryptoMenuWindow = function() {
    const rect = new Rectangle(0, 0, Graphics.boxWidth, Graphics.boxHeight);
    this._cryptoMenuWindow = new Window_CryptoMenu(rect);
    this._cryptoMenuWindow.setHandler('cancel', this.closeCryptoMenuWindow.bind(this));
    this._cryptoMenuWindow.setHandler('togglePassphrase', this.handleTogglePassphrase.bind(this));
    this._cryptoMenuWindow.setHandler('showPassphrase', this.handleShowPassphrase.bind(this));
    this._cryptoMenuWindow.setHandler('sendTransaction', this.handleSendTransaction.bind(this));
    this._cryptoMenuWindow.setHandler('showBalance', this.handleShowBalance.bind(this));
    this.addWindow(this._cryptoMenuWindow);
};

Scene_Menu.prototype.closeCryptoMenuWindow = function() {
    this._cryptoMenuWindow.close();
    this._cryptoMenuWindow.deactivate();
    this._commandWindow.activate();
};

Scene_Menu.prototype.cryptoMenuIsOpen = function() {
    return this._cryptoMenuWindow && this._cryptoMenuWindow.isOpen() && this._cryptoMenuWindow.active;
};

function Window_CryptoMenu() {
    this.initialize.apply(this, arguments);
}

Window_CryptoMenu.prototype = Object.create(Window_Command.prototype);
Window_CryptoMenu.prototype.constructor = Window_CryptoMenu;

Window_CryptoMenu.prototype.initialize = function(rect) {
    const topMargin = 52;
    rect.y += topMargin;
    rect.height -= topMargin;
    Window_Command.prototype.initialize.call(this, rect);
};

Window_CryptoMenu.prototype.makeCommandList = function() {
    //this.addCommand("Save Passphrase with Password?", 'togglePassphrase', true);
    //this.addCommand("Show Passphrase", 'showPassphrase', true);
    this.addCommand("Send a Transaction", 'sendTransaction', true);
    this.addCommand("Show Balance", 'showBalance', true);
};

Scene_Menu.prototype.handleTogglePassphrase = function() {
    this.createPassphraseOptionsWindow();
    this._cryptoMenuWindow.deactivate();
};

Scene_Menu.prototype.createPassphraseOptionsWindow = function() {
    const width = 600;
    const height = this._cryptoMenuWindow.fittingHeight(3);
    const x = (Graphics.boxWidth - width) / 2;
    const y = (Graphics.boxHeight - height) / 2;

    this._passphraseOptionsWindow = new Window_PassphraseOptions(new Rectangle(x, y, width, height));
    this._passphraseOptionsWindow.setHandler('disableEncryption', this.handleDisableEncryption.bind(this));
    this._passphraseOptionsWindow.setHandler('changePassword', this.handleChangePassword.bind(this));
    this._passphraseOptionsWindow.setHandler('cancel', this.handleCancelPassphraseOption.bind(this));
    this.addWindow(this._passphraseOptionsWindow);
};

Scene_Menu.prototype.closePassphraseOptionsWindow = function() {
    this._passphraseOptionsWindow.close();
    this._passphraseOptionsWindow.deactivate();
    this._cryptoMenuWindow.activate();
};

function Window_PassphraseOptions() {
    this.initialize.apply(this, arguments);
}

Window_PassphraseOptions.prototype = Object.create(Window_Command.prototype);
Window_PassphraseOptions.prototype.constructor = Window_PassphraseOptions;

Window_PassphraseOptions.prototype.initialize = function(rect) {
    Window_Command.prototype.initialize.call(this, rect);
};

Window_PassphraseOptions.prototype.makeCommandList = function() {
    if ($gameVariables.value(8)) {
        this.addCommand("Disable Encryption with Password and Delete Passphrase", 'disableEncryption');
    } else {
        this.addCommand("Enable Passphrase Encryption with Password", 'enableEncryption');
    }
    this.addCommand("Change Password", 'changePassword');
    this.addCommand("Close", 'cancel');
};

Window_PassphraseOptions.prototype.refreshCommands = function() {
    this.clearCommandList();
    this.makeCommandList();
    this.refresh();
};

Window_PassphraseOptions.prototype.windowWidth = function() {
    return 600;
};

Scene_Menu.prototype.handleDisableEncryption = function() {
    this.createConfirmationWindow();
};

Scene_Menu.prototype.createConfirmationWindow = function() {
    const width = 400;
    const height = this.calcWindowHeight(2, true); // 2 commands, fitting height
    const x = (Graphics.boxWidth - width) / 2;
    const y = (Graphics.boxHeight - height) / 2;

    this._confirmationWindow = new Window_Confirmation(new Rectangle(x, y, width, height));
    this._confirmationWindow.setHandler('yes', this.handleConfirmYes.bind(this));
    this._confirmationWindow.setHandler('no', this.handleConfirmNo.bind(this));
    this.addWindow(this._confirmationWindow);
    this._confirmationWindow.open();
    this._confirmationWindow.activate();
};

function Window_Confirmation() {
    this.initialize.apply(this, arguments);
}

Window_Confirmation.prototype = Object.create(Window_Command.prototype);
Window_Confirmation.prototype.constructor = Window_Confirmation;

Window_Confirmation.prototype.initialize = function(rect) {
    Window_Command.prototype.initialize.call(this, rect);
};

Window_Confirmation.prototype.makeCommandList = function() {
    this.addCommand("Confirm Delete Encrypted Passphrase", 'yes');
    this.addCommand("Cancel", 'no');
};

Scene_Menu.prototype.handleConfirmYes = function() {
    $gameVariables.setValue(8, null); // Delete the passphrase
    this._confirmationWindow.close();
    this._confirmationWindow.deactivate();
    this._passphraseOptionsWindow.activate();
    this._passphraseOptionsWindow.refreshCommands();
};

Scene_Menu.prototype.handleConfirmNo = function() {
    this._confirmationWindow.close();
    this._confirmationWindow.deactivate();
    this._passphraseOptionsWindow.activate();
};

Scene_Menu.prototype.handleChangePassword = function() {
    console.log("Change Password");
    this.closePassphraseOptionsWindow();
};

Scene_Menu.prototype.handleCancelPassphraseOption = function() {
    console.log("Cancel");
    this.closePassphraseOptionsWindow();
};

Scene_Menu.prototype.handleShowPassphrase = function() {
    // Additional logic for handling Show Passphrase
    this._cryptoMenuWindow.deactivate();
};

Scene_Menu.prototype.handleSendTransaction = function() {
    
    SceneManager.goto(Scene_Map);
    $gamePlayer.reserveTransfer(12, 0, 0, 0, 0);
    this._cryptoMenuWindow.deactivate();
};

Scene_Menu.prototype.handleShowBalance = async function() {
    const lisk32Address = $gameVariables.value(7);
    const balance = await getBalance(lisk32Address);
    if (balance !== undefined) {
        this.createBalanceWindow(balance);
    } else {
        console.error("Failed to retrieve balance.");
        // Optionally, show an error message to the player
    }
    this._cryptoMenuWindow.deactivate();
};

Scene_Menu.prototype.createBalanceWindow = function(balance) {
    const width = 400;
    const height = 200; // Adjust height as needed
    const x = (Graphics.boxWidth - width) / 2;
    const y = (Graphics.boxHeight - height) / 2;

    this._balanceWindow = new Window_Balance(new Rectangle(x, y, width, height), balance);
    this._balanceWindow.setHandler('close', this.closeBalanceWindow.bind(this));
    this.addWindow(this._balanceWindow);
};

Scene_Menu.prototype.closeBalanceWindow = function() {
    this._balanceWindow.close();
    this._cryptoMenuWindow.activate(); // Reactivate the main menu
};

function Window_Balance() {
    this.initialize.apply(this, arguments);
}

Window_Balance.prototype = Object.create(Window_Command.prototype);
Window_Balance.prototype.constructor = Window_Balance;

Window_Balance.prototype.initialize = function(rect, balance) {
    Window_Command.prototype.initialize.call(this, rect);
    this._balance = balance;
    this.refreshCommands(); // Call to refresh and display the balance
};

Window_Balance.prototype.refreshCommands = function() {
    this.contents.clear();
    const textWidth = this.contentsWidth();
    const balanceText = this._balance ? `Balance: ${this._balance} FAET` : "Balance: 0 FAET";
    this.drawText(balanceText, 0, 0, textWidth, 'center');
    this.addCommand("Close", 'close');
};

Window_Balance.prototype.itemRectForText = function(index) {
    // Adjust the y position to draw commands below the balance text
    const rect = Window_Command.prototype.itemRectForText.call(this, index);
    rect.y += this.lineHeight(); // Move command below the balance text
    return rect;
};

Window_Balance.prototype.processOk = function() {
    Window_Command.prototype.processOk.call(this);
    const symbol = this.currentSymbol();
    if (symbol === 'close') {
        this.close();
    }
};

//----------------------------------------------   Input Utilities  ---------------------------------------------------

/*
    Handle Password/Passphrase Check (used in Send Transaction)
    -Is Password Protected?             
        Yes: Enter Password
        No:  Enter Passphrase
*/
async function getPassphrase() {
    try {
        // Check if an encrypted passphrase is stored
        const encryptedPassphrase = $gameVariables.value(passphraseVariableId);

        if (encryptedPassphrase) {
            let decryptedPassphrase = false;
            let attempts = 0; // Initialize password attempt counter

            while (!decryptedPassphrase && attempts < 1) {
                // Prompt for password to decrypt the passphrase
                if(attempts >= 3) {
                    alert('Failed to decrypt passphrase with the provided password. Please try again.');
                }
                
                const passwordLabel = showLabelText('Enter Password to Decrypt Passphrase');
                const password = await window.getStringInputTextBox(-1);
                SceneManager._scene.removeChild(passwordLabel);
                
                if (password) {
                    try {
                        decryptedPassphrase = await decryptPassphrase(password, passphraseVariableId);
                        if (decryptedPassphrase && bip39.validateMnemonic(decryptedPassphrase)) {
                            
                            $gameSwitches.setValue(6, true);
                            $gameSwitches.setValue(7, true);
                            
                            return decryptedPassphrase; // Return the decrypted passphrase
                        } else {
                            // Notify the user about the mismatch and prompt again
                            attempts++;
                            decryptedPassphrase = false;
                        }
                    } catch (decryptError) {
                        console.error("Decryption error:", decryptError);
                        // Notify the user about the error and prompt again
                        attempts++;
                        decryptedPassphrase = false;
                    }
                } else {
                    // No password entered                    
                    attempts++;
                    decryptedPassphrase = false;
                    return false;
                }
            }

            // If the user exceeds the maximum number of attempts
            if (attempts >= 3) {                
               $gameSwitches.setValue(8, true);
               return false;
            }
        } else {
            // No encrypted passphrase found, call handleContinue
            const handleContinueResult = await handleContinue();
            if (handleContinueResult) {
                $gameSwitches.setValue(6, true);
                $gameSwitches.setValue(7, true);
                return handleContinueResult;
            } else {
                $gameSwitches.setValue(7, false);
                return false; // handleContinue failed or was cancelled
            }
        }
    } catch (error) {
        console.error("Error in getPassphrase:", error);
        $gameSwitches.setValue(7, false);
        return false;
    }
}

//Encrypt Passphrase w/ Password
async function encryptPassphrase(passphrase, password, passphraseVariableId){
    const encryptedPassphrase = await liskCrypto.encrypt.encryptMessageWithPassword(passphrase, password);
    console.log(encryptedPassphrase);
    $gameVariables.setValue(passphraseVariableId, encryptedPassphrase);
    return encryptedPassphrase;
}

//Decrypt Passphrase w/ Password
async function decryptPassphrase(password, passphraseVariableId) {
    try {
        const decryptedPassphrase = await liskCrypto.encrypt.decryptMessageWithPassword($gameVariables.value(passphraseVariableId), password, "utf8");
        return decryptedPassphrase;
    } catch (error) {
        console.error("Error in decryptPassphrase:", error);
        return false;
    }
}


async function showPassphraseOnStart() {
    try {
        const clipboardText = await navigator.clipboard.readText();
        // Call getStringInputTextArea with clipboardText as the default text
            await window.getStringInputTextArea(-1, "Here is your passphrase, it has already been copied to your clipboard. Hit Enter when done:\n\n" + clipboardText).then(
                result => {
                    $gameSwitches.setValue(6, true); // Default is set to 6, this indicates input has been entered.
                });
        return clipboardText;
    } catch (error) {
        console.error('Failed to read from clipboard:', error);
        // Handle the error or inform the user
    }
}


//----------------------------------------------   Send Transaction  ---------------------------------------------------

async function promptSendTransaction() {
    try {
        let passphrase;
        const encryptedPassphrase = $gameVariables.value(8); // Check for encrypted passphrase

        if (encryptedPassphrase) {
            // Prompt for password to decrypt the passphrase
            
            const passwordLabel = showLabelText('Enter Password to Decrypt Passphrase');
            const password = await window.getStringInputTextBox(-1);
            
            SceneManager._scene.removeChild(passwordLabel);
            if (password) {
                passphrase = await decryptPassphrase(password, 8); 
                console.log(passphrase);
                if (!passphrase || !bip39.validateMnemonic(passphrase)) {
                    console.error("Invalid passphrase.");
                    return false;
                }
            } else {
                console.error("No password entered.");
                SceneManager._scene.removeChild(passwordLabel);
                return false;
            }
        } else {
            // Prompt for passphrase directly
            
            const passphraseLabel2 = showLabelText('Enter Passphrase');
            passphrase = await window.getStringInputTextArea(-1);
            if (!passphrase || !bip39.validateMnemonic(passphrase)) {
                console.error("Invalid passphrase.");
                return false;
            }
            
            SceneManager._scene.removeChild(passphraseLabel2);
        }

        
        // Prompt for recipient address
        const passwordLabelAddress = showLabelText('Enter Recipient Public Address');
        const recipientAddress = await window.getStringInputTextBox(-1);
        if (!recipientAddress) {
            console.error("No recipient address entered.");
            return false;
        }

        // Prompt for amount
        SceneManager._scene.removeChild(passwordLabelAddress);
        const passwordLabelAmount = showLabelText('Enter Amount');
        const amount = await window.getStringInputTextBox(-1);
        if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
            console.error("Invalid amount entered.");
            return false;
        }

        // Call sendTransaction function
        var key = [1, 2, 'A'];
        $gameSelfSwitches.setValue(key, false); // Ensure the game-load routine runs even if it's ran before on previous loads
        $gameSwitches.setValue(6, true);
        
        SceneManager._scene.removeChild(passwordLabelAmount);
        return await sendTransaction(recipientAddress, passphrase, amount);

    } catch (error) {
        console.error("Error in promptSendTransaction:", error);
        return false;
    }
}


async function sendTransaction(recipientAddress, senderPassphrase, amount){
    try {
        
        const privateKeyBuffer = await liskCrypto.ed.getPrivateKeyFromPhraseAndPath(senderPassphrase, "m/44'/134'/0'");

        const publicKeyBuffer = liskCrypto.ed.getPublicKeyFromPrivateKey(privateKeyBuffer);

        //sign transaction
        const nonce = await get_Nonce($gameVariables.value(publicKeyVariableId));
        
        const unsignedTransaction = build_SendingTransaction(publicKeyBuffer, recipientAddress, amount, nonce);

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

//----------------------------------------------   Fund Account  ---------------------------------------------------

async function fundAccount(recipientAddress){
    try {
        
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

async function getBalance(lisk32Address){

    try {
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

        // Check if the response has the necessary data
        if (answer && answer.result && answer.result.data && answer.result.data[0] && answer.result.data[0].availableBalance) {
            const balanceStr = answer.result.data[0].availableBalance;
            const formattedBalance = balanceStr.length > 8 
                ? balanceStr.slice(0, -8) + "." + balanceStr.slice(-8) 
                : "0." + balanceStr.padStart(8, '0');
            return formattedBalance;
        } else {
            console.error('Balance data is not available.');
            return 0;
        }
        
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


function build_FundingTransaction(publicKeyBuffer, recipientLSKAddressX, nonceX){
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
        recipientAddress: Buffer.from(liskCrypto.address.getAddressFromLisk32Address(recipientLSKAddressX), 'hex'),
        data: 'Welcome to Faet!'
    };

    // Add the transaction params to the transaction object
    unsignedTransaction.params = transferParams;

    // Return the unsigned transaction object
    return unsignedTransaction;
}

function build_SendingTransaction(publicKeyBuffer, recipientLSKAddressX, amount, nonceX){
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
        amount: BigInt(amount*100000000),
        recipientAddress: Buffer.from(liskCrypto.address.getAddressFromLisk32Address(recipientLSKAddressX), 'hex'),
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

function resetGameVariablesAndSwitches() {
    // Reset switches
    for (let i = 1; i <= $gameSwitches._data.length; i++) {
        $gameSwitches.setValue(i, false); // Replace 'false' with the default value for each switch
    }

    // Reset variables
    for (let i = 1; i <= $gameVariables._data.length; i++) {
        $gameVariables.setValue(i, 0); // Replace '0' with the default value for each variable
    }

    // Add any other state resets here (e.g., inventory, player stats)
}

function showLabelText(labelText) {
    const passwordLabel = new PIXI.Text(labelText, {fontFamily : 'Arial', fontSize: 24, fill : 0xffffff, align : 'center'});
    passwordLabel.x = Graphics.width / 2 - passwordLabel.width / 2;
    passwordLabel.y = Graphics.height / 2 - passwordLabel.height / 2 - 100; // Adjust Y position as needed
    SceneManager._scene.addChild(passwordLabel);

    // Return the label object
    return passwordLabel;
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
