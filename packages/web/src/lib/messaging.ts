import { createSession, sendMessageToSession } from "./local-session-utils"
import type { Message } from "opencode/session/message"

export interface MessagingCallbacks {
  onMessageSent?: () => void
  onMessageComplete?: (message: Message.Info) => void
  onStreamingUpdate?: (assistantMessageId: string, text: string) => void
  onError?: (error: string) => void
}

export interface SendMessageOptions {
  apiUrl: string
  sessionId: string
  message: string
  providerID: string
  modelID: string
  callbacks: MessagingCallbacks
}

export async function sendMessage(options: SendMessageOptions): Promise<void> {
  const { apiUrl, sessionId, message, providerID, modelID, callbacks } = options
  
  let hasRefreshedForUserMessage = false

  try {
    await sendMessageToSession(
      apiUrl,
      sessionId,
      message,
      providerID,
      modelID,
      // onDelta: Update assistant message and refresh to get user message on first delta
      (delta: string, fullText: string, messageId?: string) => {
        if (messageId) {
          // On first delta, refresh to get the user message the server created
          if (!hasRefreshedForUserMessage) {
            hasRefreshedForUserMessage = true
            callbacks.onMessageSent?.()
          }
          callbacks.onStreamingUpdate?.(messageId, fullText)
        }
      },
      // onComplete: Server provides the completed messages
      (completedMessage: Message.Info) => {
        callbacks.onMessageComplete?.(completedMessage)
        callbacks.onMessageSent?.()
      },
      // onError: Handle errors
      (error: Error) => {
        callbacks.onError?.(error.message)
      },
    )
  } catch (err) {
    callbacks.onError?.(err instanceof Error ? err.message : "Failed to send message")
  }
}

export interface CreateSessionAndSendMessageOptions {
  apiUrl: string
  message: string
  providerID: string
  modelID: string
  callbacks: MessagingCallbacks & {
    onSessionCreated?: (sessionId: string) => void
  }
}

export async function createSessionAndSendMessage(options: CreateSessionAndSendMessageOptions): Promise<void> {
  const { apiUrl, message, providerID, modelID, callbacks } = options
  
  try {
    // First create the session
    const session = await createSession(apiUrl)
    const sessionId = session.id
    
    // Notify that session was created
    callbacks.onSessionCreated?.(sessionId)
    
    // Then send the message to the new session
    await sendMessage({
      apiUrl,
      sessionId,
      message,
      providerID,
      modelID,
      callbacks
    })
  } catch (err) {
    callbacks.onError?.(err instanceof Error ? err.message : "Failed to create session and send message")
  }
}