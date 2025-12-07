import * as fs from 'fs';
import * as path from 'path';
import { moduleNameFromPath, normalizeRequirePath, toPosix } from './utils/pathUtils';

export interface ResolvedModule {
  absolutePath: string;
  relativePath: string;
  moduleName: string;
  exists: boolean;
  isFolder?: boolean;
}

export interface FolderModule {
  folderPath: string;
  folderModuleName: string;
  modules: Array<{
    name: string;          // Key name in the table (e.g., "AutoFarm")
    moduleName: string;    // Full module name (e.g., "Features/AutoFarm")
    absolutePath: string;
  }>;
}

export class PathResolver {
  constructor(private readonly rootDir: string) { }

  resolve(requirePath: string, fromFile: string): ResolvedModule {
    const normalized = normalizeRequirePath(requirePath);
    const fromDir = path.dirname(fromFile);

    // All paths are resolved relative to the current file's directory
    const candidate = path.resolve(fromDir, normalized);
    const moduleFile = this.findModuleFile(candidate);

    const absolutePath = moduleFile ?? path.normalize(candidate + '.lua');
    const exists = Boolean(moduleFile);
    const moduleName = moduleNameFromPath(absolutePath, this.rootDir);
    const relativePath = path.relative(this.rootDir, absolutePath);

    return { absolutePath, relativePath, moduleName, exists };
  }

  /**
   * Check if a path is a folder that can be required as a folder module
   */
  isRequirableFolder(requirePath: string, fromFile: string): boolean {
    const normalized = normalizeRequirePath(requirePath);
    const fromDir = path.dirname(fromFile);
    const candidate = path.resolve(fromDir, normalized);

    // Check if it's a directory (not a file, not init.lua case)
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      // Make sure it's NOT an init.lua case (those are handled as regular modules)
      const initPath = path.join(candidate, 'init.lua');
      if (!fs.existsSync(initPath)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Resolve a folder and get all its .lua modules (non-recursive)
   */
  resolveFolder(requirePath: string, fromFile: string): FolderModule | null {
    const normalized = normalizeRequirePath(requirePath);
    const fromDir = path.dirname(fromFile);
    const candidate = path.resolve(fromDir, normalized);

    if (!fs.existsSync(candidate) || !fs.statSync(candidate).isDirectory()) {
      return null;
    }

    const folderModuleName = toPosix(path.relative(this.rootDir, candidate));
    const modules: FolderModule['modules'] = [];

    const entries = fs.readdirSync(candidate, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.lua')) {
        // Skip .client.lua files as they are handled separately
        if (entry.name.endsWith('.client.lua')) {
          continue;
        }

        const filePath = path.join(candidate, entry.name);
        const baseName = entry.name.slice(0, -4); // Remove .lua extension
        const moduleName = moduleNameFromPath(filePath, this.rootDir);

        modules.push({
          name: baseName,
          moduleName,
          absolutePath: filePath,
        });
      }
    }

    return {
      folderPath: candidate,
      folderModuleName,
      modules,
    };
  }

  private findModuleFile(basePath: string): string | null {
    const direct = basePath.endsWith('.lua') ? basePath : `${basePath}.lua`;
    if (fs.existsSync(direct) && fs.statSync(direct).isFile()) {
      return path.normalize(direct);
    }
    const initPath = path.join(basePath, 'init.lua');
    if (fs.existsSync(initPath) && fs.statSync(initPath).isFile()) {
      return path.normalize(initPath);
    }
    return null;
  }
}
