import { onCleanup, createSignal, onMount } from "solid-js"
import { createStore } from "solid-js/store"
import Share from "./Share"
import MessageInput from "./MessageInput"
import {
  fetchProviders,
  type ProvidersResponse,
} from "../lib/local-session-utils"
import { createSessionAndSendMessage } from "../lib/messaging"
import type { Message } from "opencode/session/message"

interface CreateSessionProps {
  apiUrl: string
  models: Record<string, string[]>
}

export default function CreateSession(props: CreateSessionProps) {
  const [messagesStore, setMessagesStore] = createStore<
    Record<string, Message.Info>
  >({})

  const [providersData, setProvidersData] =
    createSignal<ProvidersResponse | null>(null)
  const [providersError, setProvidersError] = createSignal<string | null>(null)

  // Message sending state
  const [isSending, setIsSending] = createSignal(false)
  const [sendError, setSendError] = createSignal<string | null>(null)
  const [sendSuccess, setSendSuccess] = createSignal(false)

  let shareRef: HTMLDivElement | undefined
  let resizeObserver: ResizeObserver | undefined

  // Create a mock session info for display
  const mockSessionInfo = {
    id: "create-session",
    title: "New Session",
    time: {
      created: Date.now(),
      updated: Date.now(),
    },
    path: {
      root: typeof window !== "undefined" ? window.location.pathname : "",
    },
  }

  // Fetch providers data on mount
  onMount(async () => {
    try {
      const providers = await fetchProviders(props.apiUrl)
      setProvidersData(providers)
    } catch (error) {
      console.error("[CreateSession] Failed to fetch providers:", error)
      setProvidersError(
        error instanceof Error ? error.message : "Failed to fetch providers",
      )
    }
  })

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

  const handleMessageSubmit = async (
    message: string,
    providerID: string,
    modelID: string,
  ) => {
    setIsSending(true)
    setSendError(null)
    setSendSuccess(false)

    await createSessionAndSendMessage({
      apiUrl: props.apiUrl,
      message,
      providerID,
      modelID,
      callbacks: {
        onSessionCreated: (sessionId: string) => {
          // Update the URL without page reload to prevent flickering
          window.history.replaceState(null, "", `/project/${sessionId}`)
        },
        onMessageSent: () => {
          // Message sent, no refresh needed since messages are streamed
        },
        onStreamingUpdate: (assistantMessageId: string, text: string) => {
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
                  sessionID: assistantMessageId, // Will have the real session ID from server
                  time: { created: Date.now() },
                  tool: {},
                },
              }
            }
          })
        },
        onMessageComplete: (message: Message.Info) => {
          // Stop observing when streaming ends
          stopScrollObserver()

          // Replace optimistic message with real server message
          if (message && message.id) {
            setMessagesStore(message.id, message)
          }

          setSendSuccess(true)
          setTimeout(() => setSendSuccess(false), 3000)
        },
        onError: (error: string) => {
          setSendError(error)
        },
      },
    })

    setIsSending(false)
  }

  return (
    <div>
      <div ref={shareRef}>
        <Share
          id="create-session"
          api={props.apiUrl}
          info={mockSessionInfo}
          messages={messagesStore}
        />
      </div>
      <MessageInput
        models={props.models}
        providersData={providersData()}
        providersError={providersError()}
        messages={messagesStore}
        isSending={isSending()}
        error={sendError()}
        success={sendSuccess()}
        onSubmit={handleMessageSubmit}
      />
    </div>
  )
}
