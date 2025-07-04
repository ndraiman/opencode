import type { CommandModule } from "yargs"
import { join } from "node:path"
import { homedir } from "node:os"
import { ProjectManager } from "../../project-manager.js"
import type { OrchestratorState } from "../../types.js"
import { UI } from "../ui.js"

interface ListOptions {
  workspace: string
  format: string
  status?: string
}

export const ListCommand: CommandModule<{}, ListOptions> = {
  command: "list",
  describe: "List all OpenCode projects",
  aliases: ["ls"],
  builder: (yargs) => {
    return yargs
      .option("workspace", {
        alias: "w",
        describe: "Workspace directory for projects",
        type: "string",
        default: join(homedir(), ".opencode", "orchestrator", "projects"),
      })
      .option("format", {
        alias: "f",
        describe: "Output format",
        type: "string",
        choices: ["table", "json"],
        default: "table",
      })
      .option("status", {
        alias: "s",
        describe: "Filter by project status",
        type: "string",
        choices: ["stopped", "starting", "running", "stopping", "failed"],
      })
  },
  handler: async (args) => {
    const { workspace: workspaceDir, format, status } = args

    // Initialize state
    const state: OrchestratorState = {
      projects: new Map(),
      processes: new Map(),
    }

    // Initialize project manager
    const projectManager = new ProjectManager(state, workspaceDir)

    try {
      // Get all projects
      let projects = await projectManager.listProjects()

      // Filter by status if provided
      if (status) {
        projects = projects.filter(project => project.status === status)
      }

      if (projects.length === 0) {
        UI.empty()
        if (status) {
          UI.info(`No projects found with status "${status}"`)
        } else {
          UI.info("No projects found")
          UI.dim("Create a new project with: opencode-orchestrator create <name>")
        }
        return
      }

      if (format === "json") {
        // JSON output
        console.log(JSON.stringify(projects, null, 2))
      } else {
        // Table output
        UI.empty()
        UI.header(`Found ${projects.length} project(s):`)
        UI.empty()
        
        // Sort by creation date (newest first)
        projects.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

        projects.forEach((project, index) => {
          const timeSince = getTimeSince(project.createdAt)
          
          UI.println(UI.listItem(index + 1, project.name, project.status))
          UI.println("   " + UI.field("ID", project.id))
          UI.println("   " + UI.field("Type", project.type))
          
          if (project.description) {
            UI.println("   " + UI.field("Description", project.description))
          }
          
          if (project.port) {
            UI.println("   " + UI.field("Port", project.port.toString()))
          }
          
          if (project.pid) {
            UI.println("   " + UI.field("PID", project.pid.toString()))
          }
          
          UI.println("   " + UI.field("Created", timeSince))
          UI.println("   " + UI.field("Path", project.path))
          
          if (project.lastError) {
            UI.println("   " + UI.Style.TEXT_DANGER_BOLD + "Last Error: " + UI.Style.TEXT_NORMAL + UI.Style.TEXT_DANGER + project.lastError + UI.Style.TEXT_NORMAL)
          }
          
          if (index < projects.length - 1) {
            UI.empty()
          }
        })

        // Summary
        const statusCounts = projects.reduce((acc, project) => {
          acc[project.status] = (acc[project.status] || 0) + 1
          return acc
        }, {} as Record<string, number>)

        UI.empty()
        UI.header("Status Summary:")
        Object.entries(statusCounts).forEach(([status, count]) => {
          UI.println("   " + UI.projectStatus(status) + ": " + UI.Style.TEXT_NORMAL_BOLD + count + UI.Style.TEXT_NORMAL)
        })
      }

    } catch (error) {
      UI.error(`Failed to list projects: ${error instanceof Error ? error.message : error}`)
      process.exit(1)
    }
  },
}

function getTimeSince(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return `${days} day(s) ago`
  } else if (hours > 0) {
    return `${hours} hour(s) ago`
  } else if (minutes > 0) {
    return `${minutes} minute(s) ago`
  } else {
    return "Just now"
  }
}