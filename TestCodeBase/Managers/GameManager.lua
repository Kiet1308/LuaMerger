-- Managers/GameManager.lua
-- Test: Manager that requires from multiple locations

local Config = require("../Utils/Config")
local Logger = require("../Utils/Logger")
local SubManager = require("./SubManager/SubManager")

local GameManager = {}

GameManager.running = false
GameManager.startTime = nil

function GameManager.start()
    if GameManager.running then
        Logger.warn("GameManager already running")
        return
    end
    
    GameManager.running = true
    GameManager.startTime = os.time()
    
    Logger.info("GameManager started")
    Logger.info("Game:", Config.gameName, "Version:", Config.version)
    
    -- Initialize sub-manager
    SubManager.init()
end

function GameManager.stop()
    if not GameManager.running then
        Logger.warn("GameManager not running")
        return
    end
    
    GameManager.running = false
    Logger.info("GameManager stopped")
end

function GameManager.getUptime()
    if GameManager.startTime then
        return os.time() - GameManager.startTime
    end
    return 0
end

return GameManager
