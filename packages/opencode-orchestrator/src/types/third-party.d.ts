declare module "hono" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export class Hono<T = any> {
    // Basic route registration methods used in this project
    get(path: string, ...handlers: any[]): this
    post(path: string, ...handlers: any[]): this
    delete(path: string, ...handlers: any[]): this
    all(path: string, ...handlers: any[]): this
    fetch: any
  }
}

declare module "@hono/zod-validator" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function zValidator(type: string, schema: any): any
}

declare module "zod" {
  // Minimal placeholder definitions for the subset of Zod used in the codebase
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const z: any

  // The real zod namespace exposes a helper type `z.infer<T>`. We recreate
  // just enough so that `z.infer<typeof SomeSchema>` compiles.
  export namespace z {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export type infer<T = any> = any
  }
}