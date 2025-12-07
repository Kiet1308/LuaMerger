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
exports.LuaBundler = void 0;
const fs = __importStar(require("fs/promises"));
const fsSync = __importStar(require("fs"));
const path = __importStar(require("path"));
const dependencyGraph_1 = require("./dependencyGraph");
const codeGenerator_1 = require("./codeGenerator");
const parser_1 = require("./parser");
const resolver_1 = require("./resolver");
const pathUtils_1 = require("./utils/pathUtils");
class LuaBundler {
    constructor(workspaceRoot, options) {
        this.workspaceRoot = workspaceRoot;
        this.options = options;
    }
    async bundle(entryOverride) {
        const entryPath = this.resolveEntryPath(entryOverride);
        const entryModuleName = (0, pathUtils_1.moduleNameFromPath)(entryPath, this.workspaceRoot);
        const parser = new parser_1.LuaParser();
        const resolver = new resolver_1.PathResolver(this.workspaceRoot);
        const graph = new dependencyGraph_1.DependencyGraph();
        // Track all folder requires across the bundle
        const allFolderRequires = [];
        const queue = [
            { path: entryPath, moduleName: entryModuleName },
        ];
        while (queue.length > 0) {
            const current = queue.shift();
            if (!current)
                break;
            if (graph.hasModule(current.moduleName)) {
                continue;
            }
            const content = await fs.readFile(current.path, 'utf8');
            const parseResult = parser.parse(content, current.path);
            // Separate folder requires from regular requires
            const regularRequires = [];
            const folderRequires = [];
            for (const req of parseResult.requires) {
                if (resolver.isRequirableFolder(req.modulePath, current.path)) {
                    // This is a folder require
                    if (!req.variableName) {
                        throw new Error(`Folder require must be assigned to a variable: require("${req.modulePath}") in ${current.path}`);
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
                }
                else {
                    regularRequires.push(req);
                }
            }
            // Resolve regular dependencies
            const resolvedDeps = regularRequires.map((req) => {
                const resolved = resolver.resolve(req.modulePath, current.path);
                if (!resolved.exists) {
                    throw new Error(`Module not found: ${req.modulePath} (required from ${current.path})`);
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
            const rewritten = this.rewriteRequiresWithFolders(parseResult, resolvedDeps, regularRequires, folderRequires);
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
            throw new Error(`Circular dependencies detected: ${cycles.map((c) => c.join(' -> ')).join('; ')}`);
        }
        // Collect all .client.lua files
        const clientScripts = await this.collectClientScripts(parser);
        const generator = new codeGenerator_1.CodeGenerator({
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
    async collectClientScripts(parser) {
        const clientScripts = [];
        const files = await this.findClientFiles(this.workspaceRoot);
        for (const filePath of files) {
            const content = await fs.readFile(filePath, 'utf8');
            const parseResult = parser.parse(content, filePath);
            // Rewrite requires in client scripts to use __require
            const resolver = new resolver_1.PathResolver(this.workspaceRoot);
            const resolvedDeps = parseResult.requires.map((req) => {
                const resolved = resolver.resolve(req.modulePath, filePath);
                if (!resolved.exists) {
                    throw new Error(`Module not found: ${req.modulePath} (required from client script ${filePath})`);
                }
                return resolved;
            });
            const rewritten = this.rewriteRequires(parseResult, resolvedDeps);
            const moduleName = (0, pathUtils_1.moduleNameFromPath)(filePath, this.workspaceRoot);
            clientScripts.push({
                path: filePath,
                content: rewritten,
                moduleName,
            });
        }
        return clientScripts;
    }
    async findClientFiles(dir) {
        const clientFiles = [];
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                const subFiles = await this.findClientFiles(fullPath);
                clientFiles.push(...subFiles);
            }
            else if (entry.isFile() && entry.name.endsWith('.client.lua')) {
                clientFiles.push(fullPath);
            }
        }
        return clientFiles;
    }
    resolveEntryPath(entryOverride) {
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
    rewriteRequires(parseResult, deps) {
        if (parseResult.requires.length !== deps.length) {
            throw new Error('Require resolution mismatch');
        }
        let result = parseResult.originalCode;
        for (let i = parseResult.requires.length - 1; i >= 0; i -= 1) {
            const req = parseResult.requires[i];
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
    rewriteRequiresWithFolders(parseResult, resolvedDeps, regularRequires, folderRequires) {
        let result = parseResult.originalCode;
        const replacements = [];
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
exports.LuaBundler = LuaBundler;
//# sourceMappingURL=bundler.js.map