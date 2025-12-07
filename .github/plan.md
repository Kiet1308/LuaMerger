# 📋 Implementation Plan: Lua Bundler VSCode Extension

## 🎯 Tổng Quan Extension

```
┌─────────────────────────────────────────────────────────────────┐
│                    LUA BUNDLER EXTENSION                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │  main.lua│───▶│ Parser   │───▶│ Resolver │───▶│ Bundler  │  │
│  │          │    │          │    │          │    │          │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│       │                                               │         │
│       │         ┌──────────────────────────┐          │         │
│       │         │     Dependency Graph     │          │         │
│       └────────▶│  module1 ─▶ module3      │◀─────────┘         │
│                 │  module2 ─▶ module4      │                    │
│                 └──────────────────────────┘                    │
│                               │                                 │
│                               ▼                                 │
│                      ┌──────────────┐                           │
│                      │  output.lua  │                           │
│                      └──────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Cấu Trúc Project

```
lua-bundler-extension/
├── 📁 src/
│   ├── 📄 extension.ts          # Entry point
│   ├── 📄 bundler.ts            # Core bundling logic
│   ├── 📄 parser.ts             # Lua require parser
│   ├── 📄 resolver.ts           # Path resolver
│   ├── 📄 dependencyGraph.ts    # Dependency management
│   ├── 📄 codeGenerator.ts      # Output code generator
│   └── 📁 utils/
│       ├── 📄 fileUtils.ts
│       └── 📄 pathUtils.ts
├── 📁 test/
├── 📄 package.json
├── 📄 tsconfig.json
└── 📄 README.md
```

---

## 🔧 Chi Tiết Implementation

### Phase 1: Setup & Configuration

```typescript
// package.json
{
  "name": "lua-bundler",
  "displayName": "Lua Bundler",
  "description": "Bundle multiple Lua files into single output",
  "version": "1.0.0",
  "engines": {
    "vscode": "^1.80.0"
  },
  "categories": ["Other"],
  "activationEvents": [
    "onLanguage:lua"
  ],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "luaBundler.bundle",
        "title": "Lua: Bundle Files"
      },
      {
        "command": "luaBundler.bundleWithConfig",
        "title": "Lua: Bundle with Config"
      }
    ],
    "configuration": {
      "title": "Lua Bundler",
      "properties": {
        "luaBundler.outputFileName": {
          "type": "string",
          "default": "output.lua",
          "description": "Output file name"
        },
        "luaBundler.entryPoint": {
          "type": "string",
          "default": "main.lua",
          "description": "Entry point file"
        },
        "luaBundler.minify": {
          "type": "boolean",
          "default": false,
          "description": "Minify output"
        }
      }
    },
    "menus": {
      "explorer/context": [
        {
          "command": "luaBundler.bundle",
          "when": "resourceExtname == .lua",
          "group": "navigation"
        }
      ]
    }
  }
}
```

---

### Phase 2: Parser Module

```
┌─────────────────────────────────────────────────────────────┐
│                      PARSER FLOW                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Input Lua Code                                            │
│   ─────────────                                             │
│   local Module1 = require("module1")                        │
│   local Module2 = require("Folder1/module2")                │
│                        │                                    │
│                        ▼                                    │
│   ┌─────────────────────────────────────┐                   │
│   │         Regex Matching              │                   │
│   │  /local\s+(\w+)\s*=\s*require\s*   │                   │
│   │   \(\s*["']([^"']+)["']\s*\)/g     │                   │
│   └─────────────────────────────────────┘                   │
│                        │                                    │
│                        ▼                                    │
│   Output: RequireInfo[]                                     │
│   ─────────────────────                                     │
│   [                                                         │
│     { varName: "Module1", path: "module1", line: 1 },       │
│     { varName: "Module2", path: "Folder1/module2", line: 2 }│
│   ]                                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

```typescript
// src/parser.ts
export interface RequireInfo {
  variableName: string;
  modulePath: string;
  originalStatement: string;
  lineNumber: number;
  startIndex: number;
  endIndex: number;
}

export interface ParseResult {
  requires: RequireInfo[];
  codeWithoutRequires: string;
  originalCode: string;
}

export class LuaParser {
  private readonly REQUIRE_PATTERNS = [
    // local Module = require("path")
    /local\s+(\w+)\s*=\s*require\s*\(\s*["']([^"']+)["']\s*\)/g,
    // local Module = require "path"
    /local\s+(\w+)\s*=\s*require\s+["']([^"']+)["']/g,
    // require("path") without assignment
    /require\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];

  parse(content: string, filePath: string): ParseResult {
    // Implementation
  }

  extractRequires(content: string): RequireInfo[] {
    // Implementation
  }
}
```

---

### Phase 3: Path Resolver

```
┌─────────────────────────────────────────────────────────────┐
│                    PATH RESOLUTION                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Current File: /project/src/Folder1/module.lua            │
│   Require Path: "../module2"                                │
│                        │                                    │
│                        ▼                                    │
│   ┌─────────────────────────────────────┐                   │
│   │          Path Resolution            │                   │
│   │                                     │                   │
│   │  1. Get directory: /project/src/Folder1/               │
│   │  2. Resolve relative: ../module2                        │
│   │  3. Result: /project/src/module2                        │
│   │  4. Add extension: /project/src/module2.lua            │
│   └─────────────────────────────────────┘                   │
│                        │                                    │
│                        ▼                                    │
│   Resolved: /project/src/module2.lua                        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│   SUPPORTED PATH FORMATS:                                   │
│   ─────────────────────                                     │
│   • require("module")         → ./module.lua                │
│   • require("folder/module")  → ./folder/module.lua         │
│   • require("../module")      → ../module.lua               │
│   • require("./module")       → ./module.lua                │
│   • require("folder.module")  → ./folder/module.lua (Lua)   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

```typescript
// src/resolver.ts
export interface ResolvedModule {
  absolutePath: string;
  relativePath: string;
  moduleName: string;
  exists: boolean;
}

export class PathResolver {
  constructor(private rootDir: string) {}

  resolve(requirePath: string, fromFile: string): ResolvedModule {
    // Handle different path formats
  }

  private normalizePath(path: string): string {
    // Convert Lua dot notation to path
    // "folder.module" → "folder/module"
  }

  private findModuleFile(basePath: string): string | null {
    // Try: basePath.lua, basePath/init.lua
  }
}
```

---

### Phase 4: Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                   DEPENDENCY GRAPH                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Example Structure:                                        │
│   ─────────────────                                         │
│                                                             │
│   main.lua ────┬────▶ module1.lua ────▶ module3.lua        │
│                │                              ▲             │
│                │                              │             │
│                └────▶ module2.lua ────────────┘             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Graph Representation:                                     │
│   ────────────────────                                      │
│                                                             │
│   {                                                         │
│     "main.lua": ["module1.lua", "module2.lua"],            │
│     "module1.lua": ["module3.lua"],                        │
│     "module2.lua": ["module3.lua"],                        │
│     "module3.lua": []                                       │
│   }                                                         │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Topological Sort (Output Order):                          │
│   ───────────────────────────────                           │
│                                                             │
│   1. module3.lua  (no dependencies)                         │
│   2. module1.lua  (depends on module3)                      │
│   3. module2.lua  (depends on module3)                      │
│   4. main.lua     (depends on module1, module2)             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

```typescript
// src/dependencyGraph.ts
export interface ModuleNode {
  path: string;
  dependencies: string[];
  content: string;
  parseResult: ParseResult;
}

export class DependencyGraph {
  private nodes: Map<string, ModuleNode> = new Map();
  
  addModule(path: string, node: ModuleNode): void {}
  
  getDependencies(path: string): string[] {}
  
  getTopologicalOrder(): string[] {
    // Kahn's algorithm or DFS-based topological sort
  }
  
  detectCircularDependencies(): string[][] {
    // Return cycles if found
  }
  
  getAllModules(): ModuleNode[] {}
}
```

---

### Phase 5: Code Generator

```
┌─────────────────────────────────────────────────────────────┐
│                  OUTPUT CODE STRUCTURE                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   -- ═══════════════════════════════════════════════════    │
│   -- BUNDLED BY LUA BUNDLER                                 │
│   -- Generated: 2024-01-15 10:30:00                         │
│   -- Entry: main.lua                                        │
│   -- ═══════════════════════════════════════════════════    │
│                                                             │
│   -- Module cache                                           │
│   local __modules = {}                                      │
│   local __loaded = {}                                       │
│                                                             │
│   -- Custom require function                                │
│   local function __require(name)                            │
│       if __loaded[name] then                                │
│           return __loaded[name]                             │
│       end                                                   │
│       if __modules[name] then                               │
│           __loaded[name] = __modules[name]()                │
│           return __loaded[name]                             │
│       end                                                   │
│       return require(name) -- fallback                      │
│   end                                                       │
│                                                             │
│   -- ─────────────────────────────────────────────────      │
│   -- Module: module3                                        │
│   -- Source: src/module3.lua                                │
│   -- ─────────────────────────────────────────────────      │
│   __modules["module3"] = function()                         │
│       local M = {}                                          │
│       function M.hello() print("Hello") end                 │
│       return M                                              │
│   end                                                       │
│                                                             │
│   -- ─────────────────────────────────────────────────      │
│   -- Module: module1                                        │
│   -- Source: src/module1.lua                                │
│   -- ─────────────────────────────────────────────────      │
│   __modules["module1"] = function()                         │
│       local Module3 = __require("module3")                  │
│       local M = {}                                          │
│       function M.greet() Module3.hello() end                │
│       return M                                              │
│   end                                                       │
│                                                             │
│   -- ─────────────────────────────────────────────────      │
│   -- ENTRY POINT: main.lua                                  │
│   -- ─────────────────────────────────────────────────      │
│   local Module1 = __require("module1")                      │
│   Module1.greet()                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

```typescript
// src/codeGenerator.ts
export interface GeneratorOptions {
  addComments: boolean;
  minify: boolean;
  includeSourceMap: boolean;
  preserveRequireNames: boolean;
}

export class CodeGenerator {
  constructor(private options: GeneratorOptions) {}

  generate(graph: DependencyGraph, entryPoint: string): string {
    const order = graph.getTopologicalOrder();
    let output = this.generateHeader();
    output += this.generateRuntime();
    
    for (const modulePath of order) {
      if (modulePath !== entryPoint) {
        output += this.generateModuleWrapper(graph.getModule(modulePath));
      }
    }
    
    output += this.generateEntryPoint(graph.getModule(entryPoint));
    return output;
  }

  private generateHeader(): string {}
  private generateRuntime(): string {}
  private generateModuleWrapper(module: ModuleNode): string {}
  private generateEntryPoint(module: ModuleNode): string {}
}
```

---

### Phase 6: Extension Entry Point

```typescript
// src/extension.ts
import * as vscode from 'vscode';
import { LuaBundler } from './bundler';

export function activate(context: vscode.ExtensionContext) {
  
  // Command: Bundle current file
  const bundleCommand = vscode.commands.registerCommand(
    'luaBundler.bundle',
    async (uri?: vscode.Uri) => {
      try {
        const bundler = new LuaBundler();
        const result = await bundler.bundle(uri);
        
        vscode.window.showInformationMessage(
          `✅ Bundled successfully! Output: ${result.outputPath}`
        );
      } catch (error) {
        vscode.window.showErrorMessage(`❌ Bundle failed: ${error}`);
      }
    }
  );

  // Command: Bundle with custom config
  const bundleWithConfigCommand = vscode.commands.registerCommand(
    'luaBundler.bundleWithConfig',
    async () => {
      // Show config UI
    }
  );

  context.subscriptions.push(bundleCommand, bundleWithConfigCommand);
}
```

---

## 📊 Luồng Xử Lý Chi Tiết

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BUNDLING WORKFLOW                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Step 1: User triggers "Bundle" command                             │
│          │                                                          │
│          ▼                                                          │
│  ┌───────────────────────────────────────┐                          │
│  │  Get entry file (main.lua)            │                          │
│  │  Read configuration                   │                          │
│  └───────────────────────────────────────┘                          │
│          │                                                          │
│          ▼                                                          │
│  Step 2: Parse entry file                                           │
│          │                                                          │
│          ▼                                                          │
│  ┌───────────────────────────────────────┐                          │
│  │  Extract require statements           │                          │
│  │  ├─ require("module1") ──────────────┼──▶ Add to queue          │
│  │  └─ require("Folder1/module2") ──────┼──▶ Add to queue          │
│  └───────────────────────────────────────┘                          │
│          │                                                          │
│          ▼                                                          │
│  Step 3: Recursively process dependencies                           │
│          │                                                          │
│          ▼                                                          │
│  ┌───────────────────────────────────────┐                          │
│  │  While queue not empty:               │                          │
│  │    1. Pop module from queue           │                          │
│  │    2. Resolve path                    │                          │
│  │    3. Read file content               │                          │
│  │    4. Parse for more requires         │                          │
│  │    5. Add to dependency graph         │                          │
│  │    6. Add new requires to queue       │                          │
│  └───────────────────────────────────────┘                          │
│          │                                                          │
│          ▼                                                          │
│  Step 4: Check for circular dependencies                            │
│          │                                                          │
│          ├──▶ Found? ──▶ Show warning/error                         │
│          │                                                          │
│          ▼                                                          │
│  Step 5: Topological sort                                           │
│          │                                                          │
│          ▼                                                          │
│  ┌───────────────────────────────────────┐                          │
│  │  Order: [module3, module1, module2,   │                          │
│  │          main]                        │                          │
│  └───────────────────────────────────────┘                          │
│          │                                                          │
│          ▼                                                          │
│  Step 6: Generate output code                                       │
│          │                                                          │
│          ▼                                                          │
│  ┌───────────────────────────────────────┐                          │
│  │  Write to output.lua                  │                          │
│  └───────────────────────────────────────┘                          │
│          │                                                          │
│          ▼                                                          │
│  Step 7: Show success notification                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🧪 Test Cases

```typescript
// test/bundler.test.ts
describe('Lua Bundler', () => {
  
  describe('Parser', () => {
    it('should parse simple require statements', () => {});
    it('should parse require with dot notation', () => {});
    it('should handle multiple requires', () => {});
    it('should ignore commented requires', () => {});
  });

  describe('Path Resolver', () => {
    it('should resolve relative paths', () => {});
    it('should resolve absolute paths', () => {});
    it('should handle dot notation paths', () => {});
    it('should find init.lua for directories', () => {});
  });

  describe('Dependency Graph', () => {
    it('should detect circular dependencies', () => {});
    it('should produce correct topological order', () => {});
    it('should handle diamond dependencies', () => {});
  });

  describe('Code Generator', () => {
    it('should generate valid Lua code', () => {});
    it('should preserve module exports', () => {});
    it('should handle nested requires', () => {});
  });
});
```

---

## 🚀 Prompt Hoàn Chỉnh

```markdown
# PROMPT: Create VSCode Extension - Lua Bundler

## Task
Create a VSCode extension that bundles multiple Lua files into a single 
executable output file.

## Requirements

### Core Features
1. Parse Lua files and extract `require()` statements
2. Resolve relative and absolute module paths
3. Build dependency graph with circular dependency detection
4. Generate bundled output with proper module encapsulation
5. Support both slash (/) and dot (.) path notation

### Require Patterns to Support
- `local M = require("module")`
- `local M = require("folder/module")`
- `local M = require("../module")`
- `local M = require("folder.module")`

### Output Format
```lua
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

__modules["moduleName"] = function()
    -- module code with require replaced by __require
    return ModuleExports
end

-- Entry point code
```

### Commands
- `luaBundler.bundle` - Bundle current file
- `luaBundler.bundleWithConfig` - Bundle with custom settings

### Configuration
- `luaBundler.outputFileName` - Output file name (default: "output.lua")
- `luaBundler.entryPoint` - Entry point file (default: "main.lua")
- `luaBundler.minify` - Minify output (default: false)

### Tech Stack
- TypeScript
- VSCode Extension API
- Node.js path/fs modules

### Error Handling
- File not found errors
- Circular dependency warnings
- Syntax error reporting
- Invalid path format errors

## Deliverables
1. Complete extension source code
2. package.json with all configurations
3. README with usage instructions
4. Unit tests for core modules
```
