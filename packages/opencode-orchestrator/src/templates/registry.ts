import type { ProjectTemplate, TemplateRegistry } from "../plugins/types.js"

export class DefaultTemplateRegistry implements TemplateRegistry {
  private templates = new Map<string, ProjectTemplate>()

  register(template: ProjectTemplate): void {
    this.templates.set(template.id, template)
  }

  get(id: string): ProjectTemplate | null {
    return this.templates.get(id) || null
  }

  list(): ProjectTemplate[] {
    return Array.from(this.templates.values())
  }
}

export function createDefaultTemplateRegistry(): TemplateRegistry {
  return new DefaultTemplateRegistry()
}