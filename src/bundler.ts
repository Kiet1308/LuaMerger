import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { DependencyGraph } from './dependencyGraph';
import { CodeGenerator } from './codeGenerator';
import { LuaParser, ParseResult, RequireInfo } from './parser';
import { PathResolver, ResolvedModule, FolderModule } from './resolver';
import { moduleNameFromPath } from './utils/pathUtils';

export interface BundleOptions {
  entryPoint: string;
  outputFileName: string;
  minify: boolean;
}

export interface ClientScript {
  path: string;
  content: string;
  moduleName: string;
}

export interface FolderRequire {
  variableName: string;
  folderModule: FolderModule;
  originalStatement: string;
  startIndex: number;
  endIndex: number;
}

export interface BundleResult {
  outputPath: string;
  entryModule: string;
  clientScripts: ClientScript[];
  folderRequires: FolderRequire[];
}

export class LuaBundler {
  constructor(
    private readonly workspaceRoot: string,
    private readonly options: BundleOptions,
  ) { }

  async bundle(entryOverride?: string): Promise<BundleResult> {
    const entryPath = this.resolveEntryPath(entryOverride);
    const entryModuleName = moduleNameFromPath(entryPath, this.workspaceRoot);

    const parser = new LuaParser();
    const resolver = new PathResolver(this.workspaceRoot);
    const graph = new DependencyGraph();

    // Track all folder requires across the bundle
    const allFolderRequires: FolderRequire[] = [];

    const queue: Array<{ path: string; moduleName: string }> = [
      { path: entryPath, moduleName: entryModuleName },
    ];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;
      if (graph.hasModule(current.moduleName)) {
        continue;
      }

      const content = await fs.readFile(current.path, 'utf8');
      const parseResult = parser.parse(content, current.path);

      // Separate folder requires from regular requires
      const regularRequires: RequireInfo[] = [];
      const folderRequires: FolderRequire[] = [];

      for (const req of parseResult.requires) {
        if (resolver.isRequirableFolder(req.modulePath, current.path)) {
          // This is a folder require
          if (!req.variableName) {
            throw new Error(
              `Folder require must be assigned to a variable: require("${req.modulePath}") in ${current.path}`
            );
          }
          const folderModule = resolver.resolveFolder(req.modulePath, current.path);
          if (folderModule && folderModule.modules.length > 0) {
            folderRequires.push({
              variableName: req.variableName,
              folderModule,
              originalStatement: req.originalStatement,
              startIndex: req.startIndex,
              endIndex: req.endIndex,
            });
            // Mark the require as a folder require
            req.isFolder = true;
          }
        } else {
          regularRequires.push(req);
        }
      }

      // Resolve regular dependencies
      const resolvedDeps: ResolvedModule[] = regularRequires.map((req) => {
        const resolved = resolver.resolve(req.modulePath, current.path);
        if (!resolved.exists) {
          throw new Error(
            `Module not found: ${req.modulePath} (required from ${current.path})`,
          );
        }
        return resolved;
      });

      // Add modules from folder requires to the queue
      for (const fr of folderRequires) {
        for (const mod of fr.folderModule.modules) {
          if (!graph.hasModule(mod.moduleName)) {
            queue.push({ path: mod.absolutePath, moduleName: mod.moduleName });
          }
        }
      }

      // Rewrite requires (both regular and folder)
      const rewritten = this.rewriteRequiresWithFolders(
        parseResult,
        resolvedDeps,
        regularRequires,
        folderRequires
      );

      // Build dependencies list including folder module dependencies
      const dependencies = [
        ...resolvedDeps.map((d) => d.moduleName),
        ...folderRequires.flatMap((fr) => fr.folderModule.modules.map((m) => m.moduleName)),
      ];

      graph.addModule(current.moduleName, {
        moduleName: current.moduleName,
        path: current.path,
        dependencies,
        content: rewritten,
        parseResult,
      });

      for (const dep of resolvedDeps) {
        if (!graph.hasModule(dep.moduleName)) {
          queue.push({ path: dep.absolutePath, moduleName: dep.moduleName });
        }
      }

      // Collect folder requires for return
      allFolderRequires.push(...folderRequires);
    }

    const cycles = graph.detectCircularDependencies();
    if (cycles.length > 0) {
      throw new Error(
        `Circular dependencies detected: ${cycles.map((c) => c.join(' -> ')).join('; ')}`,
      );
    }

    // Collect all .client.lua files
    const clientScripts = await this.collectClientScripts(parser);

    const generator = new CodeGenerator({
      addComments: true,
      minify: this.options.minify,
      includeSourceMap: false,
      preserveRequireNames: true,
    });

    const output = generator.generate(graph, entryModuleName, clientScripts);
    const outputPath = path.join(this.workspaceRoot, this.options.outputFileName);
    await fs.writeFile(outputPath, output, 'utf8');

    return { outputPath, entryModule: entryModuleName, clientScripts, folderRequires: allFolderRequires };
  }

  private async collectClientScripts(parser: LuaParser): Promise<ClientScript[]> {
    const clientScripts: ClientScript[] = [];
    const files = await this.findClientFiles(this.workspaceRoot);

    for (const filePath of files) {
      const content = await fs.readFile(filePath, 'utf8');
      const parseResult = parser.parse(content, filePath);

      // Rewrite requires in client scripts to use __require
      const resolver = new PathResolver(this.workspaceRoot);
      const resolvedDeps = parseResult.requires.map((req) => {
        const resolved = resolver.resolve(req.modulePath, filePath);
        if (!resolved.exists) {
          throw new Error(
            `Module not found: ${req.modulePath} (required from client script ${filePath})`,
          );
        }
        return resolved;
      });

      const rewritten = this.rewriteRequires(parseResult, resolvedDeps);
      const moduleName = moduleNameFromPath(filePath, this.workspaceRoot);

      clientScripts.push({
        path: filePath,
        content: rewritten,
        moduleName,
      });
    }

    return clientScripts;
  }

  private async findClientFiles(dir: string): Promise<string[]> {
    const clientFiles: string[] = [];

    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const subFiles = await this.findClientFiles(fullPath);
        clientFiles.push(...subFiles);
      } else if (entry.isFile() && entry.name.endsWith('.client.lua')) {
        clientFiles.push(fullPath);
      }
    }

    return clientFiles;
  }

  private resolveEntryPath(entryOverride?: string): string {
    const target = entryOverride ?? this.options.entryPoint;
    const fullPath = path.isAbsolute(target)
      ? target
      : path.join(this.workspaceRoot, target);
    const withExtension = path.extname(fullPath) ? fullPath : `${fullPath}.lua`;
    if (!fsSync.existsSync(withExtension)) {
      throw new Error(`Entry file not found: ${withExtension}`);
    }
    return withExtension;
  }

  private rewriteRequires(parseResult: ParseResult, deps: ResolvedModule[]): string {
    if (parseResult.requires.length !== deps.length) {
      throw new Error('Require resolution mismatch');
    }
    let result = parseResult.originalCode;
    for (let i = parseResult.requires.length - 1; i >= 0; i -= 1) {
      const req: RequireInfo = parseResult.requires[i];
      const dep = deps[i];
      const replacement = req.variableName
        ? `local ${req.variableName} = __require("${dep.moduleName}")`
        : `__require("${dep.moduleName}")`;
      result =
        result.slice(0, req.startIndex) +
        replacement +
        result.slice(req.endIndex);
    }
    return result;
  }

  private rewriteRequiresWithFolders(
    parseResult: ParseResult,
    resolvedDeps: ResolvedModule[],
    regularRequires: RequireInfo[],
    folderRequires: FolderRequire[]
  ): string {
    let result = parseResult.originalCode;

    // Create a combined list of all replacements with their positions
    interface Replacement {
      startIndex: number;
      endIndex: number;
      content: string;
    }

    const replacements: Replacement[] = [];

    // Add regular require replacements
    for (let i = 0; i < regularRequires.length; i++) {
      const req = regularRequires[i];
      const dep = resolvedDeps[i];
      const replacement = req.variableName
        ? `local ${req.variableName} = __require("${dep.moduleName}")`
        : `__require("${dep.moduleName}")`;

      replacements.push({
        startIndex: req.startIndex,
        endIndex: req.endIndex,
        content: replacement,
      });
    }

    // Add folder require replacements
    for (const fr of folderRequires) {
      // Use __requireFolder helper for clean output
      const replacement = `local ${fr.variableName} = __requireFolder("${fr.folderModule.folderModuleName}")`;

      replacements.push({
        startIndex: fr.startIndex,
        endIndex: fr.endIndex,
        content: replacement,
      });
    }

    // Sort replacements by startIndex in descending order (replace from end to start)
    replacements.sort((a, b) => b.startIndex - a.startIndex);

    // Apply replacements
    for (const rep of replacements) {
      result = result.slice(0, rep.startIndex) + rep.content + result.slice(rep.endIndex);
    }

    return result;
  }
}
