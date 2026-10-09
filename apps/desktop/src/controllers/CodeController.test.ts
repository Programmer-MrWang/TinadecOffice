// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import { captureStorageId } from '@/lib/storageScope'
const mocks = vi.hoisted(() => ({ listProjects: vi.fn(), listSessions: vi.fn(), listApprovals: vi.fn() }))
vi.mock('@/api', () => ({ api: mocks }))
vi.mock('@/composables/useNotifications', () => ({ useNotifications: () => ({ notify: { error: vi.fn() }, banner: { error: vi.fn() }, dismissByKey: vi.fn() }) }))
import { codeController } from './CodeController'
it('ignores a late source clone session and reads approvals from the selected clone', async () => {
  let resolveSource!: (value: Array<{ id: string }>) => void
  const scopes: string[] = []
  codeController.projects.value = [{ id: 'same-project', storage_id: 'source', path: 'C:/source' }, { id: 'same-project', storage_id: 'copy', path: 'C:/copy' }] as never
  mocks.listSessions.mockImplementation((key: string) => key.startsWith('source::') ? new Promise(resolve => { resolveSource = resolve }) : Promise.resolve([{ id: 'copy-session' }]))
  mocks.listApprovals.mockImplementation(async () => { scopes.push(captureStorageId('/api/v1/approvals')); return [{ id: 'copy-approval' }] })
  codeController.setProject('source::same-project')
  codeController.setProject('copy::same-project')
  await flushPromises()
  resolveSource([{ id: 'source-session' }]); await flushPromises()
  expect(codeController.selectedSessionId.value).toBe('copy-session')
  expect(codeController.approvals.value[0]?.id).toBe('copy-approval')
  expect(scopes).toEqual(['copy'])
})
