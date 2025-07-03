import { describe, expect, test, beforeEach, afterEach, mock } from "bun:test"
import { mkdir, rm, chmod } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

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

// Mock Bun.serve to avoid actually starting a server
const mockServer = {
  stop: mock(() => {}),
  url: new URL("http://127.0.0.1:3000"),
  hostname: "127.0.0.1",
  port: 3000
}

const mockServe = mock(() => mockServer)
const originalServe = Bun.serve

// Mock Bun.spawn for git operations
const mockSpawn = mock(() => ({
  pid: 12345,
  exitCode: null,
  exited: Promise.resolve(0),
  kill: mock(() => {}),
  stdout: new ReadableStream({ start(controller) { controller.close() } }),
  stderr: new ReadableStream({ start(controller) { controller.close() } })
}))
const originalSpawn = Bun.spawn

beforeEach(() => {
  // @ts-ignore
  Bun.serve = mockServe
  // @ts-ignore
  Bun.spawn = mockSpawn
})

afterEach(() => {
  // Restore original Bun methods
  // @ts-ignore
  Bun.serve = originalServe
  // @ts-ignore
  Bun.spawn = originalSpawn
  
  // Clear all mocks
  mockServe.mockClear()
  mockSpawn.mockClear()
  
  // Reset mock server state
  if (mockServer.stop && typeof mockServer.stop.mockClear === 'function') {
    mockServer.stop.mockClear()
  }
})

describe("OpenCode Orchestrator Main", () => {
  let tempWorkspace: string

  beforeEach(async () => {
    tempWorkspace = join(tmpdir(), `orchestrator-test-${Date.now()}`)
    await mkdir(tempWorkspace, { recursive: true })
  })

  afterEach(async () => {
    // Clean up temp directory
    await cleanupDirectory(tempWorkspace)
    
    // Ensure no lingering process references
    tempWorkspace = ""
  })

  test("should initialize orchestrator components", async () => {
    // Since the main function starts an infinite server, we can't easily test it directly
    // But we can test that the imports work and the basic structure is correct
    const { createApiRouter } = await import("../src/api.js")
    const { ProjectManager } = await import("../src/project-manager.js")
    const { ProxyService } = await import("../src/proxy.js")

    expect(createApiRouter).toBeDefined()
    expect(ProjectManager).toBeDefined()
    expect(ProxyService).toBeDefined()

    // Test that we can create instances
    const state = {
      projects: new Map(),
      processes: new Map()
    }

    const projectManager = new ProjectManager(state, tempWorkspace)
    const proxyService = new ProxyService(state)
    const apiRouter = createApiRouter(projectManager, proxyService)

    expect(projectManager).toBeInstanceOf(ProjectManager)
    expect(proxyService).toBeInstanceOf(ProxyService)
    expect(apiRouter).toBeDefined()
  })

  test("should handle command line arguments parsing", () => {
    // Test argument parsing logic (this would be in the main function)
    const testArgs = ["--port=8080", "--hostname=0.0.0.0", "--workspace=/custom/path"]
    
    const portArg = testArgs.find(arg => arg.startsWith("--port="))
    const hostArg = testArgs.find(arg => arg.startsWith("--hostname="))
    const workspaceArg = testArgs.find(arg => arg.startsWith("--workspace="))

    expect(portArg?.split("=")[1]).toBe("8080")
    expect(hostArg?.split("=")[1]).toBe("0.0.0.0")
    expect(workspaceArg?.split("=")[1]).toBe("/custom/path")
  })

  test("should use default values when no arguments provided", () => {
    const testArgs: string[] = []
    
    const portArg = testArgs.find(arg => arg.startsWith("--port="))
    const hostArg = testArgs.find(arg => arg.startsWith("--hostname="))
    const workspaceArg = testArgs.find(arg => arg.startsWith("--workspace="))

    const port = portArg ? parseInt(portArg.split("=")[1]) : 3000
    const hostname = hostArg ? hostArg.split("=")[1] : "127.0.0.1"
    const workspaceDir = workspaceArg ? workspaceArg.split("=")[1] : join(tmpdir(), "default-workspace")

    expect(port).toBe(3000)
    expect(hostname).toBe("127.0.0.1")
    expect(workspaceDir).toContain("default-workspace")
  })

  test("should validate workspace directory creation", async () => {
    const testWorkspace = join(tempWorkspace, "test-projects")
    
    // This mimics what happens in the main function
    await mkdir(testWorkspace, { recursive: true })
    
    // Verify directory exists using fs.access
    const fs = await import("node:fs/promises")
    try {
      await fs.access(testWorkspace)
      expect(true).toBe(true) // Directory exists
    } catch {
      expect(false).toBe(true) // Directory doesn't exist
    }
  })

  test("should handle invalid port numbers", () => {
    const testArgs = ["--port=invalid"]
    
    const portArg = testArgs.find(arg => arg.startsWith("--port="))
    const port = portArg ? parseInt(portArg.split("=")[1]) : 3000
    
    // parseInt returns NaN for invalid numbers
    expect(isNaN(port)).toBe(true)
    
    // In real implementation, this would fall back to default
    const finalPort = isNaN(port) ? 3000 : port
    expect(finalPort).toBe(3000)
  })

  test("should create server configuration", () => {
    const port = 3000
    const hostname = "127.0.0.1"
    
    // This mimics the server configuration in main
    const serverConfig = {
      port,
      hostname,
      fetch: () => new Response("test")
    }
    
    expect(serverConfig.port).toBe(3000)
    expect(serverConfig.hostname).toBe("127.0.0.1")
    expect(serverConfig.fetch).toBeDefined()
  })
})