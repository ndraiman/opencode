import { mkdir } from "fs/promises"
import { join } from "path"
import { homedir } from "os"
import { ProjectManager } from "./project-manager.js"
import { ProxyService } from "./proxy.js"
import { createApiRouter } from "./api.js"
import type { OrchestratorState } from "./types.js"

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2)
  const portArg = args.find(arg => arg.startsWith("--port="))
  const hostArg = args.find(arg => arg.startsWith("--hostname="))
  const workspaceArg = args.find(arg => arg.startsWith("--workspace="))

  const port = portArg ? parseInt(portArg.split("=")[1]) : 3000
  const hostname = hostArg ? hostArg.split("=")[1] : "127.0.0.1"
  const workspaceDir = workspaceArg 
    ? workspaceArg.split("=")[1] 
    : join(homedir(), ".opencode", "orchestrator", "projects")

  // Create workspace directory
  await mkdir(workspaceDir, { recursive: true })

  // Initialize state
  const state: OrchestratorState = {
    projects: new Map(),
    processes: new Map(),
  }

  // Initialize services
  const projectManager = new ProjectManager(state, workspaceDir)
  const proxyService = new ProxyService(state)

  // Create API router
  const app = createApiRouter(projectManager, proxyService)

  // Start server
  const server = Bun.serve({
    port,
    hostname,
    fetch: app.fetch,
  })

  console.log(`🚀 OpenCode Orchestrator running on http://${hostname}:${port}`)
  console.log(`📁 Workspace directory: ${workspaceDir}`)
  console.log(`📊 API Documentation: http://${hostname}:${port}/`)

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n🛑 Shutting down OpenCode Orchestrator...")
    
    // Stop all running projects
    const projects = await projectManager.listProjects()
    const runningProjects = projects.filter(p => p.status === "running")
    
    if (runningProjects.length > 0) {
      console.log(`⏹️  Stopping ${runningProjects.length} running project(s)...`)
      
      await Promise.all(
        runningProjects.map(async (project) => {
          try {
            await projectManager.stopProject(project.id)
            console.log(`✅ Stopped project: ${project.name}`)
          } catch (error) {
            console.error(`❌ Failed to stop project ${project.name}:`, error)
          }
        })
      )
    }
    
    server.stop()
    console.log("👋 Goodbye!")
    process.exit(0)
  })

  // Keep the process alive
  await new Promise(() => {})
}

// Handle unhandled errors
process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection:", error)
  process.exit(1)
})

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error)
  process.exit(1)
})

// Start the application
main().catch((error) => {
  console.error("Failed to start OpenCode Orchestrator:", error)
  process.exit(1)
})