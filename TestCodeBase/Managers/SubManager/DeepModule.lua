-- Managers/SubManager/DeepModule.lua  
-- Test: Even deeper nesting to test path resolution

local Helpers = require("../../Utils/Helpers")

local DeepModule = {}

function DeepModule.calculate(a, b)
    local result = Helpers.lerp(a, b, 0.5)
    return Helpers.formatNumber(result)
end

function DeepModule.clampValue(value)
    return Helpers.clamp(value, 0, 100)
end

return DeepModule
