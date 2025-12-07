"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DependencyGraph = void 0;
class DependencyGraph {
    constructor() {
        this.nodes = new Map();
    }
    addModule(moduleName, node) {
        this.nodes.set(moduleName, node);
    }
    hasModule(moduleName) {
        return this.nodes.has(moduleName);
    }
    getModule(moduleName) {
        const node = this.nodes.get(moduleName);
        if (!node) {
            throw new Error(`Module not found in graph: ${moduleName}`);
        }
        return node;
    }
    getDependencies(moduleName) {
        return this.getModule(moduleName).dependencies;
    }
    getAllModules() {
        return Array.from(this.nodes.values());
    }
    getTopologicalOrder() {
        const visited = new Set();
        const visiting = new Set();
        const order = [];
        const dfs = (name) => {
            if (visited.has(name)) {
                return;
            }
            if (visiting.has(name)) {
                throw new Error(`Circular dependency detected involving ${name}`);
            }
            visiting.add(name);
            for (const dep of this.getDependencies(name)) {
                if (this.nodes.has(dep)) {
                    dfs(dep);
                }
            }
            visiting.delete(name);
            visited.add(name);
            order.push(name);
        };
        for (const name of this.nodes.keys()) {
            if (!visited.has(name)) {
                dfs(name);
            }
        }
        return order;
    }
    detectCircularDependencies() {
        const cycles = [];
        const stack = [];
        const state = new Map();
        for (const name of this.nodes.keys()) {
            state.set(name, 'unvisited');
        }
        const visit = (name) => {
            const currentState = state.get(name);
            if (currentState === 'visiting') {
                const cycleStart = stack.indexOf(name);
                if (cycleStart !== -1) {
                    cycles.push(stack.slice(cycleStart));
                }
                return;
            }
            if (currentState === 'visited') {
                return;
            }
            state.set(name, 'visiting');
            stack.push(name);
            for (const dep of this.getDependencies(name)) {
                if (this.nodes.has(dep)) {
                    visit(dep);
                }
            }
            stack.pop();
            state.set(name, 'visited');
        };
        for (const name of this.nodes.keys()) {
            if (state.get(name) === 'unvisited') {
                visit(name);
            }
        }
        return cycles;
    }
}
exports.DependencyGraph = DependencyGraph;
//# sourceMappingURL=dependencyGraph.js.map