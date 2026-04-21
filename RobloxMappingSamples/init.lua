local CrashSync = require("./Modules/CrashSync")
local CrashTask = require("./Modules/CrashTask")
local CrashMethod = require("./Modules/CrashMethod")
local CrashSignal = require("./Modules/CrashSignal")

print("RobloxMappingSamples: bundle started")
print("You should see remapped errors that point back to Modules/*.lua")

task.delay(0.1, function()
    print("Running CrashSync.run()")
    CrashSync.run()
end)

task.delay(0.2, function()
    print("Running CrashTask.run()")
    CrashTask.run()
end)

task.delay(0.3, function()
    print("Running CrashMethod.run()")
    CrashMethod.run()
end)

task.delay(0.4, function()
    print("Running CrashSignal.run()")
    CrashSignal.run()
end)
