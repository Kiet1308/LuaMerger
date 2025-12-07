-- Features/AutoHeal.client.lua
-- Test: .client.lua file - should be wrapped in task.spawn

local Config = require("../Utils/Config")

print("[CLIENT] AutoHeal client script started")

local function autoHealLoop()
    while true do
        print("[CLIENT] AutoHeal: Checking health...")
        -- In real code this would wait
        -- task.wait(1)
        break -- Break immediately for testing
    end
end

if Config.debug then
    print("[CLIENT] AutoHeal running in debug mode")
end

autoHealLoop()
