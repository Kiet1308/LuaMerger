-- Utils/Helpers.lua
-- Test: Utility functions

local Helpers = {}

function Helpers.formatNumber(num)
    return string.format("%.2f", num)
end

function Helpers.clamp(value, min, max)
    return math.max(min, math.min(max, value))
end

function Helpers.lerp(a, b, t)
    return a + (b - a) * t
end

function Helpers.tableLength(t)
    local count = 0
    for _ in pairs(t) do
        count = count + 1
    end
    return count
end

return Helpers
