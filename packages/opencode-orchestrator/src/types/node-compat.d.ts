declare module "node:crypto" {
  export * from "crypto"
}

declare module "node:fs/promises" {
  export * from "fs/promises"
}

declare module "node:path" {
  export * from "path"
}

// Provide minimal stubs when full `@types/node` is not installed
// This prevents TS errors during local development.
declare module "crypto" {
  /** Return a v4 UUID (requires Node >= 14.17) */
  export function randomUUID(): string
}

declare module "fs/promises" {
  export function mkdir(path: string, options?: unknown): Promise<void>
  export function rm(path: string, options?: unknown): Promise<void>
}

declare module "path" {
  export function join(...parts: string[]): string
}