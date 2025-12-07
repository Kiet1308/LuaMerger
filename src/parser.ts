export interface RequireInfo {
  variableName: string | null;
  modulePath: string;
  originalStatement: string;
  lineNumber: number;
  startIndex: number;
  endIndex: number;
  isFolder?: boolean;  // Set to true if this is a folder require
}

export interface ParseResult {
  requires: RequireInfo[];
  codeWithoutRequires: string;
  originalCode: string;
}

export class LuaParser {
  private readonly REQUIRE_PATTERNS: RegExp[] = [
    /local\s+(\w+)\s*=\s*require\s*\(\s*["']([^"']+)["']\s*\)/g,
    /local\s+(\w+)\s*=\s*require\s+["']([^"']+)["']/g,
    /require\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];

  parse(content: string, filePath: string): ParseResult {
    const requires = this.extractRequires(content);
    return {
      requires,
      codeWithoutRequires: content,
      originalCode: content,
    };
  }

  extractRequires(content: string): RequireInfo[] {
    const requires: RequireInfo[] = [];
    const usedRanges: Array<{ start: number; end: number }> = [];
    for (const pattern of this.REQUIRE_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
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

  private overlapsExisting(ranges: Array<{ start: number; end: number }>, start: number, end: number): boolean {
    return ranges.some((r) => !(end <= r.start || start >= r.end));
  }

  private isCommented(content: string, matchIndex: number): boolean {
    const lineStart = content.lastIndexOf('\n', matchIndex - 1) + 1;
    const linePrefix = content.slice(lineStart, matchIndex).trim();
    return linePrefix.startsWith('--');
  }
}
