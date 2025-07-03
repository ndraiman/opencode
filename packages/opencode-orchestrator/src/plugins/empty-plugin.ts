import { z } from "zod"
import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import type { ProjectPlugin, ValidationResult, CreateProjectInput } from "./types.js"
import type { Project, ProcessInfo } from "../types.js"

const EmptyConfigSchema = z.object({
  template: z.enum(["basic", "typescript", "node", "web"]).optional().default("basic"),
  createGitRepo: z.boolean().optional().default(false),
  includeReadme: z.boolean().optional().default(true),
})

export class EmptyPlugin implements ProjectPlugin {
  readonly id = "empty-plugin"
  readonly name = "Empty Project Plugin"
  readonly description = "Creates empty projects with basic scaffolding"
  readonly projectType = "empty"

  async validateInput(input: CreateProjectInput): Promise<ValidationResult> {
    const warnings: string[] = []

    // Validate template if provided
    if (input.config?.template) {
      const validTemplates = ["basic", "typescript", "node", "web"]
      if (!validTemplates.includes(input.config.template as string)) {
        return {
          isValid: false,
          errors: [`Invalid template. Must be one of: ${validTemplates.join(", ")}`],
        }
      }
    }

    // Provide helpful warnings
    if (!input.config?.template || input.config.template === "basic") {
      warnings.push("Using basic template. Consider using 'typescript', 'node', or 'web' for more features.")
    }

    return {
      isValid: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  }

  async createProject(input: CreateProjectInput, projectPath: string): Promise<void> {
    const config = input.config || {}
    const template = config.template as string || "basic"
    const createGitRepo = config.createGitRepo as boolean || false
    const includeReadme = config.includeReadme as boolean ?? true

    await this.initializeEmptyProject(
      projectPath,
      input.name,
      template,
      createGitRepo,
      includeReadme
    )
  }

  getConfigSchema(): z.ZodSchema<any> {
    return EmptyConfigSchema
  }

  private async initializeEmptyProject(
    projectPath: string,
    projectName: string,
    template: string,
    createGitRepo: boolean,
    includeReadme: boolean
  ): Promise<void> {
    // Create basic project structure
    await mkdir(join(projectPath, "src"), { recursive: true })

    // Create package.json based on template
    const packageJson = this.generatePackageJson(projectName, template)
    await Bun.write(
      join(projectPath, "package.json"),
      JSON.stringify(packageJson, null, 2)
    )

    // Create README if requested
    if (includeReadme) {
      const readmeContent = this.generateReadme(projectName, template)
      await Bun.write(join(projectPath, "README.md"), readmeContent)
    }

    // Create template-specific files
    switch (template) {
      case "typescript":
        await this.createTypeScriptFiles(projectPath, projectName)
        break
      case "node":
        await this.createNodeFiles(projectPath, projectName)
        break
      case "web":
        await this.createWebFiles(projectPath, projectName)
        break
      default:
        await this.createBasicFiles(projectPath, projectName)
    }

    // Initialize git repository if requested
    if (createGitRepo) {
      await this.initializeGitRepository(projectPath)
    }
  }

  private generatePackageJson(projectName: string, template: string): any {
    const base = {
      name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      version: "1.0.0",
      description: `A new OpenCode project`,
      main: "src/index.js",
      type: "module",
    }

    switch (template) {
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

  private async createBasicFiles(projectPath: string, projectName: string): Promise<void> {
    await Bun.write(
      join(projectPath, "src/index.js"),
      `console.log("Hello from ${projectName}!");

export function greet(name) {
  return \`Hello, \${name}!\`;
}
`
    )
  }

  private async createTypeScriptFiles(projectPath: string, projectName: string): Promise<void> {
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

  private async createNodeFiles(projectPath: string, projectName: string): Promise<void> {
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

  private async createWebFiles(projectPath: string, projectName: string): Promise<void> {
    // Create HTML file
    await Bun.write(
      join(projectPath, "index.html"),
      `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName}</title>
    <link rel="stylesheet" href="src/style.css">
</head>
<body>
    <div class="container">
        <h1>Welcome to ${projectName}</h1>
        <p>This is your new OpenCode web project!</p>
        <button id="greet-btn">Click me!</button>
    </div>
    <script src="src/index.js"></script>
</body>
</html>
`
    )

    // Create CSS file
    await Bun.write(
      join(projectPath, "src/style.css"),
      `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  line-height: 1.6;
  color: #333;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.container {
  background: white;
  padding: 2rem;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  text-align: center;
  max-width: 500px;
  width: 90%;
}

h1 {
  color: #4a5568;
  margin-bottom: 1rem;
  font-size: 2rem;
}

p {
  margin-bottom: 1.5rem;
  color: #718096;
}

button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  transition: transform 0.2s ease;
}

button:hover {
  transform: translateY(-2px);
}

button:active {
  transform: translateY(0);
}
`
    )

    // Create JavaScript file
    await Bun.write(
      join(projectPath, "src/index.js"),
      `document.addEventListener('DOMContentLoaded', function() {
    const button = document.getElementById('greet-btn');
    
    button.addEventListener('click', function() {
        alert('Hello from ${projectName}!');
    });
});

export function greet(name) {
    return \`Hello, \${name}!\`;
}
`
    )
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