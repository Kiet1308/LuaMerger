# Lua Bundler VS Code Extension

Bundle multiple Lua files into a single runnable `output.lua` with dependency resolution and a custom runtime `__require`.

## Features
- Parse Lua `require` statements (slash and dot notation) and rewrite them to bundled `__require` calls.
- Resolve relative and absolute paths, including `init.lua` folders.
- Build a dependency graph with circular detection and topological ordering.
- Generate bundled output with module cache and entry execution; optional minify.

## Commands
- `Lua: Bundle Files` (`luaBundler.bundle`): bundle the active Lua file or configured entry.
- `Lua: Bundle with Config` (`luaBundler.bundleWithConfig`): prompt for entry/output/minify before bundling.

## Configuration
- `luaBundler.outputFileName` (string, default `output.lua`)
- `luaBundler.entryPoint` (string, default `main.lua`)
- `luaBundler.minify` (boolean, default `false`)

## Usage
1. Install dependencies: `npm install`.
2. Open the workspace in VS Code and press `F5` to launch the Extension Development Host.
3. Run `Lua: Bundle Files` (or `Lua: Bundle with Config`) from the command palette. The bundled file is written to the workspace root using the configured output name.

## Development
- Build: `npm run build`
- Tests: `npm test`
- Watch mode: `npm run watch`
- Main sources live in `src/`; compiled output is emitted to `out/`.

## Output Runtime (excerpt)
```lua
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
```
