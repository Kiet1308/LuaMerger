-- Features/ESP.lua
-- Test: ESP feature in Features folder

local ESP = {}

ESP.enabled = false
ESP.showPlayers = true
ESP.showItems = true
ESP.showNPCs = false

function ESP.init()
    print("    [ESP] Initialized")
end

function ESP.toggle()
    ESP.enabled = not ESP.enabled
    print("    [ESP] " .. (ESP.enabled and "Enabled" or "Disabled"))
end

function ESP.configure(options)
    if options.players ~= nil then ESP.showPlayers = options.players end
    if options.items ~= nil then ESP.showItems = options.items end
    if options.npcs ~= nil then ESP.showNPCs = options.npcs end
end

return ESP
