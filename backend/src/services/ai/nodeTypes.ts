import { NODE_TYPE_ALIASES, SPEC_NODE_DEFINITIONS, getNodeSpecDefinition } from './nodeSpec.generated';

export const THREE_NODE_TYPES: Record<string, string> = Object.fromEntries([
  ...Object.entries(SPEC_NODE_DEFINITIONS).map(([type, definition]) => [type, definition.label]),
  ...Object.entries(NODE_TYPE_ALIASES).map(([alias, target]) => [
    alias,
    getNodeSpecDefinition(target)?.label || alias,
  ]),
]);
