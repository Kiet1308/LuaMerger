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

function hasExplicitConfigValue<T>(
  inspection: {
    globalValue?: T;
    workspaceValue?: T;
    workspaceFolderValue?: T;
  } | undefined,
): boolean {
  return Boolean(
    inspection &&
    (
      inspection.globalValue !== undefined ||
      inspection.workspaceValue !== undefined ||
      inspection.workspaceFolderValue !== undefined
    ),
  );
}

function getErrorMappingEnabled(config = vscode.workspace.getConfiguration('luaBundler')): boolean {
  const errorMappingInspection = config.inspect<boolean>('errorMapping');
  if (hasExplicitConfigValue(errorMappingInspection)) {
    return config.get<boolean>('errorMapping', false);
  }

  const cleanTracebackInspection = config.inspect<boolean>('cleanTraceback');
  const fullFunctionWrappingInspection = config.inspect<boolean>('fullFunctionWrapping');
  const hasLegacyConfig =
    hasExplicitConfigValue(cleanTracebackInspection) ||
    hasExplicitConfigValue(fullFunctionWrappingInspection);

  if (hasLegacyConfig) {
    return (
      config.get<boolean>('cleanTraceback', true) ||
      config.get<boolean>('fullFunctionWrapping', true)
    );
  }

  return false;
}

function getBaseOptions(): BundleOptions {
  const config = vscode.workspace.getConfiguration('luaBundler');
  return {
    entryPoint: config.get<string>('entryPoint', 'init.lua'),
    outputFileName: config.get<string>('outputFileName', 'output.lua'),
    minify: config.get<boolean>('minify', false),
    errorMapping: getErrorMappingEnabled(config),
  };
}

function updateStatusBarItems(
  bundleItem: vscode.StatusBarItem,
  mappingItem: vscode.StatusBarItem,
): void {
  const options = getBaseOptions();

  bundleItem.tooltip = [
    'Bundle Lua files into a single output.',
    `Runtime errors: ${options.errorMapping ? 'Mapped to original files' : 'Raw bundle output'}`,
  ].join('\n');

  mappingItem.text = options.errorMapping
    ? '$(check) Mapped Errors'
    : '$(close) Raw Errors';

  mappingItem.tooltip = options.errorMapping
    ? 'Mapped errors are enabled. Runtime errors will point back to original Lua files and lines. Click to disable.'
    : 'Mapped errors are disabled. Runtime errors will use raw bundled stack positions. Click to enable clean mapped errors.';
}

async function pickBooleanOption(
  placeHolder: string,
  currentValue: boolean,
): Promise<boolean> {
  const choice = await vscode.window.showQuickPick(
    [
      {
        label: 'On',
        description: currentValue ? 'Current' : undefined,
      },
      {
        label: 'Off',
        description: !currentValue ? 'Current' : undefined,
      },
    ],
    {
      placeHolder,
      canPickMany: false,
      ignoreFocusOut: true,
    },
  );

  if (!choice) {
    return currentValue;
  }

  return choice.label === 'On';
}

async function toggleErrorMapping(): Promise<void> {
  const config = vscode.workspace.getConfiguration('luaBundler');
  const current = getErrorMappingEnabled(config);
  const next = !current;
  const target = vscode.workspace.workspaceFolders?.length
    ? vscode.ConfigurationTarget.Workspace
    : vscode.ConfigurationTarget.Global;

  await config.update('errorMapping', next, target);
  vscode.window.showInformationMessage(
    next
      ? 'Lua Bundler error mapping enabled.'
      : 'Lua Bundler error mapping disabled.',
  );
}

/**
 * Find init.lua by traversing up from the given file path.
 * Returns the path to init.lua and its parent folder (the root).
 */
function findInitLua(startPath: string): { initPath: string; rootDir: string } | null {
  let currentDir = fs.statSync(startPath).isDirectory() ? startPath : path.dirname(startPath);
  const workspaceRoot = getWorkspaceRoot();

  while (currentDir.length >= workspaceRoot.length) {
    const initPath = path.join(currentDir, 'init.lua');
    if (fs.existsSync(initPath)) {
      return { initPath, rootDir: currentDir };
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }

  return null;
}

async function runBundle(uri?: vscode.Uri): Promise<void> {
  const options = getBaseOptions();

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
    ignoreFocusOut: true,
  });
  const minify = minifyChoice === 'Yes' ? true : base.minify;

  const errorMapping = await pickBooleanOption(
    'Map runtime errors back to the original Lua files?',
    base.errorMapping,
  );

  const bundler = new LuaBundler(workspaceRoot, {
    entryPoint,
    outputFileName,
    minify,
    errorMapping,
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

  const toggleErrorMappingCommand = vscode.commands.registerCommand(
    'luaBundler.toggleErrorMapping',
    async () => {
      try {
        await toggleErrorMapping();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to toggle error mapping: ${message}`);
      }
    },
  );

  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100,
  );
  statusBarItem.command = 'luaBundler.bundle';
  statusBarItem.text = '$(package) Bundle Lua';
  statusBarItem.show();

  const mappingStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    99,
  );
  mappingStatusBarItem.command = 'luaBundler.toggleErrorMapping';
  mappingStatusBarItem.show();

  updateStatusBarItems(statusBarItem, mappingStatusBarItem);

  const configChangeListener = vscode.workspace.onDidChangeConfiguration((event) => {
    if (
      event.affectsConfiguration('luaBundler.errorMapping') ||
      event.affectsConfiguration('luaBundler.cleanTraceback') ||
      event.affectsConfiguration('luaBundler.fullFunctionWrapping') ||
      event.affectsConfiguration('luaBundler.outputFileName') ||
      event.affectsConfiguration('luaBundler.entryPoint') ||
      event.affectsConfiguration('luaBundler.minify')
    ) {
      updateStatusBarItems(statusBarItem, mappingStatusBarItem);
    }
  });

  context.subscriptions.push(
    bundleCommand,
    bundleWithConfigCommand,
    toggleErrorMappingCommand,
    mappingStatusBarItem,
    configChangeListener,
    statusBarItem,
  );
}

export function deactivate(): void { }
