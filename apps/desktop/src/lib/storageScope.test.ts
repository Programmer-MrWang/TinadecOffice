import { describe, expect, it } from 'vitest'
import { captureStorageId, registerProjectStorage, rememberStorageResult, selectedStorageId, setSelectedStorage, scopedApi, storageHeaders, normalizeStorageRequest } from './storageScope'

describe('captured storage scope', () => {
  it('keeps dispatched headers and entity mappings on their original scope', () => {
    registerProjectStorage('old-project', 'old-scope')
    setSelectedStorage('old-scope')
    const options = { method: 'POST', body: JSON.stringify({ project_id: 'old-project' }) }
    const headers = storageHeaders('/api/v1/sessions', options)
    setSelectedStorage('new-scope')
    expect(headers.get('x-tinadec-storage-id')).toBe('old-scope')
    rememberStorageResult('/api/v1/sessions', { id: 'late-session', project_id: 'old-project' }, 'old-scope')
    expect(captureStorageId('/api/v1/sessions/late-session/messages')).toBe('old-scope')
    expect(captureStorageId('/api/v1/projects')).toBe('user')
    expect(selectedStorageId()).toBe('new-scope')
  })
  it('uses a bound settings context and restores it after dispatch', () => {
    setSelectedStorage('new-scope')
    const settings = scopedApi({ load: () => storageHeaders('/api/v1/tools/settings/defaults') }, () => 'old-scope')
    expect(settings.load().get('x-tinadec-storage-id')).toBe('old-scope')
    expect(storageHeaders('/api/v1/tools/settings/defaults').get('x-tinadec-storage-id')).toBe('new-scope')
    expect(captureStorageId('/api/v1/tools/settings/defaults', { storageId: 'explicit' })).toBe('explicit')
  })
  it('keeps copied product ids independent and strips the selected composite key on the wire', () => {
    registerProjectStorage('copied-project', 'original-scope')
    registerProjectStorage('copied-project', 'copy-scope')
    setSelectedStorage('original-scope')
    expect(captureStorageId('/api/v1/projects/copied-project')).toBe('original-scope')
    expect(captureStorageId('/api/v1/projects/copy-scope%3A%3Acopied-project')).toBe('copy-scope')
    const normalized = normalizeStorageRequest('/api/v1/sessions', { body: JSON.stringify({ project_id: 'copy-scope::copied-project' }) })
    expect(JSON.parse(String(normalized.body))).toEqual({ project_id: 'copied-project' })
    expect(normalizeStorageRequest('/api/v1/projects/copy-scope%3A%3Acopied-project').path).toBe('/api/v1/projects/copied-project')
    setSelectedStorage('user')
  })
})
