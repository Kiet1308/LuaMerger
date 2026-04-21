local RunService = game:GetService("RunService")

local M = {}

function M.run()
    local connection

    local function onHeartbeat()
        connection:Disconnect()

        local character = nil
        print(character.PrimaryPart)
    end

    connection = RunService.Heartbeat:Connect(onHeartbeat)
end

return M
