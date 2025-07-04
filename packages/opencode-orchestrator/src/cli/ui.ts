export class UI {
  static error(message: string): void {
    console.error(`❌ ${message}`)
  }

  static info(message: string): void {
    console.log(`ℹ️  ${message}`)
  }

  static success(message: string): void {
    console.log(`✅ ${message}`)
  }

  static warn(message: string): void {
    console.warn(`⚠️  ${message}`)
  }

  static logo(): string {
    return `
🚀 OpenCode Orchestrator
API for managing multiple OpenCode instances
    `
  }
}
