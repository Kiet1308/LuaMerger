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
    expect(output).to.contain('__modules.moduleA');
    expect(output).to.contain('-- ENTRY POINT');
  });

  it('derives module names from file paths', () => {
    const root = path.join(os.tmpdir(), 'lua-bundler-root');
    const name = moduleNameFromPath(path.join(root, 'folder', 'init.lua'), root);
    expect(name).to.equal('folder');
  });
});
