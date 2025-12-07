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
exports.toPosix = toPosix;
exports.normalizeRequirePath = normalizeRequirePath;
exports.moduleNameFromPath = moduleNameFromPath;
const path = __importStar(require("path"));
function toPosix(filePath) {
    return filePath.split(path.sep).join('/');
}
function normalizeRequirePath(requirePath) {
    // Convert Lua dot notation into slash-based paths while preserving leading ./ or ../ segments.
    const segments = requirePath.split('/');
    let pastLeadingDots = false;
    return segments
        .map((segment) => {
        // Preserve all leading . and .. segments
        if (!pastLeadingDots && (segment === '.' || segment === '..')) {
            return segment;
        }
        // Once we hit a non-dot segment, start converting dots to slashes
        pastLeadingDots = true;
        return segment.replace(/\./g, '/');
    })
        .join('/');
}
function moduleNameFromPath(absPath, rootDir) {
    const relative = toPosix(path.relative(rootDir, absPath));
    const withoutExt = relative.endsWith('.lua') ? relative.slice(0, -4) : relative;
    if (withoutExt.endsWith('/init')) {
        return withoutExt.slice(0, -5);
    }
    return withoutExt;
}
//# sourceMappingURL=pathUtils.js.map