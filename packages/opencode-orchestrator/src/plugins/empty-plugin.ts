import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import type { ProjectPlugin, ValidationResult, CreateProjectInput, PluginLifecycle } from "./types.js"
import type { Project, ProcessInfo } from "../types.js"
import { EmptyConfigSchema, type EmptyPluginConfig } from "./config-types.js"
import { createTemplateRegistryWithDefaults } from "../templates/index.js"

export class EmptyPlugin implements ProjectPlugin {
  readonly meta = {
    id: "empty-plugin",
    name: "Empty Project Plugin",
    description: "Creates empty projects with customizable templates",
    projectType: "empty",
    configSchema: EmptyConfigSchema,
    version: "2.0.0",
    author: "OpenCode Team"
  }

  private templateRegistry = createTemplateRegistryWithDefaults()

  async validate(input: CreateProjectInput): Promise<ValidationResult> {
    try {
      // Parse config with defaults - handle undefined config
      const config = EmptyConfigSchema.parse(input.config || {})
      const warnings: string[] = []

      // Check if template exists
      const template = this.templateRegistry.get(config.template)
      if (!template) {
        return {
          isValid: false,
          errors: [`Template '${config.template}' not found`]
        }
      }

      // Provide helpful warnings
      if (config.template === "basic") {
        warnings.push("Using basic template. Consider using 'typescript', 'node', or 'web' for more features.")
      }

      return {
        isValid: true,
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
    const config = EmptyConfigSchema.parse(input.config || {})
    
    // Create basic project structure
    await mkdir(join(projectPath, "src"), { recursive: true })

    // Create package.json
    const packageJson = this.generatePackageJson(input.name, config)
    await Bun.write(
      join(projectPath, "package.json"),
      JSON.stringify(packageJson, null, 2)
    )

    // Create README if requested
    if (config.includeReadme) {
      const readmeContent = this.generateReadme(input.name, config.template)
      await Bun.write(join(projectPath, "README.md"), readmeContent)
    }

    // Use template system to create template-specific files
    const template = this.templateRegistry.get(config.template)
    if (template) {
      await template.generate(projectPath, { 
        projectName: input.name,
        ...config
      })
    }

    // Initialize git repository if requested
    if (config.createGitRepo) {
      await this.initializeGitRepository(projectPath)
    }
  }

  private generatePackageJson(projectName: string, config: EmptyPluginConfig): any {
    const base = {
      name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      version: "1.0.0",
      description: `A new OpenCode project`,
      main: "src/index.js",
      type: "module",
    }

    switch (config.template) {
      case "typescript":
        return {
          ...base,
          main: "dist/index.js",
          scripts: {
            build: "tsc",
            dev: "tsc --watch",
            start: "node dist/index.js",
            test: "echo 'No tests yet'"
          },
          devDependencies: {
            typescript: "^5.0.0",
            "@types/node": "^20.0.0"
          }
        }
      case "node":
        return {
          ...base,
          scripts: {
            dev: "node --watch src/index.js",
            start: "node src/index.js",
            test: "echo 'No tests yet'"
          }
        }
      case "web":
        return {
          ...base,
          scripts: {
            dev: "python -m http.server 8000",
            build: "echo 'No build process yet'",
            start: "python -m http.server 8000"
          }
        }
      default:
        return {
          ...base,
          scripts: {
            dev: "echo 'Hello from OpenCode project!'",
            start: "echo 'Hello from OpenCode project!'"
          }
        }
    }
  }

  private generateReadme(projectName: string, template: string): string {
    const templateInfo = {
      basic: "basic project structure",
      typescript: "TypeScript project with build configuration",
      node: "Node.js project with ES modules",
      web: "web project with static files"
    }

    return `# ${projectName}

This is a new OpenCode project created with the ${templateInfo[template as keyof typeof templateInfo] || "basic template"}.

## Getting Started

\`\`\`bash
# Install dependencies (if any)
npm install

# Start development
npm run dev
\`\`\`

## Project Structure

- \`src/\` - Source code files
- \`package.json\` - Project configuration
- \`README.md\` - This file

## Next Steps

1. Add your project code to the \`src/\` directory
2. Update the \`package.json\` scripts as needed
3. Add dependencies with \`npm install <package-name>\`
4. Start building your project!

---

*Created with OpenCode*
`
  }

  private async initializeGitRepository(projectPath: string): Promise<void> {
    try {
      // Initialize git repository
      await Bun.spawn({
        cmd: ["git", "init"],
        cwd: projectPath,
        stdout: "pipe",
        stderr: "pipe",
      }).exited

      // Create .gitignore
      const gitignore = `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build outputs
dist/
build/
*.tsbuildinfo

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE files
.vscode/
.idea/
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db

# Logs
logs
*.log

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache
`

      await Bun.write(join(projectPath, ".gitignore"), gitignore)

      // Initial commit
      await Bun.spawn({
        cmd: ["git", "add", "."],
        cwd: projectPath,
        stdout: "pipe",
        stderr: "pipe",
      }).exited

      await Bun.spawn({
        cmd: ["git", "commit", "-m", "Initial commit"],
        cwd: projectPath,
        stdout: "pipe",
        stderr: "pipe",
      }).exited

    } catch (error) {
      // Git initialization is optional, so we don't throw
      console.warn("Failed to initialize git repository:", error)
    }
  }
}