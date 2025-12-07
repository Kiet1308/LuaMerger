# Lua Bundler

<p align="center">
  <img src="https://img.shields.io/badge/VS%20Code-Extension-blue?style=for-the-badge&logo=visual-studio-code" alt="VS Code Extension"/>
  <img src="https://img.shields.io/badge/Language-Lua-purple?style=for-the-badge&logo=lua" alt="Lua"/>
  <img src="https://img.shields.io/badge/TypeScript-Built-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Version-1.0.0-green?style=for-the-badge" alt="Version 1.0.0"/>
</p>

A powerful VS Code extension that bundles multiple Lua files into a single, runnable output file. Perfect for Roblox development, game scripting, and any Lua project that requires modular code organization.

---

## ✨ Features

### 🔗 **Smart Module Resolution**
- Resolves `require()` statements with relative paths (`./`, `../`)
- Supports both dot notation (`Utils.Logger`) and slash notation (`Utils/Logger`)
- Automatically handles nested module dependencies

### 📁 **Folder-Based Modules**
- **init.lua Support**: Folders with `init.lua` are treated as single modules
- **Folder Require**: Require an entire folder as a table of modules (for folders without `init.lua`)
- Tree-based module storage with flat key fallback for conflict-free module organization

### ⚡ **Client Scripts**
- `.client.lua` files are automatically detected and wrapped in `task.spawn()`
- Execute parallel scripts alongside the main bundle
- Great for Roblox client-side scripting patterns

### 🛡️ **Circular Dependency Detection**
- Detects and reports circular dependencies before bundling
- Prevents runtime errors from module loading loops

### 📊 **Topological Sorting**
- Modules are ordered correctly based on dependencies
- Ensures modules are defined before they are required

---

## 📥 Installation

### From VSIX File
1. Download `lua-bundler-1.0.0.vsix` from the releases
2. Open VS Code
3. Go to Extensions (Ctrl+Shift+X)
4. Click `...` → `Install from VSIX...`
5. Select the downloaded file

### From Source
```bash
cd LuaMerger
npm install
npm run build
```

Then press `F5` in VS Code to launch the Extension Development Host.

---

## 🚀 Usage

### Quick Bundle
1. Open any Lua project in VS Code
2. Click the **📦 Bundle Lua** button in the status bar
3. The bundled output will be saved to `output.lua`

### Command Palette
- `Lua: Bundle Files` - Bundle with default settings
- `Lua: Bundle with Config` - Bundle with custom entry point, output name, and minification options

### Context Menu
Right-click any `.lua` file in the explorer and select **Lua: Bundle Files** to bundle starting from that file's location.

---

## ⚙️ Configuration

Configure the extension in VS Code settings (`settings.json`):

```json
{
  "luaBundler.entryPoint": "init.lua",      // Entry point file
  "luaBundler.outputFileName": "output.lua", // Output file name
  "luaBundler.minify": false                 // Minify output
}
```

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `luaBundler.entryPoint` | string | `init.lua` | The main entry file to start bundling from |
| `luaBundler.outputFileName` | string | `output.lua` | Name of the bundled output file |
| `luaBundler.minify` | boolean | `false` | Remove unnecessary whitespace from output |

---

## 📁 Project Structure Example

```
MyProject/
├── init.lua                    # Entry point
├── output.lua                  # Generated bundle
├── Utils/
│   ├── Config.lua
│   ├── Logger.lua
│   └── Helpers.lua
├── Classes/
│   ├── Entity.lua
│   └── Player.lua
├── Services/
│   ├── init.lua               # Folder acts as single module
│   ├── DataService.lua
│   └── NetworkService.lua
├── Features/                   # Folder without init.lua
│   ├── AutoFarm.lua           # Can be required as table
│   ├── ESP.lua
│   └── Teleport.lua
├── UI.client.lua              # Wrapped in task.spawn()
└── InputHandler.client.lua    # Parallel execution
```

---

## 📝 Require Syntax

The bundler supports multiple require syntaxes:

```lua
-- Relative path with ./
local Config = require("./Utils/Config")

-- Dot notation
local Logger = require("Utils.Logger")

-- Parent directory with ../
local Entity = require("../Classes/Entity")

-- Folder with init.lua (single module)
local Services = require("./Services")

-- Folder without init.lua (returns table of modules)
local Features = require("./Features")
-- Usage: Features.AutoFarm.start()
```

---

## 📤 Output Format

The bundler generates a self-contained Lua file with:

1. **Header**: Metadata about the bundle (timestamp, entry point)
2. **Runtime**: Module loading system with `__require`, `__getModule`, `__requireFolder`
3. **Module Tree**: Folder structure initialization
4. **Modules**: Each module wrapped as a function
5. **Client Scripts**: `.client.lua` files in `task.spawn()` wrappers
6. **Entry Point**: Main code execution

Example output structure:
```lua
-- Bundled by Lua Bundler
-- Generated: 2025-12-07T16:06:21.481Z
-- Entry: init

local __modules = {}
local __loaded = {}

local function __require(name)
    -- Module loading logic
end

local function __requireFolder(folderPath)
    -- Folder require logic
end

-- Module: Utils/Config
__modules.Utils.Config = function()
    -- Module code here
end

-- CLIENT SCRIPTS
task.spawn(function()
    -- Client script code
end)

-- ENTRY POINT
do
    -- Main code execution
end
```

---

## 🔧 Development

### Building
```bash
npm install
npm run build
```

### Running Tests
```bash
npm test
```

### Watching for Changes
```bash
npm run watch
```

### Packaging
```bash
npx vsce package
```

---

## 🏗️ Architecture

| File | Purpose |
|------|---------|
| `extension.ts` | VS Code extension entry point, commands registration |
| `bundler.ts` | Main bundling logic, orchestrates the pipeline |
| `parser.ts` | Parses Lua files, extracts `require()` statements |
| `resolver.ts` | Resolves module paths to absolute file paths |
| `dependencyGraph.ts` | Builds and analyzes module dependency graph |
| `codeGenerator.ts` | Generates the final bundled output |
| `utils/pathUtils.ts` | Path manipulation utilities |

---

## 🎮 Roblox Integration

This bundler is designed with Roblox development in mind:

- **task.spawn()**: Client scripts are wrapped for parallel execution
- **Module patterns**: Compatible with Roblox's module loading conventions
- **Single file output**: Easy to paste into Roblox exploits or scripts

---

## 📄 License

MIT License - feel free to use this in your projects!

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

<p align="center">
  Made with ❤️ for the Lua community
</p>
