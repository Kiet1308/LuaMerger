-- InputHandler.client.lua
-- Test: Another root-level client script with require

local Config = require("./Utils/Config")
local Logger = require("./Utils/Logger")

print("[CLIENT] InputHandler started")

local keybinds = {
    Toggle = "F1",
    Menu = "F2",
    Teleport = "F3"
}

local function onKeyPress(key)
    Logger.debug("Key pressed:", key)
end

Logger.info("InputHandler ready, debug mode:", Config.debug)
