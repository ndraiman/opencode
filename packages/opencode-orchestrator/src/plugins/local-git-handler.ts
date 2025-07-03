import { randomUUID } from "node:crypto"
import { mkdir, rm } from "node:fs/promises"
import { join } from "node:path"
import type { CreateProjectInput, OrchestratorState, ProcessInfo, Project, ProjectStatus } from "../types.js"
import type { ProjectHandler } from "./project-handler.js"

/**
 * Default handler that runs projects directly on the local machine.
 *
 * This implementation contains the logic that previously lived inside
 * `ProjectManager` so that additional handlers (e.g. dev-container or
 * remote-server) can be introduced without touching the manager.
 */
export class LocalGitHandler implements ProjectHandler {
  readonly name = "local-git"

  private state: OrchestratorState
  private workspaceDir: string

  constructor(state: OrchestratorState, workspaceDir: string) {
    this.state = state
    this.workspaceDir = workspaceDir
  }

  /* ------------------------------------------------------------------ */
  /* Project lifecycle methods                                          */
  /* ------------------------------------------------------------------ */

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
    if (!project) throw new Error("Project not found")

    // Stop if running
    if (project.status === "running") {
      await this.stopProject(projectId)
    }

    // Remove directory
    await rm(project.path, { recursive: true, force: true })

    this.state.projects.delete(projectId)
    this.state.processes.delete(projectId)
  }

  async startProject(projectId: string): Promise<void> {
    const project = this.state.projects.get(projectId)
    if (!project) throw new Error("Project not found")
    if (project.status === "running") throw new Error("Project is already running")

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

      // Start log collection (do not await)
      this.collectLogs(projectId, processInfo)

      // Wait briefly to detect immediate failures
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
    if (!project) throw new Error("Project not found")

    const processInfo = this.state.processes.get(projectId)
    if (!processInfo) {
      await this.updateProjectStatus(projectId, "stopped")
      return
    }

    await this.updateProjectStatus(projectId, "stopping")

    try {
      processInfo.process.kill("SIGTERM")
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
    return this.state.processes.get(projectId)?.logs || []
  }

  /* ------------------------------------------------------------------ */
  /* Helper utilities (mostly lifted from previous implementation)       */
  /* ------------------------------------------------------------------ */

  private async cloneRepository(gitUrl: string, targetPath: string, branch?: string): Promise<void> {
    const result = await Bun.spawn({
      cmd: ["git", "clone", "--depth", "1", ...(branch ? ["--branch", branch] : []), gitUrl, targetPath],
      stdout: "pipe",
      stderr: "pipe",
    }).exited

    if (result !== 0) {
      throw new Error("Git clone failed")
    }
  }

  private async initializeEmptyProject(projectPath: string): Promise<void> {
    await mkdir(join(projectPath, "src"), { recursive: true })

    const packageJson = {
      name: "opencode-project",
      version: "1.0.0",
      type: "module",
      scripts: { dev: "echo 'Hello from OpenCode project!'" },
    }

    await Bun.write(join(projectPath, "package.json"), JSON.stringify(packageJson, null, 2))
    await Bun.write(join(projectPath, "README.md"), "# OpenCode Project\n\nThis is a new OpenCode project.\n")
    await Bun.write(
      join(projectPath, "src/index.ts"),
      `console.log("Hello from OpenCode!")\n\nexport function greet(name: string): string {\n  return \`Hello, \${name}!\`;\n}\n`
    )
  }

  private async findAvailablePort(): Promise<number> {
    for (let port = 4096; port < 5000; port++) {
      try {
        const server = Bun.serve({ port, hostname: "127.0.0.1", fetch: () => new Response("test") })
        server.stop()
        return port
      } catch {
        continue
      }
    }
    throw new Error("No available ports found")
  }

  private async findOpenCodeExecutable(): Promise<string> {
    const possible = ["opencode", "bun", process.execPath]
    for (const path of possible) {
      try {
        const res = await Bun.spawn({ cmd: [path, "--version"], stdout: "pipe", stderr: "pipe" }).exited
        if (res === 0) {
          if (path === "bun" || path === process.execPath) return process.execPath
          return path
        }
      } catch {
        // ignore
      }
    }
    return process.execPath
  }

  private collectLogs(projectId: string, processInfo: ProcessInfo): void {
    const maxLogs = 1000
    const pushLines = (stream: ReadableStream<Uint8Array> | null | undefined, prefix: string) => {
      if (!stream) return
      const reader = stream.getReader()
      const decoder = new TextDecoder()
      ;(async () => {
        try {
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const text = decoder.decode(value)
            const lines = text.split("\n").filter(l => l.trim())
            for (const line of lines) {
              processInfo.logs.push(`${prefix} ${new Date().toISOString()} ${line}`)
              if (processInfo.logs.length > maxLogs) processInfo.logs.shift()
            }
          }
        } catch {
          /* swallow */
        }
      })()
    }

    pushLines(processInfo.process.stdout, "[stdout]")
    pushLines(processInfo.process.stderr, "[stderr]")
  }

  private async updateProjectStatus(projectId: string, status: ProjectStatus): Promise<void> {
    await this.updateProject(projectId, { status })
  }

  private async updateProject(projectId: string, updates: Partial<Project>): Promise<void> {
    const project = this.state.projects.get(projectId)
    if (!project) return
    const updated = { ...project, ...updates, updatedAt: new Date() }
    this.state.projects.set(projectId, updated)
  }
}