import { join } from "node:path"
import type { ProjectTemplate } from "../plugins/types.js"

export class BasicTemplate implements ProjectTemplate {
  readonly id = "basic"
  readonly name = "Basic Project"
  readonly description = "Simple project with basic structure"

  async generate(projectPath: string, config: any): Promise<void> {
    const { projectName } = config

    // Create basic TypeScript file (to match test expectations)
    await Bun.write(
      join(projectPath, "src/index.ts"),
      `console.log("Hello from ${projectName}!");

export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
`
    )
  }
}