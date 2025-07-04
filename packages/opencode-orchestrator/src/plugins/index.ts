// Plugin system types and interfaces
export type {
  ProjectPlugin,
  ValidationResult,
  CreateProjectInput,
  PluginRegistry,
} from "./types.js"

export { CreateProjectSchema } from "./types.js"

// Plugin registry implementation
export { DefaultPluginRegistry } from "./registry.js"

// Built-in plugins
export { GitPlugin } from "./git-plugin.js"
export { EmptyPlugin } from "./empty-plugin.js"

// Import for local use
import { DefaultPluginRegistry } from "./registry.js"
import { GitPlugin } from "./git-plugin.js"
import { EmptyPlugin } from "./empty-plugin.js"

// Convenience function to create a registry with default plugins
export function createDefaultPluginRegistry(): DefaultPluginRegistry {
  const registry = new DefaultPluginRegistry()

  // Register built-in plugins
  registry.registerPlugin(new GitPlugin())
  registry.registerPlugin(new EmptyPlugin())

  // Set git as the default plugin
  registry.setDefaultPlugin("git")

  return registry
}
