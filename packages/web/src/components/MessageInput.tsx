import { createSignal, Show } from "solid-js"
import { sendMessageToSession } from "../lib/local-session-utils"
import type { Message } from "opencode/session/message"

interface MessageInputProps {
  sessionId: string
  apiUrl: string
  models: Record<string, string[]>
  onMessageSent?: () => void
  onMessageComplete?: (message: Message.Info) => void
  onStreamingUpdate?: (assistantMessageId: string, text: string) => void
}

export default function MessageInput(props: MessageInputProps) {
  const [message, setMessage] = createSignal("")
  const [isSending, setIsSending] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [success, setSuccess] = createSignal(false)

  // Get the first available model from the session
  const getDefaultModel = () => {
    const modelEntries = Object.values(props.models)
    if (modelEntries.length > 0) {
      const [providerID, modelID] = modelEntries[0]
      return { providerID, modelID }
    }
    // Fallback to anthropic claude if no models found
    return { providerID: "anthropic", modelID: "claude-3-5-sonnet-20241022" }
  }

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    const messageText = message().trim()
    if (!messageText || isSending()) return

    setIsSending(true)
    setError(null)
    setSuccess(false)

    try {
      const { providerID, modelID } = getDefaultModel()

      await sendMessageToSession(
        props.apiUrl,
        props.sessionId,
        messageText,
        providerID,
        modelID,
        // onDelta: Just update the assistant message the server gives us
        (delta: string, fullText: string, messageId?: string) => {
          if (messageId) {
            props.onStreamingUpdate?.(messageId, fullText)
          }
        },
        // onComplete: Server provides the completed messages
        (completedMessage: Message.Info) => {
          setMessage("")
          setSuccess(true)
          setTimeout(() => setSuccess(false), 3000)

          props.onMessageComplete?.(completedMessage)
          props.onMessageSent?.()
        },
        // onError: Handle errors
        (error: Error) => {
          setError(error.message)
        },
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div class="message-input-container">
      <div class="message-input-header">
        <span data-element-label>Send New Message</span>
      </div>

      <form onSubmit={handleSubmit} class="message-input-form">
        <div class="message-input-field">
          <textarea
            value={message()}
            onInput={(e) => setMessage(e.currentTarget.value)}
            placeholder="Type your message here..."
            disabled={isSending()}
            class="message-input-textarea"
            data-disabled={isSending()}
          />
        </div>

        <div class="message-input-footer">
          <div class="message-input-model-info">
            <span data-element-label>Using</span>
            <span>
              {getDefaultModel().providerID}/{getDefaultModel().modelID}
            </span>
          </div>

          <button
            type="submit"
            disabled={!message().trim() || isSending()}
            data-element-button-text
            class="message-input-submit"
            data-disabled={!message().trim() || isSending()}
          >
            {isSending() ? "Sending..." : "Send Message"}
          </button>
        </div>
      </form>

      <Show when={error()}>
        <div class="message-input-error">
          <span data-color="red" data-marker="label" data-separator>
            Error
          </span>
          <span>{error()}</span>
        </div>
      </Show>

      <Show when={success()}>
        <div class="message-input-success">
          <span data-color="green" data-marker="label" data-separator>
            Success
          </span>
          <span>
            Message sent successfully! The response will appear above.
          </span>
        </div>
      </Show>

      <style>{`
        .message-input-container {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          line-height: 1;
          padding: 1.5rem;
          padding-left: calc(1.5rem + 18px + 0.625rem);
          max-width: var(--lg-tool-width);

          @media (max-width: 30rem) {
            padding: 1rem;
            padding-left: calc(1rem + 18px + 0.625rem);
            gap: 0.75rem;
          }

          --sm-tool-width: 28rem;
          --md-tool-width: 40rem;
          --lg-tool-width: 56rem;
        }

        .message-input-header {
          margin-bottom: 0.5rem;
        }

        .message-input-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .message-input-field {
          display: flex;
          flex-direction: column;
        }

        .message-input-textarea {
          width: 100%;
          min-height: 120px;
          padding: 0.75rem;
          border: 1px solid var(--sl-color-divider);
          border-radius: 0.375rem;
          font-family: inherit;
          font-size: 0.875rem;
          line-height: 1.5;
          resize: vertical;
          background-color: var(--sl-color-bg-surface);
          color: var(--sl-color-text);
          box-sizing: border-box;
          transition:
            border-color 0.15s ease,
            outline-color 0.15s ease;
        }

        .message-input-textarea:focus {
          outline: 2px solid var(--sl-color-blue);
          outline-offset: -2px;
          border-color: var(--sl-color-blue);
        }

        .message-input-textarea[data-disabled="true"] {
          background-color: var(--sl-color-bg-nav);
          color: var(--sl-color-text-dimmed);
          cursor: not-allowed;
        }

        .message-input-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .message-input-model-info {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.75rem;
          color: var(--sl-color-text-secondary);
        }

        .message-input-submit {
          padding: 0.5rem 1rem;
          background-color: var(--sl-color-blue);
          color: var(--sl-color-text-invert);
          border: 1px solid var(--sl-color-blue);
          border-radius: 0.375rem;
          font-weight: 500;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.15s ease;
          appearance: none;
        }

        .message-input-submit:hover:not([data-disabled="true"]) {
          background-color: var(--sl-color-blue-high);
          border-color: var(--sl-color-blue-high);
        }

        .message-input-submit[data-disabled="true"] {
          background-color: var(--sl-color-divider);
          border-color: var(--sl-color-divider);
          color: var(--sl-color-text-dimmed);
          cursor: not-allowed;
        }

        .message-input-error,
        .message-input-success {
          margin-top: 0.5rem;
          padding: 0.75rem;
          border-radius: 0.375rem;
          font-size: 0.75rem;
          line-height: 1.5;
        }

        .message-input-error {
          background-color: var(--sl-color-bg-surface);
          border: 1px solid var(--sl-color-red-low);
        }

        .message-input-success {
          background-color: var(--sl-color-bg-surface);
          border: 1px solid var(--sl-color-green-low);
        }

        .message-input-error span[data-color="red"] {
          color: var(--sl-color-red);
        }

        .message-input-success span[data-color="green"] {
          color: var(--sl-color-green);
        }

        span[data-marker="label"] {
          text-transform: uppercase;
          letter-spacing: -0.5px;
        }

        span[data-separator] {
          margin-right: 0.375rem;
        }

        @media (max-width: 30rem) {
          .message-input-footer {
            flex-direction: column;
            align-items: stretch;
          }

          .message-input-submit {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  )
}
