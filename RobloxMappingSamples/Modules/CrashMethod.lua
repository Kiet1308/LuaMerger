local Controller = {}

function Controller:explode()
    local pet = nil
    return pet.Health
end

local M = {}

function M.run()
    Controller:explode()
end

return M
