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
    const searchableContent = this.stripCommentsPreserveLength(content);
    const requires: RequireInfo[] = [];
    const usedRanges: Array<{ start: number; end: number }> = [];
    for (const pattern of this.REQUIRE_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(searchableContent)) !== null) {
        const startIndex = match.index;
        const endIndex = startIndex + match[0].length;
        if (this.overlapsExisting(usedRanges, startIndex, endIndex)) {
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

  private stripCommentsPreserveLength(content: string): string {
    const chars = content.split('');
    let i = 0;

    while (i < content.length) {
      const current = content[i];

      if (current === '"' || current === '\'') {
        i = this.skipQuotedString(content, i, current);
        continue;
      }

      const longString = this.matchLongBracketStart(content, i);
      if (longString) {
        i = this.findLongBracketEnd(content, i + longString.length, longString.equalsCount);
        continue;
      }

      if (current === '-' && content[i + 1] === '-') {
        const blockComment = this.matchLongBracketStart(content, i + 2);
        if (blockComment) {
          const end = this.findLongBracketEnd(
            content,
            i + 2 + blockComment.length,
            blockComment.equalsCount,
          );
          this.maskRange(chars, i, end);
          i = end;
        } else {
          const lineEnd = this.findLineEnd(content, i + 2);
          this.maskRange(chars, i, lineEnd);
          i = lineEnd;
        }
        continue;
      }

      i += 1;
    }

    return chars.join('');
  }

  private skipQuotedString(content: string, start: number, quote: string): number {
    let i = start + 1;
    while (i < content.length) {
      const current = content[i];
      if (current === '\\') {
        i += 2;
        continue;
      }
      if (current === quote) {
        return i + 1;
      }
      i += 1;
    }
    return content.length;
  }

  private findLineEnd(content: string, start: number): number {
    let i = start;
    while (i < content.length && content[i] !== '\n' && content[i] !== '\r') {
      i += 1;
    }
    return i;
  }

  private maskRange(chars: string[], start: number, end: number): void {
    for (let i = start; i < end; i += 1) {
      if (chars[i] !== '\n' && chars[i] !== '\r') {
        chars[i] = ' ';
      }
    }
  }

  private matchLongBracketStart(
    content: string,
    start: number,
  ): { equalsCount: number; length: number } | null {
    if (content[start] !== '[') {
      return null;
    }

    let i = start + 1;
    while (i < content.length && content[i] === '=') {
      i += 1;
    }

    if (content[i] !== '[') {
      return null;
    }

    return {
      equalsCount: i - (start + 1),
      length: i - start + 1,
    };
  }

  private findLongBracketEnd(content: string, start: number, equalsCount: number): number {
    let i = start;
    while (i < content.length) {
      if (content[i] !== ']') {
        i += 1;
        continue;
      }

      let j = i + 1;
      let matchedEquals = 0;
      while (matchedEquals < equalsCount && j < content.length && content[j] === '=') {
        matchedEquals += 1;
        j += 1;
      }

      if (matchedEquals === equalsCount && j < content.length && content[j] === ']') {
        return j + 1;
      }

      i += 1;
    }

    return content.length;
  }
}
