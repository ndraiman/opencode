import { describe, expect, test, beforeEach, afterEach, mock, spyOn } from "bun:test"
import { mkdir, rm, chmod } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { ProjectManager } from "../src/project-manager.js"
import type { OrchestratorState, CreateProjectInput } from "../src/types.js"

// Robust cleanup function
async function cleanupDirectory(dirPath: string): Promise<void> {
  try {
    // First, try to make everything writable
    try {
      await chmod(dirPath, 0o777)
    } catch (e) {
      // Ignore chmod errors
    }
    
    // Try to remove recursively  
    await rm(dirPath, { recursive: true, force: true })
  } catch (e) {
    // If that fails, try a second time after a short delay
    try {
      await new Promise(resolve => setTimeout(resolve, 10))
      await rm(dirPath, { recursive: true, force: true })
    } catch (e) {
      // Ignore final cleanup errors in tests
    }
  }
}

// Mock Bun.spawn
const mockSpawn = mock(() => ({
  pid: 12345,
  exitCode: null,
  exited: Promise.resolve(0),
  kill: mock(() => {}),
  stdout: new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("OpenCode server started"))
      controller.close()
    }
  }),
  stderr: new ReadableStream({
    start(controller) {
      controller.close()
    }
  })
}))

// Mock Bun.serve for port checking
const mockServe = mock(() => ({
  stop: mock(() => {})
}))

// Mock file operations
const mockWrite = mock(() => Promise.resolve())

// Replace global Bun methods
const originalSpawn = Bun.spawn
const originalServe = Bun.serve
const originalWrite = Bun.write

beforeEach(() => {
  // @ts-ignore
  Bun.spawn = mockSpawn
  // @ts-ignore  
  Bun.serve = mockServe
  // @ts-ignore
  Bun.write = mockWrite
})

afterEach(() => {
  // @ts-ignore
  Bun.spawn = originalSpawn
  // @ts-ignore
  Bun.serve = originalServe
  // @ts-ignore
  Bun.write = originalWrite
  mockSpawn.mockClear()
  mockServe.mockClear()
  mockWrite.mockClear()
})

describe("ProjectManager", () => {
  let state: OrchestratorState
  let projectManager: ProjectManager
  let tempWorkspace: string

  beforeEach(async () => {
    state = {
      projects: new Map(),
      processes: new Map()
    }
    
    tempWorkspace = join(tmpdir(), `opencode-test-${Date.now()}`)
    await mkdir(tempWorkspace, { recursive: true })
    
    projectManager = new ProjectManager(state, tempWorkspace)
  })

  afterEach(async () => {
    // Cleanup any running processes first
    for (const [projectId, processInfo] of state.processes) {
      try {
        if (processInfo.process && typeof processInfo.process.kill === 'function') {
          processInfo.process.kill('SIGTERM')
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    // Clear state
    state.projects.clear()
    state.processes.clear()
    
    // Clean up temp directory
    try {
      await cleanupDirectory(tempWorkspace)
    } catch (e) {
      // Ignore cleanup errors in tests
    }
  })

  describe("createProject", () => {
    test("should create an empty project", async () => {
      const input: CreateProjectInput = {
        name: "test-project",
        type: "empty",
        description: "Test project"
      }

      const project = await projectManager.createProject(input)

      expect(project).toBeDefined()
      expect(project.name).toBe("test-project")
      expect(project.type).toBe("empty")
      expect(project.status).toBe("stopped")
      expect(project.id).toMatch(/^[a-f0-9-]{36}$/) // UUID format
      expect(project.path).toContain(tempWorkspace)
      expect(state.projects.has(project.id)).toBe(true)
    })

    test("should create a git project", async () => {
      // Mock successful git clone
      mockSpawn.mockReturnValueOnce({
        pid: 12345,
        exitCode: null,
        exited: Promise.resolve(0),
        kill: mock(() => {}),
        stdout: new ReadableStream({ start(controller) { controller.close() } }),
        stderr: new ReadableStream({ start(controller) { controller.close() } })
      })

      const input: CreateProjectInput = {
        name: "git-project", 
        type: "git",
        gitUrl: "https://github.com/user/repo.git",
        gitBranch: "main"
      }

      const project = await projectManager.createProject(input)

      expect(project).toBeDefined()
      expect(project.name).toBe("git-project")
      expect(project.type).toBe("git")
      expect(project.gitUrl).toBe("https://github.com/user/repo.git")
      expect(project.gitBranch).toBe("main")
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.objectContaining({
          cmd: expect.arrayContaining(["git", "clone"])
        })
      )
    })

    test("should handle git clone failure", async () => {
      // Mock failed git clone
      mockSpawn.mockReturnValueOnce({
        pid: 12345,
        exitCode: null,
        exited: Promise.resolve(1),
        kill: mock(() => {}),
        stdout: new ReadableStream({ start(controller) { controller.close() } }),
        stderr: new ReadableStream({ start(controller) { controller.close() } })
      })

      const input: CreateProjectInput = {
        name: "failed-git-project",
        type: "git", 
        gitUrl: "https://github.com/invalid/repo.git"
      }

      await expect(projectManager.createProject(input)).rejects.toThrow()
      expect(state.projects.size).toBe(0)
    })

    test("should initialize empty project with proper structure", async () => {
      const input: CreateProjectInput = {
        name: "structured-project",
        type: "empty"
      }

      await projectManager.createProject(input)

      // Verify Bun.write was called to create files
      expect(mockWrite).toHaveBeenCalledWith(
        expect.stringContaining("package.json"),
        expect.stringContaining("opencode-project")
      )
      expect(mockWrite).toHaveBeenCalledWith(
        expect.stringContaining("README.md"),
        expect.stringContaining("OpenCode Project")
      )
      expect(mockWrite).toHaveBeenCalledWith(
        expect.stringContaining("src/index.ts"),
        expect.stringContaining("Hello from OpenCode")
      )
    })
  })

  describe("listProjects", () => {
    test("should return empty array when no projects exist", async () => {
      const projects = await projectManager.listProjects()
      expect(projects).toEqual([])
    })

    test("should return all created projects", async () => {
      const input1: CreateProjectInput = { name: "project1", type: "empty" }
      const input2: CreateProjectInput = { name: "project2", type: "empty" }

      const project1 = await projectManager.createProject(input1)
      const project2 = await projectManager.createProject(input2)

      const projects = await projectManager.listProjects()
      
      expect(projects).toHaveLength(2)
      expect(projects.map(p => p.id)).toContain(project1.id)
      expect(projects.map(p => p.id)).toContain(project2.id)
    })
  })

  describe("getProject", () => {
    test("should return project by ID", async () => {
      const input: CreateProjectInput = { name: "test-project", type: "empty" }
      const created = await projectManager.createProject(input)

      const found = await projectManager.getProject(created.id)
      
      expect(found).toEqual(created)
    })

    test("should return undefined for non-existent project", async () => {
      const found = await projectManager.getProject("non-existent-id")
      expect(found).toBeUndefined()
    })
  })

  describe("deleteProject", () => {
    test("should delete existing project", async () => {
      const input: CreateProjectInput = { name: "to-delete", type: "empty" }
      const project = await projectManager.createProject(input)

      await projectManager.deleteProject(project.id)

      expect(state.projects.has(project.id)).toBe(false)
      expect(state.processes.has(project.id)).toBe(false)
    })

    test("should throw error for non-existent project", async () => {
      await expect(projectManager.deleteProject("non-existent")).rejects.toThrow("Project not found")
    })

    test("should stop running project before deletion", async () => {
      const input: CreateProjectInput = { name: "running-project", type: "empty" }
      const project = await projectManager.createProject(input)

      // Mock running process
      const mockProcess = {
        pid: 12345,
        exitCode: null,
        exited: Promise.resolve(0),
        kill: mock(() => {}),
        stdout: new ReadableStream(),
        stderr: new ReadableStream()
      }
      
      state.processes.set(project.id, {
        process: mockProcess as any,
        port: 4096,
        startedAt: new Date(),
        logs: []
      })
      
      state.projects.set(project.id, { ...project, status: "running" })

      await projectManager.deleteProject(project.id)

      expect(mockProcess.kill).toHaveBeenCalledWith("SIGTERM")
      expect(state.projects.has(project.id)).toBe(false)
    })
  })

  describe("startProject", () => {
    test("should start a stopped project", async () => {
      const input: CreateProjectInput = { name: "start-test", type: "empty" }
      const project = await projectManager.createProject(input)

      await projectManager.startProject(project.id)

      const updatedProject = state.projects.get(project.id)
      expect(updatedProject?.status).toBe("running")
      expect(updatedProject?.port).toBeGreaterThan(0)
      expect(updatedProject?.pid).toBe(12345)
      expect(state.processes.has(project.id)).toBe(true)
    })

    test("should throw error for non-existent project", async () => {
      await expect(projectManager.startProject("non-existent")).rejects.toThrow("Project not found")
    })

    test("should throw error if project is already running", async () => {
      const input: CreateProjectInput = { name: "already-running", type: "empty" }
      const project = await projectManager.createProject(input)
      
      // Set project as running
      state.projects.set(project.id, { ...project, status: "running" })

      await expect(projectManager.startProject(project.id)).rejects.toThrow("Project is already running")
    })

    test("should handle process start failure", async () => {
      const input: CreateProjectInput = { name: "fail-start", type: "empty" }
      const project = await projectManager.createProject(input)

      // Mock Bun.serve to throw error when finding port
      const originalServe = Bun.serve
      Bun.serve = mock(() => {
        throw new Error("Port in use")
      }) as any

      try {
        await expect(projectManager.startProject(project.id)).rejects.toThrow()
        
        const updatedProject = state.projects.get(project.id)
        expect(updatedProject?.status).toBe("failed")
        expect(updatedProject?.lastError).toBeDefined()
      } finally {
        // Restore original Bun.serve
        Bun.serve = originalServe
      }
    })
  })

  describe("stopProject", () => {
    test("should stop a running project", async () => {
      const input: CreateProjectInput = { name: "stop-test", type: "empty" }
      const project = await projectManager.createProject(input)

      // Start the project first
      await projectManager.startProject(project.id)
      
      // Now stop it
      await projectManager.stopProject(project.id)

      const updatedProject = state.projects.get(project.id)
      expect(updatedProject?.status).toBe("stopped")
      expect(updatedProject?.port).toBeUndefined()
      expect(updatedProject?.pid).toBeUndefined()
      expect(state.processes.has(project.id)).toBe(false)
    })

    test("should handle stopping already stopped project", async () => {
      const input: CreateProjectInput = { name: "already-stopped", type: "empty" }
      const project = await projectManager.createProject(input)

      // Project is already stopped by default
      await projectManager.stopProject(project.id)

      const updatedProject = state.projects.get(project.id)
      expect(updatedProject?.status).toBe("stopped")
    })

    test("should throw error for non-existent project", async () => {
      await expect(projectManager.stopProject("non-existent")).rejects.toThrow("Project not found")
    })
  })

  describe("restartProject", () => {
    test("should restart a running project", async () => {
      const input: CreateProjectInput = { name: "restart-test", type: "empty" }
      const project = await projectManager.createProject(input)

      // Start the project
      await projectManager.startProject(project.id)
      const initialPort = state.projects.get(project.id)?.port

      // Restart it
      await projectManager.restartProject(project.id)

      const updatedProject = state.projects.get(project.id)
      expect(updatedProject?.status).toBe("running")
      // Should get a new port
      expect(updatedProject?.port).toBeGreaterThan(0)
    })
  })

  describe("getProjectLogs", () => {
    test("should return empty logs for non-running project", async () => {
      const input: CreateProjectInput = { name: "log-test", type: "empty" }
      const project = await projectManager.createProject(input)

      const logs = await projectManager.getProjectLogs(project.id)
      expect(logs).toEqual([])
    })

    test("should return logs for running project", async () => {
      const input: CreateProjectInput = { name: "log-test-running", type: "empty" }
      const project = await projectManager.createProject(input)

      // Mock process info with logs
      state.processes.set(project.id, {
        process: {} as any,
        port: 4096,
        startedAt: new Date(),
        logs: ["[stdout] 2024-01-01T00:00:00.000Z Starting server", "[stderr] 2024-01-01T00:00:01.000Z Debug info"]
      })

      const logs = await projectManager.getProjectLogs(project.id)
      expect(logs).toHaveLength(2)
      expect(logs[0]).toContain("Starting server")
      expect(logs[1]).toContain("Debug info")
    })
  })
})