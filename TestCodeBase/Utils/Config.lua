-- Utils/Config.lua
-- Test: Basic module that returns a table

local Config = {
    gameName = "Test Game",
    version = "1.0.0",
    debug = true,
    maxPlayers = 10,
    settings = {
        autoSave = true,
        saveInterval = 60
    }
}

return Config
