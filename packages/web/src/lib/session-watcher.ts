import type { Session } from "opencode/session/index"

export interface SessionWatcher {
  disconnect: () => void
}

export interface SessionWatcherCallbacks {
  onSessionUpdated?: (session: Session.Info) => void
  onError?: (error: Error) => void
}

export function watchSession(
  apiUrl: string, 
  sessionId: string, 
  callbacks: SessionWatcherCallbacks
): SessionWatcher {
  let eventSource: EventSource | null = null
  
  const connect = () => {
    try {
      eventSource = new EventSource(`${apiUrl}/event`)
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          // Debug: log all events to see what we're getting
          console.log("[SessionWatcher] Received event:", data)
          
          // Check if this is a session.updated event for our session
          if (data.type === "session.updated" && 
              data.properties?.info?.id === sessionId) {
            console.log("[SessionWatcher] Session updated for our session:", data.properties.info)
            callbacks.onSessionUpdated?.(data.properties.info)
          }
        } catch (err) {
          console.error("Failed to parse event data:", err)
        }
      }
      
      eventSource.onerror = (error) => {
        console.error("EventSource error:", error)
        callbacks.onError?.(new Error("Event stream connection failed"))
      }
      
      eventSource.onopen = () => {
        console.log("Session watcher connected")
      }
    } catch (err) {
      callbacks.onError?.(err instanceof Error ? err : new Error(String(err)))
    }
  }
  
  const disconnect = () => {
    if (eventSource) {
      eventSource.close()
      eventSource = null
      console.log("Session watcher disconnected")
    }
  }
  
  // Start watching
  connect()
  
  return { disconnect }
}