-- Services/NetworkService.lua
-- Test: Another module within Services folder

local NetworkService = {}

function NetworkService.connect(url)
    print(string.format("  [NetworkService] Connecting to: %s", url))
    return true
end

function NetworkService.disconnect()
    print("  [NetworkService] Disconnected")
end

function NetworkService.send(data)
    print(string.format("  [NetworkService] Sending: %s", tostring(data)))
end

function NetworkService.receive()
    return "mock data"
end

return NetworkService
