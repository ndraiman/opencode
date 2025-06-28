import { createSignal, createEffect } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import Share from "./Share"
import MessageInput from "./MessageInput"
import { fetchSessionMessages } from "../lib/local-session-utils"
import type { Message } from "opencode/session/message"
import type { Session } from "opencode/session/index"

interface SessionViewerProps {
  sessionId: string
  apiUrl: string
  sessionInfo: Session.Info
  initialMessages: Record<string, Message.Info>
  models: Record<string, string[]>
}

export default function SessionViewer(props: SessionViewerProps) {
  const [messagesStore, setMessagesStore] = createStore<
    Record<string, Message.Info>
  >(props.initialMessages)
  const [refreshTrigger, setRefreshTrigger] = createSignal(0)

  // Function to refresh messages from server
  const refreshMessages = async () => {
    try {
      const newMessages = await fetchSessionMessages(
        props.apiUrl,
        props.sessionId,
      )
      const messagesObj: Record<string, Message.Info> = {}
      newMessages.forEach((msg: any) => {
        messagesObj[msg.id] = msg
      })
      setMessagesStore(reconcile(messagesObj))
    } catch (error) {
      console.error("Failed to refresh messages:", error)
    }
  }

  // Refresh messages when trigger changes
  createEffect(() => {
    if (refreshTrigger() > 0) {
      refreshMessages()
    }
  })

  const handleMessageSent = () => {
    // Trigger a refresh by incrementing the signal
    setRefreshTrigger((prev) => prev + 1)
  }

  const handleStreamingUpdate = (assistantMessageId: string, text: string) => {
    // Create or update the assistant message during streaming
    setMessagesStore(assistantMessageId, (prev) => {
      if (prev) {
        // Update existing message
        return {
          ...prev,
          parts: [{ type: "text", text }],
        }
      } else {
        // Create new message on first update
        return {
          id: assistantMessageId,
          role: "assistant",
          parts: [{ type: "text", text }],
          metadata: {
            sessionID: props.sessionId,
            time: { created: Date.now() },
            tool: {},
          },
        }
      }
    })
  }

  const handleMessageComplete = (message: Message.Info) => {
    // Replace optimistic message with real server message
    if (message && message.id) {
      setMessagesStore(message.id, message)
    }
  }

  return (
    <div>
      <Share
        id={props.sessionId}
        api={props.apiUrl}
        info={props.sessionInfo}
        messages={messagesStore}
      />
      <MessageInput
        sessionId={props.sessionId}
        apiUrl={props.apiUrl}
        models={props.models}
        onMessageSent={handleMessageSent}
        onMessageComplete={handleMessageComplete}
        onStreamingUpdate={handleStreamingUpdate}
      />
    </div>
  )
}
