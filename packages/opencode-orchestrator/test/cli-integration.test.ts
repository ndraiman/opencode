import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { CreateCommand } from "../src/cli/cmd/create.js"
import { ListCommand } from "../src/cli/cmd/list.js"
import { DeleteCommand } from "../src/cli/cmd/delete.js"
import { ProjectManager } from "../src/project-manager.js"
import type { OrchestratorState } from "../src/types.js"
import { cleanupDirectory, generateTestId, withTimeout } from "./helpers/test-utils.js"
import { TestStateFactory } from "./helpers/test-factories.js"
import { TestMocker } from "./helpers/test-mocks.js"

describe("CLI Integration Tests", () => {
  let tempWorkspace: string
  let state: OrchestratorState
  let projectManager: ProjectManager
  let testMocker: TestMocker

  beforeEach(async () => {
    tempWorkspace = join(tmpdir(), `cli-integration-test-${generateTestId()}`)
    await mkdir(tempWorkspace, { recursive: true })
    
    state = TestStateFactory.empty()
    projectManager = new ProjectManager(state, tempWorkspace)
    testMocker = new TestMocker()
    
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

  test("should create, list, and delete project in full workflow", async () => {
    const projectName = "integration-test-project"
    let consoleLogs: string[] = []
    let consoleErrors: string[] = []

    // Mock console to capture all output
    const originalConsoleLog = console.log
    const originalConsoleError = console.error
    
    console.log = (message: string) => {
      consoleLogs.push(message)
      originalConsoleLog(message)
    }
    console.error = (message: string) => {
      consoleErrors.push(message)
      originalConsoleError(message)
    }

    try {
      // Step 1: Create a project
      await CreateCommand.handler({
        name: projectName,
        type: "empty",
        description: "Integration test project",
        workspace: tempWorkspace,
        config: undefined,
      } as any)

      // Verify project was created
      expect(consoleErrors.some(msg => msg.includes("created successfully"))).toBe(true)
      expect(consoleErrors.some(msg => msg.includes(projectName))).toBe(true)

      // Clear console logs for next step
      consoleLogs = []
      consoleErrors = []

      // Step 2: List projects (should show the created project)
      await ListCommand.handler({
        workspace: tempWorkspace,
        format: "table",
        status: undefined,
      } as any)

      // Verify project appears in list
      expect(consoleErrors.some(msg => msg.includes("Found 1 project(s)"))).toBe(true)
      expect(consoleErrors.some(msg => msg.includes(projectName))).toBe(true)
      expect(consoleErrors.some(msg => msg.includes("stopped"))).toBe(true)

      // Clear console logs for next step
      consoleLogs = []
      consoleErrors = []

      // Step 3: Delete the project
      await DeleteCommand.handler({
        project: projectName,
        workspace: tempWorkspace,
        force: false,
        confirm: true,
      } as any)

      // Verify project was deleted
      expect(consoleErrors.some(msg => msg.includes("deleted successfully"))).toBe(true)
      expect(consoleErrors.some(msg => msg.includes(projectName))).toBe(true)

      // Clear console logs for final step
      consoleLogs = []
      consoleErrors = []

      // Step 4: List projects again (should be empty)
      await ListCommand.handler({
        workspace: tempWorkspace,
        format: "table",
        status: undefined,
      } as any)

      // Verify no projects remain
      expect(consoleErrors.some(msg => msg.includes("No projects found"))).toBe(true)

    } finally {
      console.log = originalConsoleLog
      console.error = originalConsoleError
    }
  })

  test("should handle multiple projects creation and management", async () => {
    const projectNames = ["project-1", "project-2", "project-3"]
    let consoleLogs: string[] = []
    let consoleErrors: string[] = []

    const originalConsoleLog = console.log
    const originalConsoleError = console.error
    
    console.log = (message: string) => {
      consoleLogs.push(message)
    }
    console.error = (message: string) => {
      consoleErrors.push(message)
    }

    try {
      // Create multiple projects
      for (const name of projectNames) {
        await CreateCommand.handler({
          name,
          type: "empty",
          description: `Test project ${name}`,
          workspace: tempWorkspace,
          config: undefined,
        } as any)
      }

      // Clear console for list command
      consoleLogs = []
      consoleErrors = []

      // List all projects
      await ListCommand.handler({
        workspace: tempWorkspace,
        format: "table",
        status: undefined,
      } as any)

      // Verify all projects are listed
      expect(consoleErrors.some(msg => msg.includes("Found 3 project(s)"))).toBe(true)
      projectNames.forEach(name => {
        expect(consoleErrors.some(msg => msg.includes(name))).toBe(true)
      })

      // Clear console for deletion
      consoleLogs = []
      consoleErrors = []

      // Delete one project
      await DeleteCommand.handler({
        project: projectNames[0],
        workspace: tempWorkspace,
        force: true,
        confirm: false,
      } as any)

      // Clear console for final list
      consoleLogs = []
      consoleErrors = []

      // List remaining projects
      await ListCommand.handler({
        workspace: tempWorkspace,
        format: "table",
        status: undefined,
      } as any)

      // Verify count decreased
      expect(consoleErrors.some(msg => msg.includes("Found 2 project(s)"))).toBe(true)
      expect(consoleErrors.every(msg => !msg.includes(projectNames[0]))).toBe(true)
      expect(consoleErrors.some(msg => msg.includes(projectNames[1]))).toBe(true)
      expect(consoleErrors.some(msg => msg.includes(projectNames[2]))).toBe(true)

    } finally {
      console.log = originalConsoleLog
      console.error = originalConsoleError
    }
  })

  test("should handle JSON output format in list command", async () => {
    const projectName = "json-test-project"
    let consoleLogs: string[] = []

    const originalConsoleLog = console.log
    const originalConsoleError = console.error
    
    console.log = (message: string) => {
      consoleLogs.push(message)
    }
    console.error = () => {} // Suppress error output for this test

    try {
      // Create a project
      await CreateCommand.handler({
        name: projectName,
        type: "git",
        description: "JSON test project",
        workspace: tempWorkspace,
        config: JSON.stringify({ gitUrl: "https://github.com/test/repo.git" }),
      } as any)

      // Clear console logs
      consoleLogs = []

      // List projects in JSON format
      await ListCommand.handler({
        workspace: tempWorkspace,
        format: "json",
        status: undefined,
      } as any)

      // Verify JSON output
      const jsonOutput = consoleLogs.join("")
      expect(() => JSON.parse(jsonOutput)).not.toThrow()
      
      const projects = JSON.parse(jsonOutput)
      expect(projects).toHaveLength(1)
      expect(projects[0].name).toBe(projectName)
      expect(projects[0].type).toBe("git")
      expect(projects[0].config.gitUrl).toBe("https://github.com/test/repo.git")

    } finally {
      console.log = originalConsoleLog
      console.error = originalConsoleError
    }
  })

  test("should handle project filtering by status", async () => {
    let consoleErrors: string[] = []

    const originalConsoleLog = console.log
    const originalConsoleError = console.error
    
    console.log = () => {} // Suppress log output
    console.error = (message: string) => {
      consoleErrors.push(message)
    }

    try {
      // Create projects
      await CreateCommand.handler({
        name: "stopped-project",
        type: "empty",
        workspace: tempWorkspace,
        config: undefined,
      } as any)

      // Clear console
      consoleErrors = []

      // List only stopped projects
      await ListCommand.handler({
        workspace: tempWorkspace,
        format: "table",
        status: "stopped",
      } as any)

      // Verify filtering works
      expect(consoleErrors.some(msg => msg.includes("Found 1 project(s)"))).toBe(true)
      expect(consoleErrors.some(msg => msg.includes("stopped-project"))).toBe(true)

      // Clear console
      consoleErrors = []

      // List running projects (should be none)
      await ListCommand.handler({
        workspace: tempWorkspace,
        format: "table",
        status: "running",
      } as any)

      // Verify no running projects
      expect(consoleErrors.some(msg => msg.includes('No projects found with status "running"'))).toBe(true)

    } finally {
      console.log = originalConsoleLog
      console.error = originalConsoleError
    }
  })

  test("should handle error cases gracefully", async () => {
    let consoleErrors: string[] = []
    const originalConsoleLog = console.log
    const originalConsoleError = console.error
    const originalProcessExit = process.exit
    
    let exitCode = 0

    console.log = () => {} // Suppress log output
    console.error = (message: string) => {
      consoleErrors.push(message)
    }
    process.exit = ((code: number) => {
      exitCode = code
      throw new Error(`Process exit with code ${code}`)
    }) as any

    try {
      // Test 1: Create project with invalid JSON config
      try {
        await CreateCommand.handler({
          name: "invalid-config-project",
          type: "empty",
          workspace: tempWorkspace,
          config: "invalid json",
        } as any)
        expect(false).toBe(true) // Should not reach here
      } catch (error) {
        expect(exitCode).toBe(1)
        expect(consoleErrors.some(msg => msg.includes("Invalid JSON"))).toBe(true)
      }

      // Reset for next test
      exitCode = 0
      consoleErrors = []

      // Test 2: Delete non-existent project
      try {
        await DeleteCommand.handler({
          project: "non-existent",
          workspace: tempWorkspace,
          force: false,
          confirm: false,
        } as any)
        expect(false).toBe(true) // Should not reach here
      } catch (error) {
        expect(exitCode).toBe(1)
        expect(consoleErrors.some(msg => msg.includes("Project not found"))).toBe(true)
      }

      // Reset for next test
      exitCode = 0
      consoleErrors = []

      // Test 3: Delete project without confirmation
      // First create a project
      await CreateCommand.handler({
        name: "no-confirm-project",
        type: "empty",
        workspace: tempWorkspace,
        config: undefined,
      } as any)

      consoleErrors = [] // Clear creation messages

      try {
        await DeleteCommand.handler({
          project: "no-confirm-project",
          workspace: tempWorkspace,
          force: false,
          confirm: false,
        } as any)
        expect(false).toBe(true) // Should not reach here
      } catch (error) {
        expect(exitCode).toBe(1)
        expect(consoleErrors.some(msg => msg.includes("Deletion cancelled"))).toBe(true)
      }

    } finally {
      console.log = originalConsoleLog
      console.error = originalConsoleError
      process.exit = originalProcessExit
    }
  })

  test("should handle concurrent operations safely", async () => {
    const projectNames = ["concurrent-1", "concurrent-2", "concurrent-3"]
    
    const originalConsole = { log: console.log, error: console.error }
    console.log = () => {} // Suppress output
    console.error = () => {}

    try {
      // Create multiple projects concurrently
      await withTimeout(
        Promise.all(
          projectNames.map(name =>
            CreateCommand.handler({
              name,
              type: "empty",
              workspace: tempWorkspace,
              config: undefined,
            } as any)
          )
        ),
        10000 // 10 second timeout
      )

      // Verify all projects were created
      const consoleLogs: string[] = []
      console.log = (message: string) => consoleLogs.push(message)

      await ListCommand.handler({
        workspace: tempWorkspace,
        format: "json",
        status: undefined,
      } as any)

      const projects = JSON.parse(consoleLogs.join(""))
      expect(projects).toHaveLength(3)
      
      projectNames.forEach(name => {
        expect(projects.some((p: any) => p.name === name)).toBe(true)
      })

    } finally {
      console.log = originalConsole.log
      console.error = originalConsole.error
    }
  })

  test("should maintain data consistency across operations", async () => {
    const projectName = "consistency-test"
    let projects: any[] = []

    const originalConsole = { log: console.log, error: console.error }
    console.log = () => {} // Suppress most output
    console.error = () => {}

    try {
      // Create project
      await CreateCommand.handler({
        name: projectName,
        type: "git",
        description: "Consistency test project",
        workspace: tempWorkspace,
        config: JSON.stringify({ 
          gitUrl: "https://github.com/test/repo.git",
          gitBranch: "main" 
        }),
      } as any)

      // Get project list in JSON format
      const consoleLogs: string[] = []
      console.log = (message: string) => consoleLogs.push(message)

      await ListCommand.handler({
        workspace: tempWorkspace,
        format: "json",
        status: undefined,
      } as any)

      projects = JSON.parse(consoleLogs.join(""))
      expect(projects).toHaveLength(1)

      const project = projects[0]
      expect(project.name).toBe(projectName)
      expect(project.type).toBe("git")
      expect(project.description).toBe("Consistency test project")
      expect(project.status).toBe("stopped")
      expect(project.config.gitUrl).toBe("https://github.com/test/repo.git")
      expect(project.config.gitBranch).toBe("main")
      expect(project.id).toBeDefined()
      expect(project.path).toBeDefined()
      expect(project.createdAt).toBeDefined()
      expect(project.updatedAt).toBeDefined()

      // Reset console
      console.log = () => {}
      console.error = () => {}

      // Delete project
      await DeleteCommand.handler({
        project: projectName,
        workspace: tempWorkspace,
        force: true,
        confirm: false,
      } as any)

      // Verify project is gone
      const finalLogs: string[] = []
      console.log = (message: string) => finalLogs.push(message)

      await ListCommand.handler({
        workspace: tempWorkspace,
        format: "json",
        status: undefined,
      } as any)

      const finalProjects = JSON.parse(finalLogs.join(""))
      expect(finalProjects).toHaveLength(0)

    } finally {
      console.log = originalConsole.log
      console.error = originalConsole.error
    }
  })

  test("should handle workspace directory creation", async () => {
    const nonExistentWorkspace = join(tmpdir(), `non-existent-${generateTestId()}`)
    
    const originalConsole = { log: console.log, error: console.error }
    console.log = () => {}
    console.error = () => {}

    try {
      // Create project in non-existent workspace (should create directory)
      await CreateCommand.handler({
        name: "workspace-test",
        type: "empty",
        workspace: nonExistentWorkspace,
        config: undefined,
      } as any)

      // Verify workspace was created and project exists
      const consoleLogs: string[] = []
      console.log = (message: string) => consoleLogs.push(message)

      await ListCommand.handler({
        workspace: nonExistentWorkspace,
        format: "json",
        status: undefined,
      } as any)

      const projects = JSON.parse(consoleLogs.join(""))
      expect(projects).toHaveLength(1)
      expect(projects[0].name).toBe("workspace-test")

      // Clean up the non-existent workspace
      await cleanupDirectory(nonExistentWorkspace)

    } finally {
      console.log = originalConsole.log
      console.error = originalConsole.error
    }
  })

  test("should validate command configurations", () => {
    // Test Create command configuration
    expect(CreateCommand.command).toBe("create <name>")
    expect(CreateCommand.describe).toBe("Create a new OpenCode project")
    expect(CreateCommand.builder).toBeDefined()
    expect(CreateCommand.handler).toBeDefined()

    // Test List command configuration
    expect(ListCommand.command).toBe("list")
    expect(ListCommand.describe).toBe("List all OpenCode projects")
    expect(ListCommand.aliases).toContain("ls")
    expect(ListCommand.builder).toBeDefined()
    expect(ListCommand.handler).toBeDefined()

    // Test Delete command configuration
    expect(DeleteCommand.command).toBe("delete <project>")
    expect(DeleteCommand.describe).toBe("Delete an OpenCode project")
    expect(DeleteCommand.aliases).toContain("rm")
    expect(DeleteCommand.aliases).toContain("remove")
    expect(DeleteCommand.builder).toBeDefined()
    expect(DeleteCommand.handler).toBeDefined()
  })
})