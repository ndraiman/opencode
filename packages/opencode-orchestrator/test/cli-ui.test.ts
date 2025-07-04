import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { UI } from "../src/cli/ui.js"

describe("CLI UI Components", () => {
  let consoleSpy: {
    error: string[]
  }
  let originalConsoleError: typeof console.error

  beforeEach(() => {
    consoleSpy = {
      error: [],
    }
    originalConsoleError = console.error
    console.error = (message: string) => {
      consoleSpy.error.push(message)
    }
  })

  afterEach(() => {
    console.error = originalConsoleError
  })

  test("should have correct style constants", () => {
    expect(UI.Style.TEXT_HIGHLIGHT).toBe("\x1b[96m")
    expect(UI.Style.TEXT_HIGHLIGHT_BOLD).toBe("\x1b[96m\x1b[1m")
    expect(UI.Style.TEXT_DIM).toBe("\x1b[90m")
    expect(UI.Style.TEXT_DIM_BOLD).toBe("\x1b[90m\x1b[1m")
    expect(UI.Style.TEXT_NORMAL).toBe("\x1b[0m")
    expect(UI.Style.TEXT_NORMAL_BOLD).toBe("\x1b[1m")
    expect(UI.Style.TEXT_WARNING).toBe("\x1b[93m")
    expect(UI.Style.TEXT_WARNING_BOLD).toBe("\x1b[93m\x1b[1m")
    expect(UI.Style.TEXT_DANGER).toBe("\x1b[91m")
    expect(UI.Style.TEXT_DANGER_BOLD).toBe("\x1b[91m\x1b[1m")
    expect(UI.Style.TEXT_SUCCESS).toBe("\x1b[92m")
    expect(UI.Style.TEXT_SUCCESS_BOLD).toBe("\x1b[92m\x1b[1m")
    expect(UI.Style.TEXT_INFO).toBe("\x1b[94m")
    expect(UI.Style.TEXT_INFO_BOLD).toBe("\x1b[94m\x1b[1m")
  })

  test("should format error messages with proper styling", () => {
    UI.error("Test error message")
    
    expect(consoleSpy.error).toHaveLength(1)
    const output = consoleSpy.error[0]
    expect(output).toContain("Error:")
    expect(output).toContain("Test error message")
    expect(output).toContain(UI.Style.TEXT_DANGER_BOLD)
    expect(output).toContain(UI.Style.TEXT_NORMAL)
  })

  test("should format success messages with proper styling", () => {
    UI.success("Test success message")
    
    expect(consoleSpy.error).toHaveLength(1)
    const output = consoleSpy.error[0]
    expect(output).toContain("Success:")
    expect(output).toContain("Test success message")
    expect(output).toContain(UI.Style.TEXT_SUCCESS_BOLD)
    expect(output).toContain(UI.Style.TEXT_NORMAL)
  })

  test("should format info messages with proper styling", () => {
    UI.info("Test info message")
    
    expect(consoleSpy.error).toHaveLength(1)
    const output = consoleSpy.error[0]
    expect(output).toContain("Info:")
    expect(output).toContain("Test info message")
    expect(output).toContain(UI.Style.TEXT_INFO_BOLD)
    expect(output).toContain(UI.Style.TEXT_NORMAL)
  })

  test("should format warning messages with proper styling", () => {
    UI.warning("Test warning message")
    
    expect(consoleSpy.error).toHaveLength(1)
    const output = consoleSpy.error[0]
    expect(output).toContain("Warning:")
    expect(output).toContain("Test warning message")
    expect(output).toContain(UI.Style.TEXT_WARNING_BOLD)
    expect(output).toContain(UI.Style.TEXT_NORMAL)
  })

  test("should format header messages with proper styling", () => {
    UI.header("Test header")
    
    expect(consoleSpy.error).toHaveLength(1)
    const output = consoleSpy.error[0]
    expect(output).toContain("Test header")
    expect(output).toContain(UI.Style.TEXT_HIGHLIGHT_BOLD)
    expect(output).toContain(UI.Style.TEXT_NORMAL)
  })

  test("should format dim messages with proper styling", () => {
    UI.dim("Test dim message")
    
    expect(consoleSpy.error).toHaveLength(1)
    const output = consoleSpy.error[0]
    expect(output).toContain("Test dim message")
    expect(output).toContain(UI.Style.TEXT_DIM)
    expect(output).toContain(UI.Style.TEXT_NORMAL)
  })

  test("should format bold messages with proper styling", () => {
    UI.bold("Test bold message")
    
    expect(consoleSpy.error).toHaveLength(1)
    const output = consoleSpy.error[0]
    expect(output).toContain("Test bold message")
    expect(output).toContain(UI.Style.TEXT_NORMAL_BOLD)
    expect(output).toContain(UI.Style.TEXT_NORMAL)
  })

  test("should format project status indicators correctly", () => {
    const runningStatus = UI.projectStatus("running")
    expect(runningStatus).toContain("●")
    expect(runningStatus).toContain("running")
    expect(runningStatus).toContain(UI.Style.TEXT_SUCCESS_BOLD)
    expect(runningStatus).toContain(UI.Style.TEXT_SUCCESS)

    const stoppedStatus = UI.projectStatus("stopped")
    expect(stoppedStatus).toContain("●")
    expect(stoppedStatus).toContain("stopped")
    expect(stoppedStatus).toContain(UI.Style.TEXT_DIM_BOLD)
    expect(stoppedStatus).toContain(UI.Style.TEXT_DIM)

    const startingStatus = UI.projectStatus("starting")
    expect(startingStatus).toContain("●")
    expect(startingStatus).toContain("starting")
    expect(startingStatus).toContain(UI.Style.TEXT_WARNING_BOLD)
    expect(startingStatus).toContain(UI.Style.TEXT_WARNING)

    const stoppingStatus = UI.projectStatus("stopping")
    expect(stoppingStatus).toContain("●")
    expect(stoppingStatus).toContain("stopping")
    expect(stoppingStatus).toContain(UI.Style.TEXT_WARNING_BOLD)
    expect(stoppingStatus).toContain(UI.Style.TEXT_WARNING)

    const failedStatus = UI.projectStatus("failed")
    expect(failedStatus).toContain("●")
    expect(failedStatus).toContain("failed")
    expect(failedStatus).toContain(UI.Style.TEXT_DANGER_BOLD)
    expect(failedStatus).toContain(UI.Style.TEXT_DANGER)

    const unknownStatus = UI.projectStatus("unknown")
    expect(unknownStatus).toContain("●")
    expect(unknownStatus).toContain("unknown")
    expect(unknownStatus).toContain(UI.Style.TEXT_DIM_BOLD)
    expect(unknownStatus).toContain(UI.Style.TEXT_DIM)
  })

  test("should format field labels and values correctly", () => {
    const normalField = UI.field("Label", "Value")
    expect(normalField).toContain("Label:")
    expect(normalField).toContain("Value")
    expect(normalField).toContain(UI.Style.TEXT_DIM_BOLD)
    expect(normalField).toContain(UI.Style.TEXT_NORMAL)

    const highlightedField = UI.field("Label", "Value", true)
    expect(highlightedField).toContain("Label:")
    expect(highlightedField).toContain("Value")
    expect(highlightedField).toContain(UI.Style.TEXT_HIGHLIGHT_BOLD)
    expect(highlightedField).toContain(UI.Style.TEXT_HIGHLIGHT)
  })

  test("should format list items correctly", () => {
    const listItem = UI.listItem(1, "Project Name")
    expect(listItem).toContain("1.")
    expect(listItem).toContain("Project Name")
    expect(listItem).toContain(UI.Style.TEXT_DIM)
    expect(listItem).toContain(UI.Style.TEXT_NORMAL_BOLD)

    const listItemWithStatus = UI.listItem(2, "Running Project", "running")
    expect(listItemWithStatus).toContain("2.")
    expect(listItemWithStatus).toContain("Running Project")
    expect(listItemWithStatus).toContain("●")
    expect(listItemWithStatus).toContain("running")
    expect(listItemWithStatus).toContain(UI.Style.TEXT_SUCCESS_BOLD)
  })

  test("should create ASCII art logo", () => {
    const logo = UI.logo()
    expect(logo).toBeDefined()
    expect(logo.length).toBeGreaterThan(0)
    expect(logo).toContain("█")
    expect(logo).toContain("ORCHESTRATOR")
  })

  test("should handle empty output correctly", () => {
    UI.empty()
    
    expect(consoleSpy.error).toHaveLength(1)
    const output = consoleSpy.error[0]
    expect(output).toContain(UI.Style.TEXT_NORMAL)
  })

  test("should handle print and println correctly", () => {
    UI.print("Test", "message")
    UI.println("Test", "println")
    
    expect(consoleSpy.error).toHaveLength(2)
    expect(consoleSpy.error[0]).toContain("Test message")
    expect(consoleSpy.error[1]).toContain("Test println")
  })

  test("should maintain consistent color scheme with main OpenCode CLI", () => {
    // Verify colors match expected ANSI codes for consistency
    const expectedColors = {
      HIGHLIGHT: "\x1b[96m",
      DIM: "\x1b[90m", 
      NORMAL: "\x1b[0m",
      WARNING: "\x1b[93m",
      DANGER: "\x1b[91m",
      SUCCESS: "\x1b[92m",
      INFO: "\x1b[94m",
    }

    expect(UI.Style.TEXT_HIGHLIGHT).toBe(expectedColors.HIGHLIGHT)
    expect(UI.Style.TEXT_DIM).toBe(expectedColors.DIM)
    expect(UI.Style.TEXT_NORMAL).toBe(expectedColors.NORMAL)
    expect(UI.Style.TEXT_WARNING).toBe(expectedColors.WARNING)
    expect(UI.Style.TEXT_DANGER).toBe(expectedColors.DANGER)
    expect(UI.Style.TEXT_SUCCESS).toBe(expectedColors.SUCCESS)
    expect(UI.Style.TEXT_INFO).toBe(expectedColors.INFO)
  })

  test("should provide consistent output format", () => {
    // Test that all output functions use stderr
    UI.error("error")
    UI.success("success")
    UI.info("info")
    UI.warning("warning")
    UI.header("header")
    UI.dim("dim")
    UI.bold("bold")

    // All output should go to console.error (stderr)
    expect(consoleSpy.error).toHaveLength(7)
  })

  test("should handle special characters in messages", () => {
    const specialMessage = "Test with 🚀 emojis and & symbols < > \" '"
    UI.info(specialMessage)
    
    expect(consoleSpy.error).toHaveLength(1)
    const output = consoleSpy.error[0]
    expect(output).toContain(specialMessage)
  })

  test("should format long messages correctly", () => {
    const longMessage = "This is a very long message that should be handled correctly by the UI system without breaking or causing issues with the terminal output formatting and styling."
    UI.info(longMessage)
    
    expect(consoleSpy.error).toHaveLength(1)
    const output = consoleSpy.error[0]
    expect(output).toContain(longMessage)
    expect(output).toContain(UI.Style.TEXT_INFO_BOLD)
    expect(output).toContain(UI.Style.TEXT_NORMAL)
  })

  test("should provide utilities for complex formatting", () => {
    // Test combining multiple UI functions
    UI.header("Project Details")
    UI.println(UI.field("Name", "test-project", true))
    UI.println(UI.field("Status", "running"))
    UI.println(UI.projectStatus("running"))
    UI.empty()
    UI.success("All formatting working correctly")

    expect(consoleSpy.error.length).toBeGreaterThan(5)
    
    // Check that complex formatting produces expected output structure
    const output = consoleSpy.error.join("\n")
    expect(output).toContain("Project Details")
    expect(output).toContain("Name:")
    expect(output).toContain("test-project")
    expect(output).toContain("Status:")
    expect(output).toContain("running")
    expect(output).toContain("●")
    expect(output).toContain("Success:")
  })
})