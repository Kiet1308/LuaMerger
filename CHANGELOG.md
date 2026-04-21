# Changelog

All notable changes to this project are documented in this file.

## [1.4.0] - 2026-04-21

### Added
- Added single-file runtime error mapping that remaps bundled runtime failures back to the original Lua file and line.
- Added clean mapped traceback output with readable frame summaries for modules, entry code, methods, local functions, anonymous callbacks, and common async/event callbacks.
- Added a focused VS Code UX for error mapping with:
  - one `luaBundler.errorMapping` setting,
  - one `Lua: Toggle Error Mapping` command,
  - one status bar toggle that switches between **Mapped Errors** and **Raw Errors**.
- Added Roblox mapping sample scripts under `RobloxMappingSamples/` to validate mapped runtime errors quickly in Studio.

### Changed
- Simplified the debugging UX so error mapping is now the only public runtime-debug toggle and is disabled by default until you explicitly turn it on.
- Updated bundle generation so mapped mode enables the required runtime helpers automatically while raw mode emits normal bundle behavior.
- Refined packaging/docs for the new release and excluded local sample/test artifacts from VSIX packaging.

### Fixed
- Fixed the main debugging pain point where runtime errors in bundled Lua only pointed to bundle lines instead of original source files.
- Fixed deep runtime debugging for nested/local/method/anonymous functions by preserving mapped locations through wrapped execution paths.

### Validation
- Test suite: `npm test` (16 tests passing).
- Build: `npm run build` (TypeScript compile passing).

## [1.3.0] - 2026-02-28

### Added
- Added regression test coverage for folder `init.lua` modules that also contain nested submodules (e.g. `GuiBuilder/init.lua` + `GuiBuilder/Internal/Builder.lua`).
- Added explicit module-tree registration metadata (`__init`) to support deterministic folder traversal at runtime.

### Changed
- Refactored generated runtime to use:
  - `__modules` for flat module loader lookup by full module path.
  - `__moduleTree` for folder traversal used by `__requireFolder`.
- Updated generated output strategy to register every bundled module under flat keys (`__modules["a/b/c"] = function() ... end`).
- Updated README runtime/output documentation and installation version references for `1.3.0`.

### Fixed
- Fixed startup crash in generated bundles when nested tree initialization was emitted before parent initialization.
- Fixed folder-module ambiguity where a folder path could act both as a module (`init.lua`) and a subtree root, causing order-sensitive code generation failures.
- Ensured folder + nested submodule projects no longer emit unsafe initialization patterns such as indexing through potentially nil parents.

### Validation
- Test suite: `npm test` (all tests passing).
- Build: `npm run build` (TypeScript compile passing).

## [1.2.0] - 2026-02-24

### Added
- Added shared runtime table `SHARED_VAR` for all bundled modules/scripts.

### Fixed
- Fixed module tree generation for non-identifier names via bracket access.
- Fixed parser to ignore `require(...)` inside line/block comments.
- Added regression tests for shared variable and parser/codegen fixes.
