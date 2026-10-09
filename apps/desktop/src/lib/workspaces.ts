import type { Component } from 'vue'
import { BookOpen, Bot, Briefcase, Code, Database, FlaskConical, FolderOpen, Globe, Layers, Palette, Rocket, Terminal } from '@lucide/vue'
export interface WorkspaceRoot { id: string; path: string }
export interface WorkspaceDefinition { name: string; roots: WorkspaceRoot[]; primary_root_id: string; icon: string; color: string; content_hash: string; primary_path?: string }
export interface WorkspaceInput { name: string; roots: WorkspaceRoot[]; primary_root_id: string; icon: string; color: string }
export interface WorkspacePreview { exists: boolean; project_path: string; storage_id?: string | null; storage_root?: string | null; workspace?: WorkspaceDefinition | null }
export interface WorkspaceLoadState { status: 'loading' | 'ready' | 'error'; message?: string }
export const workspaceIcons: Record<string, Component> = { folder: FolderOpen, code: Code, book: BookOpen, briefcase: Briefcase, flask: FlaskConical, rocket: Rocket, layers: Layers, bot: Bot, globe: Globe, palette: Palette, terminal: Terminal, database: Database }
export const workspaceColors = ['default', 'blue', 'green', 'yellow', 'orange', 'red', 'pink', 'purple', 'teal']
export function folderIdentity(path: string) {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '')
  return /^[a-z]:\//i.test(normalized) || normalized.startsWith('//') ? normalized.toLowerCase() : normalized
}
