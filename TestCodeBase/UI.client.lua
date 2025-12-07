-- UI.client.lua
-- Test: Root-level client script

local Logger = require("./Utils/Logger")

print("[CLIENT] UI client script started")

Logger.info("UI system initializing...")

local function createUI()
    print("[CLIENT] Creating main UI...")
    -- UI creation code here
end

local function setupEvents()
    print("[CLIENT] Setting up UI events...")
    -- Event handlers here
end

createUI()
setupEvents()

Logger.info("UI system ready!")
