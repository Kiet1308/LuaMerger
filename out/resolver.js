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
exports.PathResolver = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const pathUtils_1 = require("./utils/pathUtils");
class PathResolver {
    constructor(rootDir) {
        this.rootDir = rootDir;
    }
    resolve(requirePath, fromFile) {
        const normalized = (0, pathUtils_1.normalizeRequirePath)(requirePath);
        const fromDir = path.dirname(fromFile);
        // All paths are resolved relative to the current file's directory
        const candidate = path.resolve(fromDir, normalized);
        const moduleFile = this.findModuleFile(candidate);
        const absolutePath = moduleFile ?? path.normalize(candidate + '.lua');
        const exists = Boolean(moduleFile);
        const moduleName = (0, pathUtils_1.moduleNameFromPath)(absolutePath, this.rootDir);
        const relativePath = path.relative(this.rootDir, absolutePath);
        return { absolutePath, relativePath, moduleName, exists };
    }
    /**
     * Check if a path is a folder that can be required as a folder module
     */
    isRequirableFolder(requirePath, fromFile) {
        const normalized = (0, pathUtils_1.normalizeRequirePath)(requirePath);
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
    resolveFolder(requirePath, fromFile) {
        const normalized = (0, pathUtils_1.normalizeRequirePath)(requirePath);
        const fromDir = path.dirname(fromFile);
        const candidate = path.resolve(fromDir, normalized);
        if (!fs.existsSync(candidate) || !fs.statSync(candidate).isDirectory()) {
            return null;
        }
        const folderModuleName = (0, pathUtils_1.toPosix)(path.relative(this.rootDir, candidate));
        const modules = [];
        const entries = fs.readdirSync(candidate, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isFile() && entry.name.endsWith('.lua')) {
                // Skip .client.lua files as they are handled separately
                if (entry.name.endsWith('.client.lua')) {
                    continue;
                }
                const filePath = path.join(candidate, entry.name);
                const baseName = entry.name.slice(0, -4); // Remove .lua extension
                const moduleName = (0, pathUtils_1.moduleNameFromPath)(filePath, this.rootDir);
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
    findModuleFile(basePath) {
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
exports.PathResolver = PathResolver;
//# sourceMappingURL=resolver.js.map