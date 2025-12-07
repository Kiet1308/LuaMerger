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
