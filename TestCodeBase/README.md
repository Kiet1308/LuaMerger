# TestCodeBase - LuaMerger Test Suite

Đây là cấu trúc test đầy đủ để kiểm tra tất cả các chức năng của LuaMerger extension.

## 📁 Cấu trúc thư mục

```
TestCodeBase/
├── init.lua                    # 🚀 ENTRY POINT - File chính để bundle
├── UI.client.lua               # Client script (task.spawn)
├── InputHandler.client.lua     # Client script (task.spawn)
│
├── Utils/                      # Utility modules
│   ├── Config.lua              # Basic config module
│   ├── Logger.lua              # Logger với functions
│   └── Helpers.lua             # Helper functions
│
├── Services/                   # Folder VỚI init.lua
│   ├── init.lua                # Exports DataService + NetworkService
│   ├── DataService.lua         # Data service module
│   └── NetworkService.lua      # Network service module
│
├── Features/                   # Folder KHÔNG có init.lua (Folder Require!)
│   ├── AutoFarm.lua            # Feature module
│   ├── AutoCollect.lua         # Feature module
│   ├── ESP.lua                 # Feature module
│   ├── Teleport.lua            # Feature module
│   └── AutoHeal.client.lua     # Client script trong folder
│
├── Classes/                    # OOP classes với inheritance
│   ├── Entity.lua              # Base class
│   ├── Player.lua              # Inherits Entity, requires ../Utils
│   └── NPC.lua                 # Inherits Entity
│
├── Managers/                   # Nested managers
│   ├── GameManager.lua         # Manager với multiple requires
│   └── SubManager/             # Nested subfolder
│       ├── SubManager.lua      # Uses ../../ relative path
│       └── DeepModule.lua      # Deep nested module
│
└── CircularTest/               # ⚠️ SHOULD FAIL - Test circular detection
    ├── init.lua                # Entry for circular test
    ├── ModuleA.lua             # Requires ModuleB
    └── ModuleB.lua             # Requires ModuleA (creates cycle!)
```

## 🧪 Test Cases

### 1. Basic Require (✅ Should Work)
- File: `init.lua` → `require("./Utils/Config")`
- Test: Basic relative path require

### 2. Dot Notation (✅ Should Work)
- File: `init.lua` → `require("Utils.Logger")`
- Test: Lua dot notation path

### 3. Folder với init.lua (✅ Should Work)
- File: `init.lua` → `require("./Services")`
- Expected: Returns the exports from `Services/init.lua`

### 4. ⭐ NEW: Folder Require (✅ Should Work)
- File: `init.lua` → `require("./Features")`
- Expected: Returns table `{ AutoFarm = module, AutoCollect = module, ... }`
- Note: `.client.lua` files should NOT be included

### 5. Client Scripts (✅ Should Work)
- Files: `*.client.lua`
- Expected: Wrapped in `task.spawn(function() ... end)`

### 6. Nested Requires (✅ Should Work)
- File: `Player.lua` → `require("./Entity")` + `require("../Utils/Helpers")`
- Test: Child folder requiring sibling and parent modules

### 7. Deep Nesting (✅ Should Work)
- File: `SubManager/SubManager.lua` → `require("../../Utils/Logger")`
- Test: Going up multiple directory levels

### 8. ⚠️ Circular Dependency (❌ Should FAIL)
- Entry: `CircularTest/init.lua`
- Expected: Error message about circular dependency detected

## 🎯 Cách Test

### Test Main Bundle (tất cả tính năng):
1. Mở file `TestCodeBase/init.lua` trong VS Code
2. Chạy command: **Lua Bundler: Bundle Current File**
3. Kiểm tra file output được tạo

### Test Circular Detection:
1. Mở file `TestCodeBase/CircularTest/init.lua`
2. Chạy bundle
3. Expected: Error popup về circular dependency

## 📝 Expected Output Structure

```lua
-- Bundled by Lua Bundler
-- Generated: [timestamp]
-- Entry: [entry path]

-- Module cache
local __modules = {}
local __loaded = {}

local function __require(name)
    if __loaded[name] then return __loaded[name] end
    if __modules[name] then
        __loaded[name] = __modules[name]()
        return __loaded[name]
    end
    return require(name)
end

-- Module: Utils/Config
__modules["Utils/Config"] = function()
    -- Config code...
end

-- Module: Features/AutoFarm
__modules["Features/AutoFarm"] = function()
    -- AutoFarm code...
end

-- ... more modules ...

-- CLIENT SCRIPTS (execute in parallel via task.spawn)
task.spawn(function()
    -- UI.client.lua code...
end)

-- ENTRY POINT
do
    -- init.lua code với:
    -- local Features = { AutoFarm = __require("Features/AutoFarm"), ... }
end
```
