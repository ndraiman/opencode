# OpenCode Orchestrator

A server package for managing multiple OpenCode instances with project provisioning, process management, and proxy functionality.

## Features

- **Project Provisioning**: Clone Git repositories or initialize fresh projects
- **Process Management**: Start, stop, and restart OpenCode instances
- **Status Tracking**: Monitor instance status (running, stopped, failed)
- **Proxy Functionality**: Forward HTTP/WebSocket requests to appropriate instances
- **Log Collection**: Capture stdout/stderr from running instances

## Installation

```bash
cd packages/opencode-orchestrator
bun install
```

## Usage

### Start the Orchestrator

```bash
# Default configuration (port 3000, localhost)
bun start

# Custom configuration
bun start --port=8080 --hostname=0.0.0.0 --workspace=/custom/path
```

### Command Line Options

- `--port=3000` - Port to listen on (default: 3000)
- `--hostname=127.0.0.1` - Hostname to bind to (default: 127.0.0.1)
- `--workspace=/path` - Custom workspace directory for projects

## API Endpoints

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/projects` | Create new project |
| `GET` | `/projects` | List all projects |
| `GET` | `/projects/:projectId` | Get project details |
| `DELETE` | `/projects/:projectId` | Delete project |

### Project Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/projects/:projectId/start` | Start OpenCode instance |
| `POST` | `/projects/:projectId/stop` | Stop OpenCode instance |
| `POST` | `/projects/:projectId/restart` | Restart OpenCode instance |

### Proxy & Logs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/projects/:projectId/proxy` | Proxy HTTP request to instance |
| `GET` | `/projects/:projectId/ws` | Proxy WebSocket connection |
| `GET` | `/projects/:projectId/logs` | Get instance logs |
| `ALL` | `/projects/:projectId/proxy/*` | Generic proxy for any HTTP method |

## API Examples

### Create a Git Project

```bash
curl -X POST http://localhost:3000/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-project",
    "type": "git",
    "gitUrl": "https://github.com/user/repo.git",
    "gitBranch": "main",
    "description": "My awesome project"
  }'
```

### Create an Empty Project

```bash
curl -X POST http://localhost:3000/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "empty-project",
    "type": "empty",
    "description": "A fresh start"
  }'
```

### Start a Project

```bash
curl -X POST http://localhost:3000/projects/{projectId}/start
```

### List Projects

```bash
curl http://localhost:3000/projects
```

### Proxy HTTP Request

```bash
curl -X POST http://localhost:3000/projects/{projectId}/proxy \
  -H "Content-Type: application/json" \
  -d '{
    "method": "GET",
    "path": "/api/status",
    "headers": {
      "Authorization": "Bearer token"
    }
  }'
```

### Get Project Logs

```bash
curl http://localhost:3000/projects/{projectId}/logs
```

## Project Types

### Git Projects
- Clones the specified repository
- Supports branch selection
- Shallow clone for faster setup

### Empty Projects
- Creates basic project structure
- Includes `package.json`, `README.md`, and starter TypeScript file
- Ready for immediate development

## Project Status

- `stopped` - Project exists but OpenCode instance is not running
- `starting` - OpenCode instance is being started
- `running` - OpenCode instance is active and accessible
- `stopping` - OpenCode instance is being shut down
- `failed` - Project or instance encountered an error

## Architecture

The orchestrator consists of several components:

- **ProjectManager**: Handles project lifecycle (create, delete, start, stop)
- **ProxyService**: Forwards HTTP/WebSocket requests to running instances
- **API Router**: Hono-based REST API with validation
- **State Management**: In-memory state tracking for projects and processes

## Development

```bash
# Type check
bun run typecheck

# Development with auto-reload
bun run dev

# Start production server
bun run start
```

## Error Handling

The orchestrator includes comprehensive error handling:

- Project validation on creation
- Process management error recovery
- Proxy request error forwarding
- Graceful shutdown of all instances

## Workspace Structure

```
~/.opencode/orchestrator/projects/
├── {project-id-1}/          # Git or empty project files
├── {project-id-2}/          # Another project
└── ...
```

Each project gets its own isolated directory within the workspace.