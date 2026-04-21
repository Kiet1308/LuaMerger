local M = {}

local function namedAsyncCrash()
    local inventory = nil
    print(inventory.Items)
end

function M.run()
    task.spawn(namedAsyncCrash)

    task.delay(0.05, function()
        local stats = nil
        print(stats.Gold)
    end)
end

return M
