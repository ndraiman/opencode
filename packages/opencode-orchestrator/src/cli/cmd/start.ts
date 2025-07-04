import type { CommandModule } from "yargs"
import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { homedir } from "node:os"
import { ProjectManager } from "../../project-manager.js"
import { ProxyService } from "../../proxy.js"
import { createApiRouter } from "../../api.js"
import type { OrchestratorState } from "../../types.js"

interface StartOptions {
  port: number
  hostname: string
  workspace: string
}

export const StartCommand: CommandModule<{}, StartOptions> = {
  command: "start",
  describe: "Start the OpenCode Orchestrator server",
  builder: (yargs) => {
    return yargs
      .option("port", {
        alias: "p",
        describe: "Port to run the server on",
        type: "number",
        default: 3000,
      })
      .option("hostname", {
        alias: "h",
        describe: "Hostname to bind the server to",
        type: "string",
        default: "127.0.0.1",
      })
      .option("workspace", {
        alias: "w",
        describe: "Workspace directory for projects",
        type: "string",
        default: join(homedir(), ".opencode", "orchestrator", "projects"),
      })
  },
  handler: async (args) => {
    const { port, hostname, workspace: workspaceDir } = args

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

    console.log(
      `🚀 OpenCode Orchestrator running on http://${hostname}:${port}`,
    )
    console.log(`📁 Workspace directory: ${workspaceDir}`)
    console.log(`📊 API Documentation: http://${hostname}:${port}/`)

    // Graceful shutdown
    process.on("SIGINT", async () => {
      console.log("\n🛑 Shutting down OpenCode Orchestrator...")

      // Stop all running projects
      const projects = await projectManager.listProjects()
      const runningProjects = projects.filter((p) => p.status === "running")

      if (runningProjects.length > 0) {
        console.log(
          `⏹️  Stopping ${runningProjects.length} running project(s)...`,
        )

        await Promise.all(
          runningProjects.map(async (project) => {
            try {
              await projectManager.stopProject(project.id)
              console.log(`✅ Stopped project: ${project.name}`)
            } catch (error) {
              console.error(`❌ Failed to stop project ${project.name}:`, error)
            }
          }),
        )
      }

      server.stop()
      console.log("👋 Goodbye!")
      process.exit(0)
    })

    // Keep the process alive
    await new Promise(() => {})
  },
}
