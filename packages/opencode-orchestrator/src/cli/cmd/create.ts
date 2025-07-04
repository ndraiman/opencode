import type { CommandModule } from "yargs"
import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { homedir } from "node:os"
import { ProjectManager } from "../../project-manager.js"
import type { OrchestratorState } from "../../types.js"
import { UI } from "../ui.js"

interface CreateOptions {
  name: string
  type: string
  description?: string
  workspace: string
  config?: string
}

export const CreateCommand: CommandModule<{}, CreateOptions> = {
  command: "create <name>",
  describe: "Create a new OpenCode project",
  builder: (yargs) => {
    return yargs
      .positional("name", {
        describe: "Name of the project to create",
        type: "string",
        demandOption: true,
      })
      .option("type", {
        alias: "t",
        describe: "Type of project to create",
        type: "string",
        choices: ["git", "empty"],
        default: "empty",
      })
      .option("description", {
        alias: "d",
        describe: "Description of the project",
        type: "string",
      })
      .option("workspace", {
        alias: "w",
        describe: "Workspace directory for projects",
        type: "string",
        default: join(homedir(), ".opencode", "orchestrator", "projects"),
      })
      .option("config", {
        alias: "c",
        describe: "JSON configuration for the project",
        type: "string",
      })
  },
  handler: async (args) => {
    const { name, type, description, workspace: workspaceDir, config } = args

    // Create workspace directory if it doesn't exist
    await mkdir(workspaceDir, { recursive: true })

    // Initialize state
    const state: OrchestratorState = {
      projects: new Map(),
      processes: new Map(),
    }

    // Initialize project manager
    const projectManager = new ProjectManager(state, workspaceDir)

    try {
      // Parse config if provided
      let parsedConfig: Record<string, any> | undefined
      if (config) {
        try {
          parsedConfig = JSON.parse(config)
        } catch (error) {
          throw new Error(`Invalid JSON configuration: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      // Create project
      const project = await projectManager.createProject({
        name,
        type: type as "git" | "empty",
        description,
        config: parsedConfig,
      })

      UI.empty()
      UI.success(`Project "${name}" created successfully!`)
      UI.empty()
      UI.println(UI.field("Project ID", project.id, true))
      UI.println(UI.field("Project path", project.path))
      UI.println(UI.field("Created at", project.createdAt.toISOString()))
      
      if (project.description) {
        UI.println(UI.field("Description", project.description))
      }

      // Show available plugins if they exist
      const availablePlugins = projectManager.getAvailablePlugins()
      if (availablePlugins.length > 1) {
        UI.empty()
        UI.header("Available project types for future projects:")
        availablePlugins.forEach(plugin => {
          UI.println(UI.Style.TEXT_DIM + "  - " + UI.Style.TEXT_NORMAL + plugin.projectType + ": " + UI.Style.TEXT_DIM + plugin.description + UI.Style.TEXT_NORMAL)
        })
      }

    } catch (error) {
      UI.error(`Failed to create project "${name}": ${error instanceof Error ? error.message : error}`)
      process.exit(1)
    }
  },
}