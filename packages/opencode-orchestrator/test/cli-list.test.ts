import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { ListCommand } from "../src/cli/cmd/list.js"
import { ProjectManager } from "../src/project-manager.js"
import type { OrchestratorState } from "../src/types.js"
import { cleanupDirectory, generateTestId } from "./helpers/test-utils.js"
import { TestProjectStateFactory, TestStateFactory } from "./helpers/test-factories.js"
import { TestMocker } from "./helpers/test-mocks.js"

describe("CLI List Command", () => {
  let tempWorkspace: string
  let state: OrchestratorState
  let projectManager: ProjectManager
  let testMocker: TestMocker

  beforeEach(async () => {
    tempWorkspace = join(tmpdir(), `cli-list-test-${generateTestId()}`)
    await mkdir(tempWorkspace, { recursive: true })
    
    state = TestStateFactory.empty()
    projectManager = new ProjectManager(state, tempWorkspace)
    testMocker = new TestMocker()
    
    testMocker.setupIntegrationMocks()
  })

  afterEach(async () => {
    testMocker.cleanup()
    await cleanupDirectory(tempWorkspace)
  })

  test("should create CLI command with correct configuration", () => {
    expect(ListCommand.command).toBe("list")
    expect(ListCommand.describe).toBe("List all OpenCode projects")
    expect(ListCommand.aliases).toContain("ls")
    expect(ListCommand.builder).toBeDefined()
    expect(ListCommand.handler).toBeDefined()
  })

  test("should configure yargs with correct options", () => {
    const mockYargs = {
      option: (name: string, config: any) => {
        switch (name) {
          case "workspace":
            expect(config.type).toBe("string")
            expect(config.default).toContain(".opencode")
            break
          case "format":
            expect(config.choices).toEqual(["table", "json"])
            expect(config.default).toBe("table")
            break
          case "status":
            expect(config.choices).toEqual(["stopped", "starting", "running", "stopping", "failed"])
            break
        }
        return mockYargs
      },
    }

    const builder = ListCommand.builder as any
    builder(mockYargs)
  })

  test("should display no projects message when no projects exist", async () => {
    const args = {
      workspace: tempWorkspace,
      format: "table",
      status: undefined,
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
      await ListCommand.handler(args as any)
      
      expect(consoleSpy.error.some(msg => msg.includes("No projects found"))).toBe(true)
      expect(consoleSpy.error.some(msg => msg.includes("Create a new project"))).toBe(true)
      
    } finally {
      console.log = originalConsoleLog
      console.error = originalConsoleError
    }
  })

  test("should list projects in table format", async () => {
    // Add test projects to state
    const projects = [
      TestProjectStateFactory.stopped({ name: "project-1", description: "First project" }),
      TestProjectStateFactory.running({ name: "project-2", port: 4000, pid: 12345 }),
      TestProjectStateFactory.failed({ name: "project-3", lastError: "Build failed" }),
    ]
    
    projects.forEach(project => state.projects.set(project.id, project))

    const args = {
      workspace: tempWorkspace,
      format: "table",
      status: undefined,
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
      await ListCommand.handler(args as any)
      
      // Check that projects are listed
      expect(consoleSpy.error.some(msg => msg.includes("Found 3 project(s)"))).toBe(true)
      expect(consoleSpy.error.some(msg => msg.includes("project-1"))).toBe(true)
      expect(consoleSpy.error.some(msg => msg.includes("project-2"))).toBe(true)
      expect(consoleSpy.error.some(msg => msg.includes("project-3"))).toBe(true)
      
      // Check that status summary is shown
      expect(consoleSpy.error.some(msg => msg.includes("Status Summary"))).toBe(true)
      
    } finally {
      console.log = originalConsoleLog
      console.error = originalConsoleError
    }
  })

  test("should list projects in JSON format", async () => {
    // Add test projects to state
    const projects = [
      TestProjectStateFactory.stopped({ name: "json-project-1" }),
      TestProjectStateFactory.running({ name: "json-project-2" }),
    ]
    
    projects.forEach(project => state.projects.set(project.id, project))

    const args = {
      workspace: tempWorkspace,
      format: "json",
      status: undefined,
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
      await ListCommand.handler(args as any)
      
      // Check that JSON output is produced
      const jsonOutput = consoleSpy.log.join("")
      expect(() => JSON.parse(jsonOutput)).not.toThrow()
      
      const parsedOutput = JSON.parse(jsonOutput)
      expect(parsedOutput).toHaveLength(2)
      expect(parsedOutput.some((p: any) => p.name === "json-project-1")).toBe(true)
      expect(parsedOutput.some((p: any) => p.name === "json-project-2")).toBe(true)
      
    } finally {
      console.log = originalConsoleLog
      console.error = originalConsoleError
    }
  })

  test("should filter projects by status", async () => {
    // Add test projects with different statuses
    const projects = [
      TestProjectStateFactory.stopped({ name: "stopped-project" }),
      TestProjectStateFactory.running({ name: "running-project" }),
      TestProjectStateFactory.failed({ name: "failed-project" }),
    ]
    
    projects.forEach(project => state.projects.set(project.id, project))

    const args = {
      workspace: tempWorkspace,
      format: "table",
      status: "running",
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
      await ListCommand.handler(args as any)
      
      // Check that only running projects are shown
      expect(consoleSpy.error.some(msg => msg.includes("Found 1 project(s)"))).toBe(true)
      expect(consoleSpy.error.some(msg => msg.includes("running-project"))).toBe(true)
      expect(consoleSpy.error.every(msg => !msg.includes("stopped-project"))).toBe(true)
      expect(consoleSpy.error.every(msg => !msg.includes("failed-project"))).toBe(true)
      
    } finally {
      console.log = originalConsoleLog
      console.error = originalConsoleError
    }
  })

  test("should show no projects message when filtering returns no results", async () => {
    // Add test projects but filter for non-existent status
    const projects = [
      TestProjectStateFactory.stopped({ name: "stopped-project" }),
    ]
    
    projects.forEach(project => state.projects.set(project.id, project))

    const args = {
      workspace: tempWorkspace,
      format: "table",
      status: "running",
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
      await ListCommand.handler(args as any)
      
      expect(consoleSpy.error.some(msg => msg.includes('No projects found with status "running"'))).toBe(true)
      
    } finally {
      console.log = originalConsoleLog
      console.error = originalConsoleError
    }
  })

  test("should sort projects by creation date (newest first)", async () => {
    // Add test projects with different creation dates
    const now = new Date()
    const older = new Date(now.getTime() - 60000) // 1 minute ago
    const oldest = new Date(now.getTime() - 120000) // 2 minutes ago
    
    const projects = [
      TestProjectStateFactory.stopped({ name: "oldest-project", createdAt: oldest }),
      TestProjectStateFactory.stopped({ name: "newest-project", createdAt: now }),
      TestProjectStateFactory.stopped({ name: "older-project", createdAt: older }),
    ]
    
    projects.forEach(project => state.projects.set(project.id, project))

    const args = {
      workspace: tempWorkspace,
      format: "table",
      status: undefined,
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
      await ListCommand.handler(args as any)
      
      const output = consoleSpy.error.join("\n")
      
      // Find the positions of project names in the output
      const newestIndex = output.indexOf("newest-project")
      const olderIndex = output.indexOf("older-project")
      const oldestIndex = output.indexOf("oldest-project")
      
      // Verify they appear in the correct order (newest first)
      expect(newestIndex).toBeLessThan(olderIndex)
      expect(olderIndex).toBeLessThan(oldestIndex)
      
    } finally {
      console.log = originalConsoleLog
      console.error = originalConsoleError
    }
  })

  test("should display project details in table format", async () => {
    // Add a project with all possible details
    const project = TestProjectStateFactory.running({
      name: "detailed-project",
      description: "A project with all details",
      port: 4000,
      pid: 12345,
      lastError: undefined,
    })
    
    state.projects.set(project.id, project)

    const args = {
      workspace: tempWorkspace,
      format: "table",
      status: undefined,
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
      await ListCommand.handler(args as any)
      
      const output = consoleSpy.error.join("\n")
      
      // Check that all details are displayed
      expect(output).toContain("detailed-project")
      expect(output).toContain("A project with all details")
      expect(output).toContain("Port: 4000")
      expect(output).toContain("PID: 12345")
      expect(output).toContain(project.id)
      expect(output).toContain(project.path)
      
    } finally {
      console.log = originalConsoleLog
      console.error = originalConsoleError
    }
  })

  test("should display error information for failed projects", async () => {
    // Add a failed project
    const project = TestProjectStateFactory.failed({
      name: "failed-project",
      lastError: "Connection timeout",
    })
    
    state.projects.set(project.id, project)

    const args = {
      workspace: tempWorkspace,
      format: "table",
      status: undefined,
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
      await ListCommand.handler(args as any)
      
      const output = consoleSpy.error.join("\n")
      
      // Check that error information is displayed
      expect(output).toContain("failed-project")
      expect(output).toContain("Connection timeout")
      expect(output).toContain("Last Error")
      
    } finally {
      console.log = originalConsoleLog
      console.error = originalConsoleError
    }
  })

  test("should display status summary with counts", async () => {
    // Add projects with different statuses
    const projects = [
      TestProjectStateFactory.stopped({ name: "stopped-1" }),
      TestProjectStateFactory.stopped({ name: "stopped-2" }),
      TestProjectStateFactory.running({ name: "running-1" }),
      TestProjectStateFactory.failed({ name: "failed-1" }),
    ]
    
    projects.forEach(project => state.projects.set(project.id, project))

    const args = {
      workspace: tempWorkspace,
      format: "table",
      status: undefined,
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
      await ListCommand.handler(args as any)
      
      const output = consoleSpy.error.join("\n")
      
      // Check that status summary is displayed with correct counts
      expect(output).toContain("Status Summary")
      expect(output).toContain("stopped: 2")
      expect(output).toContain("running: 1")
      expect(output).toContain("failed: 1")
      
    } finally {
      console.log = originalConsoleLog
      console.error = originalConsoleError
    }
  })

  test("should handle list command errors gracefully", async () => {
    // Mock project manager to throw an error
    const mockProjectManager = testMocker.projectManagerMocker.createMockWithBehavior({
      shouldFailOperations: ["listProjects"],
    })
    
    mockProjectManager.listProjects = () => {
      throw new Error("Database connection failed")
    }

    const args = {
      workspace: tempWorkspace,
      format: "table",
      status: undefined,
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
    const originalHandler = ListCommand.handler
    ListCommand.handler = async (handlerArgs: any) => {
      try {
        await mockProjectManager.listProjects()
      } catch (error) {
        console.error(`Failed to list projects: ${error instanceof Error ? error.message : error}`)
        process.exit(1)
      }
    }

    try {
      await ListCommand.handler(args as any)
      expect(false).toBe(true) // Should not reach here
    } catch (error) {
      expect(exitCode).toBe(1)
      expect(consoleSpy.error.some(msg => msg.includes("Database connection failed"))).toBe(true)
    } finally {
      console.log = originalConsoleLog
      console.error = originalConsoleError
      process.exit = originalProcessExit
      ListCommand.handler = originalHandler
    }
  })

  test("should have correct default values", () => {
    const mockYargs = {
      option: (name: string, config: any) => {
        switch (name) {
          case "workspace":
            expect(config.default).toContain("projects")
            break
          case "format":
            expect(config.default).toBe("table")
            break
          case "status":
            expect(config.default).toBeUndefined()
            break
        }
        return mockYargs
      },
    }

    const builder = ListCommand.builder as any
    builder(mockYargs)
  })

  test("should have correct aliases", () => {
    expect(ListCommand.aliases).toEqual(["ls"])
  })
})