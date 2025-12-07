-- Services/init.lua
-- Folder with init.lua acts as single module

local DataService = require("./DataService")
local NetworkService = require("./NetworkService")

local Services = {
    DataService = DataService,
    NetworkService = NetworkService
}

return Services
