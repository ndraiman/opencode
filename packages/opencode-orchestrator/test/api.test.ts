import { describe, expect, test, beforeEach, mock } from "bun:test"
import { createApiRouter } from "../src/api.js"
import type { ProjectManager } from "../src/project-manager.js"
import type { ProxyService } from "../src/proxy.js"
import type { CreateProjectInput, Project } from "../src/types.js"

// Mock ProjectManager
const mockProjectManager = {
  createProject: mock(async (input: CreateProjectInput): Promise<Project> => {
    return {
      id: "test-project-id",
      name: input.name,
      type: input.type,
      gitUrl: input.gitUrl,
      gitBranch: input.gitBranch,
      description: input.description,
      status: "stopped",
      path: "/path/to/project",
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }),
  listProjects: mock(async () => []),
  getProject: mock(async (id: string) => {
    if (id === "existing-project") {
      return {
        id: "existing-project",
        name: "test-project",
        type: "empty" as const,
        status: "running" as const,
        path: "/path/to/project",
        port: 4096,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }
    return undefined
  }),
  deleteProject: mock(async (id: string) => {
    if (id === "non-existent") {
      throw new Error("Project not found")
    }
  }),
  startProject: mock(async (id: string) => {
    if (id === "non-existent") {
      throw new Error("Project not found")
    }
  }),
  stopProject: mock(async (id: string) => {
    if (id === "non-existent") {
      throw new Error("Project not found")
    }
  }),
  restartProject: mock(async (id: string) => {
    if (id === "non-existent") {
      throw new Error("Project not found")
    }
  }),
  getProjectLogs: mock(async (id: string) => [
    "[stdout] 2024-01-01T00:00:00.000Z Server started",
    "[stderr] 2024-01-01T00:00:01.000Z Debug info"
  ])
} as unknown as ProjectManager

// Mock ProxyService
const mockProxyService = {
  proxyRequest: mock(async (projectId: string, request: any) => {
    return new Response(JSON.stringify({ proxied: true, projectId }), { 
      status: 200,
      headers: { "Content-Type": "application/json" }
    })
  }),
  proxyWebSocket: mock(async (projectId: string, request: Request) => {
    return new Response(JSON.stringify({ 
      message: "WebSocket proxy",
      projectId 
    }), { 
      status: 200,
      headers: { "Content-Type": "application/json" }
    })
  })
} as unknown as ProxyService

describe("API Router", () => {
  let app: any

  beforeEach(() => {
    app = createApiRouter(mockProjectManager, mockProxyService)
    
    // Clear all mocks
    Object.values(mockProjectManager).forEach(fn => {
      if (typeof fn === 'function' && 'mockClear' in fn) {
        fn.mockClear()
      }
    })
    Object.values(mockProxyService).forEach(fn => {
      if (typeof fn === 'function' && 'mockClear' in fn) {
        fn.mockClear()
      }
    })
  })

  describe("GET /", () => {
    test("should return API info", async () => {
      const request = new Request("http://localhost:3000/")
      const response = await app.fetch(request)
      
      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.message).toBe("OpenCode Orchestrator API")
      expect(json.version).toBe("0.0.1")
      expect(json.timestamp).toBeDefined()
    })
  })

  describe("POST /projects", () => {
    test("should create empty project", async () => {
      const projectData = {
        name: "test-project",
        type: "empty",
        description: "Test project"
      }

      const request = new Request("http://localhost:3000/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectData)
      })

      const response = await app.fetch(request)
      
      expect(response.status).toBe(201)
      const json = await response.json()
      expect(json.id).toBe("test-project-id")
      expect(json.name).toBe("test-project")
      expect(json.type).toBe("empty")
      expect(mockProjectManager.createProject).toHaveBeenCalledWith(projectData)
    })

    test("should create git project", async () => {
      const projectData = {
        name: "git-project",
        type: "git",
        gitUrl: "https://github.com/user/repo.git",
        gitBranch: "main"
      }

      const request = new Request("http://localhost:3000/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectData)
      })

      const response = await app.fetch(request)
      
      expect(response.status).toBe(201)
      const json = await response.json()
      expect(json.name).toBe("git-project")
      expect(json.gitUrl).toBe("https://github.com/user/repo.git")
    })

    test("should validate request body", async () => {
      const invalidData = {
        // Missing required name field
        type: "empty"
      }

      const request = new Request("http://localhost:3000/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidData)
      })

      const response = await app.fetch(request)
      
      expect(response.status).toBe(400)
    })

    test("should handle project creation errors", async () => {
      const errorMock = mock(async () => {
        throw new Error("Git clone failed")
      })
      mockProjectManager.createProject = errorMock

      const projectData = {
        name: "failing-project",
        type: "git",
        gitUrl: "https://github.com/invalid/repo.git"
      }

      const request = new Request("http://localhost:3000/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectData)
      })

      const response = await app.fetch(request)
      
      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toBe("Failed to create project")
      expect(json.message).toBe("Git clone failed")
    })
  })

  describe("GET /projects", () => {
    test("should list all projects", async () => {
      const projects = [
        { id: "1", name: "project1", type: "empty" as const },
        { id: "2", name: "project2", type: "git" as const }
      ]
      const listMock = mock(async () => projects as any)
      mockProjectManager.listProjects = listMock

      const request = new Request("http://localhost:3000/projects")
      const response = await app.fetch(request)
      
      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.projects).toEqual(projects)
      expect(mockProjectManager.listProjects).toHaveBeenCalled()
    })

    test("should handle listing errors", async () => {
      const errorMock = mock(async () => {
        throw new Error("Database error")
      })
      mockProjectManager.listProjects = errorMock

      const request = new Request("http://localhost:3000/projects")
      const response = await app.fetch(request)
      
      expect(response.status).toBe(500)
      const json = await response.json()
      expect(json.error).toBe("Failed to list projects")
    })
  })

  describe("GET /projects/:projectId", () => {
    test("should return existing project", async () => {
      const request = new Request("http://localhost:3000/projects/existing-project")
      const response = await app.fetch(request)
      
      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.id).toBe("existing-project")
      expect(json.name).toBe("test-project")
      expect(mockProjectManager.getProject).toHaveBeenCalledWith("existing-project")
    })

    test("should return 404 for non-existent project", async () => {
      const request = new Request("http://localhost:3000/projects/non-existent")
      const response = await app.fetch(request)
      
      expect(response.status).toBe(404)
      const json = await response.json()
      expect(json.error).toBe("Project not found")
    })
  })

  describe("DELETE /projects/:projectId", () => {
    test("should delete existing project", async () => {
      const request = new Request("http://localhost:3000/projects/existing-project", {
        method: "DELETE"
      })
      const response = await app.fetch(request)
      
      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.message).toBe("Project deleted successfully")
      expect(mockProjectManager.deleteProject).toHaveBeenCalledWith("existing-project")
    })

    test("should return 404 for non-existent project", async () => {
      const request = new Request("http://localhost:3000/projects/non-existent", {
        method: "DELETE"
      })
      const response = await app.fetch(request)
      
      expect(response.status).toBe(404)
      const json = await response.json()
      expect(json.error).toBe("Project not found")
    })
  })

  describe("POST /projects/:projectId/start", () => {
    test("should start project", async () => {
      const request = new Request("http://localhost:3000/projects/existing-project/start", {
        method: "POST"
      })
      const response = await app.fetch(request)
      
      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.message).toBe("Project started successfully")
      expect(mockProjectManager.startProject).toHaveBeenCalledWith("existing-project")
    })

    test("should handle start errors", async () => {
      const request = new Request("http://localhost:3000/projects/non-existent/start", {
        method: "POST"
      })
      const response = await app.fetch(request)
      
      expect(response.status).toBe(404)
      const json = await response.json()
      expect(json.error).toBe("Project not found")
    })
  })

  describe("POST /projects/:projectId/stop", () => {
    test("should stop project", async () => {
      const request = new Request("http://localhost:3000/projects/existing-project/stop", {
        method: "POST"
      })
      const response = await app.fetch(request)
      
      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.message).toBe("Project stopped successfully")
      expect(mockProjectManager.stopProject).toHaveBeenCalledWith("existing-project")
    })
  })

  describe("POST /projects/:projectId/restart", () => {
    test("should restart project", async () => {
      const request = new Request("http://localhost:3000/projects/existing-project/restart", {
        method: "POST"
      })
      const response = await app.fetch(request)
      
      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.message).toBe("Project restarted successfully")
      expect(mockProjectManager.restartProject).toHaveBeenCalledWith("existing-project")
    })
  })

  describe("POST /projects/:projectId/proxy", () => {
    test("should proxy request", async () => {
      const proxyData = {
        method: "GET",
        path: "/api/status",
        headers: { "Authorization": "Bearer token" }
      }

      const request = new Request("http://localhost:3000/projects/existing-project/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proxyData)
      })

      const response = await app.fetch(request)
      
      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.proxied).toBe(true)
      expect(json.projectId).toBe("existing-project")
      expect(mockProxyService.proxyRequest).toHaveBeenCalledWith("existing-project", proxyData)
    })

    test("should validate proxy request body", async () => {
      const invalidData = {
        // Missing required path field
        method: "GET"
      }

      const request = new Request("http://localhost:3000/projects/existing-project/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidData)
      })

      const response = await app.fetch(request)
      
      expect(response.status).toBe(400)
    })
  })

  describe("GET /projects/:projectId/ws", () => {
    test("should proxy websocket connection", async () => {
      const request = new Request("http://localhost:3000/projects/existing-project/ws")
      const response = await app.fetch(request)
      
      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.message).toBe("WebSocket proxy")
      expect(json.projectId).toBe("existing-project")
      expect(mockProxyService.proxyWebSocket).toHaveBeenCalledWith("existing-project", request)
    })
  })

  describe("GET /projects/:projectId/logs", () => {
    test("should return project logs", async () => {
      const request = new Request("http://localhost:3000/projects/existing-project/logs")
      const response = await app.fetch(request)
      
      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.logs).toHaveLength(2)
      expect(json.logs[0]).toContain("Server started")
      expect(json.logs[1]).toContain("Debug info")
      expect(mockProjectManager.getProjectLogs).toHaveBeenCalledWith("existing-project")
    })
  })

  describe("Generic proxy endpoint", () => {
    test("should proxy GET request via wildcard route", async () => {
      const request = new Request("http://localhost:3000/projects/existing-project/proxy/api/status", {
        method: "GET",
        headers: { "Authorization": "Bearer token" }
      })

      const response = await app.fetch(request)
      
      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.proxied).toBe(true)
      
      // Check that mockProxyService.proxyRequest was called
      expect(mockProxyService.proxyRequest).toHaveBeenCalled()
      
      // Verify it was called with correct project ID
      expect(mockProxyService.proxyRequest).toHaveBeenCalledWith(
        "existing-project",
        expect.any(Object)
      )
    })

    test("should proxy POST request with body via wildcard route", async () => {
      const requestBody = JSON.stringify({ test: "data" })
      
      const request = new Request("http://localhost:3000/projects/existing-project/proxy/api/create", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": "Bearer token"
        },
        body: requestBody
      })

      const response = await app.fetch(request)
      
      expect(response.status).toBe(200)
      
      // Check that mockProxyService.proxyRequest was called
      expect(mockProxyService.proxyRequest).toHaveBeenCalled()
      
      // Verify it was called with correct project ID
      expect(mockProxyService.proxyRequest).toHaveBeenCalledWith(
        "existing-project",
        expect.any(Object)
      )
    })
  })
})