export const api = {
  listAgentModeTopologies: async () => [
    { id: 'fixture-mode', display_name: '规划', status: 'published', latest_published_mode_version_id: 'fixture-mode-version', nodes: [], edges: [] },
    { id: 'fixture-build', display_name: '实现', status: 'published', latest_published_mode_version_id: 'fixture-build-version', nodes: [], edges: [] },
  ],
  listModelProviders: async () => [],
  listDirectory: async () => ({ data: { entries: [] } }),
}
