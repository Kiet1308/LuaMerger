-- Services/DataService.lua
-- Test: Module within a folder that has init.lua

local DataService = {}

local dataStore = {}

function DataService.save(key, value)
    dataStore[key] = value
    print(string.format("  [DataService] Saved: %s = %s", key, tostring(value)))
end

function DataService.load(key)
    return dataStore[key]
end

function DataService.delete(key)
    dataStore[key] = nil
end

function DataService.getAll()
    return dataStore
end

return DataService
