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
