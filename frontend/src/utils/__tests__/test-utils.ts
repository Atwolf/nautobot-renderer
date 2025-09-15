import { render, RenderOptions } from '@testing-library/react'
import { ReactElement, ReactNode, createElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { SchemaResponse, ModelNode, ModelRelationship, SchemaMetadata } from '@/types/schema'

// Create a mock query client for testing
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  })
}

// Wrapper component for React Query
interface AllTheProvidersProps {
  children: ReactNode
}

export function AllTheProviders({ children }: AllTheProvidersProps) {
  const queryClient = createTestQueryClient()
  
  return createElement(QueryClientProvider, { client: queryClient }, children)
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }

// Mock data factories
export function createMockModelNode(overrides: Partial<ModelNode> = {}): ModelNode {
  return {
    id: 'test-model',
    name: 'TestModel',
    app: 'test',
    fields: [
      { name: 'id', type: 'AutoField', required: true, nullable: false },
      { name: 'name', type: 'CharField', required: true, nullable: false },
    ],
    relationships: {
      outgoing: [],
      incoming: [],
    },
    isAbstract: false,
    ...overrides,
  }
}

export function createMockRelationship(overrides: Partial<ModelRelationship> = {}): ModelRelationship {
  return {
    id: 'test-relationship',
    fromModel: 'ModelA',
    toModel: 'ModelB',
    type: 'foreign_key',
    fieldName: 'model_b',
    ...overrides,
  }
}

export function createMockSchemaMetadata(overrides: Partial<SchemaMetadata> = {}): SchemaMetadata {
  return {
    discoveredAt: '2025-01-01T00:00:00Z',
    nautobotVersion: '2.0.0',
    modelCount: 2,
    relationshipCount: 1,
    apps: ['test'],
    ...overrides,
  }
}

export function createMockSchemaResponse(overrides: Partial<SchemaResponse> = {}): SchemaResponse {
  return {
    nodes: [createMockModelNode()],
    edges: [createMockRelationship()],
    metadata: createMockSchemaMetadata(),
    ...overrides,
  }
}

// Error response factories
export function createNetworkError(): Error {
  const error = new Error('Failed to fetch')
  error.name = 'TypeError'
  return error
}

export function createTimeoutError(): DOMException {
  const error = new DOMException('The operation was aborted', 'TimeoutError')
  return error
}

export function createHttpError(status: number, message: string, code?: string) {
  return {
    ok: false,
    status,
    statusText: message,
    json: () => Promise.resolve({
      message,
      code: code || `HTTP_${status}`,
      details: { status }
    })
  }
}

export function createCorsError(): Error {
  const error = new Error('CORS error')
  error.name = 'TypeError'
  return error
}

// Performance testing utilities
export function measurePerformance<T>(fn: () => T | Promise<T>): Promise<{ result: T; duration: number }> {
  const start = performance.now()
  const result = fn()
  
  if (result instanceof Promise) {
    return result.then(res => ({
      result: res,
      duration: performance.now() - start
    }))
  }
  
  return Promise.resolve({
    result,
    duration: performance.now() - start
  })
}

// Memory usage helpers (for memory leak detection)
export function createLargeDataset(size: number): ModelNode[] {
  return Array.from({ length: size }, (_, i) => createMockModelNode({
    id: `model-${i}`,
    name: `Model${i}`,
    fields: Array.from({ length: 10 }, (_, j) => ({
      name: `field_${j}`,
      type: j % 2 === 0 ? 'CharField' : 'IntegerField',
      required: j < 5,
      nullable: j >= 5,
    }))
  }))
}

// Wait utilities for async testing
export function waitForMs(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function waitForNextTick(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}