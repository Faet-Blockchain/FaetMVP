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

----------------

you call commands via "./bin/run endpoint:invoke app_getRegisteredCommands"
