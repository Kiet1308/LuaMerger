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

    const nonEntryModules = order.filter((m) => m !== entryModule);

    let output = '';
    output += this.generateHeader(entryModule);
    output += this.generateRuntime();

    // Collect unique folder paths for tree initialization
    const folders = this.collectFolderPaths(nonEntryModules);
    output += this.generateFolderDeclarations(folders);
    output += this.generateModuleTreeRegistrations(nonEntryModules);

    for (const moduleName of nonEntryModules) {
      output += this.generateModuleWrapper(graph.getModule(moduleName));
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
   */
  private collectFolderPaths(moduleNames: string[]): string[] {
    const folders = new Set<string>();

    for (const moduleName of moduleNames) {
      const parts = moduleName.split('/');
      // Build up folder paths: "Features", "Features/SubFolder", etc.
      for (let i = 1; i < parts.length; i++) {
        const folderPath = parts.slice(0, i).join('/');
        folders.add(folderPath);
      }
    }

    // Sort by depth (shorter paths first) to ensure parent folders are created before children
    return Array.from(folders).sort((a, b) => {
      const depthA = a.split('/').length;
      const depthB = b.split('/').length;
      if (depthA !== depthB) {
        return depthA - depthB;
      }
      return a.localeCompare(b);
    });
  }

  /**
   * Generate folder initialization statements
   */
  private generateFolderDeclarations(folders: string[]): string {
    if (folders.length === 0) return '';

    const lines = ['-- Initialize module tree'];
    for (const folder of folders) {
      const folderAccess = this.toModuleTreeAccess(folder, '__moduleTree');
      lines.push(`${folderAccess} = ${folderAccess} or {}`);
    }
    lines.push('');
    return lines.join('\n');
  }

  private generateModuleTreeRegistrations(moduleNames: string[]): string {
    if (moduleNames.length === 0) return '';

    const lines = ['-- Register module names in tree'];
    const sorted = Array.from(new Set(moduleNames)).sort((a, b) => {
      const depthA = a.split('/').length;
      const depthB = b.split('/').length;
      if (depthA !== depthB) {
        return depthA - depthB;
      }
      return a.localeCompare(b);
    });

    for (const moduleName of sorted) {
      const moduleAccess = this.toModuleTreeAccess(moduleName, '__moduleTree');
      lines.push(`${moduleAccess} = ${moduleAccess} or {}`);
      lines.push(`${moduleAccess}["__init"] = ${this.toLuaStringLiteral(moduleName)}`);
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
      '-- Module cache (flat key loaders + independent folder tree)',
      'local __modules = {}',
      'local __moduleTree = {}',
      'local __loaded = {}',
      '-- Shared state across bundled modules and scripts',
      'local SHARED_VAR = {}',
      '',
      '-- Navigate folder tree by slash-separated module path',
      'local function __getTreeNode(name)',
      '    local current = __moduleTree',
      '    for part in name:gmatch("[^/]+") do',
      '        if type(current) ~= "table" then return nil end',
      '        current = current[part]',
      '        if not current then return nil end',
      '    end',
      '    return current',
      'end',
      '',
      '-- Custom require that resolves bundled modules by exact path',
      'local function __require(name)',
      '    if __loaded[name] then return __loaded[name] end',
      '    local loader = __modules[name]',
      '    if type(loader) == "function" then',
      '        __loaded[name] = loader()',
      '        return __loaded[name]',
      '    end',
      '    return require(name)',
      'end',
      '',
      '-- Folder require - returns direct child modules in a folder',
      'local function __requireFolder(folderPath)',
      '    local folder = __getTreeNode(folderPath)',
      '    if type(folder) ~= "table" then return {} end',
      '    local result = {}',
      '    for name, node in pairs(folder) do',
      '        if name ~= "__init" and type(node) == "table" and type(node["__init"]) == "string" then',
      '            result[name] = __require(node["__init"])',
      '        end',
      '    end',
      '    return result',
      'end',
      '',
    ].join('\n');
  }

  private generateModuleWrapper(module: ModuleNode): string {
    const lines = [
      `-- Module: ${module.moduleName}`,
      `-- Source: ${module.path}`,
      `__modules[${this.toLuaStringLiteral(module.moduleName)}] = function()`,
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

  private toModuleTreeAccess(modulePath: string, rootVar: string): string {
    const parts = modulePath.split('/').filter((part) => part.length > 0);
    if (parts.length === 0) {
      return `${rootVar}[${this.toLuaStringLiteral(modulePath)}]`;
    }
    return parts.reduce(
      (expr, part) => `${expr}[${this.toLuaStringLiteral(part)}]`,
      rootVar,
    );
  }

  private toLuaStringLiteral(value: string): string {
    return JSON.stringify(value);
  }
}
