import type { CreativeTemplate } from "./templateTypes";

const PERSONAL_TEMPLATES_STORAGE_KEY = "creative-node-personal-templates";

// Vite / modern bundler pattern. Codex may replace this with static imports
// if the host application does not support import.meta.glob.
const modules = import.meta.glob<CreativeTemplate>(
  "./templates/*.json",
  { eager: true, import: "default" }
);

export const templateRegistry = new Map<string, CreativeTemplate>();

for (const template of Object.values(modules)) {
  templateRegistry.set(template.id, template);
}

export function listTemplates(): CreativeTemplate[] {
  return [...templateRegistry.values()];
}

function isCreativeTemplate(value: unknown): value is CreativeTemplate {
  if (!value || typeof value !== "object") return false;
  const template = value as Partial<CreativeTemplate>;
  return typeof template.id === "string"
    && typeof template.name === "string"
    && !!template.graph
    && Array.isArray(template.graph.nodes)
    && Array.isArray(template.graph.edges);
}

export function listPersonalTemplates(): CreativeTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(PERSONAL_TEMPLATES_STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCreativeTemplate);
  } catch {
    return [];
  }
}

export function savePersonalTemplate(template: CreativeTemplate): void {
  if (typeof window === "undefined") return;
  const templates = [
    template,
    ...listPersonalTemplates().filter((item) => item.id !== template.id),
  ];
  window.localStorage.setItem(PERSONAL_TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
  window.dispatchEvent(new CustomEvent("creative-template-library-changed"));
}

export function getTemplate(id: string): CreativeTemplate {
  const template = templateRegistry.get(id) || listPersonalTemplates().find((item) => item.id === id);
  if (!template) throw new Error(`Unknown creative template: ${id}`);
  return template;
}
