-- Features/AutoFarm.lua
-- Test: Module in folder WITHOUT init.lua (for folder require feature)

local AutoFarm = {}

AutoFarm.enabled = false
AutoFarm.interval = 1

function AutoFarm.init()
    print("    [AutoFarm] Initialized")
end

function AutoFarm.start()
    AutoFarm.enabled = true
    print("    [AutoFarm] Started farming")
end

function AutoFarm.stop()
    AutoFarm.enabled = false
    print("    [AutoFarm] Stopped farming")
end

function AutoFarm.setInterval(seconds)
    AutoFarm.interval = seconds
end

return AutoFarm
