import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CodeGenerator } from '../src/codeGenerator';
import { DependencyGraph, ModuleNode } from '../src/dependencyGraph';
import { LuaParser } from '../src/parser';
import { PathResolver } from '../src/resolver';
import { moduleNameFromPath } from '../src/utils/pathUtils';

const writeLua = (dir: string, rel: string, content: string): string => {
  const target = path.join(dir, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
  return target;
};

describe('Lua Bundler building blocks', () => {
  it('parses require statements and ignores commented lines', () => {
    const parser = new LuaParser();
    const content = [
      'local Module1 = require("module1")',
      '-- require("skip")',
      'require("plain")',
    ].join('\n');
    const result = parser.parse(content, 'file.lua');
    expect(result.requires).to.have.length(2);
    expect(result.requires[0].modulePath).to.equal('module1');
    expect(result.requires[1].modulePath).to.equal('plain');
  });

  it('ignores require statements inside block comments', () => {
    const parser = new LuaParser();
    const content = [
      'local Module1 = require("module1")',
      '--[[ require("skipInline") ]]',
      '--[[',
      'local SkipBlock = require("skipBlock")',
      ']]',
      '--[=[',
      'local SkipEqBlock = require("skipEqBlock")',
      ']=]',
      'require("plain")',
    ].join('\n');
    const result = parser.parse(content, 'file.lua');
    expect(result.requires).to.have.length(2);
    expect(result.requires.map((req) => req.modulePath)).to.deep.equal(['module1', 'plain']);
  });

  it('resolves relative and dot notation paths', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lua-bundler-'));
    const entry = writeLua(tmp, 'main.lua', 'local m = require("./lib/util")');
    const dep = writeLua(tmp, 'lib/util.lua', 'return {}');

    const resolver = new PathResolver(tmp);
    const resolved = resolver.resolve('./lib/util', entry);
    expect(resolved.exists).to.equal(true);
    expect(resolved.absolutePath).to.equal(path.normalize(dep));
  });

  it('produces topological order in dependency graph', () => {
    const graph = new DependencyGraph();
    const makeNode = (name: string, deps: string[]): ModuleNode => ({
      moduleName: name,
      path: `${name}.lua`,
      dependencies: deps,
      content: '',
      parseResult: { requires: [], codeWithoutRequires: '', originalCode: '' },
    });
    graph.addModule('c', makeNode('c', []));
    graph.addModule('b', makeNode('b', ['c']));
    graph.addModule('a', makeNode('a', ['b']));

    const order = graph.getTopologicalOrder();
    expect(order.indexOf('c')).to.be.lessThan(order.indexOf('b'));
    expect(order.indexOf('b')).to.be.lessThan(order.indexOf('a'));
  });

  it('generates bundled Lua code with runtime and entry', () => {
    const graph = new DependencyGraph();
    const moduleA: ModuleNode = {
      moduleName: 'moduleA',
      path: 'moduleA.lua',
      dependencies: [],
      content: 'local M = {}; return M',
      parseResult: { requires: [], codeWithoutRequires: '', originalCode: '' },
    };
    const entry: ModuleNode = {
      moduleName: 'main',
      path: 'main.lua',
      dependencies: ['moduleA'],
      content: 'local ModuleA = __require("moduleA")',
      parseResult: { requires: [], codeWithoutRequires: '', originalCode: '' },
    };
    graph.addModule('moduleA', moduleA);
    graph.addModule('main', entry);

    const generator = new CodeGenerator({
      addComments: true,
      minify: false,
      includeSourceMap: false,
      preserveRequireNames: true,
    });
    const output = generator.generate(graph, 'main');
    expect(output).to.contain('__modules["moduleA"]');
    expect(output).to.contain('-- ENTRY POINT');
  });

  it('generates safe module access for non-identifier module names', () => {
    const graph = new DependencyGraph();
    const moduleA: ModuleNode = {
      moduleName: 'features/auto-farm',
      path: 'features/auto-farm.lua',
      dependencies: [],
      content: 'return {}',
      parseResult: { requires: [], codeWithoutRequires: '', originalCode: '' },
    };
    const entry: ModuleNode = {
      moduleName: 'main',
      path: 'main.lua',
      dependencies: ['features/auto-farm'],
      content: 'local AutoFarm = __require("features/auto-farm")',
      parseResult: { requires: [], codeWithoutRequires: '', originalCode: '' },
    };
    graph.addModule('features/auto-farm', moduleA);
    graph.addModule('main', entry);

    const generator = new CodeGenerator({
      addComments: false,
      minify: false,
      includeSourceMap: false,
      preserveRequireNames: true,
    });
    const output = generator.generate(graph, 'main');
    expect(output).to.contain('__moduleTree["features"] = __moduleTree["features"] or {}');
    expect(output).to.contain('__moduleTree["features"]["auto-farm"] = __moduleTree["features"]["auto-farm"] or {}');
    expect(output).to.contain('__moduleTree["features"]["auto-farm"]["__init"] = "features/auto-farm"');
    expect(output).to.contain('__modules["features/auto-farm"] = function()');
    expect(output).to.not.contain('__modules.features.auto-farm');
  });

  it('avoids parent nil indexing when folder init module also has nested modules', () => {
    const graph = new DependencyGraph();
    const guiBuilder: ModuleNode = {
      moduleName: 'GuiBuilder',
      path: 'GuiBuilder/init.lua',
      dependencies: ['GuiBuilder/Internal/Builder'],
      content: 'local Builder = __require("GuiBuilder/Internal/Builder")\nreturn Builder',
      parseResult: { requires: [], codeWithoutRequires: '', originalCode: '' },
    };
    const internalBuilder: ModuleNode = {
      moduleName: 'GuiBuilder/Internal/Builder',
      path: 'GuiBuilder/Internal/Builder.lua',
      dependencies: [],
      content: 'return { ok = true }',
      parseResult: { requires: [], codeWithoutRequires: '', originalCode: '' },
    };
    const entry: ModuleNode = {
      moduleName: 'main',
      path: 'main.lua',
      dependencies: ['GuiBuilder'],
      content: 'local Builder = __require("GuiBuilder")\nreturn Builder',
      parseResult: { requires: [], codeWithoutRequires: '', originalCode: '' },
    };
    graph.addModule('GuiBuilder', guiBuilder);
    graph.addModule('GuiBuilder/Internal/Builder', internalBuilder);
    graph.addModule('main', entry);

    const generator = new CodeGenerator({
      addComments: false,
      minify: false,
      includeSourceMap: false,
      preserveRequireNames: true,
    });
    const output = generator.generate(graph, 'main');

    expect(output).to.contain('local __moduleTree = {}');
    expect(output).to.contain('__moduleTree["GuiBuilder"] = __moduleTree["GuiBuilder"] or {}');
    expect(output).to.contain('__moduleTree["GuiBuilder"]["Internal"] = __moduleTree["GuiBuilder"]["Internal"] or {}');
    expect(output).to.contain('__moduleTree["GuiBuilder"]["Internal"]["Builder"] = __moduleTree["GuiBuilder"]["Internal"]["Builder"] or {}');
    expect(output).to.contain('__moduleTree["GuiBuilder"]["Internal"]["Builder"]["__init"] = "GuiBuilder/Internal/Builder"');
    expect(output).to.contain('__modules["GuiBuilder"] = function()');
    expect(output).to.contain('__modules["GuiBuilder/Internal/Builder"] = function()');
    expect(output).to.not.contain('__modules["GuiBuilder"]["Internal"] =');
  });

  it('declares shared bundle variable before module wrappers', () => {
    const graph = new DependencyGraph();
    const moduleA: ModuleNode = {
      moduleName: 'moduleA',
      path: 'moduleA.lua',
      dependencies: [],
      content: 'SHARED_VAR.count = (SHARED_VAR.count or 0) + 1\nreturn SHARED_VAR',
      parseResult: { requires: [], codeWithoutRequires: '', originalCode: '' },
    };
    const entry: ModuleNode = {
      moduleName: 'main',
      path: 'main.lua',
      dependencies: ['moduleA'],
      content: 'local shared = __require("moduleA")\nSHARED_VAR.ready = shared.count',
      parseResult: { requires: [], codeWithoutRequires: '', originalCode: '' },
    };
    graph.addModule('moduleA', moduleA);
    graph.addModule('main', entry);

    const generator = new CodeGenerator({
      addComments: false,
      minify: false,
      includeSourceMap: false,
      preserveRequireNames: true,
    });

    const output = generator.generate(graph, 'main');
    const sharedVarIndex = output.indexOf('local SHARED_VAR = {}');
    const moduleWrapperIndex = output.indexOf('__modules["moduleA"] = function()');

    expect(sharedVarIndex).to.be.greaterThan(-1);
    expect(moduleWrapperIndex).to.be.greaterThan(-1);
    expect(sharedVarIndex).to.be.lessThan(moduleWrapperIndex);
    expect(output).to.contain('SHARED_VAR.count = (SHARED_VAR.count or 0) + 1');
    expect(output).to.contain('SHARED_VAR.ready = shared.count');
  });

  it('registers source ranges that point back to original module and entry lines', () => {
    const graph = new DependencyGraph();
    const moduleA: ModuleNode = {
      moduleName: 'moduleA',
      path: 'moduleA.lua',
      displayPath: 'src/moduleA.lua',
      dependencies: [],
      content: 'local value = 1\nreturn value',
      parseResult: { requires: [], codeWithoutRequires: '', originalCode: '' },
    };
    const entry: ModuleNode = {
      moduleName: 'main',
      path: 'main.lua',
      displayPath: 'src/main.lua',
      dependencies: ['moduleA'],
      content: 'local ModuleA = __require("moduleA")\nprint(ModuleA)',
      parseResult: { requires: [], codeWithoutRequires: '', originalCode: '' },
    };
    graph.addModule('moduleA', moduleA);
    graph.addModule('main', entry);

    const generator = new CodeGenerator({
      addComments: true,
      minify: false,
      includeSourceMap: true,
      preserveRequireNames: true,
    });

    const output = generator.generate(graph, 'main');
    const lines = output.split(/\r?\n/);
    const moduleRegistration = lines.find((line) =>
      line.includes('__registerSourceRange(') && line.includes('"src/moduleA.lua"'),
    );
    const entryRegistration = lines.find((line) =>
      line.includes('__registerSourceRange(') && line.includes('"src/main.lua"'),
    );

    expect(moduleRegistration).to.not.equal(undefined);
    expect(entryRegistration).to.not.equal(undefined);

    const moduleMatch = moduleRegistration!.match(
      /__registerSourceRange\((\d+),\s*(\d+),\s*"src\/moduleA\.lua"/,
    );
    const entryMatch = entryRegistration!.match(
      /__registerSourceRange\((\d+),\s*(\d+),\s*"src\/main\.lua"/,
    );

    expect(moduleMatch).to.not.equal(null);
    expect(entryMatch).to.not.equal(null);

    const moduleStartLine = Number(moduleMatch![1]);
    const moduleLineCount = Number(moduleMatch![2]);
    const entryStartLine = Number(entryMatch![1]);
    const entryLineCount = Number(entryMatch![2]);

    expect(moduleLineCount).to.equal(2);
    expect(entryLineCount).to.equal(2);
    expect(lines[moduleStartLine - 1].trim()).to.equal('local value = 1');
    expect(lines[moduleStartLine].trim()).to.equal('return value');
    expect(lines[entryStartLine - 1].trim()).to.equal('local ModuleA = __require("moduleA")');
    expect(lines[entryStartLine].trim()).to.equal('print(ModuleA)');
  });

  it('stores explicit source line maps when minify removes blank lines', () => {
    const graph = new DependencyGraph();
    const moduleA: ModuleNode = {
      moduleName: 'moduleA',
      path: 'moduleA.lua',
      displayPath: 'src/moduleA.lua',
      dependencies: [],
      content: 'local value = 1\n\nreturn value',
      parseResult: { requires: [], codeWithoutRequires: '', originalCode: '' },
    };
    const entry: ModuleNode = {
      moduleName: 'main',
      path: 'main.lua',
      displayPath: 'src/main.lua',
      dependencies: ['moduleA'],
      content: 'return __require("moduleA")',
      parseResult: { requires: [], codeWithoutRequires: '', originalCode: '' },
    };
    graph.addModule('moduleA', moduleA);
    graph.addModule('main', entry);

    const generator = new CodeGenerator({
      addComments: false,
      minify: true,
      includeSourceMap: true,
      preserveRequireNames: true,
    });

    const output = generator.generate(graph, 'main');
    const lines = output.split(/\r?\n/);
    const registration = lines.find((line) =>
      line.includes('__registerSourceLines(') && line.includes('"src/moduleA.lua"'),
    );

    expect(registration).to.not.equal(undefined);
    expect(registration).to.contain('{ 1, 3 }');

    const match = registration!.match(
      /__registerSourceLines\((\d+),\s*"src\/moduleA\.lua"/,
    );
    expect(match).to.not.equal(null);

    const startLine = Number(match![1]);
    expect(lines[startLine - 1].trim()).to.equal('local value = 1');
    expect(lines[startLine].trim()).to.equal('return value');
  });

  it('wraps local, anonymous, and method functions so nested runtime errors stay mappable', () => {
    const graph = new DependencyGraph();
    const moduleA: ModuleNode = {
      moduleName: 'moduleA',
      path: 'moduleA.lua',
      displayPath: 'src/moduleA.lua',
      dependencies: [],
      content: [
        'local function boom()',
        '  return function()',
        '    error("boom")',
        '  end',
        'end',
        '',
        'local M = {}',
        'function M:explode(value)',
        '  return boom()(value)',
        'end',
        '',
        'return M',
      ].join('\n'),
      parseResult: { requires: [], codeWithoutRequires: '', originalCode: '' },
    };
    const entry: ModuleNode = {
      moduleName: 'main',
      path: 'main.lua',
      displayPath: 'src/main.lua',
      dependencies: ['moduleA'],
      content: 'local M = __require("moduleA")\nM:explode(123)',
      parseResult: { requires: [], codeWithoutRequires: '', originalCode: '' },
    };
    graph.addModule('moduleA', moduleA);
    graph.addModule('main', entry);

    const generator = new CodeGenerator({
      addComments: false,
      minify: false,
      includeSourceMap: true,
      preserveRequireNames: true,
    });

    const output = generator.generate(graph, 'main');

    expect(output).to.contain('local __wrappedFunctions = setmetatable({}, { __mode = "k" })');
    expect(output).to.contain('local __bundleFunctionMap = {}');
    expect(output).to.contain('__registerFunctionSource("src/moduleA.lua", 1, 5, "boom @ line 1")');
    expect(output).to.contain('__registerFunctionSource("src/moduleA.lua", 2, 4, "anonymous @ line 2")');
    expect(output).to.contain('__registerFunctionSource("src/moduleA.lua", 8, 10, "M:explode @ line 8")');
    expect(output).to.contain('local boom; boom = __wrapFunction("boom @ line 1", function()');
    expect(output).to.contain('return __wrapFunction("anonymous @ line 2", function()');
    expect(output).to.contain('M.explode = __wrapFunction("M:explode @ line 8", function(self, value)');
  });

  it('keeps method wrappers valid when the original method has no explicit parameters', () => {
    const graph = new DependencyGraph();
    const moduleA: ModuleNode = {
      moduleName: 'controller',
      path: 'controller.lua',
      displayPath: 'src/controller.lua',
      dependencies: [],
      content: [
        'local Controller = {}',
        'function Controller:explode()',
        '  error("boom")',
        'end',
        'return Controller',
      ].join('\n'),
      parseResult: { requires: [], codeWithoutRequires: '', originalCode: '' },
    };
    const entry: ModuleNode = {
      moduleName: 'main',
      path: 'main.lua',
      displayPath: 'src/main.lua',
      dependencies: ['controller'],
      content: 'return __require("controller")',
      parseResult: { requires: [], codeWithoutRequires: '', originalCode: '' },
    };
    graph.addModule('controller', moduleA);
    graph.addModule('main', entry);

    const generator = new CodeGenerator({
      addComments: false,
      minify: false,
      includeSourceMap: true,
      preserveRequireNames: true,
    });

    const output = generator.generate(graph, 'main');
    expect(output).to.contain('Controller.explode = __wrapFunction("Controller:explode @ line 2", function(self)');
  });

  it('emits a clean mapped stack formatter instead of only raw traceback annotation', () => {
    const graph = new DependencyGraph();
    const entry: ModuleNode = {
      moduleName: 'main',
      path: 'main.lua',
      displayPath: 'src/main.lua',
      dependencies: [],
      content: 'error("boom")',
      parseResult: { requires: [], codeWithoutRequires: '', originalCode: '' },
    };
    graph.addModule('main', entry);

    const generator = new CodeGenerator({
      addComments: false,
      minify: false,
      includeSourceMap: true,
      preserveRequireNames: true,
    });

    const output = generator.generate(graph, 'main');
    expect(output).to.contain('local function __buildMappedStack()');
    expect(output).to.contain('local function __describeMappedFrame(frame)');
    expect(output).to.contain('local function __stripErrorPrefix(message)');
    expect(output).to.contain('lines[#lines + 1] = "Mapped stack:"');
    expect(output).to.contain('return table.concat(lines, "\\n")');
  });

  it('can disable clean traceback formatting while keeping classic mapped traceback annotation', () => {
    const graph = new DependencyGraph();
    const entry: ModuleNode = {
      moduleName: 'main',
      path: 'main.lua',
      displayPath: 'src/main.lua',
      dependencies: [],
      content: 'error("boom")',
      parseResult: { requires: [], codeWithoutRequires: '', originalCode: '' },
    };
    graph.addModule('main', entry);

    const generator = new CodeGenerator({
      addComments: false,
      minify: false,
      includeSourceMap: true,
      preserveRequireNames: true,
      cleanTraceback: false,
      fullFunctionWrapping: true,
    });

    const output = generator.generate(graph, 'main');
    expect(output).to.contain('local function __findTopMappedLocation()');
    expect(output).to.not.contain('local function __buildMappedStack()');
    expect(output).to.not.contain('local __bundleFunctionMap = {}');
  });

  it('can disable full function wrapping from settings/config', () => {
    const graph = new DependencyGraph();
    const moduleA: ModuleNode = {
      moduleName: 'moduleA',
      path: 'moduleA.lua',
      displayPath: 'src/moduleA.lua',
      dependencies: [],
      content: [
        'local function boom()',
        '  error("boom")',
        'end',
        'return { run = boom }',
      ].join('\n'),
      parseResult: { requires: [], codeWithoutRequires: '', originalCode: '' },
    };
    const entry: ModuleNode = {
      moduleName: 'main',
      path: 'main.lua',
      displayPath: 'src/main.lua',
      dependencies: ['moduleA'],
      content: 'return __require("moduleA")',
      parseResult: { requires: [], codeWithoutRequires: '', originalCode: '' },
    };
    graph.addModule('moduleA', moduleA);
    graph.addModule('main', entry);

    const generator = new CodeGenerator({
      addComments: false,
      minify: false,
      includeSourceMap: true,
      preserveRequireNames: true,
      cleanTraceback: true,
      fullFunctionWrapping: false,
    });

    const output = generator.generate(graph, 'main');
    expect(output).to.not.contain('local __wrappedFunctions = setmetatable({}, { __mode = "k" })');
    expect(output).to.not.contain('__wrapFunction(');
    expect(output).to.not.contain('__registerFunctionSource("src/moduleA.lua"');
    expect(output).to.contain('local function __buildMappedStack()');
  });

  it('derives module names from file paths', () => {
    const root = path.join(os.tmpdir(), 'lua-bundler-root');
    const name = moduleNameFromPath(path.join(root, 'folder', 'init.lua'), root);
    expect(name).to.equal('folder');
  });
});
