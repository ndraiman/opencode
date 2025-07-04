import type { CommandModule } from "yargs"
import { join } from "node:path"
import { homedir } from "node:os"
import { ProjectManager } from "../../project-manager.js"
import type { OrchestratorState } from "../../types.js"

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
        console.error(`❌ Project not found: "${projectIdentifier}"`)
        console.log(`\n💡 Available projects:`)
        
        if (projects.length === 0) {
          console.log("   No projects found")
        } else {
          projects.forEach(p => {
            console.log(`   - ${p.name} (ID: ${p.id})`)
          })
        }
        
        process.exit(1)
      }

      // Show project info
      console.log(`\n🗂️  Project to delete:`)
      console.log(`   Name: ${project.name}`)
      console.log(`   ID: ${project.id}`)
      console.log(`   Type: ${project.type}`)
      console.log(`   Status: ${project.status}`)
      console.log(`   Path: ${project.path}`)
      console.log(`   Created: ${project.createdAt.toISOString()}`)
      
      if (project.description) {
        console.log(`   Description: ${project.description}`)
      }

      // Warn if project is running
      if (project.status === "running") {
        console.log(`\n⚠️  Warning: Project is currently running and will be stopped before deletion.`)
      }

      // Confirmation unless forced or confirmed
      if (!force && !confirm) {
        console.log(`\n🚨 This action will permanently delete the project and all its files.`)
        console.log(`⚠️  This cannot be undone!`)
        
        // In a real CLI, you'd use a proper prompt library like inquirer
        // For now, we'll require explicit confirmation flags
        console.log(`\n❌ Deletion cancelled. Use --force or --confirm to proceed.`)
        console.log(`💡 Run: opencode-orchestrator delete "${projectIdentifier}" --confirm`)
        process.exit(1)
      }

      // Perform deletion
      console.log(`\n🗑️  Deleting project "${project.name}"...`)
      
      if (project.status === "running") {
        console.log(`⏹️  Stopping running project...`)
      }
      
      await projectManager.deleteProject(project.id)
      
      console.log(`✅ Project "${project.name}" deleted successfully!`)
      console.log(`🧹 Cleaned up project directory: ${project.path}`)

      // Show remaining projects count
      const remainingProjects = await projectManager.listProjects()
      console.log(`\n📊 Remaining projects: ${remainingProjects.length}`)

    } catch (error) {
      console.error(`❌ Failed to delete project "${projectIdentifier}":`, error instanceof Error ? error.message : error)
      process.exit(1)
    }
  },
}