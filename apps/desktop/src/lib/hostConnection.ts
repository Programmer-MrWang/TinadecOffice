/** Public host readiness snapshot. Credentials never cross this boundary. */
export interface HostConnectionStatus {
  state: 'checking' | 'ready' | 'unavailable' | 'rejected' | 'preview'
  managed: boolean
  checked_at?: string
  error?: { code: string; message: string }
}
