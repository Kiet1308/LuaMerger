import { ClientScript } from './bundler';
import { DependencyGraph, ModuleNode } from './dependencyGraph';

export interface GeneratorOptions {
  addComments: boolean;
  minify: boolean;
  includeSourceMap: boolean;
  preserveRequireNames: boolean;
  cleanTraceback?: boolean;
  fullFunctionWrapping?: boolean;
}

type ChunkKind = 'module' | 'entry' | 'client';

interface GeneratedChunk {
  emittedLines: string[];
  sourceLines: number[];
  functionSources: FunctionSourceInfo[];
}

interface SourceChunkMeta {
  displayPath: string;
  kind: ChunkKind;
  name: string;
}

interface FunctionWrapPlan {
  prefixStart: number;
  prefixEnd: number;
  prefixContent: string;
  suffixIndex: number;
  label: string;
  sourceStartLine: number;
  sourceEndLine: number;
}

interface FunctionSourceInfo {
  label: string;
  startLine: number;
  endLine: number;
}

interface InstrumentedChunk {
  content: string;
  functionSources: FunctionSourceInfo[];
}

class LuaLineBuilder {
  private readonly lines: string[] = [];

  get currentLine(): number {
    return this.lines.length + 1;
  }

  push(line = ''): void {
    this.lines.push(line);
  }

  pushLines(lines: string[]): void {
    this.lines.push(...lines);
  }

  toString(): string {
    return this.lines.join('\n');
  }
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
    const builder = new LuaLineBuilder();

    this.appendHeader(builder, entryModule);
    this.appendRuntime(builder);

    const folders = this.collectFolderPaths(nonEntryModules);
    this.appendFolderDeclarations(builder, folders);
    this.appendModuleTreeRegistrations(builder, nonEntryModules);

    for (const moduleName of nonEntryModules) {
      this.appendModuleWrapper(builder, graph.getModule(moduleName));
    }

    if (clientScripts.length > 0) {
      this.appendClientScripts(builder, clientScripts);
    }

    this.appendEntryPoint(builder, graph.getModule(entryModule));

    return builder.toString();
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

  private appendHeader(builder: LuaLineBuilder, entry: string): void {
    if (!this.shouldEmitComments()) {
      return;
    }

    const now = new Date().toISOString();
    builder.push('-- Bundled by Lua Bundler');
    builder.push(`-- Generated: ${now}`);
    builder.push(`-- Entry: ${entry}`);
    builder.push();
  }

  private appendRuntime(builder: LuaLineBuilder): void {
    this.pushComment(builder, 'Module cache (flat key loaders + independent folder tree)');
    builder.push('local __modules = {}');
    builder.push('local __moduleTree = {}');
    builder.push('local __loaded = {}');
    builder.push('local SHARED_VAR = {}');

    if (this.isSourceMapEnabled()) {
      builder.push('local __bundleSourceMap = {}');
      if (this.isCleanTracebackEnabled()) {
        builder.push('local __bundleFunctionMap = {}');
      }
      builder.push('local __unpack = table.unpack or unpack');
      builder.push();
      builder.push('local function __pack(...)');
      builder.push('    return { n = select("#", ...), ... }');
      builder.push('end');
      builder.push();
      builder.push('local function __registerSourceRange(startLine, lineCount, sourcePath, kind, name, sourceLineBase)');
      builder.push('    __bundleSourceMap[#__bundleSourceMap + 1] = {');
      builder.push('        startLine = startLine,');
      builder.push('        endLine = startLine + lineCount - 1,');
      builder.push('        sourcePath = sourcePath,');
      builder.push('        kind = kind,');
      builder.push('        name = name,');
      builder.push('        sourceLineBase = sourceLineBase or 1,');
      builder.push('    }');
      builder.push('end');
      builder.push();
      builder.push('local function __registerSourceLines(startLine, sourcePath, kind, name, sourceLines)');
      builder.push('    __bundleSourceMap[#__bundleSourceMap + 1] = {');
      builder.push('        startLine = startLine,');
      builder.push('        endLine = startLine + #sourceLines - 1,');
      builder.push('        sourcePath = sourcePath,');
      builder.push('        kind = kind,');
      builder.push('        name = name,');
      builder.push('        sourceLines = sourceLines,');
      builder.push('    }');
      builder.push('end');
      builder.push();

      if (this.isCleanTracebackEnabled()) {
        builder.push('local function __registerFunctionSource(sourcePath, startLine, endLine, label)');
        builder.push('    local list = __bundleFunctionMap[sourcePath]');
        builder.push('    if type(list) ~= "table" then');
        builder.push('        list = {}');
        builder.push('        __bundleFunctionMap[sourcePath] = list');
        builder.push('    end');
        builder.push('    list[#list + 1] = {');
        builder.push('        startLine = startLine,');
        builder.push('        endLine = endLine,');
        builder.push('        label = label,');
        builder.push('    }');
        builder.push('end');
        builder.push();
      }

      builder.push('local function __findSourceLocation(bundleLine)');
      builder.push('    for i = #__bundleSourceMap, 1, -1 do');
      builder.push('        local entry = __bundleSourceMap[i]');
      builder.push('        if bundleLine >= entry.startLine and bundleLine <= entry.endLine then');
      builder.push('            local offset = bundleLine - entry.startLine + 1');
      builder.push('            if entry.sourceLines then');
      builder.push('                return entry, entry.sourceLines[offset]');
      builder.push('            end');
      builder.push('            return entry, (entry.sourceLineBase or 1) + offset - 1');
      builder.push('        end');
      builder.push('    end');
      builder.push('    return nil, nil');
      builder.push('end');
      builder.push();

      if (this.isCleanTracebackEnabled()) {
        builder.push('local function __findFunctionLabel(sourcePath, sourceLine)');
        builder.push('    local list = __bundleFunctionMap[sourcePath]');
        builder.push('    if type(list) ~= "table" then');
        builder.push('        return nil');
        builder.push('    end');
        builder.push('    for i = #list, 1, -1 do');
        builder.push('        local entry = list[i]');
        builder.push('        if sourceLine >= entry.startLine and sourceLine <= entry.endLine then');
        builder.push('            return entry.label');
        builder.push('        end');
        builder.push('    end');
        builder.push('    return nil');
        builder.push('end');
        builder.push();
      }

      builder.push('local function __formatMappedLocation(bundleLine)');
      builder.push('    local entry, sourceLine = __findSourceLocation(bundleLine)');
      builder.push('    if not entry or not sourceLine then');
      builder.push('        return nil');
      builder.push('    end');
      builder.push('    return string.format("%s:%d", entry.sourcePath, sourceLine)');
      builder.push('end');
      builder.push();

      if (this.isCleanTracebackEnabled()) {
        builder.push('local function __stripErrorPrefix(message)');
        builder.push('    if type(message) ~= "string" then');
        builder.push('        return tostring(message)');
        builder.push('    end');
        builder.push('    local stripped = message:gsub("^.-:%d+:%s*", "", 1)');
        builder.push('    if stripped ~= "" and stripped ~= message then');
        builder.push('        return stripped');
        builder.push('    end');
        builder.push('    return message');
        builder.push('end');
        builder.push();
      }

      builder.push('local function __annotateTraceback(trace)');
      builder.push('    if type(trace) ~= "string" then');
      builder.push('        return tostring(trace)');
      builder.push('    end');
      builder.push();
      builder.push('    local changed = false');
      builder.push('    local remapped = trace:gsub(":(%d+)", function(lineText)');
      builder.push('        local bundleLine = tonumber(lineText)');
      builder.push('        if not bundleLine then');
      builder.push('            return ":" .. lineText');
      builder.push('        end');
      builder.push('        local mapped = __formatMappedLocation(bundleLine)');
      builder.push('        if not mapped then');
      builder.push('            return ":" .. lineText');
      builder.push('        end');
      builder.push('        changed = true');
      builder.push('        return string.format(":%d [%s]", bundleLine, mapped)');
      builder.push('    end)');
      builder.push();
      builder.push('    if changed then');
      builder.push('        return remapped');
      builder.push('    end');
      builder.push('    return trace');
      builder.push('end');
      builder.push();

      if (this.isCleanTracebackEnabled()) {
        builder.push('local function __describeMappedFrame(frame)');
        builder.push('    if frame.functionLabel then');
        builder.push('        return string.format("- %s:%d in %s", frame.sourcePath, frame.sourceLine, frame.functionLabel)');
        builder.push('    end');
        builder.push('    if frame.kind and frame.name then');
        builder.push('        return string.format("- %s:%d in %s %s", frame.sourcePath, frame.sourceLine, frame.kind, frame.name)');
        builder.push('    end');
        builder.push('    return string.format("- %s:%d", frame.sourcePath, frame.sourceLine)');
        builder.push('end');
        builder.push();
        builder.push('local function __buildMappedStack()');
        builder.push('    if type(debug) ~= "table" or type(debug.info) ~= "function" then');
        builder.push('        return {}');
        builder.push('    end');
        builder.push('    local frames = {}');
        builder.push('    local lastKey = nil');
        builder.push('    for level = 1, 64 do');
        builder.push('        local source, line = debug.info(level, "sl")');
        builder.push('        if source == nil then');
        builder.push('            break');
        builder.push('        end');
        builder.push('        if type(line) == "number" then');
        builder.push('            local entry, sourceLine = __findSourceLocation(line)');
        builder.push('            if entry and sourceLine then');
        builder.push('                local functionLabel = __findFunctionLabel(entry.sourcePath, sourceLine)');
        builder.push('                local key = string.format("%s:%d:%s", entry.sourcePath, sourceLine, functionLabel or "")');
        builder.push('                if key ~= lastKey then');
        builder.push('                    frames[#frames + 1] = {');
        builder.push('                        sourcePath = entry.sourcePath,');
        builder.push('                        sourceLine = sourceLine,');
        builder.push('                        functionLabel = functionLabel,');
        builder.push('                        kind = entry.kind,');
        builder.push('                        name = entry.name,');
        builder.push('                    }');
        builder.push('                    lastKey = key');
        builder.push('                end');
        builder.push('            end');
        builder.push('        end');
        builder.push('    end');
        builder.push('    return frames');
        builder.push('end');
        builder.push();
      } else {
        builder.push('local function __findTopMappedLocation()');
        builder.push('    if type(debug) ~= "table" or type(debug.info) ~= "function" then');
        builder.push('        return nil, nil');
        builder.push('    end');
        builder.push('    for level = 1, 64 do');
        builder.push('        local source, line = debug.info(level, "sl")');
        builder.push('        if source == nil then');
        builder.push('            break');
        builder.push('        end');
        builder.push('        if type(line) == "number" then');
        builder.push('            local entry, sourceLine = __findSourceLocation(line)');
        builder.push('            if entry and sourceLine then');
        builder.push('                return entry, sourceLine');
        builder.push('            end');
        builder.push('        end');
        builder.push('    end');
        builder.push('    return nil, nil');
        builder.push('end');
        builder.push();
      }

      builder.push('local __BUNDLER_SENTINEL = "[LuaBundlerMapped]"');
      builder.push();
      builder.push('local function __formatRuntimeError(kind, name, err)');
      builder.push('    if type(err) == "string" and string.sub(err, 1, #__BUNDLER_SENTINEL) == __BUNDLER_SENTINEL then');
      builder.push('        return err');
      builder.push('    end');
      builder.push();
      if (this.isCleanTracebackEnabled()) {
        builder.push('    local message = __stripErrorPrefix(tostring(err))');
        builder.push('    local frames = __buildMappedStack()');
        builder.push('    local topFrame = frames[1]');
        builder.push('    if topFrame then');
        builder.push('        local headline');
        builder.push('        if topFrame.functionLabel then');
        builder.push('            headline = string.format("%s:%d in %s", topFrame.sourcePath, topFrame.sourceLine, topFrame.functionLabel)');
        builder.push('        elseif topFrame.kind and topFrame.name then');
        builder.push('            headline = string.format("%s:%d in %s %s", topFrame.sourcePath, topFrame.sourceLine, topFrame.kind, topFrame.name)');
        builder.push('        else');
        builder.push('            headline = string.format("%s:%d", topFrame.sourcePath, topFrame.sourceLine)');
        builder.push('        end');
        builder.push();
        builder.push('        local lines = {');
        builder.push('            __BUNDLER_SENTINEL,');
        builder.push('            string.format("%s: %s", headline, message),');
        builder.push('        }');
        builder.push();
        builder.push('        if #frames > 0 then');
        builder.push('            lines[#lines + 1] = ""');
        builder.push('            lines[#lines + 1] = "Mapped stack:"');
        builder.push('            local limit = math.min(#frames, 12)');
        builder.push('            for i = 1, limit do');
        builder.push('                lines[#lines + 1] = __describeMappedFrame(frames[i])');
        builder.push('            end');
        builder.push('            if #frames > limit then');
        builder.push('                lines[#lines + 1] = string.format("- ... %d more frame(s)", #frames - limit)');
        builder.push('            end');
        builder.push('        end');
        builder.push();
        builder.push('        return table.concat(lines, "\\n")');
        builder.push('    end');
        builder.push();
        builder.push('    if kind and name then');
        builder.push('        message = string.format("[%s:%s] %s", kind, name, message)');
        builder.push('    end');
      } else {
        builder.push('    local message = tostring(err)');
        builder.push('    local entry, sourceLine = __findTopMappedLocation()');
        builder.push('    if entry and sourceLine then');
        builder.push('        message = string.format("%s [line %d] [%s:%s] %s", entry.sourcePath, sourceLine, kind, name, message)');
        builder.push('    elseif kind and name then');
        builder.push('        message = string.format("[%s:%s] %s", kind, name, message)');
        builder.push('    end');
      }
      builder.push();
      builder.push('    if type(debug) == "table" and type(debug.traceback) == "function" then');
      builder.push('        local ok, trace = pcall(debug.traceback, message, 2)');
      builder.push('        if ok and type(trace) == "string" then');
      builder.push('            return __BUNDLER_SENTINEL .. "\\n" .. __annotateTraceback(trace)');
      builder.push('        end');
      builder.push('    end');
      builder.push();
      builder.push('    return __BUNDLER_SENTINEL .. "\\n" .. __annotateTraceback(message)');
      builder.push('end');
      builder.push();
      builder.push('local function __runChunk(kind, name, fn)');
      builder.push('    local packed = __pack(xpcall(fn, function(err)');
      builder.push('        return __formatRuntimeError(kind, name, err)');
      builder.push('    end))');
      builder.push('    if not packed[1] then');
      builder.push('        error(packed[2], 0)');
      builder.push('    end');
      builder.push('    return __unpack(packed, 2, packed.n)');
      builder.push('end');
      if (this.isFullFunctionWrappingEnabled()) {
        builder.push();
        builder.push('local __wrappedFunctions = setmetatable({}, { __mode = "k" })');
        builder.push();
        builder.push('local function __wrapFunction(name, callback)');
        builder.push('    if type(callback) ~= "function" then');
        builder.push('        return callback');
        builder.push('    end');
        builder.push();
        builder.push('    local existing = __wrappedFunctions[callback]');
        builder.push('    if existing then');
        builder.push('        return existing');
        builder.push('    end');
        builder.push();
        builder.push('    local wrapped = function(...)');
        builder.push('        local args = __pack(...)');
        builder.push('        return __runChunk("function", name, function()');
        builder.push('            return callback(__unpack(args, 1, args.n))');
        builder.push('        end)');
        builder.push('    end');
        builder.push();
        builder.push('    __wrappedFunctions[callback] = wrapped');
        builder.push('    __wrappedFunctions[wrapped] = wrapped');
        builder.push('    return wrapped');
        builder.push('end');
      }
    }

    builder.push();
    this.pushComment(builder, 'Navigate folder tree by slash-separated module path');
    builder.push('local function __getTreeNode(name)');
    builder.push('    local current = __moduleTree');
    builder.push('    for part in name:gmatch("[^/]+") do');
    builder.push('        if type(current) ~= "table" then return nil end');
    builder.push('        current = current[part]');
    builder.push('        if not current then return nil end');
    builder.push('    end');
    builder.push('    return current');
    builder.push('end');
    builder.push();
    this.pushComment(builder, 'Custom require that resolves bundled modules by exact path');
    builder.push('local function __require(name)');
    builder.push('    if __loaded[name] then return __loaded[name] end');
    builder.push('    local loader = __modules[name]');
    builder.push('    if type(loader) == "function" then');
    builder.push('        __loaded[name] = loader()');
    builder.push('        return __loaded[name]');
    builder.push('    end');
    builder.push('    return require(name)');
    builder.push('end');
    builder.push();
    this.pushComment(builder, 'Folder require - returns direct child modules in a folder');
    builder.push('local function __requireFolder(folderPath)');
    builder.push('    local folder = __getTreeNode(folderPath)');
    builder.push('    if type(folder) ~= "table" then return {} end');
    builder.push('    local result = {}');
    builder.push('    for name, node in pairs(folder) do');
    builder.push('        if name ~= "__init" and type(node) == "table" and type(node["__init"]) == "string" then');
    builder.push('            result[name] = __require(node["__init"])');
    builder.push('        end');
    builder.push('    end');
    builder.push('    return result');
    builder.push('end');
    builder.push();
  }

  private appendFolderDeclarations(builder: LuaLineBuilder, folders: string[]): void {
    if (folders.length === 0) {
      return;
    }

    this.pushComment(builder, 'Initialize module tree');
    for (const folder of folders) {
      const folderAccess = this.toModuleTreeAccess(folder, '__moduleTree');
      builder.push(`${folderAccess} = ${folderAccess} or {}`);
    }

    if (!this.options.minify) {
      builder.push();
    }
  }

  private appendModuleTreeRegistrations(builder: LuaLineBuilder, moduleNames: string[]): void {
    if (moduleNames.length === 0) {
      return;
    }

    this.pushComment(builder, 'Register module names in tree');
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
      builder.push(`${moduleAccess} = ${moduleAccess} or {}`);
      builder.push(`${moduleAccess}["__init"] = ${this.toLuaStringLiteral(moduleName)}`);
    }

    if (!this.options.minify) {
      builder.push();
    }
  }

  private appendModuleWrapper(builder: LuaLineBuilder, module: ModuleNode): void {
    const sourcePath = module.displayPath ?? module.path;
    const chunk = this.transformChunkContent(module.content);

    if (this.shouldEmitComments()) {
      builder.push(`-- Module: ${module.moduleName}`);
      builder.push(`-- Source: ${sourcePath}`);
    }

    if (this.isSourceMapEnabled()) {
      const registrationLines = this.buildSourceMapRegistrationLines(0, {
        displayPath: sourcePath,
        kind: 'module',
        name: module.moduleName,
      }, chunk);
      const functionRegistrationLines = this.buildFunctionSourceRegistrationLines(sourcePath, chunk.functionSources);
      const contentStartLine =
        builder.currentLine +
        registrationLines.length +
        functionRegistrationLines.length +
        2;
      builder.pushLines(this.buildSourceMapRegistrationLines(contentStartLine, {
        displayPath: sourcePath,
        kind: 'module',
        name: module.moduleName,
      }, chunk));
      builder.pushLines(functionRegistrationLines);
    }

    builder.push(`__modules[${this.toLuaStringLiteral(module.moduleName)}] = function()`);
    if (this.isSourceMapEnabled()) {
      builder.push(`    return __runChunk("module", ${this.toLuaStringLiteral(module.moduleName)}, function()`);
      this.pushIndentedLines(builder, chunk.emittedLines, 8);
      builder.push('    end)');
    } else {
      this.pushIndentedLines(builder, this.splitLines(module.content), 4);
    }
    builder.push('end');

    if (!this.options.minify) {
      builder.push();
    }
  }

  private appendEntryPoint(builder: LuaLineBuilder, module: ModuleNode): void {
    const sourcePath = module.displayPath ?? module.path;
    const chunk = this.transformChunkContent(module.content);

    if (this.shouldEmitComments()) {
      builder.push(`-- ENTRY POINT: ${module.moduleName}`);
      builder.push(`-- Source: ${sourcePath}`);
    }

    if (this.isSourceMapEnabled()) {
      const registrationLines = this.buildSourceMapRegistrationLines(0, {
        displayPath: sourcePath,
        kind: 'entry',
        name: module.moduleName,
      }, chunk);
      const functionRegistrationLines = this.buildFunctionSourceRegistrationLines(sourcePath, chunk.functionSources);
      const contentStartLine =
        builder.currentLine +
        registrationLines.length +
        functionRegistrationLines.length +
        2;
      builder.pushLines(this.buildSourceMapRegistrationLines(contentStartLine, {
        displayPath: sourcePath,
        kind: 'entry',
        name: module.moduleName,
      }, chunk));
      builder.pushLines(functionRegistrationLines);
    }

    builder.push('do');
    if (this.isSourceMapEnabled()) {
      builder.push(`    __runChunk("entry", ${this.toLuaStringLiteral(module.moduleName)}, function()`);
      this.pushIndentedLines(builder, chunk.emittedLines, 8);
      builder.push('    end)');
    } else {
      this.pushIndentedLines(builder, this.splitLines(module.content), 4);
    }
    builder.push('end');
  }

  private appendClientScripts(builder: LuaLineBuilder, clientScripts: ClientScript[]): void {
    if (this.shouldEmitComments()) {
      builder.push('-- CLIENT SCRIPTS (execute in parallel via task.spawn)');
    }

    for (const script of clientScripts) {
      const sourcePath = script.displayPath ?? script.path;
      const chunk = this.transformChunkContent(script.content);

      if (this.shouldEmitComments()) {
        builder.push(`-- Client: ${script.moduleName}`);
        builder.push(`-- Source: ${sourcePath}`);
      }

      if (this.isSourceMapEnabled()) {
        const registrationLines = this.buildSourceMapRegistrationLines(0, {
          displayPath: sourcePath,
          kind: 'client',
          name: script.moduleName,
        }, chunk);
        const functionRegistrationLines = this.buildFunctionSourceRegistrationLines(sourcePath, chunk.functionSources);
        const contentStartLine =
          builder.currentLine +
          registrationLines.length +
          functionRegistrationLines.length +
          2;
        builder.pushLines(this.buildSourceMapRegistrationLines(contentStartLine, {
          displayPath: sourcePath,
          kind: 'client',
          name: script.moduleName,
        }, chunk));
        builder.pushLines(functionRegistrationLines);
      }

      builder.push('task.spawn(function()');
      if (this.isSourceMapEnabled()) {
        builder.push(`    __runChunk("client", ${this.toLuaStringLiteral(script.moduleName)}, function()`);
        this.pushIndentedLines(builder, chunk.emittedLines, 8);
        builder.push('    end)');
      } else {
        this.pushIndentedLines(builder, this.splitLines(script.content), 4);
      }
      builder.push('end)');

      if (!this.options.minify) {
        builder.push();
      }
    }
  }

  private buildSourceMapRegistrationLines(
    startLine: number,
    meta: SourceChunkMeta,
    chunk: GeneratedChunk,
  ): string[] {
    if (this.isContiguousSequence(chunk.sourceLines)) {
      return [
        `__registerSourceRange(${startLine}, ${chunk.sourceLines.length}, ${this.toLuaStringLiteral(meta.displayPath)}, ${this.toLuaStringLiteral(meta.kind)}, ${this.toLuaStringLiteral(meta.name)}, ${chunk.sourceLines[0] ?? 1})`,
      ];
    }

    const sourceLinesLiteral = this.buildNumberTableLiteral(chunk.sourceLines);
    if (sourceLinesLiteral.length === 1) {
      return [
        `__registerSourceLines(${startLine}, ${this.toLuaStringLiteral(meta.displayPath)}, ${this.toLuaStringLiteral(meta.kind)}, ${this.toLuaStringLiteral(meta.name)}, ${sourceLinesLiteral[0]})`,
      ];
    }

    return [
      `__registerSourceLines(${startLine}, ${this.toLuaStringLiteral(meta.displayPath)}, ${this.toLuaStringLiteral(meta.kind)}, ${this.toLuaStringLiteral(meta.name)}, {`,
      ...sourceLinesLiteral.map((line) => `    ${line}`),
      '})',
    ];
  }

  private buildFunctionSourceRegistrationLines(
    sourcePath: string,
    functions: FunctionSourceInfo[],
  ): string[] {
    if (!this.isCleanTracebackEnabled() || functions.length === 0) {
      return [];
    }

    return functions.map((fn) =>
      `__registerFunctionSource(${this.toLuaStringLiteral(sourcePath)}, ${fn.startLine}, ${fn.endLine}, ${this.toLuaStringLiteral(fn.label)})`,
    );
  }

  private transformChunkContent(content: string): GeneratedChunk {
    const instrumentedChunk = this.isSourceMapEnabled() && this.isFullFunctionWrappingEnabled()
      ? this.instrumentFunctionDefinitions(content)
      : {
        content,
        functionSources: [],
      };
    const instrumentedContent = instrumentedChunk.content;

    const sourceLines = this.splitLines(instrumentedContent);
    const emittedLines: string[] = [];
    const emittedSourceLines: number[] = [];

    for (let i = 0; i < sourceLines.length; i++) {
      const originalLine = sourceLines[i];
      if (this.options.minify) {
        const trimmed = originalLine.trim();
        if (trimmed.length === 0) {
          continue;
        }
        emittedLines.push(trimmed);
      } else {
        emittedLines.push(originalLine);
      }
      emittedSourceLines.push(i + 1);
    }

    if (emittedLines.length === 0) {
      emittedLines.push('');
      emittedSourceLines.push(1);
    }

    return {
      emittedLines,
      sourceLines: emittedSourceLines,
      functionSources: instrumentedChunk.functionSources,
    };
  }

  private instrumentFunctionDefinitions(content: string): InstrumentedChunk {
    const masked = this.maskLuaContent(content);
    const plans = this.buildFunctionWrapPlans(content, masked);
    if (plans.length === 0) {
      return {
        content,
        functionSources: [],
      };
    }

    const replacements = plans.flatMap((plan) => ([
      {
        start: plan.prefixStart,
        end: plan.prefixEnd,
        content: plan.prefixContent,
      },
      {
        start: plan.suffixIndex,
        end: plan.suffixIndex,
        content: ')',
      },
    ]));

    replacements.sort((a, b) => {
      if (a.start !== b.start) {
        return b.start - a.start;
      }
      return b.end - a.end;
    });

    let result = content;
    for (const replacement of replacements) {
      result =
        result.slice(0, replacement.start) +
        replacement.content +
        result.slice(replacement.end);
    }

    return {
      content: result,
      functionSources: plans.map((plan) => ({
        label: plan.label,
        startLine: plan.sourceStartLine,
        endLine: plan.sourceEndLine,
      })),
    };
  }

  private buildFunctionWrapPlans(
    content: string,
    masked: string,
  ): FunctionWrapPlan[] {
    const plans: FunctionWrapPlan[] = [];

    for (let index = 0; index < masked.length; index += 1) {
      if (!this.isKeywordAt(masked, index, 'function')) {
        continue;
      }

      const plan = this.createFunctionWrapPlan(content, masked, index);
      if (plan) {
        plans.push(plan);
      }

      index += 'function'.length - 1;
    }

    return plans;
  }

  private createFunctionWrapPlan(
    content: string,
    masked: string,
    functionIndex: number,
  ): FunctionWrapPlan | null {
    const suffixIndex = this.findMatchingFunctionEnd(masked, functionIndex);
    if (suffixIndex == null) {
      return null;
    }

    const afterFunctionKeyword = this.skipWhitespaceForward(masked, functionIndex + 'function'.length);
    if (afterFunctionKeyword >= masked.length) {
      return null;
    }

    const lineNumber = this.countLineNumber(content, functionIndex);
    const endLineNumber = this.countLineNumber(content, Math.max(functionIndex, suffixIndex - 1));
    const localFunctionStart = this.findLocalFunctionStart(masked, functionIndex);
    const firstChar = masked[afterFunctionKeyword];

    if (this.isIdentifierStart(firstChar)) {
      return this.createNamedFunctionWrapPlan(
        content,
        masked,
        functionIndex,
        localFunctionStart,
        afterFunctionKeyword,
        suffixIndex,
        lineNumber,
        endLineNumber,
      );
    }

    if (firstChar === '(' || firstChar === '<') {
      const label = this.buildFunctionLabel(null, lineNumber);
      return {
        prefixStart: functionIndex,
        prefixEnd: functionIndex,
        prefixContent: `__wrapFunction(${this.toLuaStringLiteral(label)}, `,
        suffixIndex,
        label,
        sourceStartLine: lineNumber,
        sourceEndLine: endLineNumber,
      };
    }

    return null;
  }

  private createNamedFunctionWrapPlan(
    content: string,
    masked: string,
    functionIndex: number,
    localFunctionStart: number | null,
    nameStart: number,
    suffixIndex: number,
    lineNumber: number,
    endLineNumber: number,
  ): FunctionWrapPlan | null {
    const parsedName = this.parseNamedFunctionHeader(masked, nameStart);
    if (!parsedName) {
      return null;
    }

    const genericSuffix = content.slice(parsedName.nameEnd, parsedName.paramsStart);
    const label = this.buildFunctionLabel(parsedName.displayName, lineNumber);

    if (localFunctionStart != null) {
      return {
        prefixStart: localFunctionStart,
        prefixEnd: parsedName.paramsStart + 1,
        prefixContent: `local ${parsedName.assignmentTarget}; ${parsedName.assignmentTarget} = __wrapFunction(${this.toLuaStringLiteral(label)}, function${genericSuffix}(`,
        suffixIndex,
        label,
        sourceStartLine: lineNumber,
        sourceEndLine: endLineNumber,
      };
    }

    if (parsedName.usesSelf) {
      const hasParameters = this.parameterListHasValues(masked, parsedName.paramsStart);
      return {
        prefixStart: functionIndex,
        prefixEnd: parsedName.paramsStart + 1,
        prefixContent: `${parsedName.assignmentTarget} = __wrapFunction(${this.toLuaStringLiteral(label)}, function${genericSuffix}(${hasParameters ? 'self, ' : 'self'}`,
        suffixIndex,
        label,
        sourceStartLine: lineNumber,
        sourceEndLine: endLineNumber,
      };
    }

    return {
      prefixStart: functionIndex,
      prefixEnd: parsedName.paramsStart + 1,
      prefixContent: `${parsedName.assignmentTarget} = __wrapFunction(${this.toLuaStringLiteral(label)}, function${genericSuffix}(`,
      suffixIndex,
      label,
      sourceStartLine: lineNumber,
      sourceEndLine: endLineNumber,
    };
  }

  private parseNamedFunctionHeader(
    masked: string,
    nameStart: number,
  ): {
    assignmentTarget: string;
    displayName: string;
    nameEnd: number;
    paramsStart: number;
    usesSelf: boolean;
  } | null {
    let index = nameStart;
    while (index < masked.length && this.isNamedFunctionChar(masked[index])) {
      index += 1;
    }

    const rawName = masked.slice(nameStart, index).trim();
    if (!rawName) {
      return null;
    }

    const paramsStart = this.findFunctionParameterStart(masked, index);
    if (paramsStart == null) {
      return null;
    }

    const colonIndex = rawName.lastIndexOf(':');
    if (colonIndex === -1) {
      return {
        assignmentTarget: rawName,
        displayName: rawName,
        nameEnd: index,
        paramsStart,
        usesSelf: false,
      };
    }

    return {
      assignmentTarget: `${rawName.slice(0, colonIndex)}.${rawName.slice(colonIndex + 1)}`,
      displayName: rawName,
      nameEnd: index,
      paramsStart,
      usesSelf: true,
    };
  }

  private findFunctionParameterStart(masked: string, start: number): number | null {
    let index = start;
    let genericDepth = 0;

    while (index < masked.length) {
      const current = masked[index];
      if (current === '<') {
        genericDepth += 1;
      } else if (current === '>') {
        if (genericDepth > 0) {
          genericDepth -= 1;
        }
      } else if (current === '(' && genericDepth === 0) {
        return index;
      }
      index += 1;
    }

    return null;
  }

  private parameterListHasValues(masked: string, paramsStart: number): boolean {
    const next = this.skipWhitespaceForward(masked, paramsStart + 1);
    return next < masked.length && masked[next] !== ')';
  }

  private findLocalFunctionStart(masked: string, functionIndex: number): number | null {
    const previousNonWhitespace = this.skipWhitespaceBackward(masked, functionIndex - 1);
    if (previousNonWhitespace < 0) {
      return null;
    }

    const localEnd = previousNonWhitespace + 1;
    const localStart = localEnd - 'local'.length;
    if (localStart < 0) {
      return null;
    }

    if (
      masked.slice(localStart, localEnd) === 'local' &&
      this.isWordBoundary(masked, localStart - 1) &&
      this.isWordBoundary(masked, localEnd)
    ) {
      return localStart;
    }

    return null;
  }

  private findMatchingFunctionEnd(masked: string, functionIndex: number): number | null {
    const stack: Array<'function' | 'if' | 'do' | 'repeat'> = ['function'];
    let index = functionIndex + 'function'.length;

    while (index < masked.length) {
      const token = this.nextBlockKeyword(masked, index);
      if (!token) {
        return null;
      }

      index = token.end;

      switch (token.word) {
        case 'function':
          stack.push('function');
          break;
        case 'if':
          stack.push('if');
          break;
        case 'do':
          stack.push('do');
          break;
        case 'repeat':
          stack.push('repeat');
          break;
        case 'until': {
          const repeatIndex = stack.lastIndexOf('repeat');
          if (repeatIndex !== -1) {
            stack.splice(repeatIndex, 1);
            if (stack.length === 0) {
              return token.end;
            }
          }
          break;
        }
        case 'end':
          if (stack.length > 0) {
            stack.pop();
            if (stack.length === 0) {
              return token.end;
            }
          }
          break;
      }
    }

    return null;
  }

  private nextBlockKeyword(
    masked: string,
    start: number,
  ): { word: 'function' | 'if' | 'do' | 'repeat' | 'until' | 'end'; start: number; end: number } | null {
    for (let index = start; index < masked.length; index += 1) {
      const current = masked[index];
      if (!this.isIdentifierStart(current)) {
        continue;
      }

      let end = index + 1;
      while (end < masked.length && this.isIdentifierChar(masked[end])) {
        end += 1;
      }

      const word = masked.slice(index, end);
      if (
        word === 'function' ||
        word === 'if' ||
        word === 'do' ||
        word === 'repeat' ||
        word === 'until' ||
        word === 'end'
      ) {
        return {
          word,
          start: index,
          end,
        };
      }

      index = end - 1;
    }

    return null;
  }

  private buildFunctionLabel(name: string | null, lineNumber: number): string {
    if (name && name.length > 0) {
      return `${name} @ line ${lineNumber}`;
    }
    return `anonymous @ line ${lineNumber}`;
  }

  private countLineNumber(content: string, index: number): number {
    return content.slice(0, index).split(/\r?\n/).length;
  }

  private isKeywordAt(content: string, index: number, keyword: string): boolean {
    if (content.slice(index, index + keyword.length) !== keyword) {
      return false;
    }

    return this.isWordBoundary(content, index - 1) && this.isWordBoundary(content, index + keyword.length);
  }

  private isWordBoundary(content: string, index: number): boolean {
    if (index < 0 || index >= content.length) {
      return true;
    }
    return !this.isIdentifierChar(content[index]);
  }

  private isIdentifierStart(char: string | undefined): boolean {
    return char != null && /[A-Za-z_]/.test(char);
  }

  private isIdentifierChar(char: string | undefined): boolean {
    return char != null && /[A-Za-z0-9_]/.test(char);
  }

  private isNamedFunctionChar(char: string | undefined): boolean {
    return this.isIdentifierChar(char) || char === '.' || char === ':';
  }

  private skipWhitespaceForward(content: string, index: number): number {
    let cursor = index;
    while (cursor < content.length && /\s/.test(content[cursor])) {
      cursor += 1;
    }
    return cursor;
  }

  private skipWhitespaceBackward(content: string, index: number): number {
    let cursor = index;
    while (cursor >= 0 && /\s/.test(content[cursor])) {
      cursor -= 1;
    }
    return cursor;
  }

  private maskLuaContent(content: string): string {
    const chars = content.split('');
    let index = 0;

    while (index < content.length) {
      const current = content[index];

      if (current === '"' || current === '\'') {
        const end = this.skipQuotedString(content, index, current);
        this.maskRange(chars, index, end);
        index = end;
        continue;
      }

      const longString = this.matchLongBracketStart(content, index);
      if (longString) {
        const end = this.findLongBracketEnd(content, index + longString.length, longString.equalsCount);
        this.maskRange(chars, index, end);
        index = end;
        continue;
      }

      if (current === '-' && content[index + 1] === '-') {
        const blockComment = this.matchLongBracketStart(content, index + 2);
        if (blockComment) {
          const end = this.findLongBracketEnd(
            content,
            index + 2 + blockComment.length,
            blockComment.equalsCount,
          );
          this.maskRange(chars, index, end);
          index = end;
        } else {
          const end = this.findLineEnd(content, index + 2);
          this.maskRange(chars, index, end);
          index = end;
        }
        continue;
      }

      index += 1;
    }

    return chars.join('');
  }

  private skipQuotedString(content: string, start: number, quote: string): number {
    let index = start + 1;
    while (index < content.length) {
      const current = content[index];
      if (current === '\\') {
        index += 2;
        continue;
      }
      if (current === quote) {
        return index + 1;
      }
      index += 1;
    }
    return content.length;
  }

  private findLineEnd(content: string, start: number): number {
    let index = start;
    while (index < content.length && content[index] !== '\n' && content[index] !== '\r') {
      index += 1;
    }
    return index;
  }

  private maskRange(chars: string[], start: number, end: number): void {
    for (let index = start; index < end; index += 1) {
      if (chars[index] !== '\n' && chars[index] !== '\r') {
        chars[index] = ' ';
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

    let index = start + 1;
    while (index < content.length && content[index] === '=') {
      index += 1;
    }

    if (content[index] !== '[') {
      return null;
    }

    return {
      equalsCount: index - (start + 1),
      length: index - start + 1,
    };
  }

  private findLongBracketEnd(content: string, start: number, equalsCount: number): number {
    let index = start;
    while (index < content.length) {
      if (content[index] !== ']') {
        index += 1;
        continue;
      }

      let cursor = index + 1;
      let matchedEquals = 0;
      while (matchedEquals < equalsCount && cursor < content.length && content[cursor] === '=') {
        matchedEquals += 1;
        cursor += 1;
      }

      if (matchedEquals === equalsCount && cursor < content.length && content[cursor] === ']') {
        return cursor + 1;
      }

      index += 1;
    }

    return content.length;
  }

  private pushIndentedLines(builder: LuaLineBuilder, lines: string[], spaces: number): void {
    const prefix = ' '.repeat(spaces);
    for (const line of lines) {
      builder.push(line.length > 0 ? `${prefix}${line}` : '');
    }
  }

  private splitLines(content: string): string[] {
    return content.split(/\r?\n/);
  }

  private buildNumberTableLiteral(values: number[]): string[] {
    const chunkSize = 20;
    const rows: string[] = [];

    for (let i = 0; i < values.length; i += chunkSize) {
      const chunk = values.slice(i, i + chunkSize);
      const suffix = i + chunkSize < values.length ? ',' : '';
      rows.push(`${chunk.join(', ')}${suffix}`);
    }

    if (rows.length === 0) {
      return ['{}'];
    }

    if (rows.length === 1) {
      return [`{ ${rows[0].replace(/,$/, '')} }`];
    }

    return rows;
  }

  private isContiguousSequence(values: number[]): boolean {
    if (values.length <= 1) {
      return true;
    }
    for (let i = 1; i < values.length; i++) {
      if (values[i] !== values[i - 1] + 1) {
        return false;
      }
    }
    return true;
  }

  private pushComment(builder: LuaLineBuilder, comment: string): void {
    if (this.shouldEmitComments()) {
      builder.push(`-- ${comment}`);
    }
  }

  private shouldEmitComments(): boolean {
    return this.options.addComments && !this.options.minify;
  }

  private isSourceMapEnabled(): boolean {
    return this.options.includeSourceMap;
  }

  private isCleanTracebackEnabled(): boolean {
    return this.options.cleanTraceback !== false;
  }

  private isFullFunctionWrappingEnabled(): boolean {
    return this.options.fullFunctionWrapping !== false;
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
