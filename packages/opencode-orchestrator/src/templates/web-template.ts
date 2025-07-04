import { join } from "node:path"
import type { ProjectTemplate } from "../plugins/types.js"

export class WebTemplate implements ProjectTemplate {
  readonly id = "web"
  readonly name = "Web Application"
  readonly description = "HTML, CSS, and JavaScript web application"

  async generate(projectPath: string, config: any): Promise<void> {
    const { projectName } = config

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
}