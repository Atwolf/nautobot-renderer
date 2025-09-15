import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock environment variables
vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8000')
vi.stubEnv('VITE_REQUEST_TIMEOUT', '30000')
vi.stubEnv('VITE_ENABLE_REQUEST_LOGGING', 'false')
vi.stubEnv('VITE_API_TOKEN', 'test-token')

// Mock fetch globally
global.fetch = vi.fn()

// Mock performance.now for timing tests
global.performance = {
  ...global.performance,
  now: vi.fn(() => Date.now())
}

// Mock AbortSignal.timeout for older environments
if (!AbortSignal.timeout) {
  AbortSignal.timeout = vi.fn((delay: number) => {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), delay)
    return controller.signal
  })
}

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
  vi.unstubAllEnvs()
})