import { z } from "zod"
import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import type { ProjectPlugin, ValidationResult, CreateProjectInput } from "./types.js"
import type { Project, ProcessInfo } from "../types.js"

const DevContainerConfigSchema = z.object({
  image: z.string().default("mcr.microsoft.com/devcontainers/typescript-node:1-20-bullseye"),
  features: z.record(z.any()).optional(),
  forwardPorts: z.array(z.number()).optional(),
  postCreateCommand: z.string().optional(),
  mounts: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
})

export class DevContainerPlugin implements ProjectPlugin {
  readonly id = "devcontainer-plugin"
  readonly name = "Dev Container Plugin"
  readonly description = "Creates projects with development container configuration"
  readonly projectType = "devcontainer"

  async validateInput(input: CreateProjectInput): Promise<ValidationResult> {
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

    // Validate image format
    if (input.config?.image) {
      const image = input.config.image as string
      if (!image.includes(':') && !image.includes('/')) {
        warnings.push("Image name should include a tag or registry. Using 'latest' tag may cause unpredictable builds.")
      }
    }

    // Validate port forwards
    if (input.config?.forwardPorts) {
      const ports = input.config.forwardPorts as number[]
      const invalidPorts = ports.filter(port => port < 1 || port > 65535)
      if (invalidPorts.length > 0) {
        errors.push(`Invalid port numbers: ${invalidPorts.join(", ")}. Ports must be between 1 and 65535.`)
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  }

  async createProject(input: CreateProjectInput, projectPath: string): Promise<void> {
    const config = input.config || {}
    
    await this.createDevContainerConfig(
      projectPath,
      input.name,
      config
    )
  }

  getConfigSchema(): z.ZodSchema<any> {
    return DevContainerConfigSchema
  }

  async setupProject(project: Project, processInfo: ProcessInfo): Promise<void> {
    // Dev container projects might need additional setup
    // For example, ensuring the container is built and ready
    console.log(`Setting up dev container for project ${project.name}`)
    
    // This could include:
    // - Building the dev container
    // - Starting the container
    // - Setting up volume mounts
    // - Configuring networking
  }

  async cleanupProject(project: Project): Promise<void> {
    // Clean up dev container resources
    console.log(`Cleaning up dev container for project ${project.name}`)
    
    // This could include:
    // - Stopping the container
    // - Removing volumes
    // - Cleaning up networks
  }

  private async createDevContainerConfig(
    projectPath: string,
    projectName: string,
    config: any
  ): Promise<void> {
    // Create .devcontainer directory
    const devcontainerDir = join(projectPath, ".devcontainer")
    await mkdir(devcontainerDir, { recursive: true })

    // Create devcontainer.json
    const devcontainerConfig = {
      name: projectName,
      image: config.image || "mcr.microsoft.com/devcontainers/typescript-node:1-20-bullseye",
      features: config.features || {
        "ghcr.io/devcontainers/features/git:1": {},
        "ghcr.io/devcontainers/features/github-cli:1": {}
      },
      forwardPorts: config.forwardPorts || [3000, 8000],
      postCreateCommand: config.postCreateCommand || "npm install",
      customizations: {
        vscode: {
          extensions: [
            "ms-vscode.vscode-typescript-next",
            "esbenp.prettier-vscode",
            "bradlc.vscode-tailwindcss",
            "ms-vscode.vscode-json"
          ]
        }
      },
      mounts: config.mounts || [],
      remoteEnv: config.env || {}
    }

    await Bun.write(
      join(devcontainerDir, "devcontainer.json"),
      JSON.stringify(devcontainerConfig, null, 2)
    )

    // Create basic project structure
    await mkdir(join(projectPath, "src"), { recursive: true })

    // Create package.json
    const packageJson = {
      name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      version: "1.0.0",
      description: `A dev container project for ${projectName}`,
      main: "src/index.js",
      type: "module",
      scripts: {
        dev: "node --watch src/index.js",
        start: "node src/index.js",
        test: "echo 'No tests yet'"
      },
      dependencies: {},
      devDependencies: {
        "@types/node": "^20.0.0"
      }
    }

    await Bun.write(
      join(projectPath, "package.json"),
      JSON.stringify(packageJson, null, 2)
    )

    // Create README with dev container instructions
    const readme = `# ${projectName}

This project is configured to run in a development container.

## Getting Started with Dev Containers

1. **Prerequisites:**
   - [Docker Desktop](https://www.docker.com/products/docker-desktop)
   - [Visual Studio Code](https://code.visualstudio.com/)
   - [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)

2. **Open in Dev Container:**
   - Open this folder in VS Code
   - When prompted, click "Reopen in Container"
   - Or use the command palette: "Dev Containers: Reopen in Container"

3. **Manual Docker Setup:**
   \`\`\`bash
   # Build and run the dev container
   docker build -t ${projectName.toLowerCase()}-dev .devcontainer
   docker run -it --rm -v \${PWD}:/workspace ${projectName.toLowerCase()}-dev
   \`\`\`

## Development

The dev container includes:
- Node.js and npm
- Git and GitHub CLI
- VS Code extensions for development
- Port forwarding for development servers

Start development:
\`\`\`bash
npm install
npm run dev
\`\`\`

## Project Structure

- \`.devcontainer/\` - Dev container configuration
- \`src/\` - Source code
- \`package.json\` - Project dependencies and scripts

---

*Created with OpenCode Dev Container Plugin*
`

    await Bun.write(join(projectPath, "README.md"), readme)

    // Create a sample index file
    await Bun.write(
      join(projectPath, "src/index.js"),
      `console.log("Hello from ${projectName} dev container!");

export function greet(name) {
  return \`Hello, \${name}! Running in a dev container.\`;
}

// If this file is run directly
if (import.meta.url === \`file://\${process.argv[1]}\`) {
  console.log(greet("World"));
}
`
    )

    // Create .gitignore
    const gitignore = `# Dependencies
node_modules/
npm-debug.log*

# Environment variables
.env
.env.local

# Build outputs
dist/
build/

# IDE files
.vscode/settings.json
.vscode/launch.json

# OS files
.DS_Store
Thumbs.db

# Logs
logs
*.log
`

    await Bun.write(join(projectPath, ".gitignore"), gitignore)
  }
}