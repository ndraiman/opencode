import { z } from "zod"

export const ProjectStatus = z.enum(["stopped", "starting", "running", "stopping", "failed"])
export type ProjectStatus = z.infer<typeof ProjectStatus>

export const CreateProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  type: z.enum(["git", "empty"]),
  description: z.string().optional(),
  config: z.record(z.any()).optional(), // Plugin-specific configuration
})
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["git", "empty"]),
  description: z.string().optional(),
  status: ProjectStatus,
  path: z.string(),
  port: z.number().optional(),
  pid: z.number().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastError: z.string().optional(),
  config: z.record(z.any()).optional(), // Plugin-specific configuration
})
export type Project = z.infer<typeof ProjectSchema>

export const ProxyRequestSchema = z.object({
  method: z.string(),
  path: z.string(),
  headers: z.record(z.string()).optional(),
  body: z.string().optional(),
})
export type ProxyRequestInput = z.infer<typeof ProxyRequestSchema>

export interface ProcessInfo {
  process: Bun.Subprocess<"ignore", "pipe", "pipe">
  port: number
  startedAt: Date
  logs: string[]
}

export interface OrchestratorState {
  projects: Map<string, Project>
  processes: Map<string, ProcessInfo>
}