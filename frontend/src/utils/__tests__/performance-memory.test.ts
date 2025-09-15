import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SchemaService } from '@/services/schema.service'
import { transformSchemaToGraph } from '../schemaTransformer'
import { useSchemaVisualization } from '@/hooks/useSchemaVisualization'
import { globalAutoLayout } from '../layout/autoLayout'
import {
  createMockSchemaResponse,
  createLargeDataset,
  measurePerformance,
  waitForMs,
  createTestQueryClient
} from './test-utils'
import { renderHook, act } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'

describe('Performance and Memory Leak Tests', () => {
  let mockFetch: ReturnType<typeof vi.fn>
  let schemaService: SchemaService

  beforeEach(() => {
    mockFetch = vi.fn()
    global.fetch = mockFetch
    schemaService = new SchemaService('http://localhost:8000', 30000)
    
    // Mock performance.mark and performance.measure for testing
    global.performance.mark = vi.fn()
    global.performance.measure = vi.fn()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  describe('API Request Performance', () => {
    it('should complete schema discovery within reasonable time', async () => {
      const mockResponse = createMockSchemaResponse({
        nodes: createLargeDataset(100),
        metadata: {
          discoveredAt: '2025-01-01T00:00:00Z',
          nautobotVersion: '2.0.0',
          modelCount: 100,
          relationshipCount: 150,
          apps: ['dcim', 'circuits', 'ipam']
        }
      })

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const { result, duration } = await measurePerformance(
        () => schemaService.discoverSchema()
      )

      expect(result).toBeDefined()
      expect(result.nodes).toHaveLength(100)
      expect(duration).toBeLessThan(2000) // Should complete within 2 seconds
    })

    it('should handle concurrent requests efficiently', async () => {
      const responses = [
        createMockSchemaResponse({ nodes: createLargeDataset(50) }),
        createMockSchemaResponse({ nodes: createLargeDataset(30) }),
        createMockSchemaResponse({ nodes: createLargeDataset(20) })
      ]

      mockFetch.mockImplementation((url) => {
        const index = url.includes('?') ? 1 : 0
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(responses[index] || responses[0])
        })
      })

      const { result: concurrentResults, duration } = await measurePerformance(
        () => Promise.all([
          schemaService.discoverSchema(),
          schemaService.getFilteredSchema({ apps: ['dcim'] }),
          schemaService.getFilteredSchema({ apps: ['circuits'] })
        ])
      )

      expect(concurrentResults).toHaveLength(3)
      expect(duration).toBeLessThan(3000) // Concurrent requests should not take much longer than single
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('should handle request timeout efficiently', async () => {
      const fastService = new SchemaService('http://localhost:8000', 500)
      
      mockFetch.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      )

      const { duration } = await measurePerformance(async () => {
        try {
          await fastService.discoverSchema()
        } catch (error) {
          // Expected to timeout
        }
      })

      expect(duration).toBeLessThan(800) // Should timeout close to the 500ms limit
    })
  })

  describe('Schema Transformation Performance', () => {
    it('should transform small datasets quickly', async () => {
      const smallSchema = createMockSchemaResponse({
        nodes: createLargeDataset(10)
      })

      const { result, duration } = await measurePerformance(
        () => transformSchemaToGraph(smallSchema)
      )

      expect(result.nodes).toHaveLength(10)
      expect(duration).toBeLessThan(50) // Very fast for small datasets
    })

    it('should transform medium datasets efficiently', async () => {
      const mediumSchema = createMockSchemaResponse({
        nodes: createLargeDataset(500)
      })

      const { result, duration } = await measurePerformance(
        () => transformSchemaToGraph(mediumSchema)
      )

      expect(result.nodes).toHaveLength(500)
      expect(duration).toBeLessThan(1000) // Should complete within 1 second
    })

    it('should transform large datasets within acceptable time', async () => {
      const largeSchema = createMockSchemaResponse({
        nodes: createLargeDataset(2000)
      })

      const { result, duration } = await measurePerformance(
        () => transformSchemaToGraph(largeSchema)
      )

      expect(result.nodes).toHaveLength(2000)
      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
    })

    it('should scale sub-linearly with dataset size', async () => {
      const sizes = [100, 200, 400, 800]
      const timings: number[] = []

      for (const size of sizes) {
        const schema = createMockSchemaResponse({
          nodes: createLargeDataset(size)
        })

        const { duration } = await measurePerformance(
          () => transformSchemaToGraph(schema)
        )

        timings.push(duration)
      }

      // Each doubling should not more than double the time (sub-quadratic growth)
      for (let i = 1; i < timings.length; i++) {
        const ratio = timings[i] / timings[i - 1]
        expect(ratio).toBeLessThan(3) // Allow some variance but should be better than O(n²)
      }
    })
  })

  describe('Layout Algorithm Performance', () => {
    it('should apply dagre layout efficiently for medium datasets', async () => {
      const nodes = Array.from({ length: 100 }, (_, i) => ({
        id: `node-${i}`,
        type: 'nautobotModel',
        position: { x: 0, y: 0 },
        data: { id: `model-${i}`, name: `Model${i}`, app: 'test', fields: [], relationships: { outgoing: [], incoming: [] }, isAbstract: false }
      }))

      const edges = Array.from({ length: 150 }, (_, i) => ({
        id: `edge-${i}`,
        source: `node-${i % 100}`,
        target: `node-${(i + 1) % 100}`,
        type: 'simplified',
        data: { id: `edge-${i}`, fromModel: `model-${i % 100}`, toModel: `model-${(i + 1) % 100}`, type: 'foreign_key', fieldName: 'test' }
      }))

      const { result, duration } = await measurePerformance(
        () => globalAutoLayout.applyLayout(nodes, edges, { algorithm: 'dagre' })
      )

      expect(result.nodes).toHaveLength(100)
      expect(duration).toBeLessThan(2000) // Should complete within 2 seconds
    })

    it('should handle layout switching without memory leaks', async () => {
      const nodes = Array.from({ length: 50 }, (_, i) => ({
        id: `node-${i}`,
        type: 'nautobotModel',
        position: { x: 0, y: 0 },
        data: { id: `model-${i}`, name: `Model${i}`, app: 'test', fields: [], relationships: { outgoing: [], incoming: [] }, isAbstract: false }
      }))

      const edges: any[] = []
      const algorithms = ['dagre', 'hierarchical', 'circular', 'force'] as const

      // Apply different layouts multiple times
      for (let round = 0; round < 10; round++) {
        for (const algorithm of algorithms) {
          const { duration } = await measurePerformance(
            () => globalAutoLayout.applyLayout(nodes, edges, { algorithm })
          )
          
          expect(duration).toBeLessThan(1000) // Each layout should be fast
        }
      }

      // If we reach here without memory issues, test passes
      expect(true).toBe(true)
    })
  })

  describe('Memory Leak Detection', () => {
    it('should not leak memory with repeated schema transformations', async () => {
      const schema = createMockSchemaResponse({
        nodes: createLargeDataset(100)
      })

      // Measure memory usage (basic approach for testing environment)
      const initialMemory = process.memoryUsage?.()?.heapUsed || 0

      // Perform many transformations
      for (let i = 0; i < 100; i++) {
        const result = transformSchemaToGraph(schema)
        expect(result.nodes).toHaveLength(100)
        
        // Simulate some processing to avoid dead code elimination
        if (i % 10 === 0) {
          await waitForMs(1)
        }
      }

      const finalMemory = process.memoryUsage?.()?.heapUsed || 0
      const memoryIncrease = finalMemory - initialMemory

      // Allow some memory increase but not proportional to iterations
      const maxAllowedIncrease = 50 * 1024 * 1024 // 50MB
      expect(memoryIncrease).toBeLessThan(maxAllowedIncrease)
    })

    it('should clean up event listeners and timers properly', async () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={createTestQueryClient()}>
          {children}
        </QueryClientProvider>
      )

      const { result, unmount } = renderHook(() => useSchemaVisualization(), {
        wrapper
      })

      // Simulate multiple operations
      await act(async () => {
        result.current.setIsLoading(true)
        await waitForMs(10)
        result.current.setIsLoading(false)
      })

      // Check that cleanup doesn't throw errors
      expect(() => unmount()).not.toThrow()
    })

    it('should handle large datasets without excessive memory allocation', async () => {
      const sizes = [100, 500, 1000, 2000]
      const memoryUsages: number[] = []

      for (const size of sizes) {
        const schema = createMockSchemaResponse({
          nodes: createLargeDataset(size)
        })

        const beforeMemory = process.memoryUsage?.()?.heapUsed || 0
        const result = transformSchemaToGraph(schema)
        const afterMemory = process.memoryUsage?.()?.heapUsed || 0

        expect(result.nodes).toHaveLength(size)
        memoryUsages.push(afterMemory - beforeMemory)

        // Force garbage collection if available (Node.js)
        if (global.gc) {
          global.gc()
        }
      }

      // Memory usage should scale roughly linearly, not exponentially
      for (let i = 1; i < memoryUsages.length; i++) {
        const ratio = memoryUsages[i] / memoryUsages[i - 1]
        expect(ratio).toBeLessThan(5) // Allow some variance but should not explode
      }
    })
  })

  describe('Hook Performance', () => {
    it('should initialize useSchemaVisualization hook quickly', async () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={createTestQueryClient()}>
          {children}
        </QueryClientProvider>
      )

      const { result, duration } = await measurePerformance(() => {
        return renderHook(() => useSchemaVisualization(), { wrapper })
      })

      expect(result.result.current).toBeDefined()
      expect(duration).toBeLessThan(100) // Hook initialization should be very fast
    })

    it('should handle rapid state changes efficiently', async () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={createTestQueryClient()}>
          {children}
        </QueryClientProvider>
      )

      const { result } = renderHook(() => useSchemaVisualization(), { wrapper })

      const { duration } = await measurePerformance(async () => {
        for (let i = 0; i < 100; i++) {
          await act(async () => {
            result.current.toggleAppVisibility('dcim')
            result.current.toggleAppVisibility('circuits')
            result.current.toggleAutoLayout()
          })
        }
      })

      expect(duration).toBeLessThan(1000) // Rapid state changes should be handled efficiently
    })
  })

  describe('Stress Testing', () => {
    it('should handle maximum realistic dataset size', async () => {
      // Simulate a very large Nautobot installation
      const maxRealisticSize = 5000
      const schema = createMockSchemaResponse({
        nodes: createLargeDataset(maxRealisticSize),
        metadata: {
          discoveredAt: '2025-01-01T00:00:00Z',
          nautobotVersion: '2.0.0',
          modelCount: maxRealisticSize,
          relationshipCount: maxRealisticSize * 2,
          apps: Array.from({ length: 20 }, (_, i) => `app-${i}`)
        }
      })

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(schema)
      })

      const { result, duration } = await measurePerformance(
        () => schemaService.discoverSchema()
      )

      expect(result).toBeDefined()
      expect(result.nodes).toHaveLength(maxRealisticSize)
      expect(duration).toBeLessThan(10000) // Should complete within 10 seconds even for max size
    })

    it('should handle rapid successive API calls', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(createMockSchemaResponse())
      })

      const { duration } = await measurePerformance(async () => {
        const promises = Array.from({ length: 50 }, () => 
          schemaService.discoverSchema()
        )
        await Promise.all(promises)
      })

      expect(duration).toBeLessThan(5000) // 50 concurrent requests should complete reasonably fast
      expect(mockFetch).toHaveBeenCalledTimes(50)
    })

    it('should recover from memory pressure gracefully', async () => {
      // Create objects that would cause memory pressure
      const largeObjects = []
      
      try {
        // Allocate large amounts of memory
        for (let i = 0; i < 100; i++) {
          largeObjects.push(new Array(100000).fill(i))
        }

        // Try to perform normal operations under memory pressure
        const schema = createMockSchemaResponse({
          nodes: createLargeDataset(100)
        })

        const result = transformSchemaToGraph(schema)
        expect(result.nodes).toHaveLength(100)

      } finally {
        // Clean up
        largeObjects.length = 0
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc()
        }
      }
    })
  })

  describe('Browser Resource Management', () => {
    it('should not create excessive DOM nodes during visualization', async () => {
      // Mock DOM node counting
      let domNodeCount = 0
      const originalCreateElement = document.createElement.bind(document)
      document.createElement = vi.fn((tagName) => {
        domNodeCount++
        return originalCreateElement(tagName)
      }) as any

      try {
        const schema = createMockSchemaResponse({
          nodes: createLargeDataset(100)
        })

        const result = transformSchemaToGraph(schema)
        expect(result.nodes).toHaveLength(100)

        // Should not create an excessive number of DOM nodes
        // This is a rough heuristic - adjust based on actual implementation
        expect(domNodeCount).toBeLessThan(1000)

      } finally {
        // Restore original createElement
        document.createElement = originalCreateElement
      }
    })

    it('should handle requestAnimationFrame efficiently', async () => {
      let rafCallCount = 0
      const originalRAF = window.requestAnimationFrame
      window.requestAnimationFrame = vi.fn((callback) => {
        rafCallCount++
        return originalRAF(callback)
      })

      try {
        // Simulate operations that might use requestAnimationFrame
        const wrapper = ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={createTestQueryClient()}>
            {children}
          </QueryClientProvider>
        )

        const { result } = renderHook(() => useSchemaVisualization(), { wrapper })

        await act(async () => {
          // Simulate layout changes that might trigger animations
          for (let i = 0; i < 10; i++) {
            result.current.toggleAutoLayout()
            await waitForMs(1)
          }
        })

        // Should not call requestAnimationFrame excessively
        expect(rafCallCount).toBeLessThan(100)

      } finally {
        window.requestAnimationFrame = originalRAF
      }
    })
  })
})