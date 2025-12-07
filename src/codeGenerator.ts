import { DependencyGraph, ModuleNode } from './dependencyGraph';
import { ClientScript } from './bundler';

export interface GeneratorOptions {
  addComments: boolean;
  minify: boolean;
  includeSourceMap: boolean;
  preserveRequireNames: boolean;
}

export class CodeGenerator {
  constructor(private readonly options: GeneratorOptions) { }

  generate(graph: DependencyGraph, entryModule: string, clientScripts: ClientScript[] = []): string {
    const topo = graph.getTopologicalOrder();
    const order = topo.filter((m) => m !== entryModule);
    if (!order.includes(entryModule)) {
      order.push(entryModule);
    }

    // Get all module names for conflict detection
    const allModuleNames = new Set(order);

    let output = '';
    output += this.generateHeader(entryModule);
    output += this.generateRuntime();

    // Collect unique folder paths for tree initialization
    const folders = this.collectFolderPaths(order.filter(m => m !== entryModule));
    output += this.generateFolderDeclarations(folders);

    for (const moduleName of order) {
      if (moduleName === entryModule) {
        continue;
      }
      output += this.generateModuleWrapper(graph.getModule(moduleName), allModuleNames);
    }

    // Generate client scripts with task.spawn
    if (clientScripts.length > 0) {
      output += this.generateClientScripts(clientScripts);
    }

    output += this.generateEntryPoint(graph.getModule(entryModule));

    if (this.options.minify) {
      output = this.minify(output);
    }

    return output;
  }

  /**
   * Collect all unique folder paths that need initialization.
   * Excludes paths that are also module names (init.lua modules) to avoid conflicts.
   */
  private collectFolderPaths(moduleNames: string[]): string[] {
    const folders = new Set<string>();
    const moduleNameSet = new Set(moduleNames);

    for (const moduleName of moduleNames) {
      const parts = moduleName.split('/');
      // Build up folder paths: "Features", "Features/SubFolder", etc.
      for (let i = 1; i < parts.length; i++) {
        const folderPath = parts.slice(0, i).join('/');
        // Only add if this folder is NOT also a module (init.lua case)
        if (!moduleNameSet.has(folderPath)) {
          folders.add(folderPath);
        }
      }
    }

    // Sort by depth (shorter paths first) to ensure parent folders are created before children
    return Array.from(folders).sort((a, b) => {
      const depthA = a.split('/').length;
      const depthB = b.split('/').length;
      return depthA - depthB;
    });
  }

  /**
   * Generate folder initialization statements
   */
  private generateFolderDeclarations(folders: string[]): string {
    if (folders.length === 0) return '';

    const lines = ['-- Initialize module tree'];
    for (const folder of folders) {
      const treePath = folder.split('/').join('.');
      lines.push(`__modules.${treePath} = __modules.${treePath} or {}`);
    }
    lines.push('');
    return lines.join('\n');
  }

  private generateHeader(entry: string): string {
    if (!this.options.addComments) {
      return '';
    }
    const now = new Date().toISOString();
    return (
      `-- Bundled by Lua Bundler\n` +
      `-- Generated: ${now}\n` +
      `-- Entry: ${entry}\n\n`
    );
  }

  private generateRuntime(): string {
    return [
      '-- Module cache (tree-based storage with flat key fallback)',
      'local __modules = {}',
      'local __loaded = {}',
      '',
      '-- Get module loader: check flat key first, then tree navigation',
      'local function __getModule(name)',
      '    -- First check flat key (for modules under init.lua folders)',
      '    if __modules[name] then return __modules[name] end',
      '    -- Then try tree navigation',
      '    local current = __modules',
      '    for part in name:gmatch("[^/]+") do',
      '        if type(current) ~= "table" then return nil end',
      '        current = current[part]',
      '        if not current then return nil end',
      '    end',
      '    return current',
      'end',
      '',
      '-- Custom require that navigates module tree',
      'local function __require(name)',
      '    if __loaded[name] then return __loaded[name] end',
      '    local loader = __getModule(name)',
      '    if type(loader) == "function" then',
      '        __loaded[name] = loader()',
      '        return __loaded[name]',
      '    end',
      '    return require(name)',
      'end',
      '',
      '-- Folder require - returns table of all modules in folder',
      'local function __requireFolder(folderPath)',
      '    local folder = __getModule(folderPath)',
      '    if type(folder) ~= "table" then return {} end',
      '    local result = {}',
      '    for name, loader in pairs(folder) do',
      '        if type(loader) == "function" then',
      '            result[name] = __require(folderPath .. "/" .. name)',
      '        end',
      '    end',
      '    return result',
      'end',
      '',
    ].join('\n');
  }

  private generateModuleWrapper(module: ModuleNode, allModuleNames: Set<string>): string {
    // Check if any parent path of this module is also a module (init.lua case)
    // If so, we need to use flat key to avoid conflicts
    const parts = module.moduleName.split('/');
    let hasParentModule = false;

    for (let i = 1; i < parts.length; i++) {
      const parentPath = parts.slice(0, i).join('/');
      if (allModuleNames.has(parentPath)) {
        hasParentModule = true;
        break;
      }
    }

    // Use flat key if parent is a module, otherwise use tree path
    const moduleKey = hasParentModule
      ? `__modules["${module.moduleName}"]`
      : `__modules.${parts.join('.')}`;

    const lines = [
      `-- Module: ${module.moduleName}`,
      `-- Source: ${module.path}`,
      `${moduleKey} = function()`,
      this.indent(module.content),
      'end',
      '',
    ];
    return lines.join('\n');
  }

  private generateEntryPoint(module: ModuleNode): string {
    const lines = [
      `-- ENTRY POINT: ${module.moduleName}`,
      'do',
      this.indent(module.content),
      'end',
    ];
    return lines.join('\n');
  }

  private generateClientScripts(clientScripts: ClientScript[]): string {
    const lines: string[] = [
      '',
      '-- CLIENT SCRIPTS (execute in parallel via task.spawn)',
    ];

    for (const script of clientScripts) {
      lines.push(`-- Client: ${script.moduleName}`);
      lines.push(`-- Source: ${script.path}`);
      lines.push('task.spawn(function()');
      lines.push(this.indent(script.content));
      lines.push('end)');
      lines.push('');
    }

    return lines.join('\n');
  }

  private indent(content: string): string {
    return content
      .split(/\r?\n/)
      .map((line) => (line.length ? `    ${line}` : ''))
      .join('\n');
  }

  private minify(content: string): string {
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join('\n');
  }
}
