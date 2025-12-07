import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { LuaBundler, BundleOptions } from './bundler';

function getWorkspaceRoot(): string {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    throw new Error('Open a workspace folder to use Lua Bundler.');
  }
  return folder.uri.fsPath;
}

function getBaseOptions(): BundleOptions {
  const config = vscode.workspace.getConfiguration('luaBundler');
  return {
    entryPoint: config.get<string>('entryPoint', 'init.lua'),
    outputFileName: config.get<string>('outputFileName', 'output.lua'),
    minify: config.get<boolean>('minify', false),
  };
}

/**
 * Find init.lua by traversing up from the given file path.
 * Returns the path to init.lua and its parent folder (the root).
 */
function findInitLua(startPath: string): { initPath: string; rootDir: string } | null {
  let currentDir = fs.statSync(startPath).isDirectory() ? startPath : path.dirname(startPath);
  const workspaceRoot = getWorkspaceRoot();

  // Traverse up until we find init.lua or reach workspace root
  while (currentDir.length >= workspaceRoot.length) {
    const initPath = path.join(currentDir, 'init.lua');
    if (fs.existsSync(initPath)) {
      return { initPath, rootDir: currentDir };
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break; // Reached filesystem root
    currentDir = parentDir;
  }

  return null;
}

async function runBundle(uri?: vscode.Uri): Promise<void> {
  const options = getBaseOptions();

  // Get the target file - either from right-click uri or active editor
  let targetPath: string | undefined;
  if (uri) {
    targetPath = uri.fsPath;
  } else {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && activeEditor.document.fileName.endsWith('.lua')) {
      targetPath = activeEditor.document.fileName;
    }
  }

  let workspaceRoot: string;
  let entryPath: string;

  if (targetPath) {
    // Find init.lua by traversing up from the target file
    const initInfo = findInitLua(targetPath);
    if (initInfo) {
      workspaceRoot = initInfo.rootDir;
      entryPath = initInfo.initPath;
    } else {
      throw new Error('Could not find init.lua in parent directories.');
    }
  } else {
    workspaceRoot = getWorkspaceRoot();
    entryPath = path.join(workspaceRoot, options.entryPoint);
  }

  const bundler = new LuaBundler(workspaceRoot, options);
  const result = await bundler.bundle(entryPath);
  vscode.window.showInformationMessage(`Bundled to ${path.basename(result.outputPath)}`);
}

async function runBundleWithConfig(): Promise<void> {
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

  const outputFileName =
    (await vscode.window.showInputBox({
      prompt: 'Output file name',
      value: base.outputFileName,
      ignoreFocusOut: true,
    })) || base.outputFileName;

  const minifyChoice = await vscode.window.showQuickPick(['No', 'Yes'], {
    placeHolder: 'Minify output?',
    canPickMany: false,
  });
  const minify = minifyChoice === 'Yes' ? true : base.minify;

  const bundler = new LuaBundler(workspaceRoot, {
    entryPoint,
    outputFileName,
    minify,
  });

  const result = await bundler.bundle();
  vscode.window.showInformationMessage(
    `Bundled to ${path.basename(result.outputPath)} (entry: ${entryPoint})`,
  );
}

export function activate(context: vscode.ExtensionContext): void {
  const bundleCommand = vscode.commands.registerCommand(
    'luaBundler.bundle',
    async (uri?: vscode.Uri) => {
      try {
        await runBundle(uri);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Bundle failed: ${message}`);
      }
    },
  );

  const bundleWithConfigCommand = vscode.commands.registerCommand(
    'luaBundler.bundleWithConfig',
    async () => {
      try {
        await runBundleWithConfig();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Bundle failed: ${message}`);
      }
    },
  );

  // Create status bar button for quick bundling
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.command = 'luaBundler.bundle';
  statusBarItem.text = '$(package) Bundle Lua';
  statusBarItem.tooltip = 'Bundle Lua files into a single output';
  statusBarItem.show();

  context.subscriptions.push(bundleCommand, bundleWithConfigCommand, statusBarItem);
}

export function deactivate(): void { }
