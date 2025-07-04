import { join } from "node:path"
import type { ProjectTemplate } from "../plugins/types.js"

export class TypeScriptTemplate implements ProjectTemplate {
  readonly id = "typescript"
  readonly name = "TypeScript Project"
  readonly description = "TypeScript project with build configuration"

  async generate(projectPath: string, config: any): Promise<void> {
    const { projectName } = config

    // Create TypeScript source file
    await Bun.write(
      join(projectPath, "src/index.ts"),
      `console.log("Hello from ${projectName}!");

export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
`
    )

    // Create tsconfig.json
    const tsconfig = {
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "bundler",
        outDir: "dist",
        rootDir: "src",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        declaration: true,
        declarationMap: true
      },
      include: ["src/**/*"],
      exclude: ["node_modules", "dist"]
    }

    await Bun.write(
      join(projectPath, "tsconfig.json"),
      JSON.stringify(tsconfig, null, 2)
    )
  }
}