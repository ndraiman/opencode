import type { OrchestratorState, ProxyRequestInput } from "./types.js"

export class ProxyService {
  private state: OrchestratorState

  constructor(state: OrchestratorState) {
    this.state = state
  }

  async proxyRequest(projectId: string, request: ProxyRequestInput): Promise<Response> {
    const project = this.state.projects.get(projectId)
    if (!project) {
      return new Response("Project not found", { status: 404 })
    }

    if (project.status !== "running" || !project.port) {
      return new Response("Project is not running", { status: 503 })
    }

    const targetUrl = `http://127.0.0.1:${project.port}${request.path}`

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      })

      // Clone the response to preserve headers and body
      const clonedResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      })

      return clonedResponse
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Proxy request failed",
          message: error instanceof Error ? error.message : "Unknown error",
        }),
        { 
          status: 502,
          headers: { "Content-Type": "application/json" }
        }
      )
    }
  }

  async proxyWebSocket(projectId: string, request: Request): Promise<Response> {
    const project = this.state.projects.get(projectId)
    if (!project) {
      return new Response("Project not found", { status: 404 })
    }

    if (project.status !== "running" || !project.port) {
      return new Response("Project is not running", { status: 503 })
    }

    // Check if this is a WebSocket upgrade request
    const upgrade = request.headers.get("upgrade")
    if (upgrade !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 400 })
    }

    try {
      // For Bun runtime, we need to handle WebSocket differently
      // This is a basic implementation that forwards the request
      const targetUrl = `ws://127.0.0.1:${project.port}${new URL(request.url).pathname}`
      
      // For now, return a simple response indicating WebSocket proxy
      // In a full implementation, you'd need to handle the WebSocket upgrade
      return new Response(
        JSON.stringify({
          message: "WebSocket proxy endpoint",
          targetUrl,
          note: "WebSocket proxying requires runtime-specific implementation"
        }),
        { 
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      )
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "WebSocket proxy failed",
          message: error instanceof Error ? error.message : "Unknown error",
        }),
        { 
          status: 502,
          headers: { "Content-Type": "application/json" }
        }
      )
    }
  }
}