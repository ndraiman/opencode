export class NamedError extends Error {
  public readonly data: Record<string, any>

  constructor(name: string, message: string, data: Record<string, any> = {}) {
    super(message)
    this.name = name
    this.data = data
  }

  toObject() {
    return {
      name: this.name,
      message: this.message,
      data: this.data,
    }
  }
}

export function FormatError(error: unknown): string | undefined {
  if (error instanceof NamedError) {
    return `${error.name}: ${error.message}`
  }

  if (error instanceof Error) {
    return error.message
  }

  return undefined
}
