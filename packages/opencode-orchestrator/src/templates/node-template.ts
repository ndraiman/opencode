import { join } from "node:path"
import type { ProjectTemplate } from "../plugins/types.js"

export class NodeTemplate implements ProjectTemplate {
  readonly id = "node"
  readonly name = "Node.js Project"
  readonly description = "Node.js project with ES modules"

  async generate(projectPath: string, config: any): Promise<void> {
    const { projectName } = config

    await Bun.write(
      join(projectPath, "src/index.js"),
      `#!/usr/bin/env node

console.log("Hello from ${projectName}!");

export function greet(name) {
  return \`Hello, \${name}!\`;
}

// If this file is run directly
if (import.meta.url === \`file://\${process.argv[1]}\`) {
  console.log(greet("World"));
}
`
    )
  }
}