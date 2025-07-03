import { describe, expect, test, beforeEach, afterEach, mock } from "bun:test"
import { ProxyService } from "../src/proxy.js"
import type { OrchestratorState, ProxyRequestInput } from "../src/types.js"

// Mock fetch
const mockFetch = mock(() => Promise.resolve(new Response("mocked response", { status: 200 })))
const originalFetch = globalThis.fetch

beforeEach(() => {
  globalThis.fetch = mockFetch as any
})

afterEach(() => {
  // Restore fetch global
  globalThis.fetch = originalFetch
  
  // Clear mock state
  mockFetch.mockClear()
  
  // Reset mock implementation to default
  mockFetch.mockImplementation(() => Promise.resolve(new Response("mocked response", { status: 200 })))
})

describe("ProxyService", () => {
  let state: OrchestratorState
  let proxyService: ProxyService

  beforeEach(() => {
    state = {
      projects: new Map(),
      processes: new Map()
    }
    
    proxyService = new ProxyService(state)
  })

  describe("proxyRequest", () => {
    test("should return 404 for non-existent project", async () => {
      const request: ProxyRequestInput = {
        method: "GET",
        path: "/api/test"
      }

      const response = await proxyService.proxyRequest("non-existent-id", request)
      
      expect(response.status).toBe(404)
      const text = await response.text()
      expect(text).toBe("Project not found")
    })

    test("should return 503 for stopped project", async () => {
      const project = {
        id: "test-project-id",
        name: "test-project",
        type: "empty" as const,
        status: "stopped" as const,
        path: "/path/to/project",
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      state.projects.set(project.id, project)

      const request: ProxyRequestInput = {
        method: "GET", 
        path: "/api/test"
      }

      const response = await proxyService.proxyRequest(project.id, request)
      
      expect(response.status).toBe(503)
      const text = await response.text()
      expect(text).toBe("Project is not running")
    })

    test("should return 503 for running project without port", async () => {
      const project = {
        id: "test-project-id",
        name: "test-project",
        type: "empty" as const,
        status: "running" as const,
        path: "/path/to/project",
        createdAt: new Date(),
        updatedAt: new Date()
        // No port specified
      }
      
      state.projects.set(project.id, project)

      const request: ProxyRequestInput = {
        method: "GET",
        path: "/api/test"
      }

      const response = await proxyService.proxyRequest(project.id, request)
      
      expect(response.status).toBe(503)
      const text = await response.text()
      expect(text).toBe("Project is not running")
    })

    test("should proxy GET request to running project", async () => {
      const project = {
        id: "test-project-id",
        name: "test-project", 
        type: "empty" as const,
        status: "running" as const,
        path: "/path/to/project",
        port: 4096,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      state.projects.set(project.id, project)

      const request: ProxyRequestInput = {
        method: "GET",
        path: "/api/status"
      }

      mockFetch.mockResolvedValueOnce(
        new Response("OpenCode instance status", { 
          status: 200,
          headers: { "Content-Type": "text/plain" }
        })
      )

      const response = await proxyService.proxyRequest(project.id, request)
      
      expect(response.status).toBe(200)
      const text = await response.text()
      expect(text).toBe("OpenCode instance status")
      
      expect(mockFetch).toHaveBeenCalledWith("http://127.0.0.1:4096/api/status", {
        method: "GET",
        headers: undefined,
        body: undefined
      })
    })

    test("should proxy POST request with headers and body", async () => {
      const project = {
        id: "test-project-id",
        name: "test-project",
        type: "empty" as const,
        status: "running" as const,
        path: "/path/to/project",
        port: 4097,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      state.projects.set(project.id, project)

      const request: ProxyRequestInput = {
        method: "POST",
        path: "/api/create",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer token123"
        },
        body: JSON.stringify({ name: "test" })
      }

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { 
          status: 201,
          headers: { "Content-Type": "application/json" }
        })
      )

      const response = await proxyService.proxyRequest(project.id, request)
      
      expect(response.status).toBe(201)
      const json = await response.json()
      expect(json).toEqual({ success: true })
      
      expect(mockFetch).toHaveBeenCalledWith("http://127.0.0.1:4097/api/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer token123"
        },
        body: JSON.stringify({ name: "test" })
      })
    })

    test("should handle fetch errors", async () => {
      const project = {
        id: "test-project-id",
        name: "test-project",
        type: "empty" as const,
        status: "running" as const,
        path: "/path/to/project",
        port: 4098,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      state.projects.set(project.id, project)

      const request: ProxyRequestInput = {
        method: "GET",
        path: "/api/fail"
      }

      mockFetch.mockRejectedValueOnce(new Error("Connection refused"))

      const response = await proxyService.proxyRequest(project.id, request)
      
      expect(response.status).toBe(502)
      const json = await response.json()
      expect(json.error).toBe("Proxy request failed")
      expect(json.message).toBe("Connection refused")
    })

    test("should preserve response headers and status", async () => {
      const project = {
        id: "test-project-id",
        name: "test-project",
        type: "empty" as const,
        status: "running" as const,
        path: "/path/to/project",
        port: 4099,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      state.projects.set(project.id, project)

      const request: ProxyRequestInput = {
        method: "GET",
        path: "/api/custom"
      }

      mockFetch.mockResolvedValueOnce(
        new Response("Custom response", { 
          status: 418, // I'm a teapot
          statusText: "I'm a teapot",
          headers: {
            "Custom-Header": "custom-value",
            "Cache-Control": "no-cache"
          }
        })
      )

      const response = await proxyService.proxyRequest(project.id, request)
      
      expect(response.status).toBe(418)
      expect(response.statusText).toBe("I'm a teapot")
      expect(response.headers.get("Custom-Header")).toBe("custom-value")
      expect(response.headers.get("Cache-Control")).toBe("no-cache")
    })
  })

  describe("proxyWebSocket", () => {
    test("should return 404 for non-existent project", async () => {
      const request = new Request("http://localhost:3000/ws", {
        headers: { "Upgrade": "websocket" }
      })

      const response = await proxyService.proxyWebSocket("non-existent-id", request)
      
      expect(response.status).toBe(404)
      const text = await response.text()
      expect(text).toBe("Project not found")
    })

    test("should return 503 for stopped project", async () => {
      const project = {
        id: "test-project-id",
        name: "test-project",
        type: "empty" as const,
        status: "stopped" as const,
        path: "/path/to/project",
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      state.projects.set(project.id, project)

      const request = new Request("http://localhost:3000/ws", {
        headers: { "Upgrade": "websocket" }
      })

      const response = await proxyService.proxyWebSocket(project.id, request)
      
      expect(response.status).toBe(503)
      const text = await response.text()
      expect(text).toBe("Project is not running")
    })

    test("should return 400 for non-websocket request", async () => {
      const project = {
        id: "test-project-id",
        name: "test-project",
        type: "empty" as const,
        status: "running" as const,
        path: "/path/to/project",
        port: 4096,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      state.projects.set(project.id, project)

      const request = new Request("http://localhost:3000/not-ws")

      const response = await proxyService.proxyWebSocket(project.id, request)
      
      expect(response.status).toBe(400)
      const text = await response.text()
      expect(text).toBe("Expected WebSocket upgrade")
    })

    test("should handle websocket proxy for running project", async () => {
      const project = {
        id: "test-project-id",
        name: "test-project",
        type: "empty" as const,
        status: "running" as const,
        path: "/path/to/project",
        port: 4096,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      state.projects.set(project.id, project)

      const request = new Request("http://localhost:3000/ws/test", {
        headers: { "Upgrade": "websocket" }
      })

      const response = await proxyService.proxyWebSocket(project.id, request)
      
      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.message).toBe("WebSocket proxy endpoint")
      expect(json.targetUrl).toBe("ws://127.0.0.1:4096/ws/test")
    })
  })
})