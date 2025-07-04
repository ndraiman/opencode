/**
 * Test configuration for orchestrator integration tests
 *
 * Environment variables:
 * - TEST_TIMEOUT: Maximum timeout for test operations (default: 10000ms)
 * - TEST_PORT_MIN: Minimum port for test servers (default: 4000)
 * - TEST_PORT_MAX: Maximum port for test servers (default: 5000)
 * - TEST_WORKSPACE: Custom workspace directory for tests
 * - SKIP_TEST_CLEANUP: Skip cleanup of test directories (default: false)
 * - TEST_CONCURRENCY: Number of concurrent test operations (default: 1)
 * - TEST_RETRY_ATTEMPTS: Number of retry attempts for flaky operations (default: 3)
 * - TEST_RETRY_DELAY: Delay between retry attempts in ms (default: 1000)
 * - TEST_LOG_LEVEL: Log level for test output (default: 'error')
 * - TEST_PERFORMANCE_ENABLED: Enable performance testing (default: false)
 * - TEST_PERFORMANCE_THRESHOLD: Performance threshold in ms (default: 5000)
 * - CI: Set to 'true' in CI environment for adjusted timeouts
 */

export interface TestConfig {
  timeout: number
  portRange: {
    min: number
    max: number
  }
  workspace?: string
  skipCleanup: boolean
  concurrency: number
  retry: {
    attempts: number
    delay: number
  }
  logging: {
    level: "debug" | "info" | "warn" | "error"
    enabled: boolean
  }
  performance: {
    enabled: boolean
    threshold: number
  }
  ci: {
    enabled: boolean
    timeoutMultiplier: number
  }
}

/**
 * Load test configuration from environment variables
 */
function loadTestConfig(): TestConfig {
  const isCI = process.env["CI"] === "true"
  const baseTimeout = parseInt(process.env["TEST_TIMEOUT"] || "10000")

  return {
    timeout: isCI ? baseTimeout * 2 : baseTimeout,
    portRange: {
      min: parseInt(process.env["TEST_PORT_MIN"] || "4000"),
      max: parseInt(process.env["TEST_PORT_MAX"] || "5000"),
    },
    workspace: process.env["TEST_WORKSPACE"] || undefined,
    skipCleanup: process.env["SKIP_TEST_CLEANUP"] === "true",
    concurrency: parseInt(process.env["TEST_CONCURRENCY"] || "1"),
    retry: {
      attempts: parseInt(process.env["TEST_RETRY_ATTEMPTS"] || "3"),
      delay: parseInt(process.env["TEST_RETRY_DELAY"] || "1000"),
    },
    logging: {
      level: (process.env["TEST_LOG_LEVEL"] as any) || "error",
      enabled: process.env["TEST_LOG_ENABLED"] !== "false",
    },
    performance: {
      enabled: process.env["TEST_PERFORMANCE_ENABLED"] === "true",
      threshold: parseInt(process.env["TEST_PERFORMANCE_THRESHOLD"] || "5000"),
    },
    ci: {
      enabled: isCI,
      timeoutMultiplier: isCI ? 2 : 1,
    },
  }
}

/**
 * Global test configuration
 */
export const TEST_CONFIG = loadTestConfig()

/**
 * Test environment profiles for different scenarios
 */
export const TEST_PROFILES = {
  /**
   * Quick profile for unit tests
   */
  quick: {
    ...TEST_CONFIG,
    timeout: 5000,
    retry: { attempts: 1, delay: 100 },
    performance: { enabled: false, threshold: 1000 },
  },

  /**
   * Integration profile for comprehensive testing
   */
  integration: {
    ...TEST_CONFIG,
    timeout: 30000,
    retry: { attempts: 3, delay: 1000 },
    performance: { enabled: true, threshold: 10000 },
  },

  /**
   * Performance profile for load testing
   */
  performance: {
    ...TEST_CONFIG,
    timeout: 60000,
    retry: { attempts: 5, delay: 2000 },
    performance: { enabled: true, threshold: 5000 },
    concurrency: 5,
  },

  /**
   * CI profile for continuous integration
   */
  ci: {
    ...TEST_CONFIG,
    timeout: TEST_CONFIG.timeout * 2,
    retry: { attempts: 5, delay: 2000 },
    logging: { level: "info" as const, enabled: true },
    skipCleanup: false,
  },
}

/**
 * Get test configuration for a specific profile
 */
export function getTestConfig(
  profile: keyof typeof TEST_PROFILES = "integration",
): TestConfig {
  return TEST_PROFILES[profile]
}

/**
 * Test timeouts for different operations
 */
export const TEST_TIMEOUTS = {
  // Basic operations
  immediate: 1000,
  short: 5000,
  medium: 10000,
  long: 30000,

  // Specific operations
  projectCreate: getTestConfig().timeout,
  projectStart: getTestConfig().timeout * 2,
  projectStop: getTestConfig().timeout,
  projectRestart: getTestConfig().timeout * 3,
  gitClone: getTestConfig().timeout * 4,
  processSpawn: getTestConfig().timeout,
  processKill: getTestConfig().timeout / 2,

  // Batch operations
  batchCreate: getTestConfig().timeout * 5,
  batchStart: getTestConfig().timeout * 10,
  batchStop: getTestConfig().timeout * 5,

  // Network operations
  portCheck: 2000,
  serverStart: 5000,
  serverStop: 3000,

  // File operations
  fileCreate: 2000,
  fileDelete: 2000,
  directoryCleanup: 5000,
}

/**
 * Test port ranges for different scenarios
 */
export const TEST_PORT_RANGES = {
  integration: { min: 4000, max: 4099 },
  unit: { min: 4100, max: 4199 },
  performance: { min: 4200, max: 4299 },
  ci: { min: 4300, max: 4399 },
}

/**
 * Test data limits
 */
export const TEST_LIMITS = {
  maxProjects: 10,
  maxConcurrentProjects: 5,
  maxLogLines: 1000,
  maxRetries: getTestConfig().retry.attempts,
  maxTimeout: getTestConfig().timeout,
}

/**
 * Test environment variables
 */
export const TEST_ENV_VARS = {
  NODE_ENV: "test",
  TEST_MODE: "true",
  BUN_BE_BUN: "1",
  NO_COLOR: "1", // Disable colors in test output
  FORCE_COLOR: "0",
}

/**
 * Validate test configuration
 */
export function validateTestConfig(config: TestConfig): void {
  if (config.timeout <= 0) {
    throw new Error("Test timeout must be greater than 0")
  }

  if (config.portRange.min >= config.portRange.max) {
    throw new Error("Port range minimum must be less than maximum")
  }

  if (config.portRange.min < 1024 || config.portRange.max > 65535) {
    throw new Error("Port range must be between 1024 and 65535")
  }

  if (config.retry.attempts < 1) {
    throw new Error("Retry attempts must be at least 1")
  }

  if (config.retry.delay < 0) {
    throw new Error("Retry delay must be non-negative")
  }

  if (config.concurrency < 1) {
    throw new Error("Concurrency must be at least 1")
  }
}

/**
 * Get test configuration summary for logging
 */
export function getTestConfigSummary(): string {
  const config = TEST_CONFIG
  return `Test Configuration:
  - Timeout: ${config.timeout}ms
  - Port Range: ${config.portRange.min}-${config.portRange.max}
  - Workspace: ${config.workspace || "default"}
  - Skip Cleanup: ${config.skipCleanup}
  - Concurrency: ${config.concurrency}
  - Retry: ${config.retry.attempts} attempts, ${config.retry.delay}ms delay
  - CI Mode: ${config.ci.enabled}
  - Performance Testing: ${config.performance.enabled}
  - Log Level: ${config.logging.level}`
}

/**
 * Initialize test environment
 */
export function initializeTestEnvironment(): void {
  // Validate configuration
  validateTestConfig(TEST_CONFIG)

  // Set environment variables
  Object.entries(TEST_ENV_VARS).forEach(([key, value]) => {
    if (!process.env[key]) {
      process.env[key] = value
    }
  })

  // Log configuration in debug mode
  if (TEST_CONFIG.logging.level === "debug" && TEST_CONFIG.logging.enabled) {
    console.log(getTestConfigSummary())
  }
}

/**
 * Test-specific environment setup
 */
export function setupTestEnvironment(
  additionalEnv: Record<string, string> = {},
): void {
  // Initialize base environment
  initializeTestEnvironment()

  // Add additional environment variables
  Object.entries(additionalEnv).forEach(([key, value]) => {
    process.env[key] = value
  })
}

/**
 * Clean up test environment
 */
export function cleanupTestEnvironment(): void {
  // Remove test-specific environment variables
  Object.keys(TEST_ENV_VARS).forEach((key) => {
    if (process.env[key] === TEST_ENV_VARS[key as keyof typeof TEST_ENV_VARS]) {
      delete process.env[key]
    }
  })
}

// Initialize test environment when this module is loaded
initializeTestEnvironment()
