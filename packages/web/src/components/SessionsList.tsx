import { Show, For } from "solid-js"

export interface SessionData {
  id: string
  title?: string
  time: {
    created: number
    updated: number
  }
  version?: string
  computedData: {
    rootDir?: string
    created: number
    completed?: number
    models: Record<string, string[]>
    cost: number
    tokens: {
      input: number
      output: number
      reasoning: number
    }
  }
}

interface SessionsListProps {
  sessions: SessionData[]
  title: string
  emptyMessage: string
  helpText?: string
  error?: string | null
  apiUrl?: string
}

export default function SessionsList(props: SessionsListProps) {
  return (
    <div class="local-sessions">
      <h1>{props.title}</h1>

      <Show when={props.error}>
        <div class="error-message">
          <strong>Error:</strong> {props.error}
          <p>Make sure opencode serve is running on {props.apiUrl}</p>
        </div>
      </Show>

      <Show when={!props.error}>
        <div>
          <Show when={props.sessions.length === 0}>
            <p class="empty-state">{props.emptyMessage}</p>
          </Show>

          <Show when={props.sessions.length > 0}>
            <div class="sessions-list">
              <For each={props.sessions}>
                {(session) => (
                  <div class="session-item">
                    <div class="session-title">
                      <h3>
                        <a href={`/local/${session.id}`} class="session-link">
                          {session.title?.trim() || "(no title)"}
                        </a>
                      </h3>
                    </div>
                    <div data-section="row">
                      <ul data-section="stats">
                        <li>
                          <span data-element-label>Cost</span>
                          <Show
                            when={session.computedData.cost !== undefined}
                            fallback={<span data-placeholder>&mdash;</span>}
                          >
                            <span>${session.computedData.cost.toFixed(2)}</span>
                          </Show>
                        </li>
                        <li>
                          <span data-element-label>Input Tokens</span>
                          <Show
                            when={session.computedData.tokens.input}
                            fallback={<span data-placeholder>&mdash;</span>}
                          >
                            <span>{session.computedData.tokens.input}</span>
                          </Show>
                        </li>
                        <li>
                          <span data-element-label>Output Tokens</span>
                          <Show
                            when={session.computedData.tokens.output}
                            fallback={<span data-placeholder>&mdash;</span>}
                          >
                            <span>{session.computedData.tokens.output}</span>
                          </Show>
                        </li>
                        <li>
                          <span data-element-label>Reasoning Tokens</span>
                          <Show
                            when={session.computedData.tokens.reasoning}
                            fallback={<span data-placeholder>&mdash;</span>}
                          >
                            <span>{session.computedData.tokens.reasoning}</span>
                          </Show>
                        </li>
                      </ul>
                      <Show when={session.computedData.rootDir}>
                        <ul data-section="stats" data-section-root>
                          <li title="Project root">
                            <div data-stat-icon>
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                              >
                                <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z" />
                              </svg>
                            </div>
                            <span>{session.computedData.rootDir}</span>
                          </li>
                          <li title="opencode version">
                            <div data-stat-icon title="opencode">
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                              >
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                              </svg>
                            </div>
                            <span>v{session.version || "0.0.1"}</span>
                          </li>
                        </ul>
                      </Show>
                      <Show when={!session.computedData.rootDir}>
                        <ul data-section="stats" data-section-root>
                          <li title="opencode version">
                            <div data-stat-icon title="opencode">
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                              >
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                              </svg>
                            </div>
                            <span>v{session.version || "0.0.1"}</span>
                          </li>
                        </ul>
                      </Show>
                      <ul data-section="stats" data-section-models>
                        <Show
                          when={
                            Object.values(session.computedData.models).length >
                            0
                          }
                          fallback={
                            <li>
                              <span data-element-label>Models</span>
                              <span data-placeholder>&mdash;</span>
                            </li>
                          }
                        >
                          <For
                            each={Object.values(session.computedData.models)}
                          >
                            {(item) => (
                              <li>
                                <div data-stat-icon title={item[0]}>
                                  <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                  >
                                    <path d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z" />
                                  </svg>
                                </div>
                                <span data-stat-model>{item[1]}</span>
                              </li>
                            )}
                          </For>
                        </Show>
                      </ul>
                      <div data-section="time">
                        <Show
                          when={session.computedData.created}
                          fallback={
                            <span data-element-label data-placeholder>
                              Started at &mdash;
                            </span>
                          }
                        >
                          <span
                            title={new Date(
                              session.computedData.created,
                            ).toLocaleString()}
                          >
                            {new Date(
                              session.computedData.created,
                            ).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            }) +
                              ", " +
                              new Date(
                                session.computedData.created,
                              ).toLocaleTimeString("en-US", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                          </span>
                        </Show>
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>

      <Show when={props.helpText}>
        <div class="help-section">
          <h3>How to use:</h3>
          <div innerHTML={props.helpText} />
        </div>
      </Show>
    </div>
  )
}
