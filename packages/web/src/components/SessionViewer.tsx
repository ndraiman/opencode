import { onCleanup } from "solid-js"
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

  let shareRef: HTMLDivElement | undefined
  let resizeObserver: ResizeObserver | undefined

  // Auto-scroll function - only if user is near bottom
  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      const docElement = document.documentElement
      const scrollHeight = Math.max(
        document.body.scrollHeight,
        document.body.offsetHeight,
        docElement.clientHeight,
        docElement.scrollHeight,
        docElement.offsetHeight,
      )

      const currentScrollTop = docElement.scrollTop
      const windowHeight = window.innerHeight
      const distanceFromBottom =
        scrollHeight - (currentScrollTop + windowHeight)

      // Only auto-scroll if user is within 100px of the bottom
      // This allows them to scroll up and read without interference
      if (distanceFromBottom <= 100) {
        docElement.scrollTo({
          top: scrollHeight,
          behavior: "smooth",
        })
      }
    })
  }

  // Start observing for height changes during streaming
  const startScrollObserver = () => {
    if (shareRef && !resizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        scrollToBottom()
      })
      resizeObserver.observe(shareRef)
    }
  }

  // Stop observing when streaming ends
  const stopScrollObserver = () => {
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = undefined
    }
  }

  // Cleanup observer on component unmount
  onCleanup(() => {
    stopScrollObserver()
  })

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

  const handleMessageSent = () => {
    // Directly refresh messages when sent
    refreshMessages()
  }

  const handleStreamingUpdate = (assistantMessageId: string, text: string) => {
    // Start observing when streaming begins
    startScrollObserver()

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
    // Stop observing when streaming ends
    stopScrollObserver()

    // Replace optimistic message with real server message
    if (message && message.id) {
      setMessagesStore(message.id, message)
    }
  }

  return (
    <div>
      <div ref={shareRef}>
        <Share
          id={props.sessionId}
          api={props.apiUrl}
          info={props.sessionInfo}
          messages={messagesStore}
        />
      </div>
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
