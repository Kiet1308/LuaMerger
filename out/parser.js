"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LuaParser = void 0;
class LuaParser {
    constructor() {
        this.REQUIRE_PATTERNS = [
            /local\s+(\w+)\s*=\s*require\s*\(\s*["']([^"']+)["']\s*\)/g,
            /local\s+(\w+)\s*=\s*require\s+["']([^"']+)["']/g,
            /require\s*\(\s*["']([^"']+)["']\s*\)/g,
        ];
    }
    parse(content, filePath) {
        const requires = this.extractRequires(content);
        return {
            requires,
            codeWithoutRequires: content,
            originalCode: content,
        };
    }
    extractRequires(content) {
        const requires = [];
        const usedRanges = [];
        for (const pattern of this.REQUIRE_PATTERNS) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const startIndex = match.index;
                const endIndex = startIndex + match[0].length;
                if (this.overlapsExisting(usedRanges, startIndex, endIndex)) {
                    continue;
                }
                if (this.isCommented(content, startIndex)) {
                    continue;
                }
                const variableName = match.length > 2 ? match[1] : null;
                const modulePath = match.length > 2 ? match[2] : match[1];
                const lineNumber = content.slice(0, startIndex).split(/\r?\n/).length;
                requires.push({
                    variableName,
                    modulePath,
                    originalStatement: match[0],
                    lineNumber,
                    startIndex,
                    endIndex,
                });
                usedRanges.push({ start: startIndex, end: endIndex });
            }
        }
        // Preserve source order to make replacements deterministic.
        return requires.sort((a, b) => a.startIndex - b.startIndex);
    }
    overlapsExisting(ranges, start, end) {
        return ranges.some((r) => !(end <= r.start || start >= r.end));
    }
    isCommented(content, matchIndex) {
        const lineStart = content.lastIndexOf('\n', matchIndex - 1) + 1;
        const linePrefix = content.slice(lineStart, matchIndex).trim();
        return linePrefix.startsWith('--');
    }
}
exports.LuaParser = LuaParser;
//# sourceMappingURL=parser.js.map