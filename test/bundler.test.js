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
const chai_1 = require("chai");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const codeGenerator_1 = require("../src/codeGenerator");
const dependencyGraph_1 = require("../src/dependencyGraph");
const parser_1 = require("../src/parser");
const resolver_1 = require("../src/resolver");
const pathUtils_1 = require("../src/utils/pathUtils");
const writeLua = (dir, rel, content) => {
    const target = path.join(dir, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
    return target;
};
describe('Lua Bundler building blocks', () => {
    it('parses require statements and ignores commented lines', () => {
        const parser = new parser_1.LuaParser();
        const content = [
            'local Module1 = require("module1")',
            '-- require("skip")',
            'require("plain")',
        ].join('\n');
        const result = parser.parse(content, 'file.lua');
        (0, chai_1.expect)(result.requires).to.have.length(2);
        (0, chai_1.expect)(result.requires[0].modulePath).to.equal('module1');
        (0, chai_1.expect)(result.requires[1].modulePath).to.equal('plain');
    });
    it('resolves relative and dot notation paths', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lua-bundler-'));
        const entry = writeLua(tmp, 'main.lua', 'local m = require("./lib/util")');
        const dep = writeLua(tmp, 'lib/util.lua', 'return {}');
        const resolver = new resolver_1.PathResolver(tmp);
        const resolved = resolver.resolve('./lib/util', entry);
        (0, chai_1.expect)(resolved.exists).to.equal(true);
        (0, chai_1.expect)(resolved.absolutePath).to.equal(path.normalize(dep));
    });
    it('produces topological order in dependency graph', () => {
        const graph = new dependencyGraph_1.DependencyGraph();
        const makeNode = (name, deps) => ({
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
        (0, chai_1.expect)(order.indexOf('c')).to.be.lessThan(order.indexOf('b'));
        (0, chai_1.expect)(order.indexOf('b')).to.be.lessThan(order.indexOf('a'));
    });
    it('generates bundled Lua code with runtime and entry', () => {
        const graph = new dependencyGraph_1.DependencyGraph();
        const moduleA = {
            moduleName: 'moduleA',
            path: 'moduleA.lua',
            dependencies: [],
            content: 'local M = {}; return M',
            parseResult: { requires: [], codeWithoutRequires: '', originalCode: '' },
        };
        const entry = {
            moduleName: 'main',
            path: 'main.lua',
            dependencies: ['moduleA'],
            content: 'local ModuleA = __require("moduleA")',
            parseResult: { requires: [], codeWithoutRequires: '', originalCode: '' },
        };
        graph.addModule('moduleA', moduleA);
        graph.addModule('main', entry);
        const generator = new codeGenerator_1.CodeGenerator({
            addComments: true,
            minify: false,
            includeSourceMap: false,
            preserveRequireNames: true,
        });
        const output = generator.generate(graph, 'main');
        (0, chai_1.expect)(output).to.contain('__modules["moduleA"]');
        (0, chai_1.expect)(output).to.contain('-- ENTRY POINT');
    });
    it('derives module names from file paths', () => {
        const root = path.join(os.tmpdir(), 'lua-bundler-root');
        const name = (0, pathUtils_1.moduleNameFromPath)(path.join(root, 'folder', 'init.lua'), root);
        (0, chai_1.expect)(name).to.equal('folder');
    });
});
//# sourceMappingURL=bundler.test.js.map