import { randomUUID } from "node:crypto"
import { mkdir, rm, access, readdir } from "node:fs/promises"
import { join, resolve } from "node:path"
import type { CreateProjectInput, Project, ProjectStatus, ProcessInfo, OrchestratorState } from "./types.js"
import type { PluginRegistry } from "./plugins/types.js"
import { createDefaultPluginRegistry } from "./plugins/index.js"

export class ProjectManager {
  private state: OrchestratorState
  private workspaceDir: string
  private pluginRegistry: PluginRegistry

  constructor(state: OrchestratorState, workspaceDir: string, pluginRegistry?: PluginRegistry) {
    this.state = state
    this.workspaceDir = workspaceDir
    this.pluginRegistry = pluginRegistry || createDefaultPluginRegistry()
  }

  async createProject(input: CreateProjectInput): Promise<Project> {
    // Get the appropriate plugin for this project type
    const plugin = this.pluginRegistry.getPlugin(input.type)
    if (!plugin) {
      throw new Error(`Unknown project type: ${input.type}. Available types: ${this.pluginRegistry.listPlugins().map(p => p.projectType).join(", ")}`)
    }

    // Validate input using the plugin
    const validation = await plugin.validateInput(input)
    if (!validation.isValid) {
      throw new Error(`Invalid input: ${validation.errors?.join(", ")}`)
    }

    const id = randomUUID()
    const projectPath = join(this.workspaceDir, id)

    // Create project directory
    await mkdir(projectPath, { recursive: true })

    let project: Project = {
      id,
      name: input.name,
      type: input.type,
      description: input.description,
      status: "stopped",
      path: projectPath,
      createdAt: new Date(),
      updatedAt: new Date(),
      config: input.config,
    }

    try {
      // Use the plugin to create the project
      await plugin.createProject(input, projectPath)
      project.status = "stopped"
    } catch (error) {
      project.status = "failed"
      project.lastError = error instanceof Error ? error.message : "Unknown error"
      await rm(projectPath, { recursive: true, force: true })
      throw error
    }

    this.state.projects.set(id, project)
    return project
  }

  async deleteProject(projectId: string): Promise<void> {
    const project = this.state.projects.get(projectId)
    if (!project) {
      throw new Error("Project not found")
    }

    // Stop the project if running
    if (project.status === "running") {
      await this.stopProject(projectId)
    }

    // Remove project directory
    await rm(project.path, { recursive: true, force: true })

    // Remove from state
    this.state.projects.delete(projectId)
    this.state.processes.delete(projectId)
  }

  async listProjects(): Promise<Project[]> {
    return Array.from(this.state.projects.values())
  }

  async getProject(projectId: string): Promise<Project | undefined> {
    return this.state.projects.get(projectId)
  }

  async startProject(projectId: string): Promise<void> {
    const project = this.state.projects.get(projectId)
    if (!project) {
      throw new Error("Project not found")
    }

    if (project.status === "running") {
      throw new Error("Project is already running")
    }

    await this.updateProjectStatus(projectId, "starting")

    try {
      const port = await this.findAvailablePort()
      const opencodeExecutable = await this.findOpenCodeExecutable()
      
      const spawned = Bun.spawn({
        cmd: [opencodeExecutable, "serve", "--port", port.toString(), "--hostname", "127.0.0.1"],
        cwd: project.path,
        stdout: "pipe",
        stderr: "pipe",
        stdin: "ignore",
        env: {
          ...process.env,
          BUN_BE_BUN: "1",
        },
      })

      const processInfo: ProcessInfo = {
        process: spawned,
        port,
        startedAt: new Date(),
        logs: [],
      }

      // Start log collection
      this.collectLogs(projectId, processInfo)

      // Wait a bit to see if the process starts successfully
      await new Promise(resolve => setTimeout(resolve, 2000))

      if (spawned.exitCode !== null) {
        throw new Error(`OpenCode process exited with code ${spawned.exitCode}`)
      }

      this.state.processes.set(projectId, processInfo)
      await this.updateProject(projectId, {
        status: "running",
        port,
        pid: spawned.pid,
        lastError: undefined,
      })

      // Allow plugin to perform additional setup
      const plugin = this.pluginRegistry.getPlugin(project.type)
      if (plugin?.setupProject) {
        await plugin.setupProject(project, processInfo)
      }

    } catch (error) {
      await this.updateProject(projectId, {
        status: "failed",
        lastError: error instanceof Error ? error.message : "Unknown error",
      })
      throw error
    }
  }

  async stopProject(projectId: string): Promise<void> {
    const project = this.state.projects.get(projectId)
    if (!project) {
      throw new Error("Project not found")
    }

    const processInfo = this.state.processes.get(projectId)
    if (!processInfo) {
      // Already stopped
      await this.updateProjectStatus(projectId, "stopped")
      return
    }

    await this.updateProjectStatus(projectId, "stopping")

    try {
      // Graceful shutdown
      processInfo.process.kill("SIGTERM")
      
      // Wait for graceful shutdown, then force kill if needed
      const timeout = setTimeout(() => {
        if (processInfo.process.exitCode === null) {
          processInfo.process.kill("SIGKILL")
        }
      }, 5000)

      await processInfo.process.exited
      clearTimeout(timeout)

      this.state.processes.delete(projectId)
      await this.updateProject(projectId, {
        status: "stopped",
        port: undefined,
        pid: undefined,
      })

      // Allow plugin to perform additional cleanup
      const plugin = this.pluginRegistry.getPlugin(project.type)
      if (plugin?.cleanupProject) {
        await plugin.cleanupProject(project)
      }

    } catch (error) {
      await this.updateProject(projectId, {
        status: "failed",
        lastError: error instanceof Error ? error.message : "Unknown error",
      })
      throw error
    }
  }

  async restartProject(projectId: string): Promise<void> {
    await this.stopProject(projectId)
    await this.startProject(projectId)
  }

  async getProjectLogs(projectId: string): Promise<string[]> {
    const processInfo = this.state.processes.get(projectId)
    return processInfo?.logs || []
  }

  // Plugin management methods
  getAvailablePlugins() {
    return this.pluginRegistry.listPlugins().map(plugin => ({
      id: plugin.id,
      name: plugin.name,
      description: plugin.description,
      projectType: plugin.projectType,
      configSchema: plugin.getConfigSchema?.() || null,
    }))
  }

  getPluginInfo(projectType: string) {
    const plugin = this.pluginRegistry.getPlugin(projectType)
    if (!plugin) {
      return null
    }

    return {
      id: plugin.id,
      name: plugin.name,
      description: plugin.description,
      projectType: plugin.projectType,
      configSchema: plugin.getConfigSchema?.() || null,
    }
  }



  private async findAvailablePort(): Promise<number> {
    // Start from port 4096 and find the next available port
    for (let port = 4096; port < 5000; port++) {
      try {
        const server = Bun.serve({
          port,
          hostname: "127.0.0.1",
          fetch: () => new Response("test"),
        })
        server.stop()
        return port
      } catch {
        continue
      }
    }
    throw new Error("No available ports found")
  }

  private async findOpenCodeExecutable(): Promise<string> {
    // Try to find the opencode executable
    const possiblePaths = [
      "opencode",
      "bun",
      process.execPath,
    ]

    for (const path of possiblePaths) {
      try {
        const result = await Bun.spawn({
          cmd: [path, "--version"],
          stdout: "pipe",
          stderr: "pipe",
        }).exited

        if (result === 0) {
          if (path === "bun" || path === process.execPath) {
            // Use bun to run opencode package
            return process.execPath
          }
          return path
        }
      } catch {
        continue
      }
    }

    // Fallback to bun
    return process.execPath
  }

  private async collectLogs(projectId: string, processInfo: ProcessInfo): Promise<void> {
    const maxLogs = 1000

    // Collect stdout
    if (processInfo.process.stdout) {
      const reader = processInfo.process.stdout.getReader()
      const decoder = new TextDecoder()
      
      const readStdout = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            
            const text = decoder.decode(value)
            const lines = text.split('\n').filter(line => line.trim())
            
            for (const line of lines) {
              processInfo.logs.push(`[stdout] ${new Date().toISOString()} ${line}`)
              if (processInfo.logs.length > maxLogs) {
                processInfo.logs.shift()
              }
            }
          }
        } catch (error) {
          // Process ended
        }
      }
      readStdout()
    }

    // Collect stderr
    if (processInfo.process.stderr) {
      const reader = processInfo.process.stderr.getReader()
      const decoder = new TextDecoder()
      
      const readStderr = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            
            const text = decoder.decode(value)
            const lines = text.split('\n').filter(line => line.trim())
            
            for (const line of lines) {
              processInfo.logs.push(`[stderr] ${new Date().toISOString()} ${line}`)
              if (processInfo.logs.length > maxLogs) {
                processInfo.logs.shift()
              }
            }
          }
        } catch (error) {
          // Process ended
        }
      }
      readStderr()
    }
  }

  private async updateProjectStatus(projectId: string, status: ProjectStatus): Promise<void> {
    await this.updateProject(projectId, { status })
  }

  private async updateProject(projectId: string, updates: Partial<Project>): Promise<void> {
    const project = this.state.projects.get(projectId)
    if (!project) return

    const updatedProject = {
      ...project,
      ...updates,
      updatedAt: new Date(),
    }

    this.state.projects.set(projectId, updatedProject)
  }
}