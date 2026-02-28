# Changelog

All notable changes to this project are documented in this file.

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
