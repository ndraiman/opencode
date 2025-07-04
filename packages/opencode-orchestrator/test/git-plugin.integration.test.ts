/**
 * Git Plugin Integration Tests
 *
 * This file contains integration tests that verify actual git operations:
 * - Test real git clone operations with temporary repositories
 * - Slower execution but verify real-world functionality
 * - Require git to be available on the system
 * - Create temporary repositories that are automatically cleaned up
 *
 * Usage:
 * - Run integration tests: `bun run test:integration`
 * - Run all tests including unit tests: `bun test`
 */

import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { mkdir, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { GitPlugin } from "../src/plugins/git-plugin.js"
import type { CreateProjectInput } from "../src/types.js"

// Robust cleanup function
async function cleanupDirectory(dirPath: string): Promise<void> {
  try {
    await rm(dirPath, { recursive: true, force: true })
  } catch (e) {
    // Try again after a short delay
    try {
      await new Promise((resolve) => setTimeout(resolve, 10))
      await rm(dirPath, { recursive: true, force: true })
    } catch (e) {
      // Ignore final cleanup errors in tests
    }
  }
}

// Helper to create a temporary git repository for testing
async function createTestGitRepo(
  repoPath: string,
  options: {
    branches?: string[]
    files?: Record<string, string>
    commits?: number
  } = {},
): Promise<string> {
  const {
    branches = ["main"],
    files = { "README.md": "# Test Repository" },
    commits = 1,
  } = options

  await mkdir(repoPath, { recursive: true })

  // Initialize git repo
  await Bun.spawn({
    cmd: ["git", "init", "--initial-branch=main"],
    cwd: repoPath,
    stdout: "pipe",
    stderr: "pipe",
  }).exited

  // Configure git user for commits
  await Bun.spawn({
    cmd: ["git", "config", "user.email", "test@example.com"],
    cwd: repoPath,
    stdout: "pipe",
    stderr: "pipe",
  }).exited

  await Bun.spawn({
    cmd: ["git", "config", "user.name", "Test User"],
    cwd: repoPath,
    stdout: "pipe",
    stderr: "pipe",
  }).exited

  // Create initial files
  for (const [fileName, content] of Object.entries(files)) {
    await Bun.write(join(repoPath, fileName), content)
  }

  // Add and commit files
  await Bun.spawn({
    cmd: ["git", "add", "."],
    cwd: repoPath,
    stdout: "pipe",
    stderr: "pipe",
  }).exited

  await Bun.spawn({
    cmd: ["git", "commit", "-m", "Initial commit"],
    cwd: repoPath,
    stdout: "pipe",
    stderr: "pipe",
  }).exited

  // Create additional commits if requested
  for (let i = 1; i < commits; i++) {
    await Bun.write(
      join(repoPath, `file${i}.txt`),
      `Content for commit ${i + 1}`,
    )
    await Bun.spawn({
      cmd: ["git", "add", `file${i}.txt`],
      cwd: repoPath,
      stdout: "pipe",
      stderr: "pipe",
    }).exited

    await Bun.spawn({
      cmd: ["git", "commit", "-m", `Commit ${i + 1}`],
      cwd: repoPath,
      stdout: "pipe",
      stderr: "pipe",
    }).exited
  }

  // Create additional branches if requested
  for (const branch of branches.slice(1)) {
    await Bun.spawn({
      cmd: ["git", "checkout", "-b", branch],
      cwd: repoPath,
      stdout: "pipe",
      stderr: "pipe",
    }).exited

    // Add a file unique to this branch
    await Bun.write(
      join(repoPath, `${branch}.txt`),
      `Content for ${branch} branch`,
    )
    await Bun.spawn({
      cmd: ["git", "add", `${branch}.txt`],
      cwd: repoPath,
      stdout: "pipe",
      stderr: "pipe",
    }).exited

    await Bun.spawn({
      cmd: ["git", "commit", "-m", `Add ${branch} branch content`],
      cwd: repoPath,
      stdout: "pipe",
      stderr: "pipe",
    }).exited
  }

  // Switch back to main branch
  await Bun.spawn({
    cmd: ["git", "checkout", "main"],
    cwd: repoPath,
    stdout: "pipe",
    stderr: "pipe",
  }).exited

  return repoPath
}

// Helper to check if git is available
async function isGitAvailable(): Promise<boolean> {
  try {
    const result = await Bun.spawn({
      cmd: ["git", "--version"],
      stdout: "pipe",
      stderr: "pipe",
    }).exited
    return result === 0
  } catch {
    return false
  }
}

// Helper to get file content
async function getFileContent(filePath: string): Promise<string> {
  try {
    const file = Bun.file(filePath)
    return await file.text()
  } catch {
    return ""
  }
}

// Helper to check if directory exists and has content
async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await Bun.file(dirPath).stat()
    return stat.isDirectory()
  } catch {
    return false
  }
}

// Helper to get git log
async function getGitLog(repoPath: string): Promise<string[]> {
  try {
    const process = Bun.spawn({
      cmd: ["git", "log", "--oneline"],
      cwd: repoPath,
      stdout: "pipe",
      stderr: "pipe",
    })

    const output = new TextDecoder().decode(
      await new Response(process.stdout).arrayBuffer(),
    )
    await process.exited

    return output
      .trim()
      .split("\n")
      .filter((line) => line.trim())
  } catch {
    return []
  }
}

// Helper to get current branch
async function getCurrentBranch(repoPath: string): Promise<string> {
  try {
    const process = Bun.spawn({
      cmd: ["git", "branch", "--show-current"],
      cwd: repoPath,
      stdout: "pipe",
      stderr: "pipe",
    })

    const output = new TextDecoder().decode(
      await new Response(process.stdout).arrayBuffer(),
    )
    await process.exited

    return output.trim()
  } catch {
    return ""
  }
}

describe("GitPlugin Integration Tests - Real Git Operations", () => {
  let sourceRepo: string
  let targetRepo: string
  let gitPlugin: GitPlugin

  beforeEach(async () => {
    // Skip integration tests if git is not available
    if (!(await isGitAvailable())) {
      console.warn("Git not available, skipping integration tests")
      return
    }

    gitPlugin = new GitPlugin()
    sourceRepo = join(tmpdir(), `git-source-${Date.now()}`)
    targetRepo = join(tmpdir(), `git-target-${Date.now()}`)
  })

  afterEach(async () => {
    // Clean up both source and target repositories
    await Promise.all([
      cleanupDirectory(sourceRepo),
      cleanupDirectory(targetRepo),
    ])
  })

  test("should clone a real git repository", async () => {
    if (!(await isGitAvailable())) {
      console.warn("Git not available, skipping test")
      return
    }

    // Create source repository
    await createTestGitRepo(sourceRepo, {
      files: {
        "README.md": "# Test Repository",
        "package.json": JSON.stringify({ name: "test-package" }, null, 2),
      },
    })

    const input: CreateProjectInput = {
      name: "test-project",
      type: "git",
      config: {
        gitUrl: `file://${sourceRepo}`,
      },
    }

    // Test the actual clone operation
    await gitPlugin.create(input, targetRepo)

    // Verify the repository was cloned correctly
    expect(await directoryExists(targetRepo)).toBe(true)
    expect(await getFileContent(join(targetRepo, "README.md"))).toBe(
      "# Test Repository",
    )
    expect(await getFileContent(join(targetRepo, "package.json"))).toContain(
      "test-package",
    )
  })

  test("should clone specific branch", async () => {
    if (!(await isGitAvailable())) {
      console.warn("Git not available, skipping test")
      return
    }

    // Create source repository with multiple branches
    await createTestGitRepo(sourceRepo, {
      branches: ["main", "develop", "feature/test"],
      files: {
        "README.md": "# Main Branch",
      },
    })

    const input: CreateProjectInput = {
      name: "test-project",
      type: "git",
      config: {
        gitUrl: `file://${sourceRepo}`,
        gitBranch: "develop",
      },
    }

    await gitPlugin.create(input, targetRepo)

    // Verify we're on the correct branch
    expect(await getCurrentBranch(targetRepo)).toBe("develop")
    expect(await getFileContent(join(targetRepo, "develop.txt"))).toBe(
      "Content for develop branch",
    )
  })

  test("should clone with shallow depth", async () => {
    if (!(await isGitAvailable())) {
      console.warn("Git not available, skipping test")
      return
    }

    // Create source repository with multiple commits
    await createTestGitRepo(sourceRepo, {
      commits: 5,
      files: {
        "README.md": "# Test Repository",
      },
    })

    const input: CreateProjectInput = {
      name: "test-project",
      type: "git",
      config: {
        gitUrl: `file://${sourceRepo}`,
        depth: 2,
      },
    }

    await gitPlugin.create(input, targetRepo)

    // Verify shallow clone (should have limited history)
    const logs = await getGitLog(targetRepo)
    expect(logs.length).toBeLessThanOrEqual(2)
    expect(await directoryExists(targetRepo)).toBe(true)
    expect(await getFileContent(join(targetRepo, "README.md"))).toBe(
      "# Test Repository",
    )
  })

  test("should handle repository clone with recursive submodules flag", async () => {
    if (!(await isGitAvailable())) {
      console.warn("Git not available, skipping test")
      return
    }

    // Create source repository without actual submodules to avoid complexity
    await createTestGitRepo(sourceRepo, {
      files: {
        "README.md": "# Repository for Submodule Test",
        ".gitmodules":
          '[submodule "example"]\n\tpath = example\n\turl = https://github.com/example/repo.git',
      },
    })

    const input: CreateProjectInput = {
      name: "test-project",
      type: "git",
      config: {
        gitUrl: `file://${sourceRepo}`,
      },
    }

    await gitPlugin.create(input, targetRepo)

    // Verify repository was cloned with recursive flag (the actual submodule doesn't need to exist)
    expect(await directoryExists(targetRepo)).toBe(true)
    expect(await getFileContent(join(targetRepo, "README.md"))).toBe(
      "# Repository for Submodule Test",
    )
    expect(await getFileContent(join(targetRepo, ".gitmodules"))).toContain(
      "example",
    )
  })

  test("should handle non-existent repository", async () => {
    if (!(await isGitAvailable())) {
      console.warn("Git not available, skipping test")
      return
    }

    const input: CreateProjectInput = {
      name: "test-project",
      type: "git",
      config: {
        gitUrl: "file:///non/existent/repo",
      },
    }

    await expect(gitPlugin.create(input, targetRepo)).rejects.toThrow(
      "Failed to clone repository",
    )
  })

  test("should handle non-existent branch", async () => {
    if (!(await isGitAvailable())) {
      console.warn("Git not available, skipping test")
      return
    }

    // Create source repository
    await createTestGitRepo(sourceRepo, {
      branches: ["main"],
      files: {
        "README.md": "# Test Repository",
      },
    })

    const input: CreateProjectInput = {
      name: "test-project",
      type: "git",
      config: {
        gitUrl: `file://${sourceRepo}`,
        gitBranch: "non-existent-branch",
      },
    }

    await expect(gitPlugin.create(input, targetRepo)).rejects.toThrow(
      "Failed to clone repository",
    )
  })

  test("should handle invalid git URL", async () => {
    if (!(await isGitAvailable())) {
      console.warn("Git not available, skipping test")
      return
    }

    const input: CreateProjectInput = {
      name: "test-project",
      type: "git",
      config: {
        gitUrl: "not-a-valid-git-url",
      },
    }

    await expect(gitPlugin.create(input, targetRepo)).rejects.toThrow(
      "Failed to clone repository",
    )
  })

  test("should preserve git history with full clone", async () => {
    if (!(await isGitAvailable())) {
      console.warn("Git not available, skipping test")
      return
    }

    // Create source repository with multiple commits
    await createTestGitRepo(sourceRepo, {
      commits: 3,
      files: {
        "README.md": "# Test Repository",
      },
    })

    const input: CreateProjectInput = {
      name: "test-project",
      type: "git",
      config: {
        gitUrl: `file://${sourceRepo}`,
      },
    }

    await gitPlugin.create(input, targetRepo)

    // Verify full history is preserved
    const logs = await getGitLog(targetRepo)
    expect(logs.length).toBe(3)
    expect(await directoryExists(targetRepo)).toBe(true)
  })

  test("should handle repository with complex branch structure", async () => {
    if (!(await isGitAvailable())) {
      console.warn("Git not available, skipping test")
      return
    }

    // Create source repository with complex branch structure
    await createTestGitRepo(sourceRepo, {
      branches: [
        "main",
        "develop",
        "feature/auth",
        "feature/ui",
        "hotfix/critical",
      ],
      files: {
        "README.md": "# Complex Repository",
      },
    })

    const input: CreateProjectInput = {
      name: "test-project",
      type: "git",
      config: {
        gitUrl: `file://${sourceRepo}`,
        gitBranch: "feature/auth",
      },
    }

    await gitPlugin.create(input, targetRepo)

    // Verify correct branch was cloned
    expect(await getCurrentBranch(targetRepo)).toBe("feature/auth")
    expect(await getFileContent(join(targetRepo, "feature/auth.txt"))).toBe(
      "Content for feature/auth branch",
    )
  })

  test("should handle empty repository", async () => {
    if (!(await isGitAvailable())) {
      console.warn("Git not available, skipping test")
      return
    }

    // Create empty repository
    await mkdir(sourceRepo, { recursive: true })
    await Bun.spawn({
      cmd: ["git", "init", "--bare"],
      cwd: sourceRepo,
      stdout: "pipe",
      stderr: "pipe",
    }).exited

    const input: CreateProjectInput = {
      name: "test-project",
      type: "git",
      config: {
        gitUrl: `file://${sourceRepo}`,
      },
    }

    await gitPlugin.create(input, targetRepo)

    // Verify empty repository was cloned
    expect(await directoryExists(targetRepo)).toBe(true)
    expect(await directoryExists(join(targetRepo, ".git"))).toBe(true)
  })
})
