import type { DirtyReason, FrameContext, ParamMap, RuntimeAdapter, RuntimeEdge, RuntimeNodeRecord } from "../core/types.js";

export class GraphRuntime {
  private readonly nodes = new Map<string, RuntimeNodeRecord>();
  private readonly edges: RuntimeEdge[] = [];
  private readonly adapters = new Map<string, RuntimeAdapter>();
  private readonly downstream = new Map<string, Set<string>>();

  public registerAdapter(id: string, adapter: RuntimeAdapter): void {
    this.adapters.set(id, adapter);
  }

  public addNode(node: RuntimeNodeRecord): void {
    if (this.nodes.has(node.id)) throw new Error(`Duplicate runtime node: ${node.id}`);
    this.nodes.set(node.id, node);
  }

  public addEdge(edge: RuntimeEdge): void {
    this.edges.push(edge);
    const targets = this.downstream.get(edge.sourceNodeId) ?? new Set<string>();
    targets.add(edge.targetNodeId);
    this.downstream.set(edge.sourceNodeId, targets);
    this.markDirty(edge.targetNodeId, "input");
  }

  public setParam(nodeId: string, key: string, value: unknown): void {
    const node = this.requireNode(nodeId);
    node.params[key] = value;
    node.revision += 1;
    this.markDirty(nodeId, key === "variant" ? "variant" : "param");
  }

  public patchParams(nodeId: string, values: ParamMap): void {
    const node = this.requireNode(nodeId);
    Object.assign(node.params, values);
    node.revision += 1;
    this.markDirty(nodeId, Object.prototype.hasOwnProperty.call(values, "variant") ? "variant" : "param");
  }

  public markDirty(nodeId: string, reason: DirtyReason): void {
    const visited = new Set<string>();
    const visit = (id: string, nextReason: DirtyReason): void => {
      if (visited.has(id)) return;
      visited.add(id);
      const node = this.requireNode(id);
      node.dirty = true;
      node.dirtyReason = nextReason;
      for (const target of this.downstream.get(id) ?? []) visit(target, "input");
    };
    visit(nodeId, reason);
  }

  public evaluate(nodeId: string, context: FrameContext): unknown {
    return this.evaluateInternal(nodeId, context, new Set<string>());
  }

  public tick(nodeId: string, context: FrameContext): unknown {
    for (const node of this.nodes.values()) {
      if (node.updatePolicy === "perFrame") {
        node.dirty = true;
        node.dirtyReason = "time";
      }
    }
    return this.evaluate(nodeId, context);
  }

  public dispose(): void {
    for (const node of this.nodes.values()) {
      const adapter = this.adapters.get(node.adapterId);
      if (node.cachedOutput !== undefined) adapter?.dispose?.(node.cachedOutput);
    }
    this.nodes.clear();
    this.edges.length = 0;
    this.downstream.clear();
  }

  private evaluateInternal(nodeId: string, context: FrameContext, stack: Set<string>): unknown {
    if (stack.has(nodeId)) throw new Error(`Cycle detected while evaluating ${nodeId}`);
    const node = this.requireNode(nodeId);
    if (!node.dirty && node.cacheable && node.cachedOutput !== undefined) return node.cachedOutput;
    stack.add(nodeId);
    const inputs: Record<string, unknown> = {};
    for (const edge of this.edges) {
      if (edge.targetNodeId !== nodeId) continue;
      const value = this.evaluateInternal(edge.sourceNodeId, context, stack);
      const existing = inputs[edge.targetPort];
      if (existing === undefined) inputs[edge.targetPort] = value;
      else if (Array.isArray(existing)) existing.push(value);
      else inputs[edge.targetPort] = [existing, value];
    }
    stack.delete(nodeId);
    const adapter = this.adapters.get(node.adapterId);
    if (!adapter) throw new Error(`Runtime adapter not registered: ${node.adapterId}`);
    const output = adapter.cook(inputs, node.params, context);
    if (node.cachedOutput !== undefined && node.cachedOutput !== output) adapter.dispose?.(node.cachedOutput);
    node.cachedOutput = output;
    node.dirty = false;
    node.dirtyReason = undefined;
    return output;
  }

  private requireNode(nodeId: string): RuntimeNodeRecord {
    const node = this.nodes.get(nodeId);
    if (!node) throw new Error(`Runtime node not found: ${nodeId}`);
    return node;
  }
}
