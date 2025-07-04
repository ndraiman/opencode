import type { ProjectPlugin, PluginRegistry } from "./types.js"
import { DefaultPluginRegistry } from "./registry.js"

// Constructor type for plugins
type PluginConstructor = new (...args: any[]) => ProjectPlugin

/**
 * Creates a plugin registry with the specified plugins
 */
export function createPluginRegistry(plugins: (ProjectPlugin | PluginConstructor)[]): PluginRegistry {
  const registry = new DefaultPluginRegistry()
  
  for (const plugin of plugins) {
    if (typeof plugin === 'function') {
      // It's a constructor, instantiate it
      registry.registerPlugin(new plugin())
    } else {
      // It's already an instance
      registry.registerPlugin(plugin)
    }
  }
  
  return registry
}

/**
 * Creates a plugin registry with default plugins
 */
export function createDefaultPluginRegistry(): PluginRegistry {
  // Dynamic imports to avoid circular dependencies
  const plugins = []
  
  // We'll populate this with actual plugin instances
  // This is a simplified version - in practice you'd import the actual plugins
  
  return createPluginRegistry(plugins)
}

/**
 * Plugin registration helper that reduces boilerplate
 */
export class PluginRegistryBuilder {
  private plugins: ProjectPlugin[] = []
  
  add(plugin: ProjectPlugin | PluginConstructor): this {
    if (typeof plugin === 'function') {
      this.plugins.push(new plugin())
    } else {
      this.plugins.push(plugin)
    }
    return this
  }
  
  build(): PluginRegistry {
    return createPluginRegistry(this.plugins)
  }
}

/**
 * Fluent interface for building plugin registries
 */
export function pluginRegistry(): PluginRegistryBuilder {
  return new PluginRegistryBuilder()
}

// Example usage:
// const registry = pluginRegistry()
//   .add(GitPlugin)
//   .add(EmptyPlugin)
//   .add(DevContainerPlugin)
//   .build()