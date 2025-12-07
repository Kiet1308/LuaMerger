-- CircularTest/init.lua
-- Test: Entry point for circular dependency test (SHOULD FAIL)
-- Use this to test that the bundler correctly detects circular dependencies

local ModuleA = require("./ModuleA")

print("This should not print if circular detection works")
print(ModuleA.value)
