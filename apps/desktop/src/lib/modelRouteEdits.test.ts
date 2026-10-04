import { describe, expect, it } from 'vitest'
import { routesAfterModelRemoval } from './modelRouteEdits'

describe('model route removal', () => {
  it('preserves a model with the same name from a different provider and carries If-Match', () => {
    const route = { purpose: 'chat', revision: 7, updated_at: '', candidates: [
      { provider_instance_id: 'one', model: 'same-model', position: 0 },
      { provider_instance_id: 'two', model: 'same-model', position: 1 },
    ] }
    expect(routesAfterModelRemoval([route], 'one', 'same-model')).toEqual([
      { purpose: 'chat', revision: 7, candidates: [{ provider_instance_id: 'two', model: 'same-model' }] },
    ])
    expect(route.candidates).toHaveLength(2)
    expect(routesAfterModelRemoval([route], 'other', 'same-model')).toEqual([])
  })
  it('refuses before any writes when removal would leave a route with no candidate', () => {
    expect(() => routesAfterModelRemoval([{ purpose: 'chat', updated_at: '', candidates: [{ provider_instance_id: 'one', model: 'm', position: 0 }] }], 'one', 'm'))
      .toThrow('model_route_requires_replacement')
  })
})
