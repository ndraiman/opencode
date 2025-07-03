# OpenCode Orchestrator Plugin System

The OpenCode Orchestrator now supports a flexible plugin system that allows easy extension and customization of project handlers. This system replaces the hardcoded project type handling with a modular, extensible architecture.

## Overview

The plugin system consists of:

1. **Plugin Interface** - Defines the contract that all plugins must implement
2. **Plugin Registry** - Manages registration and discovery of plugins
3. **Built-in Plugins** - Default implementations for common project types
4. **Plugin Manager Integration** - ProjectManager uses plugins transparently

## Architecture

### Plugin Interface

All plugins must implement the `ProjectPlugin` interface:

```typescript
interface ProjectPlugin {
  readonly id: string              // Unique identifier
  readonly name: string           // Human-readable name
  readonly description: string    // Description of functionality
  readonly projectType: string    // Project type this plugin handles
  
  // Core methods
  validateInput(input: CreateProjectInput): Promise<ValidationResult>
  createProject(input: CreateProjectInput, projectPath: string): Promise<void>
  
  // Optional lifecycle methods
  setupProject?(project: Project, processInfo: ProcessInfo): Promise<void>
  cleanupProject?(project: Project): Promise<void>
  getConfigSchema?(): z.ZodSchema<any>
}
```

### Plugin Registry

The `PluginRegistry` manages plugin registration and discovery:

```typescript
interface PluginRegistry {
  registerPlugin(plugin: ProjectPlugin): void
  getPlugin(projectType: string): ProjectPlugin | undefined
  listPlugins(): ProjectPlugin[]
  getDefaultPlugin(): ProjectPlugin
}
```

## Built-in Plugins

### Git Plugin (`git`)

Handles Git repository cloning with advanced options:

**Configuration Schema:**
```typescript
{
  gitUrl: string,           // Required: Git repository URL
  gitBranch?: string,       // Optional: Branch to clone
  depth?: number,           // Optional: Clone depth (default: 1)
  recursive?: boolean       // Optional: Clone submodules (default: false)
}
```

**Example Usage:**
```javascript
{
  name: "My React App",
  type: "git",
  config: {
    gitUrl: "https://github.com/facebook/create-react-app.git",
    gitBranch: "main",
    depth: 1,
    recursive: false
  }
}
```

### Empty Plugin (`empty`)

Creates empty projects with various templates:

**Configuration Schema:**
```typescript
{
  template?: "basic" | "typescript" | "node" | "web",  // Default: "basic"
  createGitRepo?: boolean,                             // Default: false
  includeReadme?: boolean                              // Default: true
}
```

**Templates:**
- `basic` - Simple JavaScript project
- `typescript` - TypeScript project with build config
- `node` - Node.js project with ES modules
- `web` - Static web project with HTML/CSS/JS

**Example Usage:**
```javascript
{
  name: "My TypeScript Project",
  type: "empty",
  config: {
    template: "typescript",
    createGitRepo: true,
    includeReadme: true
  }
}
```

### Dev Container Plugin (`devcontainer`) *Example*

Demonstrates how to create projects with development container configuration:

**Configuration Schema:**
```typescript
{
  image?: string,                    // Docker image
  features?: Record<string, any>,    // Dev container features
  forwardPorts?: number[],          // Ports to forward
  postCreateCommand?: string,       // Command after container creation
  mounts?: string[],               // Volume mounts
  env?: Record<string, string>     // Environment variables
}
```

## Creating Custom Plugins

### Step 1: Implement the Plugin Interface

```typescript
import { z } from "zod"
import type { ProjectPlugin, ValidationResult, CreateProjectInput } from "./types.js"
import type { Project, ProcessInfo } from "../types.js"

export class MyCustomPlugin implements ProjectPlugin {
  readonly id = "my-custom-plugin"
  readonly name = "My Custom Plugin"
  readonly description = "Creates custom project setups"
  readonly projectType = "custom"

  async validateInput(input: CreateProjectInput): Promise<ValidationResult> {
    // Validate input configuration
    const errors: string[] = []
    const warnings: string[] = []
    
    // Add validation logic here
    
    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  }

  async createProject(input: CreateProjectInput, projectPath: string): Promise<void> {
    // Create the project structure
    // This is where your custom project creation logic goes
  }

  getConfigSchema?(): z.ZodSchema<any> {
    // Define the configuration schema for your plugin
    return z.object({
      // Define your config schema here
    })
  }

  async setupProject?(project: Project, processInfo: ProcessInfo): Promise<void> {
    // Optional: Additional setup when project starts
  }

  async cleanupProject?(project: Project): Promise<void> {
    // Optional: Cleanup when project stops
  }
}
```

### Step 2: Register Your Plugin

```typescript
import { createDefaultPluginRegistry } from "./plugins/index.js"
import { MyCustomPlugin } from "./my-custom-plugin.js"

// Create registry with default plugins
const registry = createDefaultPluginRegistry()

// Register your custom plugin
registry.registerPlugin(new MyCustomPlugin())

// Use the registry with ProjectManager
const projectManager = new ProjectManager(state, workspaceDir, registry)
```

### Step 3: Use Your Plugin

```javascript
// Create a project using your custom plugin
const project = await projectManager.createProject({
  name: "My Custom Project",
  type: "custom",  // This matches your plugin's projectType
  description: "A project created with my custom plugin",
  config: {
    // Plugin-specific configuration
    customOption: "value"
  }
})
```

## Plugin Examples

### Remote Server Plugin (Future Example)

```typescript
export class RemoteServerPlugin implements ProjectPlugin {
  readonly id = "remote-server-plugin"
  readonly name = "Remote Server Plugin" 
  readonly description = "Creates projects on remote servers"
  readonly projectType = "remote"

  async validateInput(input: CreateProjectInput): Promise<ValidationResult> {
    // Validate SSH connection, server availability, etc.
  }

  async createProject(input: CreateProjectInput, projectPath: string): Promise<void> {
    // Set up project on remote server
    // Could involve SSH, rsync, Docker, etc.
  }

  async setupProject(project: Project, processInfo: ProcessInfo): Promise<void> {
    // Start services on remote server
    // Set up port forwarding, tunnels, etc.
  }

  async cleanupProject(project: Project): Promise<void> {
    // Clean up remote resources
  }
}
```

### Microservice Plugin (Future Example)

```typescript
export class MicroservicePlugin implements ProjectPlugin {
  readonly id = "microservice-plugin"
  readonly name = "Microservice Plugin"
  readonly description = "Creates microservice architectures"
  readonly projectType = "microservice"

  async createProject(input: CreateProjectInput, projectPath: string): Promise<void> {
    // Create multiple service directories
    // Set up docker-compose.yml
    // Configure service mesh, API gateway, etc.
  }
}
```

## API Integration

The ProjectManager now provides plugin information through its API:

### Get Available Plugins
```typescript
const plugins = projectManager.getAvailablePlugins()
// Returns array of plugin info with schemas
```

### Get Plugin Information
```typescript
const pluginInfo = projectManager.getPluginInfo("git")
// Returns detailed info about the git plugin
```

### Create Project with Plugin
```typescript
const project = await projectManager.createProject({
  name: "My Project",
  type: "git",  // Plugin type
  config: {     // Plugin-specific config
    gitUrl: "https://github.com/user/repo.git",
    gitBranch: "main"
  }
})
```

## Benefits

1. **Extensibility** - Easy to add new project types without modifying core code
2. **Modularity** - Each plugin is self-contained and focused
3. **Validation** - Built-in input validation with proper error handling
4. **Configuration** - Type-safe configuration schemas using Zod
5. **Lifecycle Management** - Hooks for setup and cleanup operations
6. **Backward Compatibility** - Existing projects continue to work

## Migration from Legacy System

The new plugin system is backward compatible:

- Existing `git` and `empty` project types work exactly as before
- The API remains the same - only the internal implementation changed
- Configuration has been moved to the `config` object but old fields are still supported during transition

### Old Format (Still Supported)
```javascript
{
  name: "My Project",
  type: "git",
  gitUrl: "https://github.com/user/repo.git",
  gitBranch: "main"
}
```

### New Format (Recommended)
```javascript
{
  name: "My Project", 
  type: "git",
  config: {
    gitUrl: "https://github.com/user/repo.git",
    gitBranch: "main",
    depth: 1,
    recursive: false
  }
}
```

## Testing Plugins

Plugins can be easily tested in isolation:

```typescript
import { MyCustomPlugin } from "./my-custom-plugin.js"

describe("MyCustomPlugin", () => {
  const plugin = new MyCustomPlugin()

  test("validates input correctly", async () => {
    const result = await plugin.validateInput({
      name: "Test Project",
      type: "custom",
      config: { /* test config */ }
    })
    
    expect(result.isValid).toBe(true)
  })

  test("creates project structure", async () => {
    await plugin.createProject(input, "/tmp/test-project")
    // Assert project structure was created correctly
  })
})
```

## Future Enhancements

Potential future enhancements to the plugin system:

1. **Plugin Dependencies** - Allow plugins to depend on other plugins
2. **Plugin Marketplace** - Registry for sharing community plugins
3. **Hot Plugin Loading** - Load plugins dynamically without restart
4. **Plugin Composition** - Combine multiple plugins for complex setups
5. **Plugin Sandboxing** - Security isolation for third-party plugins
6. **Plugin Hooks** - More lifecycle events and extension points

---

*This plugin system provides a solid foundation for extending OpenCode Orchestrator with new project types and deployment targets.*