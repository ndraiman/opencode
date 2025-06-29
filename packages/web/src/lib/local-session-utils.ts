export interface SessionData {
  rootDir: string | undefined
  created: number
  completed: number | undefined
  models: Record<string, string[]>
  cost: number
  tokens: {
    input: number
    output: number
    reasoning: number
  }
}

export function computeSessionData(
  sessionInfo: any,
  messages: any[],
): SessionData {
  const result: SessionData = {
    rootDir: undefined,
    created: sessionInfo.time.created,
    completed: undefined,
    models: {},
    cost: 0,
    tokens: {
      input: 0,
      output: 0,
      reasoning: 0,
    },
  }

  for (const msg of messages) {
    const assistant = msg.metadata?.assistant
    if (assistant) {
      result.cost += assistant.cost || 0
      result.tokens.input += assistant.tokens?.input || 0
      result.tokens.output += assistant.tokens?.output || 0
      result.tokens.reasoning += assistant.tokens?.reasoning || 0

      if (assistant.providerID && assistant.modelID) {
        result.models[`${assistant.providerID} ${assistant.modelID}`] = [
          assistant.providerID,
          assistant.modelID,
        ]
      }

      if (assistant.path?.root) {
        result.rootDir = assistant.path.root
      }

      if (msg.metadata?.time?.completed) {
        result.completed = msg.metadata.time.completed
      }
    }
  }

  return result
}

export async function fetchProjectSessions(localApiUrl: string) {
  const response = await fetch(`${localApiUrl}/session`, {
    method: "GET",
  })

  if (!response.ok) {
    throw new Error("Failed to fetch sessions")
  }

  return await response.json()
}

export async function fetchSessionMessages(
  localApiUrl: string,
  sessionId: string,
) {
  const response = await fetch(`${localApiUrl}/session/${sessionId}/message`, {
    method: "get",
    headers: { "Content-Type": "application/json" },
  })

  if (!response.ok) {
    throw new Error("Failed to fetch session messages")
  }

  return await response.json()
}

export async function fetchExportedSessions(localApiUrl: string) {
  const response = await fetch(`${localApiUrl}/session/export`, {
    method: "GET",
  })

  if (!response.ok) {
    return []
  }

  return await response.json()
}

export async function sendMessageToSession(
  localApiUrl: string,
  sessionId: string,
  message: string,
  providerID: string,
  modelID: string,
  onDelta?: (delta: string, fullText: string, messageId?: string) => void,
  onComplete?: (message: any) => void,
  onError?: (error: Error) => void,
) {
  // Use streaming for web UI
  if (onDelta) {
    return sendMessageToSessionStream(
      localApiUrl,
      sessionId,
      message,
      providerID,
      modelID,
      onDelta,
      onComplete,
      onError,
    )
  }

  // Fallback to non-streaming for backward compatibility
  const response = await fetch(`${localApiUrl}/session/${sessionId}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      providerID,
      modelID,
      parts: [
        {
          type: "text",
          text: message,
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error("Failed to send message")
  }

  return await response.json()
}

export interface ModelInfo {
  id: string
  name: string
  attachment: boolean
  reasoning: boolean
  temperature: boolean
  tool_call: boolean
  cost: {
    input: number
    output: number
    cache_read?: number
    cache_write?: number
  }
  limit: {
    context: number
    output: number
  }
  options: Record<string, any>
}

export interface ProviderInfo {
  id: string
  name: string
  api?: string
  env: string[]
  npm?: string
  models: Record<string, ModelInfo>
}

export interface ProvidersResponse {
  providers: ProviderInfo[]
  default: Record<string, string>
}

export async function fetchProviders(localApiUrl: string): Promise<ProvidersResponse> {
  const response = await fetch(`${localApiUrl}/config/providers`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  })

  if (!response.ok) {
    throw new Error("Failed to fetch providers")
  }

  return await response.json()
}

export async function createSession(localApiUrl: string): Promise<any> {
  const response = await fetch(`${localApiUrl}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  })

  if (!response.ok) {
    throw new Error("Failed to create session")
  }

  return await response.json()
}

export async function sendMessageToSessionStream(
  localApiUrl: string,
  sessionId: string,
  message: string,
  providerID: string,
  modelID: string,
  onDelta: (delta: string, fullText: string, messageId?: string) => void,
  onComplete?: (message: any) => void,
  onError?: (error: Error) => void,
) {
  const requestBody = JSON.stringify({
    providerID,
    modelID,
    parts: [
      {
        type: "text",
        text: message,
      },
    ],
  })

  try {
    const response = await fetch(
      `${localApiUrl}/session/${sessionId}/message`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: requestBody,
      },
    )

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error("No response body reader")
    }

    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Process complete SSE messages
      const lines = buffer.split("\n")
      buffer = lines.pop() || "" // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6))

            if (data.type === "delta") {
              onDelta(data.content, data.fullText, data.messageId)
            } else if (data.type === "complete") {
              onComplete?.(data.message)
              return data.message
            }
          } catch (e) {
            console.error("Failed to parse SSE data:", e)
          }
        }
      }
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    onError?.(err)
    throw err
  }
}
