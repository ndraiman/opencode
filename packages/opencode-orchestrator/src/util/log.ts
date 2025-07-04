export class Log {
  private static _instance: Log | undefined
  private _print: boolean = false

  static get Default(): Log {
    if (!Log._instance) {
      Log._instance = new Log()
    }
    return Log._instance
  }

  static async init(options: { print: boolean }): Promise<void> {
    if (!Log._instance) {
      Log._instance = new Log()
    }
    Log._instance._print = options.print
  }

  info(message: string, data?: Record<string, any>): void {
    if (this._print) {
      console.log(
        `[INFO] ${message}`,
        data ? JSON.stringify(data, null, 2) : "",
      )
    }
  }

  error(message: string, data?: Record<string, any>): void {
    if (this._print) {
      console.error(
        `[ERROR] ${message}`,
        data ? JSON.stringify(data, null, 2) : "",
      )
    }
  }

  warn(message: string, data?: Record<string, any>): void {
    if (this._print) {
      console.warn(
        `[WARN] ${message}`,
        data ? JSON.stringify(data, null, 2) : "",
      )
    }
  }
}
