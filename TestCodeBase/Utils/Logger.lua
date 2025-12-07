-- Utils/Logger.lua
-- Test: Module with functions, uses require dot notation from other files

local Logger = {}

function Logger.log(level, ...)
    local args = {...}
    local message = table.concat(args, " ")
    print(string.format("[%s] %s", level, message))
end

function Logger.info(...)
    Logger.log("INFO", ...)
end

function Logger.debug(...)
    Logger.log("DEBUG", ...)
end

function Logger.warn(...)
    Logger.log("WARN", ...)
end

function Logger.error(...)
    Logger.log("ERROR", ...)
end

return Logger
