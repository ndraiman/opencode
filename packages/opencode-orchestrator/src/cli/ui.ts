export namespace UI {
  const EOL = '\n'
  
  const LOGO = [
    [`█▀▀█ █▀▀█ █▀▀ █▀▀▄ `, `█▀▀ █▀▀█ █▀▀▄ █▀▀`],
    [`█░░█ █░░█ █▀▀ █░░█ `, `█░░ █░░█ █░░█ █▀▀`],
    [`▀▀▀▀ █▀▀▀ ▀▀▀ ▀  ▀ `, `▀▀▀ ▀▀▀▀ ▀▀▀  ▀▀▀`],
  ]

  const ORCHESTRATOR_LOGO = [
    [`█▀▀█ █▀▀█ █▀▀ █▀▀▄ `, `█▀▀ █▀▀█ █▀▀▄ █▀▀`],
    [`█░░█ █░░█ █▀▀ █░░█ `, `█░░ █░░█ █░░█ █▀▀`],
    [`▀▀▀▀ █▀▀▀ ▀▀▀ ▀  ▀ `, `▀▀▀ ▀▀▀▀ ▀▀▀  ▀▀▀`],
    [`                    `, `                `],
    [`█▀▀█ █▀▀█ █▀▀ █  █ `, `█▀▀ █▀▀▀ █▀▀ █▀▀█`],
    [`█░░█ █▄▄▀ █░░ █▀▀█ `, `█▀▀ █▀▀▀ █▀▀ █▄▄▀`],
    [`▀▀▀▀ ▀ ▀▀ ▀▀▀ ▀  ▀ `, `▀▀▀ ▀▀▀▀ ▀▀▀ ▀ ▀▀`],
  ]

  export const Style = {
    TEXT_HIGHLIGHT: "\x1b[96m",
    TEXT_HIGHLIGHT_BOLD: "\x1b[96m\x1b[1m",
    TEXT_DIM: "\x1b[90m",
    TEXT_DIM_BOLD: "\x1b[90m\x1b[1m",
    TEXT_NORMAL: "\x1b[0m",
    TEXT_NORMAL_BOLD: "\x1b[1m",
    TEXT_WARNING: "\x1b[93m",
    TEXT_WARNING_BOLD: "\x1b[93m\x1b[1m",
    TEXT_DANGER: "\x1b[91m",
    TEXT_DANGER_BOLD: "\x1b[91m\x1b[1m",
    TEXT_SUCCESS: "\x1b[92m",
    TEXT_SUCCESS_BOLD: "\x1b[92m\x1b[1m",
    TEXT_INFO: "\x1b[94m",
    TEXT_INFO_BOLD: "\x1b[94m\x1b[1m",
  }

  export function println(...message: string[]) {
    print(...message)
    console.error("")
  }

  export function print(...message: string[]) {
    blank = false
    console.error(message.join(" "))
  }

  let blank = false
  export function empty() {
    if (blank) return
    println("" + Style.TEXT_NORMAL)
    blank = true
  }

  export function logo(pad?: string) {
    const result = []
    for (const row of ORCHESTRATOR_LOGO) {
      if (pad) result.push(pad)
      result.push(Style.TEXT_DIM)
      result.push(row[0])
      result.push(Style.TEXT_NORMAL)
      result.push(row[1])
      result.push(EOL)
    }
    return result.join("").trimEnd()
  }

  export function error(message: string) {
    println(Style.TEXT_DANGER_BOLD + "Error: " + Style.TEXT_NORMAL + message)
  }

  export function success(message: string) {
    println(Style.TEXT_SUCCESS_BOLD + "Success: " + Style.TEXT_NORMAL + message)
  }

  export function info(message: string) {
    println(Style.TEXT_INFO_BOLD + "Info: " + Style.TEXT_NORMAL + message)
  }

  export function warning(message: string) {
    println(Style.TEXT_WARNING_BOLD + "Warning: " + Style.TEXT_NORMAL + message)
  }

  export function header(message: string) {
    println(Style.TEXT_HIGHLIGHT_BOLD + message + Style.TEXT_NORMAL)
  }

  export function dim(message: string) {
    println(Style.TEXT_DIM + message + Style.TEXT_NORMAL)
  }

  export function bold(message: string) {
    println(Style.TEXT_NORMAL_BOLD + message + Style.TEXT_NORMAL)
  }

  // Project status indicators with colors
  export function projectStatus(status: string): string {
    switch (status) {
      case "running":
        return Style.TEXT_SUCCESS_BOLD + "●" + Style.TEXT_NORMAL + " " + Style.TEXT_SUCCESS + status + Style.TEXT_NORMAL
      case "stopped":
        return Style.TEXT_DIM_BOLD + "●" + Style.TEXT_NORMAL + " " + Style.TEXT_DIM + status + Style.TEXT_NORMAL
      case "starting":
        return Style.TEXT_WARNING_BOLD + "●" + Style.TEXT_NORMAL + " " + Style.TEXT_WARNING + status + Style.TEXT_NORMAL
      case "stopping":
        return Style.TEXT_WARNING_BOLD + "●" + Style.TEXT_NORMAL + " " + Style.TEXT_WARNING + status + Style.TEXT_NORMAL
      case "failed":
        return Style.TEXT_DANGER_BOLD + "●" + Style.TEXT_NORMAL + " " + Style.TEXT_DANGER + status + Style.TEXT_NORMAL
      default:
        return Style.TEXT_DIM_BOLD + "●" + Style.TEXT_NORMAL + " " + Style.TEXT_DIM + status + Style.TEXT_NORMAL
    }
  }

  // Formatted output helpers
  export function field(label: string, value: string, highlight = false) {
    const labelColor = highlight ? Style.TEXT_HIGHLIGHT_BOLD : Style.TEXT_DIM_BOLD
    const valueColor = highlight ? Style.TEXT_HIGHLIGHT : Style.TEXT_NORMAL
    return labelColor + label + ": " + Style.TEXT_NORMAL + valueColor + value + Style.TEXT_NORMAL
  }

  export function listItem(index: number, title: string, status?: string) {
    const num = Style.TEXT_DIM + `${index}.` + Style.TEXT_NORMAL
    const titleText = Style.TEXT_NORMAL_BOLD + title + Style.TEXT_NORMAL
    const statusText = status ? " " + projectStatus(status) : ""
    return num + " " + titleText + statusText
  }
}
