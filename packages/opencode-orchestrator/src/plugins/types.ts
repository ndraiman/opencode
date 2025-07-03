import { z } from "zod"
import type { Project, ProcessInfo } from "../types.js"

// Base plugin interface that all plugins must implement
export interface ProjectPlugin {
  /** Unique identifier for the plugin */
  readonly id: string
  
  /** Human-readable name for the plugin */
  readonly name: string
  
  /** Description of what this plugin does */
  readonly description: string
  
  /** The project type this plugin handles */
  readonly projectType: string
  
  /** Validate if the plugin can handle the given input */
  validateInput(input: CreateProjectInput): Promise<ValidationResult>
  
  /** Create a project using this plugin */
  createProject(input: CreateProjectInput, projectPath: string): Promise<void>
  
  /** Additional setup steps needed when starting a project */
  setupProject?(project: Project, processInfo: ProcessInfo): Promise<void>
  
  /** Additional cleanup steps when stopping a project */
  cleanupProject?(project: Project): Promise<void>
  
  /** Get additional configuration schema for this plugin */
  getConfigSchema?(): z.ZodSchema<any>
}

export interface ValidationResult {
  isValid: boolean
  errors?: string[]
  warnings?: string[]
}

// Extended input type that allows plugin-specific configuration
export const CreateProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  type: z.string(), // Now allows any string instead of enum
  description: z.string().optional(),
  config: z.record(z.any()).optional(), // Plugin-specific configuration
})

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>

// Plugin registry interface
export interface PluginRegistry {
  registerPlugin(plugin: ProjectPlugin): void
  getPlugin(projectType: string): ProjectPlugin | undefined
  listPlugins(): ProjectPlugin[]
  getDefaultPlugin(): ProjectPlugin
}