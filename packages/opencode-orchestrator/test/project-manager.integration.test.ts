import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { mkdir, rm, chmod, writeFile } from "node:fs/promises"
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
      await new Promise((resolve) => setTimeout(resolve, 100))
      await rm(dirPath, { recursive: true, force: true })
    } catch (e) {
      // Ignore final cleanup errors in tests
    }
  }
}

// Test timeout helper
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Operation timed out after ${ms}ms`)),
        ms,
      ),
    ),
  ])
}

// Helper to override startProject for integration tests
function overrideStartProject(
  projectManager: ProjectManager,
  state: OrchestratorState,
  testCommand: string[],
) {
  const originalStartProject = projectManager.startProject.bind(projectManager)

  projectManager.startProject = async (projectId: string) => {
    const project = state.projects.get(projectId)
    if (!project) {
      throw new Error("Project not found")
    }

    if (project.status === "running") {
      throw new Error("Project is already running")
    }

    await (projectManager as any).updateProjectStatus(projectId, "starting")

    try {
      const port = await (projectManager as any).findAvailablePort()

      const spawned = Bun.spawn({
        cmd: [...testCommand, port.toString()],
        cwd: project.path,
        stdout: "pipe",
        stderr: "pipe",
        stdin: "ignore",
        env: {
          ...process.env,
          BUN_BE_BUN: "1",
        },
      })

      const processInfo = {
        process: spawned,
        port,
        startedAt: new Date(),
        logs: [] as string[],
      }

      // Start log collection
      await (projectManager as any).collectLogs(projectId, processInfo)

      // Wait a bit to see if the process starts successfully
      await new Promise((resolve) => setTimeout(resolve, 500))

      if (spawned.exitCode !== null) {
        throw new Error(`Test process exited with code ${spawned.exitCode}`)
      }

      state.processes.set(projectId, processInfo)
      await (projectManager as any).updateProject(projectId, {
        status: "running",
        port,
        pid: spawned.pid,
        lastError: undefined,
      })
    } catch (error) {
      await (projectManager as any).updateProject(projectId, {
        status: "failed",
        lastError: error instanceof Error ? error.message : "Unknown error",
      })
      throw error
    }
  }

  return originalStartProject
}

describe("ProjectManager Integration Tests", () => {
  let state: OrchestratorState
  let projectManager: ProjectManager
  let tempWorkspace: string
  let testExecutable: string

  beforeEach(async () => {
    state = {
      projects: new Map(),
      processes: new Map(),
    }

    tempWorkspace = join(tmpdir(), `opencode-integration-test-${Date.now()}`)
    await mkdir(tempWorkspace, { recursive: true })

    // Create a test executable that behaves like a simple server
    testExecutable = join(tempWorkspace, "test-server.js")
    await writeFile(
      testExecutable,
      `
const port = parseInt(process.argv[2]) || 0

try {
  const server = Bun.serve({
    port,
    hostname: "127.0.0.1",
    fetch() {
      return new Response("OK", { status: 200 })
    }
  })

  console.log(\`Server started on port \${server.port}\`)

  process.on('SIGTERM', () => {
    server.stop()
    process.exit(0)
  })

  process.on('SIGINT', () => {
    server.stop()
    process.exit(0)
  })
} catch (error) {
  console.error('Server failed:', error)
  process.exit(1)
}
`,
      "utf8",
    )

    await chmod(testExecutable, 0o755)

    projectManager = new ProjectManager(state, tempWorkspace)
  })

  afterEach(async () => {
    // Force cleanup all running processes
    for (const [projectId, processInfo] of state.processes) {
      try {
        if (processInfo.process && processInfo.process.exitCode === null) {
          processInfo.process.kill("SIGKILL")
          await withTimeout(processInfo.process.exited, 2000).catch(() => {})
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    // Clear state
    state.projects.clear()
    state.processes.clear()

    // Clean up temp directory
    await cleanupDirectory(tempWorkspace)
  })

  describe("Real Process Spawning", () => {
    test("should spawn and manage a real process", async () => {
      // Create a project to test with
      const input: CreateProjectInput = {
        name: "real-process-test",
        type: "empty",
        description: "Integration test project",
      }
      const project = await projectManager.createProject(input)

      // Override startProject to use our test executable
      const originalStartProject = overrideStartProject(projectManager, state, [
        process.execPath,
        testExecutable,
      ])

      try {
        // Start the project - this will spawn a real process
        await withTimeout(projectManager.startProject(project.id), 10000)

        // Verify process is running
        const updatedProject = state.projects.get(project.id)
        expect(updatedProject?.status).toBe("running")
        expect(updatedProject?.port).toBeGreaterThan(0)
        expect(updatedProject?.pid).toBeDefined()

        // Verify process info is stored
        const processInfo = state.processes.get(project.id)
        expect(processInfo).toBeDefined()
        expect(processInfo?.process).toBeDefined()
        expect(processInfo?.port).toBeGreaterThan(0)
        expect(processInfo?.startedAt).toBeInstanceOf(Date)

        // Stop the project
        await withTimeout(projectManager.stopProject(project.id), 5000)

        // Verify process is stopped
        const stoppedProject = state.projects.get(project.id)
        expect(stoppedProject?.status).toBe("stopped")
        expect(stoppedProject?.port).toBeUndefined()
        expect(stoppedProject?.pid).toBeUndefined()
        expect(state.processes.has(project.id)).toBe(false)
      } finally {
        // Restore original method
        projectManager.startProject = originalStartProject
      }
    }, 15000)

    test("should handle process startup failure", async () => {
      const input: CreateProjectInput = {
        name: "failing-process-test",
        type: "empty",
      }
      const project = await projectManager.createProject(input)

      // Override to use a non-existent executable
      const originalStartProject = overrideStartProject(projectManager, state, [
        "/non/existent/executable",
        "serve",
        "--port",
      ])

      try {
        await expect(
          withTimeout(projectManager.startProject(project.id), 10000),
        ).rejects.toThrow()

        const failedProject = state.projects.get(project.id)
        expect(failedProject?.status).toBe("failed")
        expect(failedProject?.lastError).toBeDefined()
        expect(state.processes.has(project.id)).toBe(false)
      } finally {
        projectManager.startProject = originalStartProject
      }
    }, 10000)

    test("should collect real process logs", async () => {
      const input: CreateProjectInput = {
        name: "log-collection-test",
        type: "empty",
      }
      const project = await projectManager.createProject(input)

      // Create a test script that produces specific output
      const logTestScript = join(tempWorkspace, "log-test.js")
      await writeFile(
        logTestScript,
        `
console.log("Starting test process")
console.error("Test error message")
console.log("Process initialized")

const server = Bun.serve({
  port: parseInt(process.argv[2]) || 0,
  hostname: "127.0.0.1",
  fetch() {
    console.log("Request received")
    return new Response("OK")
  }
})

console.log(\`Server listening on port \${server.port}\`)

process.on('SIGTERM', () => {
  console.log('Shutting down')
  server.stop()
  process.exit(0)
})
`,
        "utf8",
      )

      const originalStartProject = overrideStartProject(projectManager, state, [
        process.execPath,
        logTestScript,
      ])

      try {
        await withTimeout(projectManager.startProject(project.id), 10000)

        // Wait for logs to be collected
        await new Promise((resolve) => setTimeout(resolve, 1000))

        const logs = await projectManager.getProjectLogs(project.id)
        expect(logs.length).toBeGreaterThan(0)

        // Check for expected log messages
        const logText = logs.join("\n")
        expect(logText).toContain("Starting test process")
        expect(logText).toContain("Process initialized")
        expect(logText).toContain("Server listening on port")

        await withTimeout(projectManager.stopProject(project.id), 5000)
      } finally {
        projectManager.startProject = originalStartProject
      }
    }, 15000)
  })

  describe("Process Lifecycle Management", () => {
    test("should handle graceful shutdown", async () => {
      const project = await projectManager.createProject({
        name: "graceful-shutdown-test",
        type: "empty",
      })

      const originalStartProject = overrideStartProject(projectManager, state, [
        process.execPath,
        testExecutable,
      ])

      try {
        await withTimeout(projectManager.startProject(project.id), 10000)

        const processInfo = state.processes.get(project.id)
        expect(processInfo?.process.exitCode).toBeNull()

        const shutdownStart = Date.now()
        await withTimeout(projectManager.stopProject(project.id), 10000)
        const shutdownTime = Date.now() - shutdownStart

        // Should shutdown relatively quickly with SIGTERM
        expect(shutdownTime).toBeLessThan(8000)

        // Process should be properly cleaned up
        expect(state.processes.has(project.id)).toBe(false)
      } finally {
        projectManager.startProject = originalStartProject
      }
    }, 20000)

    test("should force kill unresponsive processes", async () => {
      const project = await projectManager.createProject({
        name: "force-kill-test",
        type: "empty",
      })

      // Create a script that ignores SIGTERM
      const unresponsiveScript = join(tempWorkspace, "unresponsive.js")
      await writeFile(
        unresponsiveScript,
        `
const server = Bun.serve({
  port: parseInt(process.argv[2]) || 0,
  hostname: "127.0.0.1",
  fetch() { return new Response("OK") }
})

console.log(\`Unresponsive server on port \${server.port}\`)

// Ignore SIGTERM to test force kill
process.on('SIGTERM', () => {
  console.log('Ignoring SIGTERM')
})

process.on('SIGINT', () => {
  console.log('Ignoring SIGINT') 
})
`,
        "utf8",
      )

      const originalStartProject = overrideStartProject(projectManager, state, [
        process.execPath,
        unresponsiveScript,
      ])

      try {
        await withTimeout(projectManager.startProject(project.id), 10000)

        const processInfo = state.processes.get(project.id)
        expect(processInfo?.process.exitCode).toBeNull()

        // This should eventually force kill the process
        await withTimeout(projectManager.stopProject(project.id), 15000)

        expect(state.processes.has(project.id)).toBe(false)
      } finally {
        projectManager.startProject = originalStartProject
      }
    }, 20000)

    test("should restart projects correctly", async () => {
      const project = await projectManager.createProject({
        name: "restart-test",
        type: "empty",
      })

      const originalStartProject = overrideStartProject(projectManager, state, [
        process.execPath,
        testExecutable,
      ])

      try {
        // Start project
        await withTimeout(projectManager.startProject(project.id), 10000)

        const initialProcessInfo = state.processes.get(project.id)
        const initialPid = initialProcessInfo?.process.pid
        const initialPort = state.projects.get(project.id)?.port

        expect(initialPid).toBeDefined()
        expect(initialPort).toBeDefined()

        // Restart project
        await withTimeout(projectManager.restartProject(project.id), 15000)

        const restartedProcessInfo = state.processes.get(project.id)
        const restartedPid = restartedProcessInfo?.process.pid
        const restartedPort = state.projects.get(project.id)?.port

        // Should have different PID and potentially different port
        expect(restartedPid).toBeDefined()
        expect(restartedPid).not.toBe(initialPid)
        expect(restartedPort).toBeDefined()

        // Project should be running
        expect(state.projects.get(project.id)?.status).toBe("running")

        await withTimeout(projectManager.stopProject(project.id), 5000)
      } finally {
        projectManager.startProject = originalStartProject
      }
    }, 25000)
  })

  describe("Port Management", () => {
    test("should allocate different ports for multiple projects", async () => {
      const project1 = await projectManager.createProject({
        name: "port-test-1",
        type: "empty",
      })

      const project2 = await projectManager.createProject({
        name: "port-test-2",
        type: "empty",
      })

      const originalStartProject = overrideStartProject(projectManager, state, [
        process.execPath,
        testExecutable,
      ])

      try {
        // Start both projects sequentially to avoid port conflicts
        await withTimeout(projectManager.startProject(project1.id), 10000)
        await withTimeout(projectManager.startProject(project2.id), 10000)

        const port1 = state.projects.get(project1.id)?.port
        const port2 = state.projects.get(project2.id)?.port

        expect(port1).toBeDefined()
        expect(port2).toBeDefined()
        expect(port1).not.toBe(port2)

        // Both should be in valid port range
        expect(port1).toBeGreaterThan(4095)
        expect(port1).toBeLessThan(5000)
        expect(port2).toBeGreaterThan(4095)
        expect(port2).toBeLessThan(5000)

        // Stop both projects
        await Promise.all([
          withTimeout(projectManager.stopProject(project1.id), 5000),
          withTimeout(projectManager.stopProject(project2.id), 5000),
        ])
      } finally {
        projectManager.startProject = originalStartProject
      }
    }, 20000)
  })

  describe("Error Handling and Recovery", () => {
    test("should handle process crashes gracefully", async () => {
      const project = await projectManager.createProject({
        name: "crash-test",
        type: "empty",
      })

      // Create a script that crashes after a delay
      const crashingScript = join(tempWorkspace, "crashing.js")
      await writeFile(
        crashingScript,
        `
const server = Bun.serve({
  port: parseInt(process.argv[2]) || 0,
  hostname: "127.0.0.1",
  fetch() { return new Response("OK") }
})

console.log(\`Crashing server on port \${server.port}\`)

// Crash after 1 second
setTimeout(() => {
  console.log('Crashing now!')
  process.exit(1)
}, 1000)
`,
        "utf8",
      )

      const originalStartProject = overrideStartProject(projectManager, state, [
        process.execPath,
        crashingScript,
      ])

      try {
        await withTimeout(projectManager.startProject(project.id), 10000)

        // Wait for process to crash
        await new Promise((resolve) => setTimeout(resolve, 2000))

        // Process should still be in our state but may have crashed
        const processInfo = state.processes.get(project.id)
        if (processInfo) {
          // Wait for process to exit
          await withTimeout(processInfo.process.exited, 5000)
        }

        // Cleanup should work even with crashed process
        await withTimeout(projectManager.stopProject(project.id), 5000)
        expect(state.processes.has(project.id)).toBe(false)
      } finally {
        projectManager.startProject = originalStartProject
      }
    }, 25000)

    test("should clean up resources on manager destruction", async () => {
      // Create multiple projects
      const projects = await Promise.all([
        projectManager.createProject({ name: "cleanup-test-1", type: "empty" }),
        projectManager.createProject({ name: "cleanup-test-2", type: "empty" }),
        projectManager.createProject({ name: "cleanup-test-3", type: "empty" }),
      ])

      const originalStartProject = overrideStartProject(projectManager, state, [
        process.execPath,
        testExecutable,
      ])

      try {
        // Start all projects sequentially to avoid port conflicts
        for (const project of projects) {
          await withTimeout(projectManager.startProject(project.id), 10000)
        }

        // Verify all are running
        expect(state.processes.size).toBe(3)

        // Force cleanup all (simulating orchestrator shutdown)
        const stopPromises = projects.map((p) =>
          withTimeout(projectManager.stopProject(p.id), 5000),
        )

        await Promise.all(stopPromises)

        // All processes should be cleaned up
        expect(state.processes.size).toBe(0)
      } finally {
        projectManager.startProject = originalStartProject
      }
    }, 30000)
  })

  describe("Concurrent Operations", () => {
    test("should handle concurrent start/stop operations", async () => {
      const project = await projectManager.createProject({
        name: "concurrent-test",
        type: "empty",
      })

      const originalStartProject = overrideStartProject(projectManager, state, [
        process.execPath,
        testExecutable,
      ])

      try {
        // Start project
        await withTimeout(projectManager.startProject(project.id), 10000)

        // Try concurrent operations - these should be handled gracefully
        const operations = [
          projectManager.stopProject(project.id),
          projectManager.startProject(project.id).catch(() => {}), // May fail due to concurrent stop
          projectManager.stopProject(project.id).catch(() => {}), // May fail if already stopped
        ]

        await Promise.allSettled(operations)

        // Final state should be consistent
        const finalProject = state.projects.get(project.id)
        expect(["running", "stopped", "failed"]).toContain(finalProject?.status)

        // Ensure final cleanup
        if (finalProject?.status === "running") {
          await withTimeout(projectManager.stopProject(project.id), 5000)
        }
      } finally {
        projectManager.startProject = originalStartProject
      }
    }, 20000)
  })
})
