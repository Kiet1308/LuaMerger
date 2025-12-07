-- Bundled by Lua Bundler
-- Generated: 2025-12-07T15:44:26.930Z
-- Entry: init

-- Module cache (tree-based storage with flat key fallback)
local __modules = {}
local __loaded = {}

-- Get module loader: check flat key first, then tree navigation
local function __getModule(name)
    -- First check flat key (for modules under init.lua folders)
    if __modules[name] then return __modules[name] end
    -- Then try tree navigation
    local current = __modules
    for part in name:gmatch("[^/]+") do
        if type(current) ~= "table" then return nil end
        current = current[part]
        if not current then return nil end
    end
    return current
end

-- Custom require that navigates module tree
local function __require(name)
    if __loaded[name] then return __loaded[name] end
    local loader = __getModule(name)
    if type(loader) == "function" then
        __loaded[name] = loader()
        return __loaded[name]
    end
    return require(name)
end

-- Folder require - returns table of all modules in folder
local function __requireFolder(folderPath)
    local folder = __getModule(folderPath)
    if type(folder) ~= "table" then return {} end
    local result = {}
    for name, loader in pairs(folder) do
        if type(loader) == "function" then
            result[name] = __require(folderPath .. "/" .. name)
        end
    end
    return result
end
-- Initialize module tree
__modules.Utils = __modules.Utils or {}
__modules.Classes = __modules.Classes or {}
__modules.Managers = __modules.Managers or {}
__modules.Features = __modules.Features or {}
__modules.Managers.SubManager = __modules.Managers.SubManager or {}
-- Module: Utils/Config
-- Source: c:\Users\trinh\Downloads\LuaMerger\TestCodeBase\Utils\Config.lua
__modules.Utils.Config = function()
    -- Utils/Config.lua
    -- Test: Basic module that returns a table

    local Config = {
        gameName = "Test Game",
        version = "1.0.0",
        debug = true,
        maxPlayers = 10,
        settings = {
            autoSave = true,
            saveInterval = 60
        }
    }

    return Config

end
-- Module: Utils/Logger
-- Source: c:\Users\trinh\Downloads\LuaMerger\TestCodeBase\Utils\Logger.lua
__modules.Utils.Logger = function()
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

end
-- Module: Services/DataService
-- Source: c:\Users\trinh\Downloads\LuaMerger\TestCodeBase\Services\DataService.lua
__modules["Services/DataService"] = function()
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

end
-- Module: Services/NetworkService
-- Source: c:\Users\trinh\Downloads\LuaMerger\TestCodeBase\Services\NetworkService.lua
__modules["Services/NetworkService"] = function()
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

end
-- Module: Services
-- Source: c:\Users\trinh\Downloads\LuaMerger\TestCodeBase\Services\init.lua
__modules.Services = function()
    -- Services/init.lua
    -- Folder with init.lua acts as single module

    local DataService = __require("Services/DataService")
    local NetworkService = __require("Services/NetworkService")

    local Services = {
        DataService = DataService,
        NetworkService = NetworkService
    }

    return Services

end
-- Module: Classes/Entity
-- Source: c:\Users\trinh\Downloads\LuaMerger\TestCodeBase\Classes\Entity.lua
__modules.Classes.Entity = function()
    -- Classes/Entity.lua
    -- Test: Base class module (required by Player)

    local Entity = {}
    Entity.__index = Entity

    function Entity.new(name, maxHealth)
        local self = setmetatable({}, Entity)
        
        self.name = name
        self.maxHealth = maxHealth
        self.health = maxHealth
        self.alive = true
        
        return self
    end

    function Entity:getHealth()
        return self.health
    end

    function Entity:getMaxHealth()
        return self.maxHealth
    end

    function Entity:isAlive()
        return self.alive
    end

    function Entity:takeDamage(amount)
        self.health = math.max(0, self.health - amount)
        print(string.format("  [Entity] %s took %d damage (HP: %d/%d)", 
            self.name, amount, self.health, self.maxHealth))
        
        if self.health <= 0 then
            self:die()
        end
    end

    function Entity:heal(amount)
        local oldHealth = self.health
        self.health = math.min(self.maxHealth, self.health + amount)
        local healed = self.health - oldHealth
        print(string.format("  [Entity] %s healed for %d (HP: %d/%d)", 
            self.name, healed, self.health, self.maxHealth))
    end

    function Entity:die()
        self.alive = false
        print(string.format("  [Entity] %s has died!", self.name))
    end

    return Entity

end
-- Module: Utils/Helpers
-- Source: c:\Users\trinh\Downloads\LuaMerger\TestCodeBase\Utils\Helpers.lua
__modules.Utils.Helpers = function()
    -- Utils/Helpers.lua
    -- Test: Utility functions

    local Helpers = {}

    function Helpers.formatNumber(num)
        return string.format("%.2f", num)
    end

    function Helpers.clamp(value, min, max)
        return math.max(min, math.min(max, value))
    end

    function Helpers.lerp(a, b, t)
        return a + (b - a) * t
    end

    function Helpers.tableLength(t)
        local count = 0
        for _ in pairs(t) do
            count = count + 1
        end
        return count
    end

    return Helpers

end
-- Module: Classes/Player
-- Source: c:\Users\trinh\Downloads\LuaMerger\TestCodeBase\Classes\Player.lua
__modules.Classes.Player = function()
    -- Classes/Player.lua
    -- Test: Class module that requires from parent directory (../)

    local Entity = __require("Classes/Entity")
    local Helpers = __require("Utils/Helpers")

    local Player = {}
    Player.__index = Player

    -- Inherit from Entity
    setmetatable(Player, {__index = Entity})

    function Player.new(name, maxHealth)
        local self = Entity.new(name, maxHealth)
        setmetatable(self, Player)
        
        self.inventory = {}
        self.level = 1
        self.experience = 0
        
        return self
    end

    function Player:addItem(item)
        table.insert(self.inventory, item)
        print(string.format("  [Player] %s picked up: %s", self.name, item))
    end

    function Player:getInventoryCount()
        return Helpers.tableLength(self.inventory)
    end

    function Player:gainExperience(amount)
        self.experience = self.experience + amount
        print(string.format("  [Player] %s gained %d XP", self.name, amount))
        
        -- Level up check
        if self.experience >= self.level * 100 then
            self:levelUp()
        end
    end

    function Player:levelUp()
        self.level = self.level + 1
        self.experience = 0
        print(string.format("  [Player] %s leveled up to %d!", self.name, self.level))
    end

    return Player

end
-- Module: Managers/SubManager/SubManager
-- Source: c:\Users\trinh\Downloads\LuaMerger\TestCodeBase\Managers\SubManager\SubManager.lua
__modules.Managers.SubManager.SubManager = function()
    -- Managers/SubManager/SubManager.lua
    -- Test: Deeply nested module with relative path going up multiple levels

    local Logger = __require("Utils/Logger")

    local SubManager = {}

    SubManager.initialized = false

    function SubManager.init()
        SubManager.initialized = true
        Logger.info("SubManager initialized from nested folder")
    end

    function SubManager.doSomething()
        if not SubManager.initialized then
            Logger.warn("SubManager not initialized!")
            return
        end
        Logger.debug("SubManager doing something...")
    end

    return SubManager

end
-- Module: Managers/GameManager
-- Source: c:\Users\trinh\Downloads\LuaMerger\TestCodeBase\Managers\GameManager.lua
__modules.Managers.GameManager = function()
    -- Managers/GameManager.lua
    -- Test: Manager that requires from multiple locations

    local Config = __require("Utils/Config")
    local Logger = __require("Utils/Logger")
    local SubManager = __require("Managers/SubManager/SubManager")

    local GameManager = {}

    GameManager.running = false
    GameManager.startTime = nil

    function GameManager.start()
        if GameManager.running then
            Logger.warn("GameManager already running")
            return
        end
        
        GameManager.running = true
        GameManager.startTime = os.time()
        
        Logger.info("GameManager started")
        Logger.info("Game:", Config.gameName, "Version:", Config.version)
        
        -- Initialize sub-manager
        SubManager.init()
    end

    function GameManager.stop()
        if not GameManager.running then
            Logger.warn("GameManager not running")
            return
        end
        
        GameManager.running = false
        Logger.info("GameManager stopped")
    end

    function GameManager.getUptime()
        if GameManager.startTime then
            return os.time() - GameManager.startTime
        end
        return 0
    end

    return GameManager

end
-- Module: Features/AutoCollect
-- Source: c:\Users\trinh\Downloads\LuaMerger\TestCodeBase\Features\AutoCollect.lua
__modules.Features.AutoCollect = function()
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

end
-- Module: Features/AutoFarm
-- Source: c:\Users\trinh\Downloads\LuaMerger\TestCodeBase\Features\AutoFarm.lua
__modules.Features.AutoFarm = function()
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

end
-- Module: Features/ESP
-- Source: c:\Users\trinh\Downloads\LuaMerger\TestCodeBase\Features\ESP.lua
__modules.Features.ESP = function()
    -- Features/ESP.lua
    -- Test: ESP feature in Features folder

    local ESP = {}

    ESP.enabled = false
    ESP.showPlayers = true
    ESP.showItems = true
    ESP.showNPCs = false

    function ESP.init()
        print("    [ESP] Initialized")
    end

    function ESP.toggle()
        ESP.enabled = not ESP.enabled
        print("    [ESP] " .. (ESP.enabled and "Enabled" or "Disabled"))
    end

    function ESP.configure(options)
        if options.players ~= nil then ESP.showPlayers = options.players end
        if options.items ~= nil then ESP.showItems = options.items end
        if options.npcs ~= nil then ESP.showNPCs = options.npcs end
    end

    return ESP

end
-- Module: Features/Teleport
-- Source: c:\Users\trinh\Downloads\LuaMerger\TestCodeBase\Features\Teleport.lua
__modules.Features.Teleport = function()
    -- Features/Teleport.lua
    -- Test: Teleport feature (tests folder require with 4+ modules)

    local Teleport = {}

    Teleport.lastPosition = nil

    function Teleport.init()
        print("    [Teleport] Initialized")
    end

    function Teleport.toPosition(x, y, z)
        Teleport.lastPosition = {x = x, y = y, z = z}
        print(string.format("    [Teleport] Teleported to: %d, %d, %d", x, y, z))
    end

    function Teleport.toPlayer(playerName)
        print("    [Teleport] Teleported to player: " .. playerName)
    end

    function Teleport.back()
        if Teleport.lastPosition then
            print("    [Teleport] Teleported back to last position")
        else
            print("    [Teleport] No last position saved")
        end
    end

    return Teleport

end

-- CLIENT SCRIPTS (execute in parallel via task.spawn)
-- Client: Features/AutoHeal.client
-- Source: c:\Users\trinh\Downloads\LuaMerger\TestCodeBase\Features\AutoHeal.client.lua
task.spawn(function()
    -- Features/AutoHeal.client.lua
    -- Test: .client.lua file - should be wrapped in task.spawn

    local Config = __require("Utils/Config")

    print("[CLIENT] AutoHeal client script started")

    local function autoHealLoop()
        while true do
            print("[CLIENT] AutoHeal: Checking health...")
            -- In real code this would wait
            -- task.wait(1)
            break -- Break immediately for testing
        end
    end

    if Config.debug then
        print("[CLIENT] AutoHeal running in debug mode")
    end

    autoHealLoop()

end)

-- Client: InputHandler.client
-- Source: c:\Users\trinh\Downloads\LuaMerger\TestCodeBase\InputHandler.client.lua
task.spawn(function()
    -- InputHandler.client.lua
    -- Test: Another root-level client script with require

    local Config = __require("Utils/Config")
    local Logger = __require("Utils/Logger")

    print("[CLIENT] InputHandler started")

    local keybinds = {
        Toggle = "F1",
        Menu = "F2",
        Teleport = "F3"
    }

    local function onKeyPress(key)
        Logger.debug("Key pressed:", key)
    end

    Logger.info("InputHandler ready, debug mode:", Config.debug)

end)

-- Client: UI.client
-- Source: c:\Users\trinh\Downloads\LuaMerger\TestCodeBase\UI.client.lua
task.spawn(function()
    -- UI.client.lua
    -- Test: Root-level client script

    local Logger = __require("Utils/Logger")

    print("[CLIENT] UI client script started")

    Logger.info("UI system initializing...")

    local function createUI()
        print("[CLIENT] Creating main UI...")
        -- UI creation code here
    end

    local function setupEvents()
        print("[CLIENT] Setting up UI events...")
        -- Event handlers here
    end

    createUI()
    setupEvents()

    Logger.info("UI system ready!")

end)
-- ENTRY POINT: init
do
    -- Main entry point - init.lua
    -- Test: Entry point with init.lua, multiple requires, folder require

    -- Test 1: Basic require with relative path
    local Config = __require("Utils/Config")

    -- Test 2: Require using dot notation  
    local Logger = __require("Utils/Logger")

    -- Test 3: Require folder with init.lua (should act as single module)
    local Services = __require("Services")

    -- Test 4: NEW FEATURE - Require folder without init.lua (returns table)
    local Features = __requireFolder("Features")

    -- Test 5: Require nested module
    local Player = __require("Classes/Player")

    -- Test 6: Require from Managers
    local GameManager = __require("Managers/GameManager")

    print("=== LuaMerger Test Suite ===")
    print("")

    -- Use Config
    print("Config loaded:")
    print("  Game Name:", Config.gameName)
    print("  Version:", Config.version)
    print("  Debug:", Config.debug)
    print("")

    -- Use Logger
    Logger.info("Logger initialized successfully")
    Logger.debug("Debug mode is", Config.debug and "ON" or "OFF")
    print("")

    -- Use Services (from init.lua)
    print("Services module loaded:")
    print("  DataService available:", Services.DataService ~= nil)
    print("  NetworkService available:", Services.NetworkService ~= nil)
    Services.DataService.save("testKey", "testValue")
    print("")

    -- Use Features (folder require - table of modules)
    print("Features folder loaded (table):")
    for name, module in pairs(Features) do
        print("  Feature:", name, "->", type(module))
    end
    print("")

    -- Initialize all features
    print("Initializing all features:")
    for name, feature in pairs(Features) do
        if feature.init then
            feature.init()
        end
    end
    print("")

    -- Use Player class
    print("Testing Player class:")
    local player = Player.new("TestPlayer", 100)
    player:takeDamage(30)
    player:heal(10)
    print("  Final health:", player:getHealth())
    print("")

    -- Use GameManager
    print("Testing GameManager:")
    GameManager.start()
    print("")

    print("=== All tests completed! ===")

end