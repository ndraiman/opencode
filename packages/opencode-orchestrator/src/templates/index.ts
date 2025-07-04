import { BasicTemplate } from "./basic-template.js"
import { TypeScriptTemplate } from "./typescript-template.js"
import { NodeTemplate } from "./node-template.js"
import { WebTemplate } from "./web-template.js"
import { createDefaultTemplateRegistry } from "./registry.js"
import type { TemplateRegistry } from "../plugins/types.js"

export { BasicTemplate, TypeScriptTemplate, NodeTemplate, WebTemplate }
export { createDefaultTemplateRegistry } from "./registry.js"
export type { TemplateRegistry } from "../plugins/types.js"

export function createTemplateRegistryWithDefaults(): TemplateRegistry {
  const registry = createDefaultTemplateRegistry()
  
  registry.register(new BasicTemplate())
  registry.register(new TypeScriptTemplate())
  registry.register(new NodeTemplate())
  registry.register(new WebTemplate())
  
  return registry
}