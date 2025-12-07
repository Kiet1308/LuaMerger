-- Main entry point - init.lua
-- Test: Entry point with init.lua, multiple requires, folder require

-- Test 1: Basic require with relative path
local Config = require("./Utils/Config")

-- Test 2: Require using dot notation  
local Logger = require("Utils.Logger")

-- Test 3: Require folder with init.lua (should act as single module)
local Services = require("./Services")

-- Test 4: NEW FEATURE - Require folder without init.lua (returns table)
local Features = require("./Features")

-- Test 5: Require nested module
local Player = require("./Classes/Player")

-- Test 6: Require from Managers
local GameManager = require("./Managers/GameManager")

print("=== LuaMerger Test Suite ===")
print("")

-- Use Config
print("Config loaded:")
print("  Game Name:", Config.gameName)
print("  Version:", Config.version)
print("  Debug:", Config.debug)
print("")

-- Use Logger
Logger.info("Logger initialized successfully")
Logger.debug("Debug mode is", Config.debug and "ON" or "OFF")
print("")

-- Use Services (from init.lua)
print("Services module loaded:")
print("  DataService available:", Services.DataService ~= nil)
print("  NetworkService available:", Services.NetworkService ~= nil)
Services.DataService.save("testKey", "testValue")
print("")

-- Use Features (folder require - table of modules)
print("Features folder loaded (table):")
for name, module in pairs(Features) do
    print("  Feature:", name, "->", type(module))
end
print("")

-- Initialize all features
print("Initializing all features:")
for name, feature in pairs(Features) do
    if feature.init then
        feature.init()
    end
end
print("")

-- Use Player class
print("Testing Player class:")
local player = Player.new("TestPlayer", 100)
player:takeDamage(30)
player:heal(10)
print("  Final health:", player:getHealth())
print("")

-- Use GameManager
print("Testing GameManager:")
GameManager.start()
print("")

print("=== All tests completed! ===")
