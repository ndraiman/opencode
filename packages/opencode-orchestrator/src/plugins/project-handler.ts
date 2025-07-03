export interface ProjectHandler {
  /** Unique name to identify the plugin */
  readonly name: string

  /**
   * Create a new project and return the created project object.
   */
  createProject(input: import("../types.js").CreateProjectInput): Promise<import("../types.js").Project>

  /** Completely remove an existing project (stop it first if needed). */
  deleteProject(projectId: string): Promise<void>

  /** Start a previously created project */
  startProject(projectId: string): Promise<void>

  /** Stop a running project */
  stopProject(projectId: string): Promise<void>

  /** Restart a running project */
  restartProject(projectId: string): Promise<void>

  /** Retrieve the recent logs collected for a project */
  getProjectLogs(projectId: string): Promise<string[]>
}