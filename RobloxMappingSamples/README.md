# Roblox Mapping Samples

Open this folder as the VS Code workspace root and bundle `init.lua`.

After bundling:

1. Copy the single bundled output into a `Script` in Roblox Studio.
2. Run Play Solo.
3. Watch the Output window.

You should see errors that still include the bundle line, but now also show the original source file and source line such as:

- `Modules/CrashSync.lua`
- `Modules/CrashTask.lua`
- `Modules/CrashMethod.lua`
- `Modules/CrashSignal.lua`

The sample triggers four common cases:

1. normal local function crash
2. `task.spawn` named callback crash
3. method (`:`) crash
4. `RunService.Heartbeat:Connect(...)` crash
