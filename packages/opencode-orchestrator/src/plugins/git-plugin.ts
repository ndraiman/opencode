import type { ProjectPlugin, ValidationResult, CreateProjectInput } from "./types.js"
import type { Project, ProcessInfo } from "../types.js"
import { GitConfigSchema, type GitPluginConfig } from "./config-types.js"

export class GitPlugin implements ProjectPlugin {
  readonly meta = {
    id: "git-plugin",
    name: "Git Repository Plugin",
    description: "Creates projects by cloning Git repositories",
    projectType: "git",
    configSchema: GitConfigSchema,
    version: "1.0.0",
    author: "OpenCode Team"
  }

  async validate(input: CreateProjectInput): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    if (!input.config?.gitUrl) {
      errors.push("Git URL is required for git projects")
    }

    if (input.config?.gitUrl) {
      try {
        new URL(input.config.gitUrl)
      } catch {
        errors.push("Git URL must be a valid URL")
      }
    }

    // Validate branch name if provided
    if (input.config?.gitBranch) {
      const branchName = input.config.gitBranch as string
      if (branchName.includes('..') || branchName.startsWith('-')) {
        errors.push("Invalid branch name")
      }
    }

    // Warn about shallow cloning when explicitly requested
    if (input.config?.depth && input.config.depth === 1) {
      warnings.push("Using shallow clone (depth=1). Full history will not be available.")
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  }

  async create(input: CreateProjectInput, projectPath: string): Promise<void> {
    const config = input.config
    if (!config?.gitUrl) {
      throw new Error("Git URL is required")
    }

    await this.cloneRepository(
      config.gitUrl as string,
      projectPath,
      config.gitBranch as string | undefined,
      config.depth as number | undefined
    )
  }

  private async cloneRepository(
    gitUrl: string,
    targetPath: string,
    branch?: string,
    depth?: number
  ): Promise<void> {
    try {
      const args = ["git", "clone"]
      
      // Add depth option only if explicitly specified
      if (depth && depth > 0) {
        args.push("--depth", depth.toString())
      }
      
      // Add branch option if specified
      if (branch) {
        args.push("--branch", branch)
      }
      
      // Always clone submodules recursively
      args.push("--recurse-submodules")
      
      args.push(gitUrl, targetPath)

      const result = await Bun.spawn({
        cmd: args,
        stdout: "pipe",
        stderr: "pipe",
      }).exited
      
      if (result !== 0) {
        throw new Error("Git clone failed")
      }
    } catch (error) {
      throw new Error(`Failed to clone repository: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}