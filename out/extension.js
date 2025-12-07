"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const bundler_1 = require("./bundler");
function getWorkspaceRoot() {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        throw new Error('Open a workspace folder to use Lua Bundler.');
    }
    return folder.uri.fsPath;
}
function getBaseOptions() {
    const config = vscode.workspace.getConfiguration('luaBundler');
    return {
        entryPoint: config.get('entryPoint', 'init.lua'),
        outputFileName: config.get('outputFileName', 'output.lua'),
        minify: config.get('minify', false),
    };
}
/**
 * Find init.lua by traversing up from the given file path.
 * Returns the path to init.lua and its parent folder (the root).
 */
function findInitLua(startPath) {
    let currentDir = fs.statSync(startPath).isDirectory() ? startPath : path.dirname(startPath);
    const workspaceRoot = getWorkspaceRoot();
    // Traverse up until we find init.lua or reach workspace root
    while (currentDir.length >= workspaceRoot.length) {
        const initPath = path.join(currentDir, 'init.lua');
        if (fs.existsSync(initPath)) {
            return { initPath, rootDir: currentDir };
        }
        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir)
            break; // Reached filesystem root
        currentDir = parentDir;
    }
    return null;
}
async function runBundle(uri) {
    const options = getBaseOptions();
    // Get the target file - either from right-click uri or active editor
    let targetPath;
    if (uri) {
        targetPath = uri.fsPath;
    }
    else {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.fileName.endsWith('.lua')) {
            targetPath = activeEditor.document.fileName;
        }
    }
    let workspaceRoot;
    let entryPath;
    if (targetPath) {
        // Find init.lua by traversing up from the target file
        const initInfo = findInitLua(targetPath);
        if (initInfo) {
            workspaceRoot = initInfo.rootDir;
            entryPath = initInfo.initPath;
        }
        else {
            throw new Error('Could not find init.lua in parent directories.');
        }
    }
    else {
        workspaceRoot = getWorkspaceRoot();
        entryPath = path.join(workspaceRoot, options.entryPoint);
    }
    const bundler = new bundler_1.LuaBundler(workspaceRoot, options);
    const result = await bundler.bundle(entryPath);
    vscode.window.showInformationMessage(`Bundled to ${path.basename(result.outputPath)}`);
}
async function runBundleWithConfig() {
    const workspaceRoot = getWorkspaceRoot();
    const base = getBaseOptions();
    const entryPoint = await vscode.window.showInputBox({
        prompt: 'Entry Lua file',
        value: base.entryPoint,
        ignoreFocusOut: true,
    });
    if (!entryPoint) {
        return;
    }
    const outputFileName = (await vscode.window.showInputBox({
        prompt: 'Output file name',
        value: base.outputFileName,
        ignoreFocusOut: true,
    })) || base.outputFileName;
    const minifyChoice = await vscode.window.showQuickPick(['No', 'Yes'], {
        placeHolder: 'Minify output?',
        canPickMany: false,
    });
    const minify = minifyChoice === 'Yes' ? true : base.minify;
    const bundler = new bundler_1.LuaBundler(workspaceRoot, {
        entryPoint,
        outputFileName,
        minify,
    });
    const result = await bundler.bundle();
    vscode.window.showInformationMessage(`Bundled to ${path.basename(result.outputPath)} (entry: ${entryPoint})`);
}
function activate(context) {
    const bundleCommand = vscode.commands.registerCommand('luaBundler.bundle', async (uri) => {
        try {
            await runBundle(uri);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Bundle failed: ${message}`);
        }
    });
    const bundleWithConfigCommand = vscode.commands.registerCommand('luaBundler.bundleWithConfig', async () => {
        try {
            await runBundleWithConfig();
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Bundle failed: ${message}`);
        }
    });
    // Create status bar button for quick bundling
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = 'luaBundler.bundle';
    statusBarItem.text = '$(package) Bundle Lua';
    statusBarItem.tooltip = 'Bundle Lua files into a single output';
    statusBarItem.show();
    context.subscriptions.push(bundleCommand, bundleWithConfigCommand, statusBarItem);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map