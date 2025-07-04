import { z } from "zod"
import type { ProjectPlugin, ValidationResult, CreateProjectInput } from "./types.js"
import type { Project, ProcessInfo } from "../types.js"

const GitConfigSchema = z.object({
  gitUrl: z.string().url("Must be a valid URL"),
  gitBranch: z.string().optional(),
  depth: z.number().min(1).optional().default(1),
  recursive: z.boolean().optional().default(false),
})

export class GitPlugin implements ProjectPlugin {
  readonly id = "git-plugin"
  readonly name = "Git Repository Plugin"
  readonly description = "Creates projects by cloning Git repositories"
  readonly projectType = "git"

  async validateInput(input: CreateProjectInput): Promise<ValidationResult> {
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

    // Warn about shallow cloning
    if (!input.config?.depth || input.config.depth === 1) {
      warnings.push("Using shallow clone (depth=1). Full history will not be available.")
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  }

  async createProject(input: CreateProjectInput, projectPath: string): Promise<void> {
    const config = input.config
    if (!config?.gitUrl) {
      throw new Error("Git URL is required")
    }

    await this.cloneRepository(
      config.gitUrl as string,
      projectPath,
      config.gitBranch as string | undefined,
      config.depth as number | undefined,
      config.recursive as boolean | undefined
    )
  }

  getConfigSchema(): z.ZodSchema<any> {
    return GitConfigSchema
  }


  private async cloneRepository(
    gitUrl: string,
    targetPath: string,
    branch?: string,
    depth: number = 1,
    recursive: boolean = false
  ): Promise<void> {
    try {
      const args = ["git", "clone"]
      
      // Add depth option for shallow cloning
      if (depth > 0) {
        args.push("--depth", depth.toString())
      }
      
      // Add branch option if specified
      if (branch) {
        args.push("--branch", branch)
      }
      
      // Add recursive option for submodules
      if (recursive) {
        args.push("--recursive")
      }
      
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