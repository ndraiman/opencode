import { join } from "node:path"
import { tmpdir } from "node:os"
import type {
  CreateProjectInput,
  Project,
  OrchestratorState,
} from "../../src/types.js"
import { generateTestId } from "./test-utils.js"

/**
 * Factory for creating test project inputs
 */
export class TestProjectFactory {
  /**
   * Create an empty project input
   */
  static empty(
    overrides: Partial<CreateProjectInput> = {},
  ): CreateProjectInput {
    return {
      name: `empty-project-${generateTestId()}`,
      type: "empty",
      description: "Test empty project",
      ...overrides,
    }
  }

  /**
   * Create a git project input
   */
  static git(overrides: Partial<CreateProjectInput> = {}): CreateProjectInput {
    return {
      name: `git-project-${generateTestId()}`,
      type: "git",
      description: "Test git project",
      config: {
        gitUrl: "https://github.com/test/repo.git",
        gitBranch: "main",
        ...overrides.config,
      },
      ...overrides,
    }
  }

  /**
   * Create a git project with web framework config
   */
  static webGit(
    overrides: Partial<CreateProjectInput> = {},
  ): CreateProjectInput {
    return {
      name: `web-project-${generateTestId()}`,
      type: "git",
      description: "Test web project",
      config: {
        gitUrl: "https://github.com/test/web-app.git",
        gitBranch: "main",
        framework: "react",
        ...overrides.config,
      },
      ...overrides,
    }
  }

  /**
   * Create a git project with node config
   */
  static nodeGit(
    overrides: Partial<CreateProjectInput> = {},
  ): CreateProjectInput {
    return {
      name: `node-project-${generateTestId()}`,
      type: "git",
      description: "Test node project",
      config: {
        gitUrl: "https://github.com/test/node-app.git",
        gitBranch: "main",
        packageManager: "npm",
        nodeVersion: "20",
        ...overrides.config,
      },
      ...overrides,
    }
  }

  /**
   * Create a project input with custom configuration
   */
  static custom(
    type: CreateProjectInput["type"],
    config: Record<string, any> = {},
    overrides: Partial<CreateProjectInput> = {},
  ): CreateProjectInput {
    return {
      name: `custom-project-${generateTestId()}`,
      type,
      description: `Test ${type} project`,
      config,
      ...overrides,
    }
  }

  /**
   * Create multiple project inputs for batch testing
   */
  static batch(
    count: number,
    factory: () => CreateProjectInput = TestProjectFactory.empty,
  ): CreateProjectInput[] {
    return Array.from({ length: count }, (_, i) => ({
      ...factory(),
      name: `batch-project-${i}-${generateTestId()}`,
    }))
  }

  /**
   * Create a project input with invalid data for error testing
   */
  static invalid(
    overrides: Partial<CreateProjectInput> = {},
  ): CreateProjectInput {
    return {
      name: "", // Invalid empty name
      type: "invalid" as any, // Invalid type
      description: "Invalid project for testing",
      ...overrides,
    }
  }
}

/**
 * Factory for creating test projects (already created/persisted)
 */
export class TestProjectStateFactory {
  /**
   * Create a project in stopped state
   */
  static stopped(overrides: Partial<Project> = {}): Project {
    const id = generateTestId()
    const now = new Date()
    return {
      id,
      name: `stopped-project-${id}`,
      type: "empty",
      description: "Test stopped project",
      status: "stopped",
      path: join(tmpdir(), `opencode-test-${id}`),
      createdAt: now,
      updatedAt: now,
      ...overrides,
    }
  }

  /**
   * Create a project in running state
   */
  static running(overrides: Partial<Project> = {}): Project {
    const id = generateTestId()
    const now = new Date()
    return {
      id,
      name: `running-project-${id}`,
      type: "empty",
      description: "Test running project",
      status: "running",
      path: join(tmpdir(), `opencode-test-${id}`),
      port: 4000 + Math.floor(Math.random() * 1000),
      pid: 12345 + Math.floor(Math.random() * 1000),
      createdAt: now,
      updatedAt: now,
      ...overrides,
    }
  }

  /**
   * Create a project in failed state
   */
  static failed(overrides: Partial<Project> = {}): Project {
    const id = generateTestId()
    const now = new Date()
    return {
      id,
      name: `failed-project-${id}`,
      type: "empty",
      description: "Test failed project",
      status: "failed",
      path: join(tmpdir(), `opencode-test-${id}`),
      lastError: "Test failure",
      createdAt: now,
      updatedAt: now,
      ...overrides,
    }
  }

  /**
   * Create a project in starting state
   */
  static starting(overrides: Partial<Project> = {}): Project {
    const id = generateTestId()
    const now = new Date()
    return {
      id,
      name: `starting-project-${id}`,
      type: "empty",
      description: "Test starting project",
      status: "starting",
      path: join(tmpdir(), `opencode-test-${id}`),
      createdAt: now,
      updatedAt: now,
      ...overrides,
    }
  }

  /**
   * Create a project in stopping state
   */
  static stopping(overrides: Partial<Project> = {}): Project {
    const id = generateTestId()
    const now = new Date()
    return {
      id,
      name: `stopping-project-${id}`,
      type: "empty",
      description: "Test stopping project",
      status: "stopping",
      path: join(tmpdir(), `opencode-test-${id}`),
      port: 4000 + Math.floor(Math.random() * 1000),
      pid: 12345 + Math.floor(Math.random() * 1000),
      createdAt: now,
      updatedAt: now,
      ...overrides,
    }
  }

  /**
   * Create a git project with full configuration
   */
  static gitProject(overrides: Partial<Project> = {}): Project {
    const id = generateTestId()
    const now = new Date()
    return {
      id,
      name: `git-project-${id}`,
      type: "git",
      description: "Test git project",
      status: "stopped",
      path: join(tmpdir(), `opencode-test-${id}`),
      config: {
        gitUrl: "https://github.com/test/repo.git",
        gitBranch: "main",
      },
      createdAt: now,
      updatedAt: now,
      ...overrides,
    }
  }

  /**
   * Create multiple projects for batch testing
   */
  static batch(
    count: number,
    factory: () => Project = TestProjectStateFactory.stopped,
  ): Project[] {
    return Array.from({ length: count }, (_, i) => ({
      ...factory(),
      name: `batch-project-${i}-${generateTestId()}`,
    }))
  }
}

/**
 * Factory for creating test orchestrator state
 */
export class TestStateFactory {
  /**
   * Create an empty orchestrator state
   */
  static empty(): OrchestratorState {
    return {
      projects: new Map(),
      processes: new Map(),
    }
  }

  /**
   * Create orchestrator state with test projects
   */
  static withProjects(projects: Project[]): OrchestratorState {
    const state = TestStateFactory.empty()
    projects.forEach((project) => {
      state.projects.set(project.id, project)
    })
    return state
  }

  /**
   * Create orchestrator state with running projects and processes
   */
  static withRunningProjects(projects: Project[]): OrchestratorState {
    const state = TestStateFactory.withProjects(projects)

    projects.forEach((project) => {
      if (project.status === "running" && project.port && project.pid) {
        state.processes.set(project.id, {
          process: {
            pid: project.pid,
            exitCode: null,
            exited: Promise.resolve(0),
            kill: () => {},
            stdout: new ReadableStream(),
            stderr: new ReadableStream(),
          } as any,
          port: project.port,
          startedAt: new Date(),
          logs: [`Project ${project.name} started on port ${project.port}`],
        })
      }
    })

    return state
  }

  /**
   * Create orchestrator state with mixed project states
   */
  static mixed(): OrchestratorState {
    const projects = [
      TestProjectStateFactory.stopped(),
      TestProjectStateFactory.running(),
      TestProjectStateFactory.failed(),
      TestProjectStateFactory.starting(),
    ]

    return TestStateFactory.withRunningProjects(projects)
  }

  /**
   * Create orchestrator state with specific project count
   */
  static withProjectCount(count: number): OrchestratorState {
    const projects = TestProjectStateFactory.batch(count)
    return TestStateFactory.withProjects(projects)
  }
}

/**
 * Factory for creating test workspace paths
 */
export class TestWorkspaceFactory {
  /**
   * Create a unique temporary workspace path
   */
  static create(prefix: string = "opencode-test"): string {
    return join(tmpdir(), `${prefix}-${generateTestId()}`)
  }

  /**
   * Create multiple workspace paths
   */
  static batch(count: number, prefix: string = "opencode-test"): string[] {
    return Array.from({ length: count }, (_, i) =>
      TestWorkspaceFactory.create(`${prefix}-${i}`),
    )
  }
}

/**
 * Factory for creating test server configurations
 */
export class TestServerFactory {
  /**
   * Create a basic test server configuration
   */
  static basic(overrides: Record<string, any> = {}) {
    return {
      hostname: "127.0.0.1",
      port: 4000 + Math.floor(Math.random() * 1000),
      ...overrides,
    }
  }

  /**
   * Create a test server configuration with specific port
   */
  static withPort(port: number, overrides: Record<string, any> = {}) {
    return {
      hostname: "127.0.0.1",
      port,
      ...overrides,
    }
  }

  /**
   * Create multiple server configurations with different ports
   */
  static batch(
    count: number,
    startPort: number = 4000,
  ): Array<Record<string, any>> {
    return Array.from({ length: count }, (_, i) =>
      TestServerFactory.withPort(startPort + i),
    )
  }
}

/**
 * Factory for creating test process information
 */
export class TestProcessFactory {
  /**
   * Create a test process info for a running project
   */
  static running(projectId: string, overrides: Record<string, any> = {}) {
    return {
      process: {
        pid: 12345 + Math.floor(Math.random() * 1000),
        exitCode: null,
        exited: Promise.resolve(0),
        kill: () => {},
        stdout: new ReadableStream(),
        stderr: new ReadableStream(),
      } as any,
      port: 4000 + Math.floor(Math.random() * 1000),
      startedAt: new Date(),
      logs: [`Process started for project ${projectId}`],
      ...overrides,
    }
  }

  /**
   * Create a test process info for a failed project
   */
  static failed(projectId: string, overrides: Record<string, any> = {}) {
    return {
      process: {
        pid: 12345 + Math.floor(Math.random() * 1000),
        exitCode: 1,
        exited: Promise.resolve(1),
        kill: () => {},
        stdout: new ReadableStream(),
        stderr: new ReadableStream(),
      } as any,
      port: 4000 + Math.floor(Math.random() * 1000),
      startedAt: new Date(),
      logs: [`Process failed for project ${projectId}`, "Error: Test failure"],
      ...overrides,
    }
  }
}

/**
 * Utility functions for test data creation
 */
export class TestDataUtils {
  /**
   * Create a realistic project name
   */
  static createProjectName(prefix: string = "project"): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`
  }

  /**
   * Create a realistic git URL
   */
  static createGitUrl(org: string = "test", repo?: string): string {
    return `https://github.com/${org}/${repo || TestDataUtils.createProjectName()}.git`
  }

  /**
   * Create a realistic project description
   */
  static createDescription(projectType: string): string {
    return `A test ${projectType} project created for integration testing`
  }

  /**
   * Create test environment variables
   */
  static createTestEnv(
    overrides: Record<string, string> = {},
  ): Record<string, string> {
    return {
      NODE_ENV: "test",
      TEST_MODE: "true",
      BUN_BE_BUN: "1",
      ...overrides,
    }
  }
}
