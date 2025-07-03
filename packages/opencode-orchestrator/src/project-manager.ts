import type { CreateProjectInput, Project, OrchestratorState } from "./types.js"
import type { ProjectHandler } from "./plugins/project-handler.js"
import { LocalGitHandler } from "./plugins/local-git-handler.js"

export class ProjectManager {
  private readonly handler: ProjectHandler

  constructor(state: OrchestratorState, workspaceDir: string, handler?: ProjectHandler) {
    // If a custom handler is not supplied, use the default local-git implementation
    this.handler = handler ?? new LocalGitHandler(state, workspaceDir)
  }

  /* ------------------------------------------------------------------ */
  /* Passthrough methods                                                */
  /* ------------------------------------------------------------------ */

  createProject(input: CreateProjectInput): Promise<Project> {
    return this.handler.createProject(input)
  }

  deleteProject(projectId: string): Promise<void> {
    return this.handler.deleteProject(projectId)
  }

  listProjects(): Promise<Project[]> {
    // The handler already keeps the authoritative state, so we can just
    // ask it for the list via the same `createProject` state Map.
    // To avoid expanding the public interface of ProjectHandler we use
    // reflection here – every handler should expose the same Map on the
    // `state` property (because the default handler does). When that map
    // is not present, we fall back to an empty list.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const state = (this.handler as unknown as { state?: OrchestratorState }).state
    return Promise.resolve(state ? Array.from(state.projects.values()) : [])
  }

  getProject(projectId: string): Promise<Project | undefined> {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const state = (this.handler as unknown as { state?: OrchestratorState }).state
    return Promise.resolve(state?.projects.get(projectId))
  }

  startProject(projectId: string): Promise<void> {
    return this.handler.startProject(projectId)
  }

  stopProject(projectId: string): Promise<void> {
    return this.handler.stopProject(projectId)
  }

  restartProject(projectId: string): Promise<void> {
    return this.handler.restartProject(projectId)
  }

  getProjectLogs(projectId: string): Promise<string[]> {
    return this.handler.getProjectLogs(projectId)
  }
}