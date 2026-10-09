/** Explicit CoreDto -> ExternalDto for Project, no AutoMapper */
export interface CoreProjectDto {
  id: string;
  name: string;
  path: string;
  kind?: string;
  created_at?: string;
  updated_at?: string;
  lifecycle_status?: string;
  trashed_at?: string | null;
}

export type ProjectLifecycleStatus = 'active' | 'archived' | 'trashed';

export interface ExternalProjectDto {
  roots?: Array<{ id: string; path: string }>;
  primary_root_id?: string;
  icon?: string;
  color?: string;
  configuration_hash?: string;
  storage_root?: string;
  external?: boolean;
  availability?: string;
  availability_error?: string;
  storage_id?: string;
  id: string;
  name: string;
  path: string;
  kind: string | null;
  created_at: string | null;
  updated_at: string | null;
  lifecycle_status: ProjectLifecycleStatus;
  trashed_at: string | null;
}

function isRecord(v: unknown): v is Record<string, unknown> { return typeof v === 'object' && v !== null && !Array.isArray(v); }

function toLifecycleStatus(v: unknown): ProjectLifecycleStatus {
  return v === 'archived' || v === 'trashed' ? v : 'active';
}

export function mapProject(core: unknown): ExternalProjectDto | null {
  if (!isRecord(core)) return null;
  const id = String(core.id ?? '');
  if (!id) return null;
  return {
    ...(typeof core.storage_id === 'string' ? { storage_id: core.storage_id } : {}),
    ...(Array.isArray(core.roots) ? { roots: core.roots.filter(isRecord).map(root => ({ id: String(root.id), path: String(root.path) })) } : {}),
    ...Object.fromEntries(['primary_root_id', 'icon', 'color', 'configuration_hash', 'storage_root', 'availability', 'availability_error'].filter(key => typeof core[key] === 'string').map(key => [key, core[key]])),
    ...(typeof core.external === 'boolean' ? { external: core.external } : {}),
    id,
    name: String(core.name ?? ''),
    path: String(core.path ?? ''),
    kind: (core.kind as string) ?? null,
    created_at: (core.created_at as string) ?? (core.createdAt as string) ?? null,
    updated_at: (core.updated_at as string) ?? (core.updatedAt as string) ?? null,
    lifecycle_status: toLifecycleStatus(core.lifecycle_status ?? core.lifecycleStatus),
    trashed_at: (core.trashed_at as string) ?? (core.trashedAt as string) ?? null,
  };
}

export function mapProjects(core: unknown): ExternalProjectDto[] {
  if (Array.isArray(core)) return core.map(mapProject).filter((x): x is ExternalProjectDto => x !== null);
  return [];
}
