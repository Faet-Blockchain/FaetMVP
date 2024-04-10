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
const fs = require('fs').promises;

// File paths for JSON files
const weaponsFilePath = '../../data/Weapons.json';
const actorsFilePath = '../../data/Actors.json';

//Static Constants
const publicKeyVariableId = 7; // ID to store the public key
const passphraseVariableId = 8; // ID to store the encrypted passphrase
const passwordProtectSwitch = 9; // ID to the switch that sets Passphrase protection via password

var nftImageData = '';

//----------------------------------------------   Generate Passphrase  ---------------------------------------------------

function updateWeaponFromJSON(weaponData) {

    try {

        // Validate weaponData
        if (!weaponData || !weaponData.id) {
            console.error("Invalid weapon data");
            return;
        }

        // Check if the weapon exists in the game's database
        var weaponId = weaponData.id;
        if (!$dataWeapons[weaponId]) {
            console.error("Weapon with ID " + weaponId + " does not exist");
            return;
        }

        // Update the weapon properties
        var gameWeapon = $dataWeapons[weaponId];
        for (var key in weaponData) {
            if (weaponData.hasOwnProperty(key)) {
                gameWeapon[key] = weaponData[key];
            }
        }

        console.log("Weapon updated: ", gameWeapon.name);
    } catch (e) {
        console.error("Error parsing JSON or updating weapon: ", e);
    }
}

function addWeaponToInventory(weaponId, quantity) {
    if (!$dataWeapons[weaponId]) {
        console.error("Weapon with ID " + weaponId + " does not exist");
        return;
    }

    if (quantity <= 0) {
        console.error("Quantity must be greater than 0");
        return;
    }

    // Adding the weapon to the player's inventory
    $gameParty.gainItem($dataWeapons[weaponId], quantity);
    console.log("Added " + quantity + " of weapon ID " + weaponId + " to inventory.");
}


//----------------------------------------------  Show Weapon Image ------------------------------------------------------

// Extend Window_ItemList's select method
const _Window_ItemList_select = Window_ItemList.prototype.select;
Window_ItemList.prototype.select = function(index) {
    _Window_ItemList_select.call(this, index);
    if (SceneManager._scene instanceof Scene_Item) {
        this._itemSelected = this.item() ? true : false;
    } else {
        this._itemSelected = false;
    }
};

// Extend Window_ItemList's processOk method for mouse clicks
const _Window_ItemList_processOk = Window_ItemList.prototype.processOk;
Window_ItemList.prototype.processOk = function() {
    if (this._itemSelected && SceneManager._scene instanceof Scene_Item) {
        this.toggleItemActionWindow();
    } else {
        _Window_ItemList_processOk.call(this);
    }
};

// Extend Window_ItemList's update method to check for keypresses
const _Window_ItemList_update = Window_ItemList.prototype.update;
Window_ItemList.prototype.update = function() {
    _Window_ItemList_update.call(this);
    if (SceneManager._scene instanceof Scene_Item) {
        if (this._itemSelected && Input.isTriggered('ok')) {
            this.toggleItemActionWindow();
        }
        if (this._itemActionWindow && this._itemActionWindow.isOpen() && Input.isTriggered('cancel')) {
            this.closeItemActionWindow();
        }
    }
};

// Toggle the item action window
Window_ItemList.prototype.toggleItemActionWindow = function() {
    if (!this._itemActionWindow || !this._itemActionWindow.isOpen()) {
        this.openItemActionWindow();
    } else {
        this.closeItemActionWindow();
    }
};

// Open the item action window
Window_ItemList.prototype.openItemActionWindow = function() {
    if (!this._itemActionWindow) {
        const wx = (Graphics.boxWidth - 400) / 2;
        const wy = (Graphics.boxHeight - 600) / 2;
        this._itemActionWindow = new Window_Base(new Rectangle(wx, wy, 365, 365));
        this.addChild(this._itemActionWindow);
    }
    const item = this.item();
    this._itemActionWindow.contents.clear();
    
    // Replace 'yourBase64String' with the actual Base64 string for the image
    
    
    this.drawImageFromBase64(this._itemActionWindow, nftImageData, 0, 0);

    this._itemActionWindow.open();
    this.deactivate();
};

// Function to draw image from Base64 string
Window_ItemList.prototype.drawImageFromBase64 = function(window, base64, x, y) {
    const image = new Image();
    image.src = base64;
    image.onload = function() {
        const bitmap = new Bitmap(image.width, image.height);
        bitmap.context.drawImage(image, 0, 0);
        window.contents.blt(bitmap, 0, 0, image.width, image.height, x, y);
    };
};

// Close the item action window
Window_ItemList.prototype.closeItemActionWindow = function() {
    if (this._itemActionWindow) {
        this._itemActionWindow.close();
        this.activate();
    }
};

// Initialize the flag in the constructor
const _Window_ItemList_initialize = Window_ItemList.prototype.initialize;
Window_ItemList.prototype.initialize = function(rect) {
    _Window_ItemList_initialize.call(this, rect);
    this._itemSelected = false;
    this._itemActionWindow = null;
};



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

        //TEMPORARY WORKAROUND, REMOVE AFTER UI UPGRADE
        //$gameVariables.setValue(12, passphrase);
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

async function handleEnterPassphrase() {
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
            console.error("Error in handleEnterPassphrase:", error);
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
            const handleEnterPassphrase = await handleEnterPassphrase();
            if (handleEnterPassphrase) {
                $gameSwitches.setValue(6, true);
                $gameSwitches.setValue(7, true);
                return handleEnterPassphrase;
            } else {
                $gameSwitches.setValue(7, false);
                return false; // handleEnterPassphrase failed or was cancelled
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

/*
async function postNFT(){
    try {
        //lskbx988tt7xybrk7mohau8c7s6a5vxo95c3sj3jn
        const privateKeyBuffer = Buffer.from("d6cd6cf732cae8be22a8cb55a5f3148fb0cf8dddc98f5786fc44422443b9422429f9ab6a552a58b3294147de22514665708094683a0373bc16aafdb911fa0a9a", 'hex');
        
        const recipientAddress = $gameVariables.value(7);
        
        const publicKeyBuffer = liskCrypto.ed.getPublicKeyFromPrivateKey(privateKeyBuffer);

        //sign transaction

        const nonce = await get_Nonce('lskbx988tt7xybrk7mohau8c7s6a5vxo95c3sj3jn');

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
}*/

async function postNFT(passphrase){
    try {

        //const passphrase = $gameVariables.value(12);

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

        console.log(answer);

        return true;
    } catch (error) {
        console.error('Error:', error);
        return false;
    }
}

async function processNFTs(passphrase) {
    try {
        
        // Await the resolution of postNFT
        const postNFTtransaction = await postNFT(passphrase);
        
        // Wait for 30 seconds
        await new Promise(resolve => setTimeout(resolve, 10000));

        // After the delay, call getNFTs
        const getNFTtransaction = await getNFTs($gameVariables.value(7));
        
        let stringFromHex = hexToString(getNFTtransaction.attributesArray[0].attributes);
        
        let itemNFT = JSON.parse(stringFromHex);

        //push the item to the player's inventory
        nftImageData = itemNFT.image;
        updateWeaponFromJSON(itemNFT.data);
        addWeaponToInventory(1, 1);

    } catch (error) {
        // Handle any errors that occur during the process
        console.error("An error occurred:", error);
    }
}

async function promptMintNFT() {
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

        const passwordLabel = showLabelText('Please wait. Minting confirmation may take up to 15 seconds.');
        const mintNFT = await processNFTs(passphrase);

        $gameSwitches.setValue(6, true);
        return true;

    } catch (error) {
        console.error("Error in promptSendTransaction:", error);
        return false;
    }
}

//----------------------------------------------   Show Balances  ---------------------------------------------------

function getNFTs(lisk32Address) {
    return new Promise(async (resolve, reject) => {
        try {
            //const lisk32Address = $gameVariables.value(7);
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

                console.log(event.data);

                const parsedResponse = JSON.parse(event.data);
                ws.close();
                if (parsedResponse.result.nfts[0] != null) {             
                    resolve(parsedResponse.result.nfts[0]);
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

    const sampleWeaponString = JSON.stringify(sampleWeaponNFT);

    // Create the asset for the Token Transfer transaction
    const transferParams = {
        address: addressBuffer, 
        collectionID: Buffer.from("00000000", "hex"),
        attributesArray: [{
            module: "testNft",
            attributes: sampleWeaponString
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

// Convert Hex String to String
function hexToString(hex) {
    var string = '';
    for (var i = 0; i < hex.length; i += 2) {
        string += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return string;
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
						dataType: 'string',
						fieldNumber: 2,
					},
				},
			},
		},
	},
};

/*
const sampleWeaponNFT = {
    "image": "data:image/png;base64,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",
    "data": {
        "id":1,
        "animationId":6,
        "description":"[Sword] A light and easy-to-wield short-bladed sword.",
        "etypeId":1,
        "traits":[
        {
            "code":31,
            "dataId":1,
            "value":0
        },
        {
            "code":22,
            "dataId":0,
            "value":0
        }
        ],
        "iconIndex":97,
        "name":"Short Sword",
        "note":"",
        "params":[
        0,
        0,
        8,
        0,
        0,
        0,
        0,
        0
        ],
        "price":300,
        "wtypeId":2
    }
};*/
    
const sampleWeaponNFT = {"image":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEUAAABGCAYAAACaGVmHAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsQAAA7EAZUrDhsAAALVSURBVHhe7Zq9ctpAFIVXKaiYYYY3oOMJaFJQJL3fwmVewcMruPVTMJMyKUMTkpqWxj20FERntde+LMegnxit5PvNwG5h5NHRd4+Qx9kxxxknfAqrobBQCBYKobedkmVZ2F2GnX7vQpEwttutX8FgMAi7gt1u56bTqd+z07fxIfTKFFiiDQHaEhgimCkV6UUoMCS2BIaIJTBEW3KNToeiw5BAdBiAhbHf78OOY+ND6GzRVilVQRsym838akVbks6ZAkPAZrPxKxiNRmFXrkNgyaXTNlMInTHlmiGgSY9oOhEKAtFhgCojUzYMwcaHkLQptyhVhplCSNKUW5YqI7lQbl2qDBsfQjKmtFWqDDOF0LopbZcqo9VQUihVho0PoRVTUipVhplCqGUKrnTdqxT3SNulyqgUimi//Hl0d1+KfdmPNx2ZW4Qh2PgQ3j0UGCIjI5bAELEEhsSWwJDYEhhyC0uAmUKo3SnCpW4RQzSp9oim9t1HgmGhSHir1cqNx2O/70IYgo0PobYpD4+nH1t8e/3uok2ZTCZ+L7BS1UiptomZQqhlChAbxBhmynq99isYDodh90pKPaIxUwiNTRGO+Z03K/6NzC3DIe/yn0GvxBwOh7Bzbj6f+zUFQ4TaocQgJAnjr3/PR0oFJ+HEgaQUhmDjQ/ivpjyQQ/15evLr9/t7v2pStASYKYTGpujCjU2BJWJIqlYwmn9P8e/O/cpfP4rtCbgrAbkzgdQDsvEh1DIFlnwN+89hBYuw6kOKUezPDSBFa8wUQiVT5KrDEjEEXQLQJ+xQuogBe7rWpGBOqVDiUgU6DFD2ZHRIcUBAP1i2hY0P4U1TYu2BLldWqlVhv6NtS4CZQrhqynG5zB97i+febCF+pHFF34szUxDGidZ5IL+fn/1L6HMgwMaHcDY+L2NDnlkEM+UD8qYpmr6bEWOmEEp9zf9omCkEC4VgoRAslDOc+wfQpya4R0mYEgAAAABJRU5ErkJggg==","data":{"id":1,"animationId":6,"description":"[Sword] A light and easy-to-wield short-bladed sword.","etypeId":1,"traits":[{"code":31,"dataId":1,"value":0},{"code":22,"dataId":0,"value":0}],"iconIndex":97,"name":"Short Sword","note":"","params":[0,0,8,0,0,0,0,0],"price":300,"wtypeId":2}};
