-- Managers/SubManager/SubManager.lua
-- Test: Deeply nested module with relative path going up multiple levels

local Logger = require("../../Utils/Logger")

local SubManager = {}

SubManager.initialized = false

function SubManager.init()
    SubManager.initialized = true
    Logger.info("SubManager initialized from nested folder")
end

function SubManager.doSomething()
    if not SubManager.initialized then
        Logger.warn("SubManager not initialized!")
        return
    end
    Logger.debug("SubManager doing something...")
end

return SubManager
