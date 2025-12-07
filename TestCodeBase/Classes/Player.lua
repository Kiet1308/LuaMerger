-- Classes/Player.lua
-- Test: Class module that requires from parent directory (../)

local Entity = require("./Entity")
local Helpers = require("../Utils/Helpers")

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
