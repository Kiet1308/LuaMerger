-- CircularTest/ModuleA.lua
-- Test: Part of circular dependency (A requires B)

local ModuleB = require("./ModuleB")

local ModuleA = {}
ModuleA.value = "A"
ModuleA.fromB = ModuleB.value

return ModuleA
