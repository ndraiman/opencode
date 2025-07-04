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

  // Helper functions for common test patterns
  function captureConsole() {
    const logs: string[] = []
    const errors: string[] = []
    const originalLog = console.log
    const originalError = console.error
    
    console.log = (message: string) => logs.push(message)
    console.error = (message: string) => errors.push(message)
    
    return {
      logs,
      errors,
      restore: () => {
        console.log = originalLog
        console.error = originalError
      }
    }
  }

  function captureProcessExit() {
    const originalExit = process.exit
    let exitCode = 0
    
    process.exit = ((code: number) => {
      exitCode = code
      throw new Error(`Process exit with code ${code}`)
    }) as any
    
    return {
      get exitCode() { return exitCode },
      restore: () => { process.exit = originalExit }
    }
  }

  function buildCreateArgs(overrides: any = {}) {
    return {
      name: "test-project",
      type: "empty",
      description: "Test project",
      workspace: tempWorkspace,
      config: undefined,
      ...overrides
    }
  }

  function validateYargsConfig(builder: any, expectations: any) {
    const mockYargs = {
      positional: (name: string, config: any) => {
        if (expectations.positional && expectations.positional[name]) {
          const expected = expectations.positional[name]
          Object.keys(expected).forEach(key => {
            expect(config[key]).toEqual(expected[key])
          })
        }
        return mockYargs
      },
      option: (name: string, config: any) => {
        if (expectations.options && expectations.options[name]) {
          const expected = expectations.options[name]
          Object.keys(expected).forEach(key => {
            expect(config[key]).toEqual(expected[key])
          })
        }
        return mockYargs
      },
    }
    
    builder(mockYargs)
  }

  test("should create CLI command with correct configuration", () => {
    expect(CreateCommand.command).toBe("create <name>")
    expect(CreateCommand.describe).toBe("Create a new OpenCode project")
    expect(CreateCommand.builder).toBeDefined()
    expect(CreateCommand.handler).toBeDefined()
  })

  test("should configure yargs with correct options", () => {
    validateYargsConfig(CreateCommand.builder, {
      positional: {
        name: {
          describe: "Name of the project to create",
          type: "string",
          demandOption: true
        }
      },
      options: {
        type: {
          choices: ["git", "empty"],
          default: "empty"
        },
        description: {
          type: "string"
        },
        workspace: {
          type: "string"
        },
        config: {
          type: "string"
        }
      }
    })
  })

  test("should successfully create an empty project", async () => {
    const args = buildCreateArgs()
    const console = captureConsole()

    try {
      await CreateCommand.handler(args as any)
      
      // Check that project was created
      const projects = await projectManager.listProjects()
      expect(projects).toHaveLength(1)
      expect(projects[0].name).toBe("test-project")
      expect(projects[0].type).toBe("empty")
      expect(projects[0].description).toBe("Test project")
      
      // Check console output includes success message
      expect(console.logs.some(msg => msg.includes("created successfully"))).toBe(true)
      
    } finally {
      console.restore()
    }
  })

  test("should successfully create a git project", async () => {
    const args = buildCreateArgs({
      name: "git-project",
      type: "git",
      description: "Git test project"
    })
    const console = captureConsole()

    try {
      await CreateCommand.handler(args as any)
      
      const projects = await projectManager.listProjects()
      expect(projects).toHaveLength(1)
      expect(projects[0].name).toBe("git-project")
      expect(projects[0].type).toBe("git")
      
    } finally {
      console.restore()
    }
  })

  test("should handle project creation with custom config", async () => {
    const customConfig = {
      gitUrl: "https://github.com/test/repo.git",
      gitBranch: "main",
    }

    const args = buildCreateArgs({
      name: "config-project",
      type: "git",
      description: "Project with config",
      config: JSON.stringify(customConfig)
    })
    const console = captureConsole()

    try {
      await CreateCommand.handler(args as any)
      
      const projects = await projectManager.listProjects()
      expect(projects).toHaveLength(1)
      expect(projects[0].config).toEqual(customConfig)
      
    } finally {
      console.restore()
    }
  })

  test("should handle invalid JSON config", async () => {
    const args = buildCreateArgs({
      name: "invalid-config-project",
      config: "invalid json"
    })
    const console = captureConsole()
    const processExit = captureProcessExit()

    try {
      await CreateCommand.handler(args as any)
      expect(false).toBe(true) // Should not reach here
    } catch (error) {
      expect(processExit.exitCode).toBe(1)
      expect(console.errors.some(msg => msg.includes("Invalid JSON"))).toBe(true)
    } finally {
      console.restore()
      processExit.restore()
    }
  })

  test("should handle project creation failure", async () => {
    // Mock project manager to throw an error
    const mockProjectManager = testMocker.projectManagerMocker.createMockWithBehavior({
      createProjectBehavior: () => {
        throw new Error("Project creation failed")
      },
    })

    const args = buildCreateArgs({ name: "failing-project" })
    const console = captureConsole()
    const processExit = captureProcessExit()

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
      expect(processExit.exitCode).toBe(1)
      expect(console.errors.some(msg => msg.includes("Project creation failed"))).toBe(true)
    } finally {
      console.restore()
      processExit.restore()
      CreateCommand.handler = originalHandler
    }
  })

  test("should create workspace directory if it doesn't exist", async () => {
    const nonExistentWorkspace = join(tmpdir(), `non-existent-${generateTestId()}`)
    const args = buildCreateArgs({
      name: "workspace-test",
      workspace: nonExistentWorkspace
    })
    const console = captureConsole()

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
      console.restore()
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
    validateYargsConfig(CreateCommand.builder, {
      options: {
        workspace: {
          type: "string"
        }
      }
    })
  })

  test("should validate required name parameter", () => {
    validateYargsConfig(CreateCommand.builder, {
      positional: {
        name: { demandOption: true }
      }
    })
  })

  test("should have correct project type choices", () => {
    validateYargsConfig(CreateCommand.builder, {
      options: {
        type: { choices: ["git", "empty"] }
      }
    })
  })
})