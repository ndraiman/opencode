import { createSignal, Show, createMemo } from "solid-js"
import {
  sendMessageToSession,
  type ProvidersResponse,
} from "../lib/local-session-utils"
import type { Message } from "opencode/session/message"

interface MessageInputProps {
  sessionId: string
  apiUrl: string
  models: Record<string, string[]>
  providersData: ProvidersResponse | null
  providersError: string | null
  messages: Record<string, Message.Info>
  onMessageSent?: () => void
  onMessageComplete?: (message: Message.Info) => void
  onStreamingUpdate?: (assistantMessageId: string, text: string) => void
}

export default function MessageInput(props: MessageInputProps) {
  const [message, setMessage] = createSignal("")
  const [isSending, setIsSending] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [success, setSuccess] = createSignal(false)

  // Get model from last message if available
  const getLastMessageModel = () => {
    const messages = Object.values(props.messages).sort(
      (a, b) =>
        (a.metadata?.time?.created || 0) - (b.metadata?.time?.created || 0),
    )
    const lastAssistantMessage = messages
      .reverse()
      .find((msg) => msg.role === "assistant")

    if (
      lastAssistantMessage?.metadata?.assistant?.providerID &&
      lastAssistantMessage?.metadata?.assistant?.modelID
    ) {
      const result = {
        providerID: lastAssistantMessage.metadata.assistant.providerID,
        modelID: lastAssistantMessage.metadata.assistant.modelID,
      }
      return result
    }
    return null
  }

  // Get the first available model from providers data
  const getDefaultModel = () => {
    // Try to use last message model first
    const lastModel = getLastMessageModel()
    if (lastModel) {
      return lastModel
    }

    // Fall back to first available model from providers data
    if (
      props.providersData?.providers &&
      props.providersData.providers.length > 0
    ) {
      const firstProvider = props.providersData.providers[0]
      const modelIds = Object.keys(firstProvider.models)
      if (modelIds.length > 0) {
        return { providerID: firstProvider.id, modelID: modelIds[0] }
      }
    }

    // Final fallback to legacy models prop
    const modelEntries = Object.values(props.models)
    if (modelEntries.length > 0) {
      const [providerID, modelID] = modelEntries[0]
      return { providerID, modelID }
    }

    // Hard fallback
    return {
      providerID: "anthropic",
      modelID: "claude-sonnet-4-20250514",
    }
  }

  const [selectedModel, setSelectedModel] = createSignal(getDefaultModel())

  // Available models grouped by provider
  const availableModelsByProvider = createMemo(() => {
    console.log("[MessageInput] Computing available models by provider...")
    if (!props.providersData?.providers) {
      console.log("[MessageInput] No providers data available")
      return []
    }

    const providers: Array<{
      providerName: string
      providerId: string
      models: Array<{
        providerID: string
        modelID: string
        displayName: string
      }>
    }> = []

    props.providersData.providers.forEach((provider) => {
      const models: Array<{
        providerID: string
        modelID: string
        displayName: string
      }> = []

      Object.entries(provider.models).forEach(([modelId, model]) => {
        models.push({
          providerID: provider.id,
          modelID: modelId,
          displayName: model.name,
        })
      })

      if (models.length > 0) {
        providers.push({
          providerName: provider.name,
          providerId: provider.id,
          models,
        })
      }
    })

    console.log("[MessageInput] Grouped providers:", providers)
    return providers
  })

  // Flat list for validation purposes
  const availableModels = createMemo(() => {
    const flat: Array<{
      providerID: string
      modelID: string
      displayName: string
      fullDisplayName: string
    }> = []

    availableModelsByProvider().forEach(provider => {
      provider.models.forEach(model => {
        flat.push({
          ...model,
          fullDisplayName: `${provider.providerName} / ${model.displayName}`
        })
      })
    })

    return flat
  })

  // Get display name for selected model
  const getSelectedModelDisplayName = () => {
    const current = validSelectedModel()
    const model = availableModels().find(m => 
      m.providerID === current.providerID && m.modelID === current.modelID
    )
    
    if (model) {
      return model.fullDisplayName
    }
    
    // Fallback for when model isn't in available list
    return `${current.providerID}/${current.modelID}`
  }

  // Update selected model when providers data changes or ensure it's valid
  const validSelectedModel = createMemo(() => {
    const current = selectedModel()
    const available = availableModels()

    // Check if current selection is in available models
    const isValid = available.some(
      (model) =>
        model.providerID === current.providerID &&
        model.modelID === current.modelID,
    )

    if (isValid) {
      return current
    }

    // If not valid and we have available models, use the first one
    if (available.length > 0) {
      const firstModel = available[0]
      const newSelection = {
        providerID: firstModel.providerID,
        modelID: firstModel.modelID,
      }
      setSelectedModel(newSelection)
      return newSelection
    }

    // Fall back to current selection if no available models
    return current
  })

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    const messageText = message().trim()
    if (!messageText || isSending()) return

    setIsSending(true)
    setError(null)
    setSuccess(false)

    try {
      const { providerID, modelID } = validSelectedModel()

      let hasRefreshedForUserMessage = false

      await sendMessageToSession(
        props.apiUrl,
        props.sessionId,
        messageText,
        providerID,
        modelID,
        // onDelta: Update assistant message and refresh to get user message on first delta
        (delta: string, fullText: string, messageId?: string) => {
          if (messageId) {
            // On first delta, refresh to get the user message the server created
            if (!hasRefreshedForUserMessage) {
              hasRefreshedForUserMessage = true
              props.onMessageSent?.()
            }
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
          <div class="message-input-model-selector">
            <span data-element-label>Model</span>
            <Show
              when={availableModels().length > 0}
              fallback={
                <span class="model-fallback">
                  {getSelectedModelDisplayName()}
                </span>
              }
            >
              <div class="model-selector-wrapper">
                <select
                  value={`${validSelectedModel().providerID}|||${validSelectedModel().modelID}`}
                  onChange={(e) => {
                    const [providerID, modelID] =
                      e.currentTarget.value.split("|||")
                    setSelectedModel({ providerID, modelID })
                  }}
                  disabled={isSending()}
                  class="model-select"
                  data-disabled={isSending()}
                >
                  {availableModelsByProvider().map((provider) => (
                    <optgroup label={provider.providerName}>
                      {provider.models.map((model) => (
                        <option value={`${model.providerID}|||${model.modelID}`}>
                          {model.displayName}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <span class="model-selected-display">
                  {getSelectedModelDisplayName()}
                </span>
              </div>
            </Show>
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

        .message-input-model-selector {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.75rem;
          color: var(--sl-color-text-secondary);
        }

        .model-selector-wrapper {
          position: relative;
          display: inline-block;
        }

        .model-selected-display {
          position: absolute;
          left: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          font-size: 0.75rem;
          color: var(--sl-color-text);
          font-weight: 400;
          white-space: nowrap;
          pointer-events: none;
          z-index: 1;
          max-width: calc(100% - 2.5rem);
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .model-select {
          padding: 0.375rem 0.75rem;
          background-color: var(--sl-color-bg-surface);
          color: transparent;
          border: 1px solid var(--sl-color-divider);
          border-radius: 0.375rem;
          font-size: 0.75rem;
          font-family: inherit;
          cursor: pointer;
          transition: 
            border-color 0.15s ease,
            background-color 0.15s ease,
            box-shadow 0.15s ease;
          min-width: 220px;
          width: auto;
          appearance: none;
          background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ccc' d='M6 4L2 8h8z'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.5rem center;
          background-size: 12px;
          padding-right: 2rem;
        }


        .model-select optgroup {
          font-weight: 600;
          font-size: 0.7rem;
          color: var(--sl-color-text-secondary);
          background-color: var(--sl-color-bg-nav);
          padding: 0.25rem 0;
          text-transform: uppercase;
          letter-spacing: 0.025em;
        }

        .model-select option {
          font-weight: 400;
          font-size: 0.75rem;
          color: var(--sl-color-text) !important;
          background-color: var(--sl-color-bg-surface);
          padding: 0.25rem 0.5rem;
        }

        .model-select option:hover {
          background-color: var(--sl-color-bg-nav);
        }

        .model-select:hover:not([data-disabled="true"]) {
          border-color: var(--sl-color-blue-low);
          background-color: var(--sl-color-bg-nav);
        }

        .model-select:focus {
          outline: 2px solid var(--sl-color-blue);
          outline-offset: -2px;
          border-color: var(--sl-color-blue);
          box-shadow: 0 0 0 2px var(--sl-color-blue-low);
        }

        .model-select[data-disabled="true"] {
          background-color: var(--sl-color-bg-nav);
          color: var(--sl-color-text-dimmed);
          cursor: not-allowed;
          border-color: var(--sl-color-divider);
          background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23999' d='M6 8L2 4h8z'/%3E%3C/svg%3E");
        }

        /* Dark mode support for dropdown arrow */
        @media (prefers-color-scheme: dark) {
          .model-select {
            background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ccc' d='M6 8L2 4h8z'/%3E%3C/svg%3E");
          }
          
          .model-select[data-disabled="true"] {
            background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L2 4h8z'/%3E%3C/svg%3E");
          }
        }

        .model-fallback {
          font-family: var(--sl-font-mono, monospace);
          background-color: var(--sl-color-bg-nav);
          color: var(--sl-color-text-secondary);
          padding: 0.375rem 0.75rem;
          border-radius: 0.375rem;
          font-size: 0.75rem;
          border: 1px solid var(--sl-color-divider);
          display: inline-block;
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

          .message-input-model-selector {
            justify-content: space-between;
          }

          .model-select {
            max-width: none;
            width: 100%;
            flex: 1;
            margin-left: 0.5rem;
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
