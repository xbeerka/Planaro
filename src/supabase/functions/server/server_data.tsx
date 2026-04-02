import { Hono } from "npm:hono";
import { registerWorkspacesRoutes } from './server_workspaces.tsx';
import { registerDepartmentsRoutes } from './server_departments.tsx';
import { registerResourcesDataRoutes } from './server_resources_data.tsx';
import { registerProjectsRoutes } from './server_projects.tsx';
import { registerMembersRoutes } from './server_members.tsx';
import { registerOrganizationsRoutes } from './server_organizations.tsx';

/**
 * registerDataRoutes — регистрирует все data-маршруты через подмодули.
 * 
 * Декомпозиция:
 * - server_workspaces.tsx — Workspaces CRUD, summary, users
 * - server_departments.tsx — Departments, Grades, Companies
 * - server_resources_data.tsx — Resources CRUD, batch operations
 * - server_projects.tsx — Projects, Off-weeks
 * - server_members.tsx — Workspace members, invites, notifications
 * - server_organizations.tsx — Organizations CRUD, org members, org invites
 */
export function registerDataRoutes(app: Hono) {
  registerWorkspacesRoutes(app);
  registerDepartmentsRoutes(app);
  registerResourcesDataRoutes(app);
  registerProjectsRoutes(app);
  registerMembersRoutes(app);
  registerOrganizationsRoutes(app);
}
