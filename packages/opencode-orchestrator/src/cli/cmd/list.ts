import type { CommandModule } from "yargs"
import { join } from "node:path"
import { homedir } from "node:os"
import { ProjectManager } from "../../project-manager.js"
import type { OrchestratorState } from "../../types.js"

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
        if (status) {
          console.log(`📭 No projects found with status "${status}"`)
        } else {
          console.log("📭 No projects found")
          console.log(`💡 Create a new project with: opencode-orchestrator create <name>`)
        }
        return
      }

      if (format === "json") {
        // JSON output
        console.log(JSON.stringify(projects, null, 2))
      } else {
        // Table output
        console.log(`\n📋 Found ${projects.length} project(s):\n`)
        
        // Sort by creation date (newest first)
        projects.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

        projects.forEach((project, index) => {
          const statusIcon = getStatusIcon(project.status)
          const timeSince = getTimeSince(project.createdAt)
          
          console.log(`${index + 1}. ${statusIcon} ${project.name}`)
          console.log(`   ID: ${project.id}`)
          console.log(`   Type: ${project.type}`)
          console.log(`   Status: ${project.status}`)
          
          if (project.description) {
            console.log(`   Description: ${project.description}`)
          }
          
          if (project.port) {
            console.log(`   Port: ${project.port}`)
          }
          
          if (project.pid) {
            console.log(`   PID: ${project.pid}`)
          }
          
          console.log(`   Created: ${timeSince}`)
          console.log(`   Path: ${project.path}`)
          
          if (project.lastError) {
            console.log(`   ⚠️  Last Error: ${project.lastError}`)
          }
          
          if (index < projects.length - 1) {
            console.log("")
          }
        })

        // Summary
        const statusCounts = projects.reduce((acc, project) => {
          acc[project.status] = (acc[project.status] || 0) + 1
          return acc
        }, {} as Record<string, number>)

        console.log(`\n📊 Status Summary:`)
        Object.entries(statusCounts).forEach(([status, count]) => {
          const icon = getStatusIcon(status as any)
          console.log(`   ${icon} ${status}: ${count}`)
        })
      }

    } catch (error) {
      console.error(`❌ Failed to list projects:`, error instanceof Error ? error.message : error)
      process.exit(1)
    }
  },
}

function getStatusIcon(status: string): string {
  switch (status) {
    case "running":
      return "🟢"
    case "stopped":
      return "⚫"
    case "starting":
      return "🟡"
    case "stopping":
      return "🟠"
    case "failed":
      return "🔴"
    default:
      return "⚪"
  }
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