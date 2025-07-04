import type { CommandModule } from "yargs"
import { join } from "node:path"
import { homedir } from "node:os"
import { ProjectManager } from "../../project-manager.js"
import type { OrchestratorState } from "../../types.js"
import { UI } from "../ui.js"

interface DeleteOptions {
  project: string
  workspace: string
  force: boolean
  confirm: boolean
}

export const DeleteCommand: CommandModule<{}, DeleteOptions> = {
  command: "delete <project>",
  describe: "Delete an OpenCode project",
  aliases: ["rm", "remove"],
  builder: (yargs) => {
    return yargs
      .positional("project", {
        describe: "Project ID or name to delete",
        type: "string",
        demandOption: true,
      })
      .option("workspace", {
        alias: "w",
        describe: "Workspace directory for projects",
        type: "string",
        default: join(homedir(), ".opencode", "orchestrator", "projects"),
      })
      .option("force", {
        alias: "f",
        describe: "Force delete without confirmation",
        type: "boolean",
        default: false,
      })
      .option("confirm", {
        alias: "y",
        describe: "Confirm deletion without interactive prompt",
        type: "boolean",
        default: false,
      })
  },
  handler: async (args) => {
    const { project: projectIdentifier, workspace: workspaceDir, force, confirm } = args

    // Initialize state
    const state: OrchestratorState = {
      projects: new Map(),
      processes: new Map(),
    }

    // Initialize project manager
    const projectManager = new ProjectManager(state, workspaceDir)

    try {
      // Find the project by ID or name
      const projects = await projectManager.listProjects()
      const project = projects.find(p => 
        p.id === projectIdentifier || 
        p.name === projectIdentifier
      )

      if (!project) {
        UI.error(`Project not found: "${projectIdentifier}"`)
        UI.empty()
        UI.header("Available projects:")
        
        if (projects.length === 0) {
          UI.dim("   No projects found")
        } else {
          projects.forEach(p => {
            UI.println("   " + UI.Style.TEXT_NORMAL_BOLD + p.name + UI.Style.TEXT_NORMAL + " " + UI.Style.TEXT_DIM + `(ID: ${p.id})` + UI.Style.TEXT_NORMAL)
          })
        }
        
        process.exit(1)
      }

      // Show project info
      UI.empty()
      UI.header("Project to delete:")
      UI.println("   " + UI.field("Name", project.name, true))
      UI.println("   " + UI.field("ID", project.id))
      UI.println("   " + UI.field("Type", project.type))
      UI.println("   " + UI.field("Status", project.status))
      UI.println("   " + UI.field("Path", project.path))
      UI.println("   " + UI.field("Created", project.createdAt.toISOString()))
      
      if (project.description) {
        UI.println("   " + UI.field("Description", project.description))
      }

      // Warn if project is running
      if (project.status === "running") {
        UI.empty()
        UI.warning("Project is currently running and will be stopped before deletion.")
      }

      // Confirmation unless forced or confirmed
      if (!force && !confirm) {
        UI.empty()
        UI.println(UI.Style.TEXT_DANGER_BOLD + "This action will permanently delete the project and all its files." + UI.Style.TEXT_NORMAL)
        UI.println(UI.Style.TEXT_DANGER_BOLD + "This cannot be undone!" + UI.Style.TEXT_NORMAL)
        
        // In a real CLI, you'd use a proper prompt library like inquirer
        // For now, we'll require explicit confirmation flags
        UI.empty()
        UI.error("Deletion cancelled. Use --force or --confirm to proceed.")
        UI.dim(`Run: opencode-orchestrator delete "${projectIdentifier}" --confirm`)
        process.exit(1)
      }

      // Perform deletion
      UI.empty()
      UI.println(UI.Style.TEXT_INFO_BOLD + "Deleting project " + UI.Style.TEXT_NORMAL + `"${project.name}"...`)
      
      if (project.status === "running") {
        UI.println(UI.Style.TEXT_WARNING_BOLD + "Stopping running project..." + UI.Style.TEXT_NORMAL)
      }
      
      await projectManager.deleteProject(project.id)
      
      UI.empty()
      UI.success(`Project "${project.name}" deleted successfully!`)
      UI.dim(`Cleaned up project directory: ${project.path}`)

      // Show remaining projects count
      const remainingProjects = await projectManager.listProjects()
      UI.empty()
      UI.println(UI.field("Remaining projects", remainingProjects.length.toString()))

    } catch (error) {
      UI.error(`Failed to delete project "${projectIdentifier}": ${error instanceof Error ? error.message : error}`)
      process.exit(1)
    }
  },
}