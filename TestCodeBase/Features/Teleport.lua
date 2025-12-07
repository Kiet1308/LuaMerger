-- Features/Teleport.lua
-- Test: Teleport feature (tests folder require with 4+ modules)

local Teleport = {}

Teleport.lastPosition = nil

function Teleport.init()
    print("    [Teleport] Initialized")
end

function Teleport.toPosition(x, y, z)
    Teleport.lastPosition = {x = x, y = y, z = z}
    print(string.format("    [Teleport] Teleported to: %d, %d, %d", x, y, z))
end

function Teleport.toPlayer(playerName)
    print("    [Teleport] Teleported to player: " .. playerName)
end

function Teleport.back()
    if Teleport.lastPosition then
        print("    [Teleport] Teleported back to last position")
    else
        print("    [Teleport] No last position saved")
    end
end

return Teleport
