import { mock, spyOn, beforeEach, afterEach } from "bun:test"
import { ProjectManager } from "../../src/project-manager.js"
import { ProxyService } from "../../src/proxy.js"
import type {
  OrchestratorState,
  Project,
  CreateProjectInput,
} from "../../src/types.js"
import { createMockProcess } from "./test-utils.js"

/**
 * Mock context for tracking and restoring mocks
 */
export class MockContext {
  private mocks: Array<{ restore: () => void }> = []
  private spies: Array<{ restore: () => void }> = []

  /**
   * Add a mock to be restored later
   */
  addMock(mock: { restore: () => void }) {
    this.mocks.push(mock)
  }

  /**
   * Add a spy to be restored later
   */
  addSpy(spy: { restore: () => void }) {
    this.spies.push(spy)
  }

  /**
   * Restore all mocks and spies
   */
  restoreAll() {
    this.mocks.forEach((mock) => mock.restore())
    this.spies.forEach((spy) => spy.restore())
    this.mocks = []
    this.spies = []
  }
}

/**
 * Global mock context for test isolation
 */
export const globalMockContext = new MockContext()

/**
 * Mock Bun global methods for testing
 */
export class BunMocker {
  private originalSpawn: typeof Bun.spawn
  private originalServe: typeof Bun.serve
  private originalWrite: typeof Bun.write

  constructor() {
    this.originalSpawn = Bun.spawn
    this.originalServe = Bun.serve
    this.originalWrite = Bun.write
  }

  /**
   * Mock Bun.spawn with configurable behavior
   */
  mockSpawn(
    config: {
      shouldSucceed?: boolean
      pid?: number
      exitCode?: number
      stdout?: string
      stderr?: string
      delay?: number
    } = {},
  ) {
    const {
      shouldSucceed = true,
      pid = 12345,
      exitCode = 0,
      stdout = "",
      stderr = "",
      delay = 0,
    } = config

    const mockSpawn = mock((options: any) => {
      const process = createMockProcess({
        pid,
        exitCode: shouldSucceed ? exitCode : 1,
        willFail: !shouldSucceed,
        stdout,
        stderr,
      })

      // Simulate async behavior
      if (delay > 0) {
        setTimeout(() => {
          process.exited = shouldSucceed
            ? Promise.resolve(0)
            : Promise.resolve(1)
        }, delay)
      }

      return process
    })

    // @ts-ignore
    Bun.spawn = mockSpawn

    globalMockContext.addMock({
      restore: () => {
        // @ts-ignore
        Bun.spawn = this.originalSpawn
      },
    })

    return mockSpawn
  }

  /**
   * Mock Bun.serve with configurable behavior
   */
  mockServe(
    config: {
      port?: number
      shouldSucceed?: boolean
      delay?: number
    } = {},
  ) {
    const { port = 3000, shouldSucceed = true, delay = 0 } = config

    const stopMock = mock(() => {})
    const mockServe = mock((options: any) => {
      if (!shouldSucceed) {
        throw new Error("Failed to start server")
      }

      const server = {
        stop: stopMock,
        url: new URL(`http://127.0.0.1:${port}`),
        hostname: "127.0.0.1",
        port: port,
      }

      if (delay > 0) {
        return new Promise((resolve) =>
          setTimeout(() => resolve(server), delay),
        )
      }

      return server
    })

    // @ts-ignore
    Bun.serve = mockServe

    globalMockContext.addMock({
      restore: () => {
        // @ts-ignore
        Bun.serve = this.originalServe
      },
    })

    return { mockServe, stopMock }
  }

  /**
   * Mock Bun.write with configurable behavior
   */
  mockWrite(
    config: {
      shouldSucceed?: boolean
      delay?: number
    } = {},
  ) {
    const { shouldSucceed = true, delay = 0 } = config

    const mockWrite = mock(async (path: string, data: any) => {
      if (!shouldSucceed) {
        throw new Error(`Failed to write to ${path}`)
      }

      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay))
      }

      return data.length || 0
    })

    // @ts-ignore
    Bun.write = mockWrite

    globalMockContext.addMock({
      restore: () => {
        // @ts-ignore
        Bun.write = this.originalWrite
      },
    })

    return mockWrite
  }

  /**
   * Restore all Bun mocks
   */
  restoreAll() {
    // @ts-ignore
    Bun.spawn = this.originalSpawn
    // @ts-ignore
    Bun.serve = this.originalServe
    // @ts-ignore
    Bun.write = this.originalWrite
  }
}

/**
 * Mock ProjectManager with configurable behavior
 */
export class ProjectManagerMocker {
  createMockProjectManager(
    state: OrchestratorState,
    workspace: string,
  ): ProjectManager {
    const projectManager = new ProjectManager(state, workspace)

    // Mock all methods with spy functionality
    const spies = {
      createProject: spyOn(projectManager, "createProject"),
      listProjects: spyOn(projectManager, "listProjects"),
      getProject: spyOn(projectManager, "getProject"),
      deleteProject: spyOn(projectManager, "deleteProject"),
      startProject: spyOn(projectManager, "startProject"),
      stopProject: spyOn(projectManager, "stopProject"),
      restartProject: spyOn(projectManager, "restartProject"),
      getProjectLogs: spyOn(projectManager, "getProjectLogs"),
    }

    // Add spies to global context for cleanup
    Object.values(spies).forEach((spy) => {
      globalMockContext.addSpy(spy)
    })

    return projectManager
  }

  /**
   * Create a mock ProjectManager with predefined behavior
   */
  createMockWithBehavior(
    config: {
      projects?: Project[]
      createProjectBehavior?: (
        input: CreateProjectInput,
      ) => Project | Promise<Project>
      startProjectBehavior?: (id: string) => void | Promise<void>
      stopProjectBehavior?: (id: string) => void | Promise<void>
      shouldFailOperations?: string[]
    } = {},
  ): ProjectManager {
    const {
      projects = [],
      createProjectBehavior,
      startProjectBehavior,
      stopProjectBehavior,
      shouldFailOperations = [],
    } = config

    const state: OrchestratorState = {
      projects: new Map(projects.map((p) => [p.id, p])),
      processes: new Map(),
    }

    const projectManager = this.createMockProjectManager(
      state,
      "/tmp/test-workspace",
    )

    // Configure behaviors
    if (createProjectBehavior) {
      projectManager.createProject = mock(createProjectBehavior)
    }

    if (startProjectBehavior) {
      projectManager.startProject = mock(startProjectBehavior)
    } else if (shouldFailOperations.includes("startProject")) {
      projectManager.startProject = mock(() => {
        throw new Error("Failed to start project")
      })
    }

    if (stopProjectBehavior) {
      projectManager.stopProject = mock(stopProjectBehavior)
    } else if (shouldFailOperations.includes("stopProject")) {
      projectManager.stopProject = mock(() => {
        throw new Error("Failed to stop project")
      })
    }

    return projectManager
  }
}

/**
 * Mock ProxyService with configurable behavior
 */
export class ProxyServiceMocker {
  createMockProxyService(state: OrchestratorState): ProxyService {
    const proxyService = new ProxyService(state)

    // Mock all methods with spy functionality
    const spies = {
      proxyRequest: spyOn(proxyService, "proxyRequest"),
      proxyWebSocket: spyOn(proxyService, "proxyWebSocket"),
    }

    // Add spies to global context for cleanup
    Object.values(spies).forEach((spy) => {
      globalMockContext.addSpy(spy)
    })

    return proxyService
  }

  /**
   * Create a mock ProxyService with predefined behavior
   */
  createMockWithBehavior(
    config: {
      proxyRequestBehavior?: (
        projectId: string,
        request: any,
      ) => any | Promise<any>
      proxyWebSocketBehavior?: (
        projectId: string,
        request: any,
      ) => any | Promise<any>
      shouldFailOperations?: string[]
    } = {},
  ): ProxyService {
    const {
      proxyRequestBehavior,
      proxyWebSocketBehavior,
      shouldFailOperations = [],
    } = config

    const state: OrchestratorState = {
      projects: new Map(),
      processes: new Map(),
    }

    const proxyService = this.createMockProxyService(state)

    // Configure behaviors
    if (proxyRequestBehavior) {
      proxyService.proxyRequest = mock(proxyRequestBehavior)
    } else if (shouldFailOperations.includes("proxyRequest")) {
      proxyService.proxyRequest = mock(() => {
        throw new Error("Failed to proxy request")
      })
    }

    if (proxyWebSocketBehavior) {
      proxyService.proxyWebSocket = mock(proxyWebSocketBehavior)
    } else if (shouldFailOperations.includes("proxyWebSocket")) {
      proxyService.proxyWebSocket = mock(() => {
        throw new Error("Failed to proxy WebSocket")
      })
    }

    return proxyService
  }
}

/**
 * Mock network operations
 */
export class NetworkMocker {
  /**
   * Mock fetch with configurable responses
   */
  mockFetch(
    responses: Array<{
      url?: string | RegExp
      method?: string
      response: {
        status: number
        body?: any
        headers?: Record<string, string>
      }
    }>,
  ) {
    const originalFetch = globalThis.fetch

    const mockFetch = mock(
      async (url: string | Request, init?: RequestInit) => {
        const requestUrl = typeof url === "string" ? url : url.url
        const requestMethod = init?.method || "GET"

        const matchingResponse = responses.find((r) => {
          const urlMatches =
            !r.url ||
            (typeof r.url === "string" && requestUrl.includes(r.url)) ||
            (r.url instanceof RegExp && r.url.test(requestUrl))
          const methodMatches = !r.method || r.method === requestMethod
          return urlMatches && methodMatches
        })

        if (matchingResponse) {
          return new Response(JSON.stringify(matchingResponse.response.body), {
            status: matchingResponse.response.status,
            headers: matchingResponse.response.headers,
          })
        }

        return new Response("Not Found", { status: 404 })
      },
    )

    globalThis.fetch = mockFetch

    globalMockContext.addMock({
      restore: () => {
        globalThis.fetch = originalFetch
      },
    })

    return mockFetch
  }
}

/**
 * Mock file system operations
 */
export class FileSystemMocker {
  /**
   * Mock node fs operations
   */
  mockFileSystemOperations(
    config: {
      writeFile?: { shouldSucceed?: boolean; delay?: number }
      readFile?: { shouldSucceed?: boolean; delay?: number; content?: string }
      mkdir?: { shouldSucceed?: boolean; delay?: number }
      rm?: { shouldSucceed?: boolean; delay?: number }
      chmod?: { shouldSucceed?: boolean; delay?: number }
    } = {},
  ) {
    const mocks: any[] = []

    // Mock writeFile
    if (config.writeFile) {
      const { shouldSucceed = true, delay = 0 } = config.writeFile
      const mockWriteFile = mock(async (path: string, data: any) => {
        if (delay > 0)
          await new Promise((resolve) => setTimeout(resolve, delay))
        if (!shouldSucceed) throw new Error(`Failed to write file ${path}`)
        return Promise.resolve()
      })
      mocks.push({ name: "writeFile", mock: mockWriteFile })
    }

    // Mock readFile
    if (config.readFile) {
      const {
        shouldSucceed = true,
        delay = 0,
        content = "test content",
      } = config.readFile
      const mockReadFile = mock(async (path: string) => {
        if (delay > 0)
          await new Promise((resolve) => setTimeout(resolve, delay))
        if (!shouldSucceed) throw new Error(`Failed to read file ${path}`)
        return Buffer.from(content)
      })
      mocks.push({ name: "readFile", mock: mockReadFile })
    }

    // Mock mkdir
    if (config.mkdir) {
      const { shouldSucceed = true, delay = 0 } = config.mkdir
      const mockMkdir = mock(async (path: string) => {
        if (delay > 0)
          await new Promise((resolve) => setTimeout(resolve, delay))
        if (!shouldSucceed)
          throw new Error(`Failed to create directory ${path}`)
        return Promise.resolve()
      })
      mocks.push({ name: "mkdir", mock: mockMkdir })
    }

    // Mock rm
    if (config.rm) {
      const { shouldSucceed = true, delay = 0 } = config.rm
      const mockRm = mock(async (path: string) => {
        if (delay > 0)
          await new Promise((resolve) => setTimeout(resolve, delay))
        if (!shouldSucceed) throw new Error(`Failed to remove ${path}`)
        return Promise.resolve()
      })
      mocks.push({ name: "rm", mock: mockRm })
    }

    // Mock chmod
    if (config.chmod) {
      const { shouldSucceed = true, delay = 0 } = config.chmod
      const mockChmod = mock(async (path: string, mode: number) => {
        if (delay > 0)
          await new Promise((resolve) => setTimeout(resolve, delay))
        if (!shouldSucceed) throw new Error(`Failed to chmod ${path}`)
        return Promise.resolve()
      })
      mocks.push({ name: "chmod", mock: mockChmod })
    }

    return mocks
  }
}

/**
 * Comprehensive test mocker combining all mocking utilities
 */
export class TestMocker {
  bunMocker = new BunMocker()
  projectManagerMocker = new ProjectManagerMocker()
  proxyServiceMocker = new ProxyServiceMocker()
  networkMocker = new NetworkMocker()
  fileSystemMocker = new FileSystemMocker()

  /**
   * Set up all mocks for integration testing
   */
  setupIntegrationMocks(
    config: {
      bun?: Parameters<BunMocker["mockSpawn"]>[0] &
        Parameters<BunMocker["mockServe"]>[0] &
        Parameters<BunMocker["mockWrite"]>[0]
      projectManager?: Parameters<
        ProjectManagerMocker["createMockWithBehavior"]
      >[0]
      proxyService?: Parameters<ProxyServiceMocker["createMockWithBehavior"]>[0]
      network?: Parameters<NetworkMocker["mockFetch"]>[0]
      fileSystem?: Parameters<FileSystemMocker["mockFileSystemOperations"]>[0]
    } = {},
  ) {
    const mocks: any = {}

    // Set up Bun mocks
    if (config.bun) {
      mocks.spawn = this.bunMocker.mockSpawn(config.bun)
      mocks.serve = this.bunMocker.mockServe(config.bun)
      mocks.write = this.bunMocker.mockWrite(config.bun)
    }

    // Set up ProjectManager mock
    if (config.projectManager) {
      mocks.projectManager = this.projectManagerMocker.createMockWithBehavior(
        config.projectManager,
      )
    }

    // Set up ProxyService mock
    if (config.proxyService) {
      mocks.proxyService = this.proxyServiceMocker.createMockWithBehavior(
        config.proxyService,
      )
    }

    // Set up network mocks
    if (config.network) {
      mocks.fetch = this.networkMocker.mockFetch(config.network)
    }

    // Set up file system mocks
    if (config.fileSystem) {
      mocks.fileSystem = this.fileSystemMocker.mockFileSystemOperations(
        config.fileSystem,
      )
    }

    return mocks
  }

  /**
   * Clean up all mocks
   */
  cleanup() {
    globalMockContext.restoreAll()
    this.bunMocker.restoreAll()
  }
}

/**
 * Global test mocker instance
 */
export const testMocker = new TestMocker()

/**
 * Set up automatic cleanup for tests
 */
export function setupMockCleanup() {
  beforeEach(() => {
    // Reset mock context before each test
    globalMockContext.restoreAll()
  })

  afterEach(() => {
    // Clean up after each test
    testMocker.cleanup()
  })
}

/**
 * Helper function to create a complete mock environment
 */
export function createMockEnvironment(
  config: Parameters<TestMocker["setupIntegrationMocks"]>[0] = {},
) {
  return testMocker.setupIntegrationMocks(config)
}
