// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/api'
afterEach(() => { vi.unstubAllGlobals() })
describe('tool settings wire contract', () => {
  it('guards new MCP and Skills resources with the quoted zero revision', async () => {
    const fetch = vi.fn(async () => Response.json({ revision: 1 })); vi.stubGlobal('fetch', fetch)
    await api.createToolMcpResource({ id: 'fixture', name: 'Fixture', enabled: true, command: 'node', args: [], env: {} })
    await api.importToolSkill({ scope: 'shared', name: 'fixture', content: 'Fixture skill' })
    for (const call of fetch.mock.calls) {
      const [, init] = call as unknown as [string, RequestInit]
      expect(init.method).toBe('POST')
      expect(new Headers(init.headers).get('if-match')).toBe('"0"')
    }
  })
  it('preserves sparse overrides and quoted revision with selected project', async () => {
    const fetch = vi.fn(async () => Response.json({ revision: 2 })); vi.stubGlobal('fetch', fetch)
    await api.saveAgentToolSettings('agent/a', { skills: { resource_ids: [] } }, 1, 'project one')
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('/api/v1/tools/settings/agents/agent%2Fa?project_id=project%20one')
    expect(new Headers(init.headers).get('if-match')).toBe('"1"')
    expect(JSON.parse(String(init.body))).toEqual({ settings: { skills: { resource_ids: [] } } })
  })
  it('sends the loaded project skill hash and revision without synthesizing completion', async () => {
    const fetch = vi.fn(async () => Response.json({ user_action_id: 'action', action_status: 'awaiting_approval' })); vi.stubGlobal('fetch', fetch)
    const result = await api.saveToolSkill('resource', { content: 'new', expected_file_hash: 'loaded-hash' }, 7, 'project')
    expect(result.action_status).toBe('awaiting_approval')
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(new Headers(init.headers).get('if-match')).toBe('"7"')
    expect(JSON.parse(String(init.body)).expected_file_hash).toBe('loaded-hash')
  })
})
