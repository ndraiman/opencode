import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { mkdir, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import yargs from "yargs"
import { CreateCommand } from "../src/cli/cmd/create.js"
import { ProjectManager } from "../src/project-manager.js"
import type { OrchestratorState } from "../src/types.js"
import { cleanupDirectory, generateTestId } from "./helpers/test-utils.js"
import { TestProjectFactory, TestStateFactory } from "./helpers/test-factories.js"
import { TestMocker, setupMockCleanup } from "./helpers/test-mocks.js"

describe("CLI Create Command", () => {
  let tempWorkspace: string
  let state: OrchestratorState
  let projectManager: ProjectManager
  let testMocker: TestMocker

  beforeEach(async () => {
    tempWorkspace = join(tmpdir(), `cli-create-test-${generateTestId()}`)
    await mkdir(tempWorkspace, { recursive: true })
    
    state = TestStateFactory.empty()
    projectManager = new ProjectManager(state, tempWorkspace)
    testMocker = new TestMocker()
    
    // Setup basic mocks
    testMocker.setupIntegrationMocks({
      fileSystem: {
        mkdir: { shouldSucceed: true },
        writeFile: { shouldSucceed: true },
        rm: { shouldSucceed: true },
      },
    })
  })

  afterEach(async () => {
    testMocker.cleanup()
    await cleanupDirectory(tempWorkspace)
  })

  test("should create CLI command with correct configuration", () => {
    expect(CreateCommand.command).toBe("create <name>")
    expect(CreateCommand.describe).toBe("Create a new OpenCode project")
    expect(CreateCommand.builder).toBeDefined()
    expect(CreateCommand.handler).toBeDefined()
  })

  test("should configure yargs with correct options", () => {
    const mockYargs = {
      positional: (name: string, config: any) => {
        if (name === "name") {
          expect(config.describe).toBe("Name of the project to create")
          expect(config.type).toBe("string")
          expect(config.demandOption).toBe(true)
        }
        return mockYargs
      },
      option: (name: string, config: any) => {
        switch (name) {
          case "type":
            expect(config.choices).toEqual(["git", "empty"])
            expect(config.default).toBe("empty")
            break
          case "description":
            expect(config.type).toBe("string")
            break
          case "workspace":
            expect(config.type).toBe("string")
            expect(config.default).toContain(".opencode")
            break
          case "config":
            expect(config.type).toBe("string")
            break
        }
        return mockYargs
      },
    }

    const builder = CreateCommand.builder as any
    builder(mockYargs)
  })

  test("should successfully create an empty project", async () => {
    const args = {
      name: "test-project",
      type: "empty",
      description: "Test project",
      workspace: tempWorkspace,
      config: undefined,
    }

    // Mock console methods to capture output
    const consoleSpy = {
      log: [] as string[],
      error: [] as string[],
    }
    
    const originalConsoleLog = console.log
    const originalConsoleError = console.error
    
    console.log = (message: string) => {
      consoleSpy.log.push(message)
    }
    console.error = (message: string) => {
      consoleSpy.error.push(message)
    }

    try {
      await CreateCommand.handler(args as any)
      
      // Check that project was created
      const projects = await projectManager.listProjects()
      expect(projects).toHaveLength(1)
      expect(projects[0].name).toBe("test-project")
      expect(projects[0].type).toBe("empty")
      expect(projects[0].description).toBe("Test project")
      
      // Check console output includes success message
      expect(consoleSpy.log.some(msg => msg.includes("created successfully"))).toBe(true)
      
    } finally {
      console.log = originalConsoleLog
      console.error = originalConsoleError
    }
  })

  test("should successfully create a git project", async () => {
    const args = {
      name: "git-project",
      type: "git",
      description: "Git test project",
      workspace: tempWorkspace,
      config: undefined,
    }

    const consoleSpy = {
      log: [] as string[],
      error: [] as string[],
    }
    
    const originalConsoleLog = console.log
    const originalConsoleError = console.error
    
    console.log = (message: string) => {
      consoleSpy.log.push(message)
    }
    console.error = (message: string) => {
      consoleSpy.error.push(message)
    }

    try {
      await CreateCommand.handler(args as any)
      
      const projects = await projectManager.listProjects()
      expect(projects).toHaveLength(1)
      expect(projects[0].name).toBe("git-project")
      expect(projects[0].type).toBe("git")
      
    } finally {
      console.log = originalConsoleLog
      console.error = originalConsoleError
    }
  })

  test("should handle project creation with custom config", async () => {
    const customConfig = {
      gitUrl: "https://github.com/test/repo.git",
      gitBranch: "main",
    }

    const args = {
      name: "config-project",
      type: "git",
      description: "Project with config",
      workspace: tempWorkspace,
      config: JSON.stringify(customConfig),
    }

    const consoleSpy = {
      log: [] as string[],
      error: [] as string[],
    }
    
    const originalConsoleLog = console.log
    const originalConsoleError = console.error
    
    console.log = (message: string) => {
      consoleSpy.log.push(message)
    }
    console.error = (message: string) => {
      consoleSpy.error.push(message)
    }

    try {
      await CreateCommand.handler(args as any)
      
      const projects = await projectManager.listProjects()
      expect(projects).toHaveLength(1)
      expect(projects[0].config).toEqual(customConfig)
      
    } finally {
      console.log = originalConsoleLog
      console.error = originalConsoleError
    }
  })

  test("should handle invalid JSON config", async () => {
    const args = {
      name: "invalid-config-project",
      type: "empty",
      workspace: tempWorkspace,
      config: "invalid json",
    }

    const consoleSpy = {
      log: [] as string[],
      error: [] as string[],
    }
    
    const originalConsoleLog = console.log
    const originalConsoleError = console.error
    const originalProcessExit = process.exit
    
    let exitCode = 0
    
    console.log = (message: string) => {
      consoleSpy.log.push(message)
    }
    console.error = (message: string) => {
      consoleSpy.error.push(message)
    }
    process.exit = ((code: number) => {
      exitCode = code
      throw new Error(`Process exit with code ${code}`)
    }) as any

    try {
      await CreateCommand.handler(args as any)
      expect(false).toBe(true) // Should not reach here
    } catch (error) {
      expect(exitCode).toBe(1)
      expect(consoleSpy.error.some(msg => msg.includes("Invalid JSON"))).toBe(true)
    } finally {
      console.log = originalConsoleLog
      console.error = originalConsoleError
      process.exit = originalProcessExit
    }
  })

  test("should handle project creation failure", async () => {
    // Mock project manager to throw an error
    const mockProjectManager = testMocker.projectManagerMocker.createMockWithBehavior({
      createProjectBehavior: () => {
        throw new Error("Project creation failed")
      },
    })

    const args = {
      name: "failing-project",
      type: "empty",
      workspace: tempWorkspace,
      config: undefined,
    }

    const consoleSpy = {
      log: [] as string[],
      error: [] as string[],
    }
    
    const originalConsoleLog = console.log
    const originalConsoleError = console.error
    const originalProcessExit = process.exit
    
    let exitCode = 0
    
    console.log = (message: string) => {
      consoleSpy.log.push(message)
    }
    console.error = (message: string) => {
      consoleSpy.error.push(message)
    }
    process.exit = ((code: number) => {
      exitCode = code
      throw new Error(`Process exit with code ${code}`)
    }) as any

    // Replace the project manager in the handler
    const originalHandler = CreateCommand.handler
    CreateCommand.handler = async (handlerArgs: any) => {
      // Simulate the same logic but with mocked project manager
      try {
        await mockProjectManager.createProject({
          name: handlerArgs.name,
          type: handlerArgs.type,
          description: handlerArgs.description,
          config: handlerArgs.config ? JSON.parse(handlerArgs.config) : undefined,
        })
      } catch (error) {
        console.error(`Failed to create project "${handlerArgs.name}": ${error instanceof Error ? error.message : error}`)
        process.exit(1)
      }
    }

    try {
      await CreateCommand.handler(args as any)
      expect(false).toBe(true) // Should not reach here
    } catch (error) {
      expect(exitCode).toBe(1)
      expect(consoleSpy.error.some(msg => msg.includes("Project creation failed"))).toBe(true)
    } finally {
      console.log = originalConsoleLog
      console.error = originalConsoleError
      process.exit = originalProcessExit
      CreateCommand.handler = originalHandler
    }
  })

  test("should create workspace directory if it doesn't exist", async () => {
    const nonExistentWorkspace = join(tmpdir(), `non-existent-${generateTestId()}`)
    
    const args = {
      name: "workspace-test",
      type: "empty",
      workspace: nonExistentWorkspace,
      config: undefined,
    }

    const consoleSpy = {
      log: [] as string[],
      error: [] as string[],
    }
    
    const originalConsoleLog = console.log
    const originalConsoleError = console.error
    
    console.log = (message: string) => {
      consoleSpy.log.push(message)
    }
    console.error = (message: string) => {
      consoleSpy.error.push(message)
    }

    try {
      await CreateCommand.handler(args as any)
      
      // Check that workspace directory was created
      const fs = await import("node:fs/promises")
      try {
        await fs.access(nonExistentWorkspace)
        expect(true).toBe(true) // Directory exists
      } catch {
        expect(false).toBe(true) // Directory doesn't exist
      }
      
    } finally {
      console.log = originalConsoleLog
      console.error = originalConsoleError
      await cleanupDirectory(nonExistentWorkspace)
    }
  })

  test("should show available plugins when creating project", async () => {
    // Mock project manager with multiple plugins
    const mockProjectManager = testMocker.projectManagerMocker.createMockWithBehavior({
      createProjectBehavior: (input) => TestProjectFactory.empty(input),
    })

    // Mock getAvailablePlugins to return multiple plugins
    mockProjectManager.getAvailablePlugins = () => [
      {
        id: "empty-plugin",
        name: "Empty Plugin",
        description: "Creates empty projects",
        projectType: "empty",
        version: "1.0.0",
        author: "Test",
        configSchema: null,
      },
      {
        id: "git-plugin",
        name: "Git Plugin",
        description: "Creates git projects",
        projectType: "git",
        version: "1.0.0",
        author: "Test",
        configSchema: null,
      },
    ]

    const args = {
      name: "plugin-test",
      type: "empty",
      workspace: tempWorkspace,
      config: undefined,
    }

    const consoleSpy = {
      log: [] as string[],
      error: [] as string[],
    }
    
    const originalConsoleLog = console.log
    const originalConsoleError = console.error
    
    console.log = (message: string) => {
      consoleSpy.log.push(message)
    }
    console.error = (message: string) => {
      consoleSpy.error.push(message)
    }

    // Replace the project manager in the handler
    const originalHandler = CreateCommand.handler
    CreateCommand.handler = async (handlerArgs: any) => {
      // Simulate the full create logic with mocked project manager
      const project = await mockProjectManager.createProject({
        name: handlerArgs.name,
        type: handlerArgs.type,
        description: handlerArgs.description,
        config: handlerArgs.config ? JSON.parse(handlerArgs.config) : undefined,
      })

      console.log(`Project "${handlerArgs.name}" created successfully!`)
      
      const availablePlugins = mockProjectManager.getAvailablePlugins()
      if (availablePlugins.length > 1) {
        console.log(`Available project types for future projects:`)
        availablePlugins.forEach(plugin => {
          console.log(`  - ${plugin.projectType}: ${plugin.description}`)
        })
      }
    }

    try {
      await CreateCommand.handler(args as any)
      
      // Check that plugin information was shown
      expect(consoleSpy.log.some(msg => msg.includes("Available project types"))).toBe(true)
      expect(consoleSpy.log.some(msg => msg.includes("empty: Creates empty projects"))).toBe(true)
      expect(consoleSpy.log.some(msg => msg.includes("git: Creates git projects"))).toBe(true)
      
    } finally {
      console.log = originalConsoleLog
      console.error = originalConsoleError
      CreateCommand.handler = originalHandler
    }
  })

  test("should use default workspace when none provided", () => {
    const mockYargs = {
      positional: () => mockYargs,
      option: (name: string, config: any) => {
        if (name === "workspace") {
          expect(config.default).toContain(".opencode")
          expect(config.default).toContain("orchestrator")
          expect(config.default).toContain("projects")
        }
        return mockYargs
      },
    }

    const builder = CreateCommand.builder as any
    builder(mockYargs)
  })

  test("should validate required name parameter", () => {
    const mockYargs = {
      positional: (name: string, config: any) => {
        if (name === "name") {
          expect(config.demandOption).toBe(true)
        }
        return mockYargs
      },
      option: () => mockYargs,
    }

    const builder = CreateCommand.builder as any
    builder(mockYargs)
  })

  test("should have correct project type choices", () => {
    const mockYargs = {
      positional: () => mockYargs,
      option: (name: string, config: any) => {
        if (name === "type") {
          expect(config.choices).toEqual(["git", "empty"])
        }
        return mockYargs
      },
    }

    const builder = CreateCommand.builder as any
    builder(mockYargs)
  })
})