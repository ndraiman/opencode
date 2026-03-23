import { createResource, Show } from "solid-js"
import { QRCodeSVG } from "solid-qr-code"

export function QrPage(props: { getUrl: () => Promise<string | null> }) {
  const [url] = createResource(props.getUrl)

  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
        "align-items": "center",
        "justify-content": "center",
        height: "100vh",
        background: "#1a1a1a",
        color: "#fff",
        "font-family": "system-ui, sans-serif",
      }}
    >
      <Show when={url()} fallback={<p>Loading...</p>}>
        {(resolvedUrl) => (
          <>
            <div
              style={{
                background: "#fff",
                padding: "16px",
                "border-radius": "12px",
              }}
            >
              <QRCodeSVG value={resolvedUrl()} width={256} height={256} level="low" backgroundColor="#ffffff" backgroundAlpha={1} foregroundColor="#000000" foregroundAlpha={1} />
            </div>
            <p
              style={{
                "margin-top": "16px",
                "font-size": "12px",
                color: "#888",
                "max-width": "300px",
                "text-align": "center",
                "word-break": "break-all",
              }}
            >
              {resolvedUrl()}
            </p>
          </>
        )}
      </Show>
    </div>
  )
}
