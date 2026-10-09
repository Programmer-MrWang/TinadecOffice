import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'
import { createSettingsLeaveGuard } from './settingsNavigation'

const Settings = { template: '<div>settings</div>' }
const Home = { template: '<div>home</div>' }

function makeRouter(guard: () => Promise<boolean>) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: Home }, { path: '/settings', component: Settings }],
  })
  router.beforeEach((_to, from) => from.path === '/settings' ? guard() : true)
  return router
}

describe('Settings route leave guard', () => {
  it('keeps memory-router navigation pending until the exit wait resolves', async () => {
    let release!: () => void
    const pending = new Promise<void>(resolve => { release = resolve })
    let exiting = false
    const router = makeRouter(createSettingsLeaveGuard({
      isTools: () => false,
      isExiting: () => exiting,
      markExiting: () => { exiting = true },
      durationMs: 530,
    }, () => pending))
    await router.push('/settings')
    const navigation = router.push('/')
    await Promise.resolve()
    expect(router.currentRoute.value.path).toBe('/settings')
    release()
    await navigation
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('returns false from the guard and preserves the current route when draft leave is rejected', async () => {
    let canLeave = false
    const router = makeRouter(createSettingsLeaveGuard({
      isTools: () => true,
      canLeave: async () => canLeave,
      isExiting: () => false,
      markExiting: () => undefined,
      durationMs: 530,
    }))
    await router.push('/settings')
    const navigation = await router.push('/')
    expect(navigation).toBeTruthy()
    expect(router.currentRoute.value.path).toBe('/settings')
  })
})
