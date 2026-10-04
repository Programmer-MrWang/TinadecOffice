import type { ModelRouteDto } from '@/api'

/** Preflight every affected route before issuing any writes. Identity includes the provider. */
export function routesAfterModelRemoval(routes: ModelRouteDto[], providerId: string, model: string) {
  return routes.filter(route => route.candidates.some(candidate => candidate.provider_instance_id === providerId && candidate.model === model))
    .map(route => {
      const candidates = route.candidates.filter(candidate => candidate.provider_instance_id !== providerId || candidate.model !== model)
      if (candidates.length === 0) throw new Error('model_route_requires_replacement')
      return { purpose: route.purpose, revision: route.revision, candidates: candidates.map(candidate => ({ provider_instance_id: candidate.provider_instance_id, model: candidate.model ?? null })) }
    })
}
