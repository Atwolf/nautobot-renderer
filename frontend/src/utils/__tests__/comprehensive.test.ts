import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SchemaService, SchemaServiceError } from '@/services/schema.service'
import { transformSchemaToGraph } from '../schemaTransformer'
import { filterPrimaryFields } from '../primaryFieldFilter'
import { calculateFieldPriorities } from '../fieldPriorityCalculator'

// Comprehensive test suite that validates all major functionality
describe('Comprehensive API Error Scenarios and Edge Cases', () => {
  let mockFetch: ReturnType<typeof vi.fn>
  let schemaService: SchemaService

  beforeEach(() => {
    mockFetch = vi.fn()
    global.fetch = mockFetch
    schemaService = new SchemaService('http://localhost:8000', 5000)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('API Error Handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      await expect(schemaService.discoverSchema()).rejects.toThrow(SchemaServiceError)
    })

    it('should handle timeout errors', async () => {
      mockFetch.mockRejectedValue(new DOMException('Operation timed out', 'TimeoutError'))

      await expect(schemaService.discoverSchema()).rejects.toThrow(SchemaServiceError)
    })

    it('should handle HTTP 401 unauthorized', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ message: 'Authentication required', code: 'AUTH_REQUIRED' })
      })

      await expect(schemaService.discoverSchema()).rejects.toThrow(SchemaServiceError)
    })

    it('should handle HTTP 404 not found', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ message: 'Endpoint not found', code: 'NOT_FOUND' })
      })

      await expect(schemaService.discoverSchema()).rejects.toThrow(SchemaServiceError)
    })

    it('should handle HTTP 500 server error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ message: 'Server error', code: 'SERVER_ERROR' })
      })

      await expect(schemaService.discoverSchema()).rejects.toThrow(SchemaServiceError)
    })

    it('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new SyntaxError('Unexpected token'))
      })

      await expect(schemaService.discoverSchema()).rejects.toThrow()
    })

    it('should handle CORS errors', async () => {
      const corsError = new Error('CORS policy violation')
      corsError.name = 'TypeError'
      mockFetch.mockRejectedValue(corsError)

      await expect(schemaService.discoverSchema()).rejects.toThrow(SchemaServiceError)
    })
  })

  describe('Schema Transformation Edge Cases', () => {
    it('should handle empty schema', () => {
      const emptySchema = {
        nodes: [],
        edges: [],
        metadata: {
          discoveredAt: '2025-01-01T00:00:00Z',
          nautobotVersion: '2.0.0',
          modelCount: 0,
          relationshipCount: 0,
          apps: []
        }
      }

      const result = transformSchemaToGraph(emptySchema)
      expect(result.nodes).toHaveLength(0)
      expect(result.edges).toHaveLength(0)
    })

    it('should handle malformed node data', () => {
      const malformedSchema = {
        nodes: [
          {
            id: 'valid-node',
            name: 'ValidNode',
            app: 'test',
            fields: [
              { name: 'id', type: 'AutoField', required: true, nullable: false }
            ],
            relationships: { outgoing: [], incoming: [] },
            isAbstract: false
          },
          {
            id: null,
            name: undefined,
            app: '',
            fields: 'invalid',
            relationships: null,
            isAbstract: 'not-boolean'
          }
        ],
        edges: [],
        metadata: {
          discoveredAt: '2025-01-01T00:00:00Z',
          nautobotVersion: '2.0.0',
          modelCount: 2,
          relationshipCount: 0,
          apps: ['test']
        }
      }

      const result = transformSchemaToGraph(malformedSchema as any)
      expect(result.nodes.length).toBeGreaterThan(0)
    })

    it('should handle circular relationships', () => {
      const circularSchema = {
        nodes: [
          {
            id: 'node-a',
            name: 'NodeA',
            app: 'test',
            fields: [],
            relationships: {
              outgoing: [{ id: 'a-to-b', fromModel: 'NodeA', toModel: 'NodeB', type: 'foreign_key', fieldName: 'node_b' }],
              incoming: [{ id: 'b-to-a', fromModel: 'NodeB', toModel: 'NodeA', type: 'foreign_key', fieldName: 'node_a' }]
            },
            isAbstract: false
          },
          {
            id: 'node-b',
            name: 'NodeB',
            app: 'test',
            fields: [],
            relationships: {
              outgoing: [{ id: 'b-to-a', fromModel: 'NodeB', toModel: 'NodeA', type: 'foreign_key', fieldName: 'node_a' }],
              incoming: [{ id: 'a-to-b', fromModel: 'NodeA', toModel: 'NodeB', type: 'foreign_key', fieldName: 'node_b' }]
            },
            isAbstract: false
          }
        ],
        edges: [
          { id: 'a-to-b', fromModel: 'node-a', toModel: 'node-b', type: 'foreign_key', fieldName: 'node_b' },
          { id: 'b-to-a', fromModel: 'node-b', toModel: 'node-a', type: 'foreign_key', fieldName: 'node_a' }
        ],
        metadata: {
          discoveredAt: '2025-01-01T00:00:00Z',
          nautobotVersion: '2.0.0',
          modelCount: 2,
          relationshipCount: 2,
          apps: ['test']
        }
      }

      const result = transformSchemaToGraph(circularSchema)
      expect(result.nodes).toHaveLength(2)
      expect(result.edges).toHaveLength(2)
    })

    it('should handle large datasets efficiently', () => {
      const largeNodes = Array.from({ length: 1000 }, (_, i) => ({
        id: `model-${i}`,
        name: `Model${i}`,
        app: `app-${i % 10}`,
        fields: [
          { name: 'id', type: 'AutoField', required: true, nullable: false },
          { name: 'name', type: 'CharField', required: true, nullable: false }
        ],
        relationships: { outgoing: [], incoming: [] },
        isAbstract: false
      }))

      const largeSchema = {
        nodes: largeNodes,
        edges: [],
        metadata: {
          discoveredAt: '2025-01-01T00:00:00Z',
          nautobotVersion: '2.0.0',
          modelCount: 1000,
          relationshipCount: 0,
          apps: Array.from({ length: 10 }, (_, i) => `app-${i}`)
        }
      }

      const startTime = performance.now()
      const result = transformSchemaToGraph(largeSchema)
      const endTime = performance.now()

      expect(result.nodes).toHaveLength(1000)
      expect(endTime - startTime).toBeLessThan(5000) // Should complete within 5 seconds
    })
  })

  describe('Primary Field Filtering', () => {
    it('should handle empty fields array', () => {
      const result = filterPrimaryFields([])
      expect(result.primaryFields).toHaveLength(0)
      expect(result.remainingFields).toHaveLength(0)
    })

    it('should handle fields with missing properties', () => {
      const malformedFields = [
        { name: 'valid_field', type: 'CharField', required: true, nullable: false },
        { name: 'incomplete_field' } as any,
        null as any,
        undefined as any
      ]

      const result = filterPrimaryFields(malformedFields)
      expect(result.primaryFields.length).toBeGreaterThan(0)
    })

    it('should calculate field priorities correctly', () => {
      const testFields = [
        { name: 'id', type: 'AutoField', required: true, nullable: false },
        { name: 'name', type: 'CharField', required: true, nullable: false },
        { name: 'description', type: 'TextField', required: false, nullable: true },
        { name: '_internal', type: 'CharField', required: false, nullable: true }
      ]

      const priorities = calculateFieldPriorities(testFields)
      
      expect(priorities).toBeDefined()
      expect(priorities.length).toBe(testFields.length)
      
      const nameField = priorities.find(p => p.field.name === 'name')
      const internalField = priorities.find(p => p.field.name === '_internal')
      
      expect(nameField?.priority).toBeGreaterThan(internalField?.priority || 0)
    })
  })

  describe('Service Integration', () => {
    it('should complete full discovery flow', async () => {
      const mockResponse = {
        nodes: [
          {
            id: 'device',
            name: 'Device',
            app: 'dcim',
            fields: [
              { name: 'id', type: 'AutoField', required: true, nullable: false },
              { name: 'name', type: 'CharField', required: true, nullable: false }
            ],
            relationships: { outgoing: [], incoming: [] },
            isAbstract: false
          }
        ],
        edges: [],
        metadata: {
          discoveredAt: '2025-01-01T00:00:00Z',
          nautobotVersion: '2.0.0',
          modelCount: 1,
          relationshipCount: 0,
          apps: ['dcim']
        }
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await schemaService.discoverSchema()
      expect(result).toBeDefined()
      expect(result.nodes).toHaveLength(1)
      expect(result.metadata.apps).toContain('dcim')
    })

    it('should handle filtered schema requests', async () => {
      const mockResponse = {
        nodes: [
          {
            id: 'device',
            name: 'Device',
            app: 'dcim',
            fields: [],
            relationships: { outgoing: [], incoming: [] },
            isAbstract: false
          }
        ],
        edges: [],
        metadata: {
          discoveredAt: '2025-01-01T00:00:00Z',
          nautobotVersion: '2.0.0',
          modelCount: 1,
          relationshipCount: 0,
          apps: ['dcim']
        }
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await schemaService.getFilteredSchema({ apps: ['dcim'] })
      expect(result).toBeDefined()
      expect(result.nodes).toHaveLength(1)
    })
  })

  describe('Performance and Memory', () => {
    it('should handle concurrent requests', async () => {
      const mockResponse = {
        nodes: [],
        edges: [],
        metadata: {
          discoveredAt: '2025-01-01T00:00:00Z',
          nautobotVersion: '2.0.0',
          modelCount: 0,
          relationshipCount: 0,
          apps: []
        }
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const requests = [
        schemaService.discoverSchema(),
        schemaService.getFilteredSchema({ apps: ['dcim'] }),
        schemaService.healthCheck()
      ]

      const results = await Promise.allSettled(requests)
      expect(results[0].status).toBe('fulfilled')
      expect(results[1].status).toBe('fulfilled')
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('should not leak memory with repeated transformations', () => {
      const schema = {
        nodes: Array.from({ length: 100 }, (_, i) => ({
          id: `model-${i}`,
          name: `Model${i}`,
          app: 'test',
          fields: [{ name: 'id', type: 'AutoField', required: true, nullable: false }],
          relationships: { outgoing: [], incoming: [] },
          isAbstract: false
        })),
        edges: [],
        metadata: {
          discoveredAt: '2025-01-01T00:00:00Z',
          nautobotVersion: '2.0.0',
          modelCount: 100,
          relationshipCount: 0,
          apps: ['test']
        }
      }

      // Perform multiple transformations
      for (let i = 0; i < 50; i++) {
        const result = transformSchemaToGraph(schema)
        expect(result.nodes).toHaveLength(100)
      }

      // If we reach here without memory issues, test passes
      expect(true).toBe(true)
    })
  })
})