-- Classes/NPC.lua
-- Test: Another class inheriting from Entity

local Entity = require("./Entity")

local NPC = {}
NPC.__index = NPC

setmetatable(NPC, {__index = Entity})

function NPC.new(name, maxHealth, dialogue)
    local self = Entity.new(name, maxHealth)
    setmetatable(self, NPC)
    
    self.dialogue = dialogue or {"Hello, traveler!"}
    self.dialogueIndex = 1
    self.friendly = true
    
    return self
end

function NPC:talk()
    local message = self.dialogue[self.dialogueIndex]
    print(string.format("  [NPC] %s says: \"%s\"", self.name, message))
    
    self.dialogueIndex = self.dialogueIndex + 1
    if self.dialogueIndex > #self.dialogue then
        self.dialogueIndex = 1
    end
end

function NPC:setHostile()
    self.friendly = false
    print(string.format("  [NPC] %s became hostile!", self.name))
end

return NPC
