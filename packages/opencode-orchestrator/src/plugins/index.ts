// Plugin registry utilities
export { DefaultPluginRegistry } from "./registry.js"
export { createPluginRegistry, pluginRegistry, PluginRegistryBuilder } from "./registry-helpers.js"

// Simplified plugin exports
export { GitPlugin } from "./git-plugin.js"
export { EmptyPlugin } from "./empty-plugin.js"
export { DevContainerPlugin } from "./devcontainer-plugin.js"

// Types and interfaces
export type { ProjectPlugin, PluginMetadata, PluginLifecycle, PluginRegistry } from "./types.js"
export type { ProjectTemplate, TemplateRegistry } from "./types.js"

// Configuration types
export type { 
  GitPluginConfig, 
  EmptyPluginConfig, 
  DevContainerConfig,
  GitProjectInput,
  EmptyProjectInput,
  DevContainerProjectInput
} from "./config-types.js"

// Template system
export { createTemplateRegistryWithDefaults } from "../templates/index.js"

// Import for local use
import { DefaultPluginRegistry } from "./registry.js"
import { GitPlugin } from "./git-plugin.js"
import { EmptyPlugin } from "./empty-plugin.js"
import { DevContainerPlugin } from "./devcontainer-plugin.js"

// Convenience function to create a registry with all default plugins
export function createDefaultPluginRegistry() {
  const registry = new DefaultPluginRegistry()
  registry.registerPlugin(new GitPlugin())
  registry.registerPlugin(new EmptyPlugin())
  registry.registerPlugin(new DevContainerPlugin())
  return registry
}