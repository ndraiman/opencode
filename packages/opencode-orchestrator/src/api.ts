import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import type { ProjectManager } from "./project-manager.js"
import type { ProxyService } from "./proxy.js"
import { CreateProjectSchema, ProxyRequestSchema } from "./types.js"

// A minimal context type to silence strict noImplicitAny.
// Hono provides its own generics, but we keep it as unknown here to avoid bringing large typings.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ctx = any

export function createApiRouter(projectManager: ProjectManager, proxyService: ProxyService) {
  const app = new Hono()

  // Health check
  app.get("/", (c: Ctx) => {
    return c.json({ 
      message: "OpenCode Orchestrator API",
      version: "0.0.1",
      timestamp: new Date().toISOString()
    })
  })

  // Create new project
  app.post("/projects", zValidator("json", CreateProjectSchema), async (c: Ctx) => {
    try {
      const input = c.req.valid("json")
      const project = await projectManager.createProject(input)
      return c.json(project, 201)
    } catch (error) {
      return c.json({
        error: "Failed to create project",
        message: error instanceof Error ? error.message : "Unknown error"
      }, 400)
    }
  })

  // List all projects
  app.get("/projects", async (c: Ctx) => {
    try {
      const projects = await projectManager.listProjects()
      return c.json({ projects })
    } catch (error) {
      return c.json({
        error: "Failed to list projects",
        message: error instanceof Error ? error.message : "Unknown error"
      }, 500)
    }
  })

  // Get project details
  app.get("/projects/:projectId", async (c: Ctx) => {
    try {
      const projectId = c.req.param("projectId")
      const project = await projectManager.getProject(projectId)
      
      if (!project) {
        return c.json({ error: "Project not found" }, 404)
      }
      
      return c.json(project)
    } catch (error) {
      return c.json({
        error: "Failed to get project",
        message: error instanceof Error ? error.message : "Unknown error"
      }, 500)
    }
  })

  // Delete project
  app.delete("/projects/:projectId", async (c: Ctx) => {
    try {
      const projectId = c.req.param("projectId")
      await projectManager.deleteProject(projectId)
      return c.json({ message: "Project deleted successfully" })
    } catch (error) {
      if (error instanceof Error && error.message === "Project not found") {
        return c.json({ error: "Project not found" }, 404)
      }
      return c.json({
        error: "Failed to delete project",
        message: error instanceof Error ? error.message : "Unknown error"
      }, 500)
    }
  })

  // Start project instance
  app.post("/projects/:projectId/start", async (c: Ctx) => {
    try {
      const projectId = c.req.param("projectId")
      await projectManager.startProject(projectId)
      return c.json({ message: "Project started successfully" })
    } catch (error) {
      if (error instanceof Error && error.message === "Project not found") {
        return c.json({ error: "Project not found" }, 404)
      }
      return c.json({
        error: "Failed to start project",
        message: error instanceof Error ? error.message : "Unknown error"
      }, 500)
    }
  })

  // Stop project instance
  app.post("/projects/:projectId/stop", async (c: Ctx) => {
    try {
      const projectId = c.req.param("projectId")
      await projectManager.stopProject(projectId)
      return c.json({ message: "Project stopped successfully" })
    } catch (error) {
      if (error instanceof Error && error.message === "Project not found") {
        return c.json({ error: "Project not found" }, 404)
      }
      return c.json({
        error: "Failed to stop project",
        message: error instanceof Error ? error.message : "Unknown error"
      }, 500)
    }
  })

  // Restart project instance
  app.post("/projects/:projectId/restart", async (c: Ctx) => {
    try {
      const projectId = c.req.param("projectId")
      await projectManager.restartProject(projectId)
      return c.json({ message: "Project restarted successfully" })
    } catch (error) {
      if (error instanceof Error && error.message === "Project not found") {
        return c.json({ error: "Project not found" }, 404)
      }
      return c.json({
        error: "Failed to restart project",
        message: error instanceof Error ? error.message : "Unknown error"
      }, 500)
    }
  })

  // Proxy HTTP requests to project instance
  app.post("/projects/:projectId/proxy", zValidator("json", ProxyRequestSchema), async (c: Ctx) => {
    try {
      const projectId = c.req.param("projectId")
      const proxyRequest = c.req.valid("json")
      
      const response = await proxyService.proxyRequest(projectId, proxyRequest)
      return response
    } catch (error) {
      return c.json({
        error: "Proxy request failed",
        message: error instanceof Error ? error.message : "Unknown error"
      }, 500)
    }
  })

  // Proxy WebSocket connections to project instance
  app.get("/projects/:projectId/ws", async (c: Ctx) => {
    try {
      const projectId = c.req.param("projectId")
      const response = await proxyService.proxyWebSocket(projectId, c.req.raw)
      return response
    } catch (error) {
      return c.json({
        error: "WebSocket proxy failed",
        message: error instanceof Error ? error.message : "Unknown error"
      }, 500)
    }
  })

  // Get project logs
  app.get("/projects/:projectId/logs", async (c: Ctx) => {
    try {
      const projectId = c.req.param("projectId")
      const logs = await projectManager.getProjectLogs(projectId)
      return c.json({ logs })
    } catch (error) {
      return c.json({
        error: "Failed to get project logs",
        message: error instanceof Error ? error.message : "Unknown error"
      }, 500)
    }
  })

  // Generic proxy endpoint for any HTTP method/path
  app.all("/projects/:projectId/proxy/*", async (c: Ctx) => {
    try {
      const projectId = c.req.param("projectId")
      const path = "/" + c.req.param("*")
      const method = c.req.method
      
             // Get headers as a plain object
       const headers: Record<string, string> = {}
       const requestHeaders = c.req.header()
       Object.entries(requestHeaders).forEach(([key, value]) => {
         if (typeof value === 'string') {
           headers[key] = value
         }
       })
      
      // Get body if present
      let body: string | undefined
      if (method !== "GET" && method !== "HEAD") {
        try {
          body = await c.req.text()
        } catch {
          // No body or invalid body
        }
      }
      
      const response = await proxyService.proxyRequest(projectId, {
        method,
        path,
        headers,
        body,
      })
      
      return response
    } catch (error) {
      return c.json({
        error: "Proxy request failed",
        message: error instanceof Error ? error.message : "Unknown error"
      }, 500)
    }
  })

  return app
}