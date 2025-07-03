import type { ProjectPlugin, PluginRegistry } from "./types.js"

export class DefaultPluginRegistry implements PluginRegistry {
  private plugins = new Map<string, ProjectPlugin>()
  private defaultPluginId: string | null = null

  registerPlugin(plugin: ProjectPlugin): void {
    this.plugins.set(plugin.projectType, plugin)
    
    // Set the first registered plugin as default if none is set
    if (this.defaultPluginId === null) {
      this.defaultPluginId = plugin.projectType
    }
  }

  getPlugin(projectType: string): ProjectPlugin | undefined {
    return this.plugins.get(projectType)
  }

  listPlugins(): ProjectPlugin[] {
    return Array.from(this.plugins.values())
  }

  getDefaultPlugin(): ProjectPlugin {
    if (this.defaultPluginId === null) {
      throw new Error("No plugins registered")
    }
    
    const plugin = this.plugins.get(this.defaultPluginId)
    if (!plugin) {
      throw new Error(`Default plugin '${this.defaultPluginId}' not found`)
    }
    
    return plugin
  }

  setDefaultPlugin(projectType: string): void {
    if (!this.plugins.has(projectType)) {
      throw new Error(`Plugin '${projectType}' not found`)
    }
    this.defaultPluginId = projectType
  }

  hasPlugin(projectType: string): boolean {
    return this.plugins.has(projectType)
  }

  unregisterPlugin(projectType: string): boolean {
    const wasRemoved = this.plugins.delete(projectType)
    
    // If we removed the default plugin, set a new default
    if (wasRemoved && this.defaultPluginId === projectType) {
      const remainingPlugins = Array.from(this.plugins.keys())
      this.defaultPluginId = remainingPlugins.length > 0 ? remainingPlugins[0] : null
    }
    
    return wasRemoved
  }
}