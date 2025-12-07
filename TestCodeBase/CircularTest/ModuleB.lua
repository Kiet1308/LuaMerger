-- CircularTest/ModuleB.lua
-- Test: Part of circular dependency (B requires A - creates cycle!)

local ModuleA = require("./ModuleA")

local ModuleB = {}
ModuleB.value = "B"
ModuleB.fromA = ModuleA.value

return ModuleB
