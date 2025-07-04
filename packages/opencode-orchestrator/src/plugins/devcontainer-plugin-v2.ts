import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import type { ProjectPlugin, ValidationResult, CreateProjectInput } from "./types.js"
import type { Project, ProcessInfo } from "../types.js"
import { DevContainerConfigSchema, type DevContainerConfig } from "./config-types.js"

export class DevContainerPlugin implements ProjectPlugin {
  readonly meta = {
    id: "devcontainer-plugin",
    name: "Dev Container Plugin",
    description: "Creates projects with development container configuration",
    projectType: "devcontainer",
    configSchema: DevContainerConfigSchema,
    version: "2.0.0",
    author: "OpenCode Team"
  }

  async validate(input: CreateProjectInput): Promise<ValidationResult> {
    const warnings: string[] = []
    const errors: string[] = []

    // Check if Docker is available (simplified check)
    try {
      const dockerCheck = await Bun.spawn({
        cmd: ["docker", "--version"],
        stdout: "pipe",
        stderr: "pipe",
      }).exited

      if (dockerCheck !== 0) {
        errors.push("Docker is not available. Dev containers require Docker to be installed and running.")
      }
    } catch {
      errors.push("Docker is not available. Dev containers require Docker to be installed and running.")
    }

    try {
      const config = DevContainerConfigSchema.parse(input.config)
      
      // Validate image format
      if (config.image) {
        if (!config.image.includes(':') && !config.image.includes('/')) {
          warnings.push("Image name should include a tag or registry. Using 'latest' tag may cause unpredictable builds.")
        }
      }

      // Validate port forwards
      if (config.forwardPorts) {
        for (const port of config.forwardPorts) {
          if (port < 1 || port > 65535) {
            errors.push(`Invalid port number: ${port}. Must be between 1 and 65535.`)
          }
        }
      }

      return {
        isValid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
      }
    } catch (error) {
      return {
        isValid: false,
        errors: ["Invalid configuration: " + (error instanceof Error ? error.message : 'Unknown error')]
      }
    }
  }

  async create(input: CreateProjectInput, projectPath: string): Promise<void> {
    const config = DevContainerConfigSchema.parse(input.config)
    
    // Create .devcontainer directory
    await mkdir(join(projectPath, ".devcontainer"), { recursive: true })

    // Create devcontainer.json
    const devcontainerConfig = {
      name: input.name,
      image: config.image || "mcr.microsoft.com/devcontainers/typescript-node:1-20-bullseye",
      features: config.features || {},
      customizations: config.customizations || {
        "vscode": {
          "extensions": [
            "ms-vscode.vscode-typescript-next",
            "esbenp.prettier-vscode"
          ]
        }
      },
      forwardPorts: config.forwardPorts || [],
      postCreateCommand: config.postCreateCommand || "npm install",
      remoteUser: config.remoteUser || "node"
    }

    await Bun.write(
      join(projectPath, ".devcontainer", "devcontainer.json"),
      JSON.stringify(devcontainerConfig, null, 2)
    )

    // Create basic project structure
    await mkdir(join(projectPath, "src"), { recursive: true })

    // Create package.json
    const packageJson = {
      name: input.name.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      version: "1.0.0",
      description: `A new OpenCode project with dev container`,
      main: "src/index.js",
      type: "module",
      scripts: {
        dev: "node --watch src/index.js",
        start: "node src/index.js",
        test: "echo 'No tests yet'"
      }
    }

    await Bun.write(
      join(projectPath, "package.json"),
      JSON.stringify(packageJson, null, 2)
    )

    // Create basic source file
    await Bun.write(
      join(projectPath, "src/index.js"),
      `console.log("Hello from ${input.name} in dev container!");

export function greet(name) {
  return \`Hello, \${name}!\`;
}
`
    )

    // Create README
    const readmeContent = `# ${input.name}

This is a new OpenCode project with dev container configuration.

## Getting Started

1. Make sure Docker is installed and running
2. Open this project in VS Code
3. When prompted, click "Reopen in Container"
4. Wait for the container to build
5. Start developing!

## Development

\`\`\`bash
# Install dependencies
npm install

# Start development
npm run dev
\`\`\`

## Dev Container Features

- Pre-configured development environment
- All dependencies included
- VS Code extensions automatically installed
- Port forwarding configured

---

*Created with OpenCode*
`

    await Bun.write(join(projectPath, "README.md"), readmeContent)
  }
}