import { z } from "zod"
import type { Project, ProcessInfo } from "../types.js"

// Plugin metadata interface
export interface PluginMetadata {
  /** Unique identifier for the plugin */
  readonly id: string
  
  /** Human-readable name for the plugin */
  readonly name: string
  
  /** Description of what this plugin does */
  readonly description: string
  
  /** The project type this plugin handles */
  readonly projectType: string
  
  /** Configuration schema for this plugin */
  readonly configSchema?: z.ZodSchema<any>
  
  /** Plugin version */
  readonly version?: string
  
  /** Plugin author */
  readonly author?: string
}

// Plugin lifecycle interface
export interface PluginLifecycle {
  /** Additional setup steps needed when starting a project */
  setup?(project: Project, processInfo: ProcessInfo): Promise<void>
  
  /** Additional cleanup steps when stopping a project */
  cleanup?(project: Project): Promise<void>
  
  /** Health check for the plugin */
  healthCheck?(): Promise<boolean>
}

// Simplified plugin interface
export interface ProjectPlugin {
  /** Plugin metadata */
  readonly meta: PluginMetadata
  
  /** Create a project using this plugin */
  create(input: CreateProjectInput, projectPath: string): Promise<void>
  
  /** Validate if the plugin can handle the given input (optional) */
  validate?(input: CreateProjectInput): Promise<ValidationResult>
  
  /** Plugin lifecycle hooks (optional) */
  lifecycle?: PluginLifecycle
}

export interface ValidationResult {
  isValid: boolean
  errors?: string[]
  warnings?: string[]
}

// Base project input schema (maintains backward compatibility)
export const CreateProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  type: z.enum(["git", "empty"]),
  description: z.string().optional(),
  // Git-specific fields (for backward compatibility)
  gitUrl: z.string().url().optional(),
  gitBranch: z.string().optional(),
  depth: z.number().min(1).optional(),
  recursive: z.boolean().optional(),
  // Empty project fields (for backward compatibility) 
  template: z.enum(["basic", "typescript", "node", "web"]).optional(),
  createGitRepo: z.boolean().optional(),
  includeReadme: z.boolean().optional(),
  // New flexible config (takes precedence if provided)
  config: z.record(z.any()).optional(),
})

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>

// Typed project input for specific plugins
export interface TypedCreateProjectInput<T = any> extends Omit<CreateProjectInput, 'config'> {
  config: T
}

// Template system interfaces
export interface ProjectTemplate {
  /** Unique identifier for the template */
  readonly id: string
  
  /** Human-readable name for the template */
  readonly name: string
  
  /** Description of what this template creates */
  readonly description: string
  
  /** Generate project files using this template */
  generate(projectPath: string, config: any): Promise<void>
}

export interface TemplateRegistry {
  register(template: ProjectTemplate): void
  get(id: string): ProjectTemplate | null
  list(): ProjectTemplate[]
}

// Plugin registry interface
export interface PluginRegistry {
  registerPlugin(plugin: ProjectPlugin): void
  getPlugin(projectType: string): ProjectPlugin | undefined
  listPlugins(): ProjectPlugin[]
  getDefaultPlugin(): ProjectPlugin
}