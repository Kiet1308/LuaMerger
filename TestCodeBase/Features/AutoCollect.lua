-- Features/AutoCollect.lua
-- Test: Another module in Features folder (folder require)

local AutoCollect = {}

AutoCollect.enabled = false
AutoCollect.radius = 50

function AutoCollect.init()
    print("    [AutoCollect] Initialized")
end

function AutoCollect.start()
    AutoCollect.enabled = true
    print("    [AutoCollect] Started collecting")
end

function AutoCollect.stop()
    AutoCollect.enabled = false
    print("    [AutoCollect] Stopped collecting")
end

function AutoCollect.setRadius(r)
    AutoCollect.radius = r
end

return AutoCollect
