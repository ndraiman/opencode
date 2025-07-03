import { randomUUID } from "node:crypto"
import { mkdir, rm, access, readdir } from "node:fs/promises"
import { join, resolve } from "node:path"
import type { CreateProjectInput, Project, ProjectStatus, ProcessInfo, OrchestratorState } from "./types.js"

export class ProjectManager {
  private state: OrchestratorState
  private workspaceDir: string

  constructor(state: OrchestratorState, workspaceDir: string) {
    this.state = state
    this.workspaceDir = workspaceDir
  }

  async createProject(input: CreateProjectInput): Promise<Project> {
    const id = randomUUID()
    const projectPath = join(this.workspaceDir, id)

    // Create project directory
    await mkdir(projectPath, { recursive: true })

    let project: Project = {
      id,
      name: input.name,
      type: input.type,
      gitUrl: input.gitUrl,
      gitBranch: input.gitBranch,
      description: input.description,
      status: "stopped",
      path: projectPath,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    try {
      if (input.type === "git" && input.gitUrl) {
        await this.cloneRepository(input.gitUrl, projectPath, input.gitBranch)
      } else if (input.type === "empty") {
        // Initialize empty project with basic structure
        await this.initializeEmptyProject(projectPath)
      }

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

  private async cloneRepository(gitUrl: string, targetPath: string, branch?: string): Promise<void> {
    try {
      // Use a simple git clone command instead of isomorphic-git for now
      const result = await Bun.spawn({
        cmd: ["git", "clone", "--depth", "1", ...(branch ? ["--branch", branch] : []), gitUrl, targetPath],
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

  private async initializeEmptyProject(projectPath: string): Promise<void> {
    // Create basic project structure
    await mkdir(join(projectPath, "src"), { recursive: true })
    
    // Create a basic package.json
    const packageJson = {
      name: "opencode-project",
      version: "1.0.0",
      type: "module",
      scripts: {
        dev: "echo 'Hello from OpenCode project!'"
      }
    }
    
    await Bun.write(
      join(projectPath, "package.json"),
      JSON.stringify(packageJson, null, 2)
    )

    // Create a basic README
    await Bun.write(
      join(projectPath, "README.md"),
      "# OpenCode Project\n\nThis is a new OpenCode project.\n"
    )

    // Create a basic TypeScript file
    await Bun.write(
      join(projectPath, "src/index.ts"),
      `console.log("Hello from OpenCode!");

export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
`
    )
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