import { z } from "zod"

// Git Plugin Configuration
export interface GitPluginConfig {
  gitUrl: string
  gitBranch?: string
  depth?: number
  recursive?: boolean
}

export const GitConfigSchema = z.object({
  gitUrl: z.string().url("Must be a valid URL"),
  gitBranch: z.string().optional(),
  depth: z.number().min(1, "Depth must be at least 1").optional(),
  recursive: z.boolean().optional()
})

// Empty Plugin Configuration
export interface EmptyPluginConfig {
  template: 'basic' | 'typescript' | 'node' | 'web'
  createGitRepo?: boolean
  includeReadme?: boolean
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'bun'
}

export const EmptyConfigSchema = z.object({
  template: z.enum(['basic', 'typescript', 'node', 'web']).default('basic'),
  createGitRepo: z.boolean().optional().default(false),
  includeReadme: z.boolean().optional().default(true),
  packageManager: z.enum(['npm', 'yarn', 'pnpm', 'bun']).optional().default('npm')
})

// DevContainer Plugin Configuration
export interface DevContainerConfig {
  image?: string
  features?: string[]
  customizations?: Record<string, any>
  forwardPorts?: number[]
  postCreateCommand?: string
  remoteUser?: string
}

export const DevContainerConfigSchema = z.object({
  image: z.string().optional(),
  features: z.array(z.string()).optional(),
  customizations: z.record(z.any()).optional(),
  forwardPorts: z.array(z.number()).optional(),
  postCreateCommand: z.string().optional(),
  remoteUser: z.string().optional()
})

// Type helpers for plugin-specific inputs
export type GitProjectInput = {
  name: string
  type: 'git'
  description?: string
  config: GitPluginConfig
}

export type EmptyProjectInput = {
  name: string
  type: 'empty'
  description?: string
  config: EmptyPluginConfig
}

export type DevContainerProjectInput = {
  name: string
  type: 'devcontainer'
  description?: string
  config: DevContainerConfig
}