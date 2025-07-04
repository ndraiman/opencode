import { rm, chmod } from "node:fs/promises"
import { mock } from "bun:test"
import type { ProjectManager } from "../../src/project-manager.js"
import type { OrchestratorState } from "../../src/types.js"

/**
 * Test configuration from environment variables
 */
export const TEST_CONFIG = {
  timeout: parseInt(process.env["TEST_TIMEOUT"] || "10000"),
  portRange: {
    min: parseInt(process.env["TEST_PORT_MIN"] || "4000"),
    max: parseInt(process.env["TEST_PORT_MAX"] || "5000"),
  },
  workspace: process.env["TEST_WORKSPACE"] || undefined,
  skipCleanup: process.env["SKIP_TEST_CLEANUP"] === "true",
}

/**
 * Robust cleanup function for test directories
 */
export async function cleanupDirectory(dirPath: string): Promise<void> {
  if (TEST_CONFIG.skipCleanup) {
    console.log(`Skipping cleanup of ${dirPath} (SKIP_TEST_CLEANUP=true)`)
    return
  }

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

/**
 * Test timeout helper with configurable timeout
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number = TEST_CONFIG.timeout,
): Promise<T> {
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

/**
 * Wait for a condition to be true with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {},
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }

  throw new Error(`Condition not met within ${timeout}ms`)
}

/**
 * Create a mock process for testing
 */
export function createMockProcess(
  options: {
    pid?: number
    exitCode?: number | null
    willFail?: boolean
    stdout?: string
    stderr?: string
  } = {},
) {
  const {
    pid = 12345,
    exitCode = null,
    willFail = false,
    stdout = "Process output",
    stderr = "",
  } = options

  const killMock = mock(() => {})

  return {
    pid,
    exitCode: willFail ? 1 : exitCode,
    exited: willFail ? Promise.resolve(1) : Promise.resolve(0),
    kill: killMock,
    stdout: new ReadableStream({
      start(controller) {
        if (stdout) {
          controller.enqueue(new TextEncoder().encode(stdout))
        }
        controller.close()
      },
    }),
    stderr: new ReadableStream({
      start(controller) {
        if (stderr) {
          controller.enqueue(new TextEncoder().encode(stderr))
        }
        controller.close()
      },
    }),
    _killMock: killMock,
  }
}

/**
 * Mock spawn function for testing
 */
export function createMockSpawn(
  processOptions: Parameters<typeof createMockProcess>[0] = {},
) {
  const mockProcess = createMockProcess(processOptions)
  return mock(() => mockProcess)
}

/**
 * Mock Bun.serve for testing
 */
export function createMockServe(port: number = 3000) {
  const stopMock = mock(() => {})

  return {
    mockServe: mock(() => ({
      stop: stopMock,
      url: new URL(`http://127.0.0.1:${port}`),
      hostname: "127.0.0.1",
      port,
    })),
    stopMock,
  }
}

/**
 * Mock Bun.write for testing
 */
export function createMockWrite() {
  return mock(() => Promise.resolve())
}

/**
 * Helper to override ProjectManager methods for testing
 */
export function createProjectManagerOverride(
  projectManager: ProjectManager,
  state: OrchestratorState,
  testCommand: string[],
) {
  const originalStartProject = projectManager.startProject.bind(projectManager)
  const originalStopProject = projectManager.stopProject.bind(projectManager)

  const overrides = {
    startProject: async (projectId: string) => {
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
    },

    restore: () => {
      projectManager.startProject = originalStartProject
      projectManager.stopProject = originalStopProject
    },
  }

  projectManager.startProject = overrides.startProject

  return overrides
}

/**
 * Performance measurement helper
 */
export class PerformanceTimer {
  private startTime: number
  private endTime?: number

  constructor() {
    this.startTime = performance.now()
  }

  stop(): number {
    this.endTime = performance.now()
    return this.duration()
  }

  duration(): number {
    const end = this.endTime ?? performance.now()
    return end - this.startTime
  }
}

/**
 * Create a performance test helper
 */
export function measurePerformance<T>(
  operation: () => Promise<T>,
  maxDuration: number,
): Promise<{ result: T; duration: number }> {
  return new Promise(async (resolve, reject) => {
    const timer = new PerformanceTimer()

    try {
      const result = await operation()
      const duration = timer.stop()

      if (duration > maxDuration) {
        reject(
          new Error(
            `Operation took ${duration}ms, expected < ${maxDuration}ms`,
          ),
        )
      } else {
        resolve({ result, duration })
      }
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Retry helper for flaky operations
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options: { maxAttempts?: number; delay?: number } = {},
): Promise<T> {
  const { maxAttempts = 3, delay = 1000 } = options
  let lastError: Error

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error

      if (attempt === maxAttempts) {
        throw new Error(
          `Operation failed after ${maxAttempts} attempts: ${lastError.message}`,
        )
      }

      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError!
}

/**
 * Generate a unique test ID
 */
export function generateTestId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Check if a port is available
 */
export async function isPortAvailable(port: number): Promise<boolean> {
  try {
    const server = Bun.serve({
      port,
      hostname: "127.0.0.1",
      fetch: () => new Response("test"),
    })
    server.stop()
    return true
  } catch {
    return false
  }
}

/**
 * Find an available port in the test range
 */
export async function findAvailableTestPort(): Promise<number> {
  const { min, max } = TEST_CONFIG.portRange

  for (let port = min; port <= max; port++) {
    if (await isPortAvailable(port)) {
      return port
    }
  }

  throw new Error(`No available ports in range ${min}-${max}`)
}
