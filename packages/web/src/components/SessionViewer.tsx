import { onCleanup, createSignal, onMount } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import Share from "./Share"
import MessageInput from "./MessageInput"
import {
  fetchSessionMessages,
  fetchProviders,
  createSession,
  sendMessageToSession,
  type ProvidersResponse,
} from "../lib/local-session-utils"
import { watchSession } from "../lib/session-watcher"
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

  const [providersData, setProvidersData] =
    createSignal<ProvidersResponse | null>(null)
  const [providersError, setProvidersError] = createSignal<string | null>(null)

  // Message sending state
  const [isSending, setIsSending] = createSignal(false)
  const [sendError, setSendError] = createSignal<string | null>(null)
  const [clearInput, setClearInput] = createSignal(false)

  // Session info that can be updated in real-time
  const [sessionInfo, setSessionInfo] = createSignal<Session.Info>(
    props.sessionInfo,
  )

  // Track the actual session ID (starts as props.sessionId, updates when new session is created)
  const [actualSessionId, setActualSessionId] = createSignal(props.sessionId)

  let shareRef: HTMLDivElement | undefined
  let resizeObserver: ResizeObserver | undefined
  let sessionWatcher: { disconnect: () => void } | undefined

  // Helper function to start session watcher
  const startSessionWatcher = (actualSessionId: string) => {
    if (sessionWatcher) {
      sessionWatcher.disconnect()
    }

    console.log(
      "[SessionViewer] Starting session watcher for:",
      actualSessionId,
    )
    sessionWatcher = watchSession(props.apiUrl, actualSessionId, {
      onSessionUpdated: (updatedSession) => {
        console.log(
          "[SessionViewer] Session updated callback triggered:",
          updatedSession,
        )
        console.log(
          "[SessionViewer] Current title:",
          sessionInfo().title,
          "New title:",
          updatedSession.title,
        )
        setSessionInfo(updatedSession)

        // Update page title if it changed
        if (updatedSession.title && document.title !== updatedSession.title) {
          console.log(
            "[SessionViewer] Updating page title to:",
            updatedSession.title,
          )
          document.title = updatedSession.title
        }
      },
      onError: (error) => {
        console.error("[SessionViewer] Session watcher error:", error)
      },
    })
  }

  // Fetch providers data and start session watcher on mount
  onMount(async () => {
    try {
      const providers = await fetchProviders(props.apiUrl)
      setProvidersData(providers)
    } catch (error) {
      console.error("[SessionViewer] Failed to fetch providers:", error)
      setProvidersError(
        error instanceof Error ? error.message : "Failed to fetch providers",
      )
    }

    // Start watching for session updates (only for existing sessions)
    if (props.sessionId !== "new") {
      startSessionWatcher(props.sessionId)
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

  // Cleanup observer and session watcher on component unmount
  onCleanup(() => {
    stopScrollObserver()
    sessionWatcher?.disconnect()
  })

  // Function to refresh messages from server (now uses actual session ID)
  const refreshMessages = async () => {
    const currentSessionId = actualSessionId()
    if (currentSessionId === "new") return // Don't try to refresh messages for "new" session

    try {
      const newMessages = await fetchSessionMessages(
        props.apiUrl,
        currentSessionId,
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

  const handleMessageSubmit = async (
    message: string,
    providerID: string,
    modelID: string,
  ) => {
    setIsSending(true)
    setSendError(null)
    setClearInput(false)

    try {
      let sessionId = actualSessionId()
      let newSessionCreated = false
      let newSessionInfo: Session.Info | null = null

      // If this is a new session, create it first but don't update UI yet
      if (sessionId === "new") {
        newSessionInfo = await createSession(props.apiUrl)
        sessionId = newSessionInfo!.id
        newSessionCreated = true
      }

      let hasRefreshedForUserMessage = false
      let hasInitialized = false

      // Helper function to initialize new session UI (called only once)
      const initializeNewSessionUI = () => {
        if (newSessionCreated && !hasInitialized && newSessionInfo) {
          hasInitialized = true

          // Update the actual session ID
          setActualSessionId(sessionId)

          // Update the session info
          setSessionInfo(newSessionInfo)

          // Start watching the new session
          startSessionWatcher(sessionId)

          console.log(
            "[SessionViewer] Session created and watcher started for:",
            sessionId,
          )
          console.log("[SessionViewer] Session title:", newSessionInfo.title)
        }
      }

      await sendMessageToSession(
        props.apiUrl,
        sessionId,
        message,
        providerID,
        modelID,
        // onDelta: Update assistant message and refresh to get user message on first delta
        (delta: string, fullText: string, messageId?: string) => {
          if (messageId) {
            // On first delta, initialize new session UI if needed
            initializeNewSessionUI()

            // On first delta, refresh to get the user message the server created
            if (!hasRefreshedForUserMessage) {
              hasRefreshedForUserMessage = true
              // Refresh messages when sent
              refreshMessages()
            }

            // Start observing when streaming begins
            startScrollObserver()

            // Create or update the assistant message during streaming
            setMessagesStore(messageId, (prev) => {
              if (prev) {
                // Update existing message
                return {
                  ...prev,
                  parts: [{ type: "text", text: fullText }],
                }
              } else {
                // Create new message on first update
                return {
                  id: messageId,
                  role: "assistant",
                  parts: [{ type: "text", text: fullText }],
                  metadata: {
                    sessionID: sessionId,
                    time: { created: Date.now() },
                    tool: {},
                  },
                }
              }
            })
          }
        },
        // onComplete: Server provides the completed messages
        (completedMessage: Message.Info) => {
          // Initialize new session UI if not done yet (for non-streaming responses)
          initializeNewSessionUI()

          // Stop observing when streaming ends
          stopScrollObserver()

          // Replace optimistic message with real server message
          if (completedMessage && completedMessage.id) {
            setMessagesStore(completedMessage.id, completedMessage)
          }

          // Clear the input on successful completion
          setClearInput(true)
          // Reset the clear flag after a short delay
          setTimeout(() => setClearInput(false), 100)

          // Refresh messages when complete
          refreshMessages()

          // Update URL after everything is complete (for new sessions)
          if (newSessionCreated && typeof window !== "undefined") {
            console.log(
              "[SessionViewer] Message complete, updating URL to:",
              `/project/${sessionId}`,
            )
            window.history.replaceState(null, "", `/project/${sessionId}`)
          }
        },
        // onError: Handle errors
        (error: Error) => {
          setSendError(error.message)
        },
      )
    } catch (err) {
      setSendError(
        err instanceof Error ? err.message : "Failed to send message",
      )
    }

    setIsSending(false)
  }

  return (
    <div>
      <div ref={shareRef}>
        <Share
          id={actualSessionId()} // Use actual session ID instead of props.sessionId
          api={props.apiUrl}
          info={sessionInfo()}
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
        clearInput={clearInput()}
        onSubmit={handleMessageSubmit}
      />
    </div>
  )
}
