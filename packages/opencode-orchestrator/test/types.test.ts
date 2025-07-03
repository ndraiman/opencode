import { describe, expect, test } from "bun:test"
import { 
  ProjectStatus, 
  CreateProjectSchema, 
  ProjectSchema,
  ProxyRequestSchema,
  type Project,
  type CreateProjectInput,
  type ProxyRequestInput
} from "../src/types.js"

describe("Types and Schemas", () => {
  describe("ProjectStatus", () => {
    test("should validate valid status values", () => {
      const validStatuses = ["stopped", "starting", "running", "stopping", "failed"]
      
      validStatuses.forEach(status => {
        expect(() => ProjectStatus.parse(status)).not.toThrow()
      })
    })

    test("should reject invalid status values", () => {
      const invalidStatuses = ["invalid", "pending", "unknown", ""]
      
      invalidStatuses.forEach(status => {
        expect(() => ProjectStatus.parse(status)).toThrow()
      })
    })
  })

  describe("CreateProjectSchema", () => {
    test("should validate valid git project input", () => {
      const validInput: CreateProjectInput = {
        name: "test-project",
        type: "git",
        gitUrl: "https://github.com/user/repo.git",
        gitBranch: "main",
        description: "Test project"
      }

      expect(() => CreateProjectSchema.parse(validInput)).not.toThrow()
    })

    test("should validate valid empty project input", () => {
      const validInput: CreateProjectInput = {
        name: "empty-project",
        type: "empty"
      }

      expect(() => CreateProjectSchema.parse(validInput)).not.toThrow()
    })

    test("should require name field", () => {
      const invalidInput = {
        type: "empty"
      }

      expect(() => CreateProjectSchema.parse(invalidInput)).toThrow()
    })

    test("should reject empty name", () => {
      const invalidInput = {
        name: "",
        type: "empty"
      }

      expect(() => CreateProjectSchema.parse(invalidInput)).toThrow()
    })

    test("should reject invalid project type", () => {
      const invalidInput = {
        name: "test",
        type: "invalid"
      }

      expect(() => CreateProjectSchema.parse(invalidInput)).toThrow()
    })

    test("should reject invalid git URL", () => {
      const invalidInput = {
        name: "test",
        type: "git",
        gitUrl: "not-a-url"
      }

      expect(() => CreateProjectSchema.parse(invalidInput)).toThrow()
    })
  })

  describe("ProjectSchema", () => {
    test("should validate complete project object", () => {
      const validProject: Project = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "test-project",
        type: "git",
        gitUrl: "https://github.com/user/repo.git",
        gitBranch: "main",
        description: "Test project",
        status: "running",
        path: "/path/to/project",
        port: 4096,
        pid: 12345,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      expect(() => ProjectSchema.parse(validProject)).not.toThrow()
    })

    test("should validate minimal project object", () => {
      const minimalProject = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "test-project",
        type: "empty",
        status: "stopped",
        path: "/path/to/project",
        createdAt: new Date(),
        updatedAt: new Date()
      }

      expect(() => ProjectSchema.parse(minimalProject)).not.toThrow()
    })

    test("should reject project with missing required fields", () => {
      const invalidProject = {
        name: "test-project",
        type: "empty"
        // missing required fields
      }

      expect(() => ProjectSchema.parse(invalidProject)).toThrow()
    })
  })

  describe("ProxyRequestSchema", () => {
    test("should validate complete proxy request", () => {
      const validRequest: ProxyRequestInput = {
        method: "POST",
        path: "/api/test",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer token"
        },
        body: JSON.stringify({ test: "data" })
      }

      expect(() => ProxyRequestSchema.parse(validRequest)).not.toThrow()
    })

    test("should validate minimal proxy request", () => {
      const minimalRequest = {
        method: "GET",
        path: "/"
      }

      expect(() => ProxyRequestSchema.parse(minimalRequest)).not.toThrow()
    })

    test("should reject request with missing required fields", () => {
      const invalidRequest = {
        method: "GET"
        // missing path
      }

      expect(() => ProxyRequestSchema.parse(invalidRequest)).toThrow()
    })

    test("should handle various HTTP methods", () => {
      const methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]
      
      methods.forEach(method => {
        const request = {
          method,
          path: "/test"
        }
        
        expect(() => ProxyRequestSchema.parse(request)).not.toThrow()
      })
    })
  })
})