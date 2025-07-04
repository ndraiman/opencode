import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { DeleteCommand } from "../src/cli/cmd/delete.js"
import { ProjectManager } from "../src/project-manager.js"
import type { OrchestratorState } from "../src/types.js"
import { cleanupDirectory, generateTestId } from "./helpers/test-utils.js"
import { TestProjectStateFactory, TestStateFactory } from "./helpers/test-factories.js"
import { TestMocker } from "./helpers/test-mocks.js"

describe("CLI Delete Command", () => {
  let tempWorkspace: string
  let state: OrchestratorState
  let projectManager: ProjectManager
  let testMocker: TestMocker

  beforeEach(async () => {
    tempWorkspace = join(tmpdir(), `cli-delete-test-${generateTestId()}`)
    await mkdir(tempWorkspace, { recursive: true })
    
    state = TestStateFactory.empty()
    projectManager = new ProjectManager(state, tempWorkspace)
    testMocker = new TestMocker()
    
    testMocker.setupIntegrationMocks({
      fileSystem: {
        rm: { shouldSucceed: true },
      },
    })
  })

  afterEach(async () => {
    testMocker.cleanup()
    await cleanupDirectory(tempWorkspace)
  })

  test("should create CLI command with correct configuration", () => {
    expect(DeleteCommand.command).toBe("delete <project>")
    expect(DeleteCommand.describe).toBe("Delete an OpenCode project")
    expect(DeleteCommand.aliases).toContain("rm")
    expect(DeleteCommand.aliases).toContain("remove")
    expect(DeleteCommand.builder).toBeDefined()
    expect(DeleteCommand.handler).toBeDefined()
  })

  test("should configure yargs with correct options", () => {
    const mockYargs = {
      positional: (name: string, config: any) => {
        if (name === "project") {
          expect(config.describe).toBe("Project ID or name to delete")
          expect(config.type).toBe("string")
          expect(config.demandOption).toBe(true)
        }
        return mockYargs
      },
      option: (name: string, config: any) => {
        switch (name) {
          case "workspace":
            expect(config.type).toBe("string")
            expect(config.default).toContain(".opencode")
            break
          case "force":
            expect(config.type).toBe("boolean")
            expect(config.default).toBe(false)
            break
          case "confirm":
            expect(config.type).toBe("boolean")
            expect(config.default).toBe(false)
            break
        }
        return mockYargs
      },
    }

    const builder = DeleteCommand.builder as any
    builder(mockYargs)
  })

  test("should show error when project not found", async () => {
    const args = {
      project: "non-existent-project",
      workspace: tempWorkspace,
      force: false,
      confirm: false,
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
      await DeleteCommand.handler(args as any)
      expect(false).toBe(true) // Should not reach here
    } catch (error) {
      expect(exitCode).toBe(1)
      expect(consoleSpy.error.some(msg => msg.includes("Project not found"))).toBe(true)
      expect(consoleSpy.error.some(msg => msg.includes("non-existent-project"))).toBe(true)
    } finally {
      console.log = originalConsoleLog
      console.error = originalConsoleError
      process.exit = originalProcessExit
    }
  })

  test("should show available projects when project not found", async () => {
    // Add some projects to show in the list
    const projects = [
      TestProjectStateFactory.stopped({ name: "available-project-1" }),
      TestProjectStateFactory.stopped({ name: "available-project-2" }),
    ]
    
    projects.forEach(project => state.projects.set(project.id, project))

    const args = {
      project: "non-existent-project",
      workspace: tempWorkspace,
      force: false,
      confirm: false,
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
      await DeleteCommand.handler(args as any)
      expect(false).toBe(true) // Should not reach here
    } catch (error) {
      expect(exitCode).toBe(1)
      expect(consoleSpy.error.some(msg => msg.includes("Available projects"))).toBe(true)
      expect(consoleSpy.error.some(msg => msg.includes("available-project-1"))).toBe(true)
      expect(consoleSpy.error.some(msg => msg.includes("available-project-2"))).toBe(true)
    } finally {
      console.log = originalConsoleLog
      console.error = originalConsoleError
      process.exit = originalProcessExit
    }
  })

  test("should find project by name", async () => {
    const project = TestProjectStateFactory.stopped({ name: "test-project" })
    state.projects.set(project.id, project)

    const args = {
      project: "test-project",
      workspace: tempWorkspace,
      force: false,
      confirm: true, // Confirm to proceed with deletion
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
      await DeleteCommand.handler(args as any)
      
      expect(consoleSpy.error.some(msg => msg.includes("deleted successfully"))).toBe(true)
      expect(consoleSpy.error.some(msg => msg.includes("test-project"))).toBe(true)
      
    } finally {
      console.log = originalConsoleLog
      console.error = originalConsoleError
    }
  })

  test("should find project by ID", async () => {
    const project = TestProjectStateFactory.stopped({ name: "test-project" })
    state.projects.set(project.id, project)

    const args = {
      project: project.id,
      workspace: tempWorkspace,
      force: false,
      confirm: true, // Confirm to proceed with deletion
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
      await DeleteCommand.handler(args as any)
      
      expect(consoleSpy.error.some(msg => msg.includes("deleted successfully"))).toBe(true)
      expect(consoleSpy.error.some(msg => msg.includes("test-project"))).toBe(true)
      
    } finally {
      console.log = originalConsoleLog
      console.error = originalConsoleError
    }
  })

  test("should require confirmation when neither force nor confirm is set", async () => {
    const project = TestProjectStateFactory.stopped({ name: "test-project" })
    state.projects.set(project.id, project)

    const args = {
      project: "test-project",
      workspace: tempWorkspace,
      force: false,
      confirm: false,
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
      await DeleteCommand.handler(args as any)
      expect(false).toBe(true) // Should not reach here
    } catch (error) {
      expect(exitCode).toBe(1)
      expect(consoleSpy.error.some(msg => msg.includes("Deletion cancelled"))).toBe(true)
      expect(consoleSpy.error.some(msg => msg.includes("--force or --confirm"))).toBe(true)
    } finally {
      console.log = originalConsoleLog
      console.error = originalConsoleError
      process.exit = originalProcessExit
    }
  })

  test("should proceed with force flag", async () => {
    const project = TestProjectStateFactory.stopped({ name: "test-project" })
    state.projects.set(project.id, project)

    const args = {
      project: "test-project",
      workspace: tempWorkspace,
      force: true,
      confirm: false,
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
      await DeleteCommand.handler(args as any)
      
      expect(consoleSpy.error.some(msg => msg.includes("deleted successfully"))).toBe(true)
      
    } finally {
      console.log = originalConsoleLog
      console.error = originalConsoleError
    }
  })

  test("should proceed with confirm flag", async () => {
    const project = TestProjectStateFactory.stopped({ name: "test-project" })
    state.projects.set(project.id, project)

    const args = {
      project: "test-project",
      workspace: tempWorkspace,
      force: false,
      confirm: true,
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
      await DeleteCommand.handler(args as any)
      
      expect(consoleSpy.error.some(msg => msg.includes("deleted successfully"))).toBe(true)
      
    } finally {
      console.log = originalConsoleLog
      console.error = originalConsoleError
    }
  })

  test("should show project details before deletion", async () => {
    const project = TestProjectStateFactory.stopped({
      name: "detailed-project",
      description: "A project with details",
      type: "git",
    })
    state.projects.set(project.id, project)

    const args = {
      project: "detailed-project",
      workspace: tempWorkspace,
      force: false,
      confirm: true,
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
      await DeleteCommand.handler(args as any)
      
      const output = consoleSpy.error.join("\n")
      
      // Check that project details are shown
      expect(output).toContain("Project to delete")
      expect(output).toContain("detailed-project")
      expect(output).toContain("A project with details")
      expect(output).toContain("git")
      expect(output).toContain(project.id)
      expect(output).toContain(project.path)
      
    } finally {
      console.log = originalConsoleLog
      console.error = originalConsoleError
    }
  })

  test("should warn when deleting running project", async () => {
    const project = TestProjectStateFactory.running({
      name: "running-project",
      port: 4000,
      pid: 12345,
    })
    state.projects.set(project.id, project)

    const args = {
      project: "running-project",
      workspace: tempWorkspace,
      force: false,
      confirm: true,
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
      await DeleteCommand.handler(args as any)
      
      const output = consoleSpy.error.join("\n")
      
      // Check that warning is shown
      expect(output).toContain("currently running")
      expect(output).toContain("stopped before deletion")
      expect(output).toContain("Stopping running project")
      
    } finally {
      console.log = originalConsoleLog
      console.error = originalConsoleError
    }
  })

  test("should show remaining project count after deletion", async () => {
    // Add multiple projects
    const projects = [
      TestProjectStateFactory.stopped({ name: "project-to-delete" }),
      TestProjectStateFactory.stopped({ name: "remaining-project-1" }),
      TestProjectStateFactory.stopped({ name: "remaining-project-2" }),
    ]
    
    projects.forEach(project => state.projects.set(project.id, project))

    const args = {
      project: "project-to-delete",
      workspace: tempWorkspace,
      force: false,
      confirm: true,
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
      await DeleteCommand.handler(args as any)
      
      const output = consoleSpy.error.join("\n")
      
      // Check that remaining count is shown (should be 2 after deleting 1 of 3)
      expect(output).toContain("Remaining projects: 2")
      
    } finally {
      console.log = originalConsoleLog
      console.error = originalConsoleError
    }
  })

  test("should handle deletion errors gracefully", async () => {
    const project = TestProjectStateFactory.stopped({ name: "failing-project" })
    state.projects.set(project.id, project)

    // Mock project manager to throw an error
    const mockProjectManager = testMocker.projectManagerMocker.createMockWithBehavior({
      shouldFailOperations: ["deleteProject"],
    })

    mockProjectManager.deleteProject = () => {
      throw new Error("Deletion failed")
    }

    // Mock listProjects to return our project
    mockProjectManager.listProjects = async () => [project]

    const args = {
      project: "failing-project",
      workspace: tempWorkspace,
      force: false,
      confirm: true,
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

    // Replace the handler with one that uses our mock
    const originalHandler = DeleteCommand.handler
    DeleteCommand.handler = async (handlerArgs: any) => {
      try {
        const projects = await mockProjectManager.listProjects()
        const foundProject = projects.find(p => 
          p.id === handlerArgs.project || 
          p.name === handlerArgs.project
        )

        if (!foundProject) {
          console.error(`Project not found: "${handlerArgs.project}"`)
          process.exit(1)
        }

        if (!handlerArgs.force && !handlerArgs.confirm) {
          console.error("Deletion cancelled. Use --force or --confirm to proceed.")
          process.exit(1)
        }

        await mockProjectManager.deleteProject(foundProject.id)
        console.error(`Project "${foundProject.name}" deleted successfully!`)
      } catch (error) {
        console.error(`Failed to delete project "${handlerArgs.project}": ${error instanceof Error ? error.message : error}`)
        process.exit(1)
      }
    }

    try {
      await DeleteCommand.handler(args as any)
      expect(false).toBe(true) // Should not reach here
    } catch (error) {
      expect(exitCode).toBe(1)
      expect(consoleSpy.error.some(msg => msg.includes("Deletion failed"))).toBe(true)
    } finally {
      console.log = originalConsoleLog
      console.error = originalConsoleError
      process.exit = originalProcessExit
      DeleteCommand.handler = originalHandler
    }
  })

  test("should have correct aliases", () => {
    expect(DeleteCommand.aliases).toEqual(["rm", "remove"])
  })

  test("should validate required project parameter", () => {
    const mockYargs = {
      positional: (name: string, config: any) => {
        if (name === "project") {
          expect(config.demandOption).toBe(true)
        }
        return mockYargs
      },
      option: () => mockYargs,
    }

    const builder = DeleteCommand.builder as any
    builder(mockYargs)
  })

  test("should have correct default values for flags", () => {
    const mockYargs = {
      positional: () => mockYargs,
      option: (name: string, config: any) => {
        switch (name) {
          case "force":
            expect(config.default).toBe(false)
            break
          case "confirm":
            expect(config.default).toBe(false)
            break
        }
        return mockYargs
      },
    }

    const builder = DeleteCommand.builder as any
    builder(mockYargs)
  })

  test("should show cleanup message after successful deletion", async () => {
    const project = TestProjectStateFactory.stopped({ name: "cleanup-project" })
    state.projects.set(project.id, project)

    const args = {
      project: "cleanup-project",
      workspace: tempWorkspace,
      force: true,
      confirm: false,
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
      await DeleteCommand.handler(args as any)
      
      const output = consoleSpy.error.join("\n")
      
      expect(output).toContain("deleted successfully")
      expect(output).toContain("Cleaned up project directory")
      expect(output).toContain(project.path)
      
    } finally {
      console.log = originalConsoleLog
      console.error = originalConsoleError
    }
  })
})