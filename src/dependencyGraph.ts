import { ParseResult } from './parser';

export interface ModuleNode {
  moduleName: string;
  path: string;
  dependencies: string[];
  content: string;
  parseResult: ParseResult;
}

export class DependencyGraph {
  private readonly nodes = new Map<string, ModuleNode>();

  addModule(moduleName: string, node: ModuleNode): void {
    this.nodes.set(moduleName, node);
  }

  hasModule(moduleName: string): boolean {
    return this.nodes.has(moduleName);
  }

  getModule(moduleName: string): ModuleNode {
    const node = this.nodes.get(moduleName);
    if (!node) {
      throw new Error(`Module not found in graph: ${moduleName}`);
    }
    return node;
  }

  getDependencies(moduleName: string): string[] {
    return this.getModule(moduleName).dependencies;
  }

  getAllModules(): ModuleNode[] {
    return Array.from(this.nodes.values());
  }

  getTopologicalOrder(): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    const dfs = (name: string): void => {
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

  detectCircularDependencies(): string[][] {
    const cycles: string[][] = [];
    const stack: string[] = [];
    const state = new Map<string, 'unvisited' | 'visiting' | 'visited'>();
    for (const name of this.nodes.keys()) {
      state.set(name, 'unvisited');
    }

    const visit = (name: string): void => {
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
