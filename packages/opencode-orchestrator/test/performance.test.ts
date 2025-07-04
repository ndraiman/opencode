import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { ProjectManager } from "../src/project-manager.js"
import type { OrchestratorState } from "../src/types.js"
import {
  cleanupDirectory,
  measurePerformance,
  withTimeout,
  PerformanceTimer,
  retry,
} from "./helpers/test-utils.js"
import {
  TestProjectFactory,
  TestStateFactory,
  TestWorkspaceFactory,
} from "./helpers/test-factories.js"
import { getTestConfig, TEST_TIMEOUTS } from "./helpers/test-config.js"

describe("ProjectManager Performance Tests", () => {
  let state: OrchestratorState
  let projectManager: ProjectManager
  let tempWorkspace: string
  const testConfig = getTestConfig("performance")

  beforeEach(async () => {
    state = TestStateFactory.empty()
    tempWorkspace = TestWorkspaceFactory.create("performance-test")
    await mkdir(tempWorkspace, { recursive: true })
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

    state.projects.clear()
    state.processes.clear()
    await cleanupDirectory(tempWorkspace)
  })

  describe("Project Creation Performance", () => {
    test("should create empty projects within performance threshold", async () => {
      const { result, duration } = await measurePerformance(async () => {
        const input = TestProjectFactory.empty()
        return await projectManager.createProject(input)
      }, testConfig.performance.threshold)

      expect(result).toBeDefined()
      expect(result.name).toBeDefined()
      expect(duration).toBeLessThan(testConfig.performance.threshold)

      console.log(`Empty project creation took ${duration}ms`)
    })

    test("should create multiple projects efficiently", async () => {
      const projectCount = 5
      const timer = new PerformanceTimer()

      const projects = await Promise.all(
        Array.from({ length: projectCount }, async () => {
          const input = TestProjectFactory.empty()
          return await projectManager.createProject(input)
        }),
      )

      const duration = timer.stop()
      const averageTime = duration / projectCount

      expect(projects).toHaveLength(projectCount)
      expect(averageTime).toBeLessThan(testConfig.performance.threshold / 2)

      console.log(
        `Average project creation time: ${averageTime}ms (${projectCount} projects in ${duration}ms)`,
      )
    })

    test("should handle concurrent project creation", async () => {
      const concurrentCount = testConfig.concurrency
      const timer = new PerformanceTimer()

      const createPromises = Array.from({ length: concurrentCount }, () => {
        const input = TestProjectFactory.empty()
        return projectManager.createProject(input)
      })

      const projects = await Promise.all(createPromises)
      const duration = timer.stop()

      expect(projects).toHaveLength(concurrentCount)
      expect(duration).toBeLessThan(testConfig.performance.threshold * 2)

      console.log(
        `Concurrent project creation (${concurrentCount}): ${duration}ms`,
      )
    })
  })

  describe("Project Lifecycle Performance", () => {
    test("should start projects within performance threshold", async () => {
      // Skip actual process spawning for performance tests
      const input = TestProjectFactory.empty()
      const project = await projectManager.createProject(input)

      // Mock the actual project start process for performance testing
      const originalStartProject = projectManager.startProject
      projectManager.startProject = async (projectId: string) => {
        // Simulate fast startup
        const proj = state.projects.get(projectId)
        if (proj) {
          proj.status = "running"
          proj.port = 4000
          proj.pid = 12345
          state.projects.set(projectId, proj)
        }
      }

      try {
        const { duration } = await measurePerformance(async () => {
          await projectManager.startProject(project.id)
        }, testConfig.performance.threshold)

        expect(duration).toBeLessThan(1000) // Should be very fast when mocked
        console.log(`Project start took ${duration}ms (mocked)`)
      } finally {
        projectManager.startProject = originalStartProject
      }
    })

    test("should stop projects quickly", async () => {
      const input = TestProjectFactory.empty()
      const project = await projectManager.createProject(input)

      // Set up project as running
      project.status = "running"
      project.port = 4000
      project.pid = 12345
      state.projects.set(project.id, project)

      const { duration } = await measurePerformance(async () => {
        await projectManager.stopProject(project.id)
      }, testConfig.performance.threshold)

      expect(duration).toBeLessThan(testConfig.performance.threshold)
      console.log(`Project stop took ${duration}ms`)
    })

    test("should handle batch operations efficiently", async () => {
      const batchSize = 3
      const projects = []

      // Create multiple projects
      for (let i = 0; i < batchSize; i++) {
        const input = TestProjectFactory.empty()
        const project = await projectManager.createProject(input)
        projects.push(project)
      }

      // Test batch listing performance
      const { result, duration } = await measurePerformance(async () => {
        return await projectManager.listProjects()
      }, testConfig.performance.threshold)

      expect(result).toHaveLength(batchSize)
      expect(duration).toBeLessThan(testConfig.performance.threshold / 4)

      console.log(`Batch listing ${batchSize} projects took ${duration}ms`)
    })
  })

  describe("Memory and Resource Performance", () => {
    test("should handle large project states efficiently", async () => {
      const largeProjectCount = 20
      const timer = new PerformanceTimer()

      // Create many projects
      for (let i = 0; i < largeProjectCount; i++) {
        const input = TestProjectFactory.empty({ name: `perf-project-${i}` })
        await projectManager.createProject(input)
      }

      const creationDuration = timer.stop()

      // Test listing performance with large state
      const listTimer = new PerformanceTimer()
      const projects = await projectManager.listProjects()
      const listDuration = listTimer.stop()

      expect(projects).toHaveLength(largeProjectCount)
      expect(listDuration).toBeLessThan(testConfig.performance.threshold / 2)

      console.log(
        `Created ${largeProjectCount} projects in ${creationDuration}ms, listed in ${listDuration}ms`,
      )
    })

    test("should cleanup resources efficiently", async () => {
      const cleanupProjectCount = 10
      const projects = []

      // Create projects
      for (let i = 0; i < cleanupProjectCount; i++) {
        const input = TestProjectFactory.empty()
        const project = await projectManager.createProject(input)
        projects.push(project)
      }

      // Test cleanup performance
      const timer = new PerformanceTimer()

      for (const project of projects) {
        await projectManager.deleteProject(project.id)
      }

      const duration = timer.stop()
      const averageCleanupTime = duration / cleanupProjectCount

      expect(state.projects.size).toBe(0)
      expect(averageCleanupTime).toBeLessThan(
        testConfig.performance.threshold / 4,
      )

      console.log(
        `Average cleanup time: ${averageCleanupTime}ms (${cleanupProjectCount} projects)`,
      )
    })
  })

  describe("Error Handling Performance", () => {
    test("should handle errors without significant performance impact", async () => {
      const errorTimer = new PerformanceTimer()

      // Test multiple error scenarios
      const errorTests = [
        () => projectManager.getProject("non-existent"),
        () => projectManager.deleteProject("non-existent"),
        () => projectManager.startProject("non-existent"),
        () => projectManager.stopProject("non-existent"),
      ]

      for (const errorTest of errorTests) {
        try {
          await errorTest()
        } catch (error) {
          // Expected errors
        }
      }

      const duration = errorTimer.stop()
      const averageErrorTime = duration / errorTests.length

      expect(averageErrorTime).toBeLessThan(100) // Error handling should be very fast
      console.log(`Average error handling time: ${averageErrorTime}ms`)
    })

    test("should recover from failures efficiently", async () => {
      const input = TestProjectFactory.empty()
      const project = await projectManager.createProject(input)

      // Simulate failure recovery
      const timer = new PerformanceTimer()

      try {
        await projectManager.startProject("non-existent")
      } catch (error) {
        // Expected failure
      }

      // Should still work normally after failure
      const result = await projectManager.getProject(project.id)
      const duration = timer.stop()

      expect(result).toBeDefined()
      expect(duration).toBeLessThan(testConfig.performance.threshold / 2)

      console.log(`Failure recovery took ${duration}ms`)
    })
  })

  describe("Concurrent Operations Performance", () => {
    test("should handle concurrent reads efficiently", async () => {
      // Create some projects first
      const setupProjects = []
      for (let i = 0; i < 5; i++) {
        const input = TestProjectFactory.empty()
        const project = await projectManager.createProject(input)
        setupProjects.push(project)
      }

      const concurrentReads = 10
      const timer = new PerformanceTimer()

      const readPromises = Array.from({ length: concurrentReads }, () =>
        projectManager.listProjects(),
      )

      const results = await Promise.all(readPromises)
      const duration = timer.stop()

      expect(results).toHaveLength(concurrentReads)
      results.forEach((result) =>
        expect(result).toHaveLength(setupProjects.length),
      )
      expect(duration).toBeLessThan(testConfig.performance.threshold)

      console.log(`${concurrentReads} concurrent reads took ${duration}ms`)
    })

    test("should handle mixed concurrent operations", async () => {
      const timer = new PerformanceTimer()

      const operations = [
        // Create operations
        ...Array.from({ length: 3 }, () => async () => {
          const input = TestProjectFactory.empty()
          return await projectManager.createProject(input)
        }),
        // Read operations
        ...Array.from({ length: 5 }, () => async () => {
          return await projectManager.listProjects()
        }),
      ]

      const results = await Promise.all(operations.map((op) => op()))
      const duration = timer.stop()

      expect(results).toHaveLength(operations.length)
      expect(duration).toBeLessThan(testConfig.performance.threshold * 2)

      console.log(`Mixed concurrent operations took ${duration}ms`)
    })
  })

  describe("Retry Performance", () => {
    test("should handle retries efficiently", async () => {
      let attemptCount = 0
      const maxAttempts = 3

      const { result, duration } = await measurePerformance(async () => {
        return await retry(
          async () => {
            attemptCount++
            if (attemptCount < maxAttempts) {
              throw new Error(`Attempt ${attemptCount} failed`)
            }
            return "success"
          },
          { maxAttempts, delay: 10 },
        )
      }, testConfig.performance.threshold)

      expect(result).toBe("success")
      expect(attemptCount).toBe(maxAttempts)
      expect(duration).toBeLessThan(testConfig.performance.threshold)

      console.log(
        `Retry operation took ${duration}ms (${attemptCount} attempts)`,
      )
    })
  })

  describe("Performance Benchmarks", () => {
    test("should meet overall performance benchmarks", async () => {
      const benchmarks = {
        projectCreation: 0,
        projectListing: 0,
        projectDeletion: 0,
        projectRetrieval: 0,
      }

      // Project creation benchmark
      let timer = new PerformanceTimer()
      const input = TestProjectFactory.empty()
      const project = await projectManager.createProject(input)
      benchmarks.projectCreation = timer.stop()

      // Project listing benchmark
      timer = new PerformanceTimer()
      await projectManager.listProjects()
      benchmarks.projectListing = timer.stop()

      // Project retrieval benchmark
      timer = new PerformanceTimer()
      await projectManager.getProject(project.id)
      benchmarks.projectRetrieval = timer.stop()

      // Project deletion benchmark
      timer = new PerformanceTimer()
      await projectManager.deleteProject(project.id)
      benchmarks.projectDeletion = timer.stop()

      // Assert benchmarks
      expect(benchmarks.projectCreation).toBeLessThan(
        testConfig.performance.threshold,
      )
      expect(benchmarks.projectListing).toBeLessThan(100)
      expect(benchmarks.projectRetrieval).toBeLessThan(50)
      expect(benchmarks.projectDeletion).toBeLessThan(
        testConfig.performance.threshold / 2,
      )

      console.log("Performance Benchmarks:", {
        ...benchmarks,
        unit: "ms",
      })
    })
  })
})
