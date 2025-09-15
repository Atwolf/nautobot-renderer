import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SchemaService, SchemaServiceError } from '@/services/schema.service'
import {
  createMockSchemaResponse,
  createMockSchemaMetadata,
  measurePerformance,
  waitForMs,
  createLargeDataset
} from './test-utils'
import type { SchemaResponse, SchemaStatistics, FilteredSchemaRequest } from '@/types/schema'

describe('Schema Service Integration Tests', () => {
  let schemaService: SchemaService
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    global.fetch = mockFetch
    schemaService = new SchemaService('http://localhost:8000', 10000)
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  describe('Full API Flow Integration', () => {
    it('should complete full discovery flow successfully', async () => {
      const mockResponse = createMockSchemaResponse({
        nodes: [
          {
            id: 'device',
            name: 'Device',
            app: 'dcim',
            fields: [
              { name: 'id', type: 'AutoField', required: true, nullable: false },
              { name: 'name', type: 'CharField', required: true, nullable: false },
              { name: 'site', type: 'ForeignKey', required: true, nullable: false, relatedModel: 'Site' }
            ],
            relationships: {
              outgoing: [
                { 
                  id: 'device-site', 
                  fromModel: 'Device', 
                  toModel: 'Site', 
                  type: 'foreign_key', 
                  fieldName: 'site' 
                }
              ],
              incoming: []
            },
            isAbstract: false
          },
          {
            id: 'site',
            name: 'Site',
            app: 'dcim',
            fields: [
              { name: 'id', type: 'AutoField', required: true, nullable: false },
              { name: 'name', type: 'CharField', required: true, nullable: false }
            ],
            relationships: {
              outgoing: [],
              incoming: [
                { 
                  id: 'device-site', 
                  fromModel: 'Device', 
                  toModel: 'Site', 
                  type: 'foreign_key', 
                  fieldName: 'site',
                  relatedName: 'devices'
                }
              ]
            },
            isAbstract: false
          }
        ],
        edges: [
          { 
            id: 'device-site', 
            fromModel: 'device', 
            toModel: 'site', 
            type: 'foreign_key', 
            fieldName: 'site' 
          }
        ],
        metadata: createMockSchemaMetadata({
          modelCount: 2,
          relationshipCount: 1,
          apps: ['dcim']
        })
      })

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await schemaService.discoverSchema()

      expect(result).toBeDefined()
      expect(result.nodes).toHaveLength(2)
      expect(result.edges).toHaveLength(1)
      expect(result.metadata.apps).toContain('dcim')
      
      // Verify the relationship integrity
      const deviceNode = result.nodes.find(n => n.id === 'device')
      const siteNode = result.nodes.find(n => n.id === 'site')
      
      expect(deviceNode?.relationships.outgoing).toHaveLength(1)
      expect(siteNode?.relationships.incoming).toHaveLength(1)
    })

    it('should handle filtered schema requests with complex filters', async () => {
      const filterRequest: FilteredSchemaRequest = {
        apps: ['dcim', 'circuits'],
        includeAbstract: false,
        maxDepth: 3
      }

      const mockResponse = createMockSchemaResponse({
        nodes: [
          {
            id: 'device',
            name: 'Device',
            app: 'dcim',
            fields: [],
            relationships: { outgoing: [], incoming: [] },
            isAbstract: false
          },
          {
            id: 'circuit',
            name: 'Circuit',
            app: 'circuits',
            fields: [],
            relationships: { outgoing: [], incoming: [] },
            isAbstract: false
          }
        ],
        edges: [],
        metadata: createMockSchemaMetadata({
          apps: ['dcim', 'circuits']
        })
      })

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await schemaService.getFilteredSchema(filterRequest)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/schema/filtered?apps=dcim%2Ccircuits&include_abstract=false&max_depth=3',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      )

      expect(result.nodes).toHaveLength(2)
      expect(result.metadata.apps).toEqual(['dcim', 'circuits'])
    })

    it('should retrieve schema statistics correctly', async () => {
      const mockStats: SchemaStatistics = {
        totalModels: 150,
        totalRelationships: 300,
        modelsByApp: {
          'dcim': 50,
          'circuits': 25,
          'ipam': 40,
          'tenancy': 15,
          'extras': 20
        },
        relationshipsByType: {
          'foreign_key': 200,
          'many_to_many': 80,
          'one_to_one': 20
        },
        averageFieldsPerModel: 8.5,
        mostConnectedModels: [
          { modelName: 'Device', connectionCount: 25 },
          { modelName: 'Site', connectionCount: 20 },
          { modelName: 'DeviceType', connectionCount: 18 }
        ]
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockStats)
      })

      const result = await schemaService.getSchemaStatistics()

      expect(result).toEqual(mockStats)
      expect(result.totalModels).toBe(150)
      expect(result.mostConnectedModels).toHaveLength(3)
    })

    it('should perform health check successfully', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: '2025-01-01T12:00:00Z'
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockHealth)
      })

      const result = await schemaService.healthCheck()

      expect(result.status).toBe('healthy')
      expect(result.timestamp).toBeDefined()
    })
  })

  describe('Error Recovery and Resilience', () => {
    it('should retry failed requests appropriately', async () => {
      let callCount = 0
      mockFetch.mockImplementation(() => {
        callCount++
        if (callCount < 3) {
          return Promise.reject(new Error('Temporary failure'))
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(createMockSchemaResponse())
        })
      })

      // Note: The SchemaService doesn't implement retry logic internally,
      // so this test validates that external retry mechanisms would work
      let result
      let attempts = 0
      const maxAttempts = 3

      while (attempts < maxAttempts) {
        try {
          result = await schemaService.discoverSchema()
          break
        } catch (error) {
          attempts++
          if (attempts === maxAttempts) {
            throw error
          }
          await waitForMs(100)
        }
      }

      expect(result).toBeDefined()
      expect(callCount).toBe(3)
    })

    it('should handle partial data gracefully', async () => {
      const partialResponse = {
        nodes: [
          {
            id: 'device',
            name: 'Device',
            app: 'dcim',
            fields: [], // Empty fields
            relationships: { outgoing: [], incoming: [] },
            isAbstract: false
          }
        ],
        edges: [], // No edges
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
        json: () => Promise.resolve(partialResponse)
      })

      const result = await schemaService.discoverSchema()

      expect(result).toBeDefined()
      expect(result.nodes).toHaveLength(1)
      expect(result.edges).toHaveLength(0)
      expect(result.nodes[0].fields).toHaveLength(0)
    })

    it('should handle corrupted relationship data', async () => {
      const corruptedResponse = createMockSchemaResponse({
        nodes: [
          {
            id: 'device',
            name: 'Device',
            app: 'dcim',
            fields: [],
            relationships: {
              outgoing: [
                {
                  id: 'invalid-relationship',
                  fromModel: 'Device',
                  toModel: 'NonExistentModel', // Reference to non-existent model
                  type: 'foreign_key',
                  fieldName: 'invalid_field'
                }
              ],
              incoming: []
            },
            isAbstract: false
          }
        ],
        edges: [
          {
            id: 'invalid-relationship',
            fromModel: 'device',
            toModel: 'nonexistent', // Mismatched case
            type: 'foreign_key',
            fieldName: 'invalid_field'
          }
        ]
      })

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(corruptedResponse)
      })

      const result = await schemaService.discoverSchema()

      // Should still return data, even if relationships are inconsistent
      expect(result).toBeDefined()
      expect(result.nodes).toHaveLength(1)
      expect(result.edges).toHaveLength(1)
    })
  })

  describe('Performance and Load Testing', () => {
    it('should handle large schema responses efficiently', async () => {
      const largeDataset = createLargeDataset(1000)
      const largeResponse = createMockSchemaResponse({
        nodes: largeDataset,
        metadata: createMockSchemaMetadata({
          modelCount: 1000,
          relationshipCount: 5000
        })
      })

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(largeResponse)
      })

      const { result, duration } = await measurePerformance(
        () => schemaService.discoverSchema()
      )

      expect(result).toBeDefined()
      expect(result.nodes).toHaveLength(1000)
      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
    })

    it('should handle concurrent requests without interference', async () => {
      const responses = [
        createMockSchemaResponse({ metadata: createMockSchemaMetadata({ apps: ['dcim'] }) }),
        { totalModels: 100, totalRelationships: 200 } as SchemaStatistics,
        { status: 'healthy', timestamp: '2025-01-01T00:00:00Z' }
      ]

      mockFetch.mockImplementation((url) => {
        let responseData
        if (url.includes('discover')) {
          responseData = responses[0]
        } else if (url.includes('statistics')) {
          responseData = responses[1]
        } else if (url.includes('health')) {
          responseData = responses[2]
        }

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(responseData)
        })
      })

      const [schemaResult, statsResult, healthResult] = await Promise.all([
        schemaService.discoverSchema(),
        schemaService.getSchemaStatistics(),
        schemaService.healthCheck()
      ])

      expect(schemaResult).toBeDefined()
      expect(statsResult.totalModels).toBe(100)
      expect(healthResult.status).toBe('healthy')
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('should respect timeout configurations', async () => {
      const fastService = new SchemaService('http://localhost:8000', 1000)
      
      mockFetch.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            json: () => Promise.resolve(createMockSchemaResponse())
          }), 2000)
        )
      )

      await expect(fastService.discoverSchema()).rejects.toThrow(
        SchemaServiceError
      )

      try {
        await fastService.discoverSchema()
      } catch (error) {
        expect((error as SchemaServiceError).code).toBe('TIMEOUT')
      }
    })
  })

  describe('Configuration and Environment', () => {
    it('should use environment variables correctly', async () => {
      vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com')
      vi.stubEnv('VITE_REQUEST_TIMEOUT', '15000')
      vi.stubEnv('VITE_API_TOKEN', 'custom-token')

      const envService = new SchemaService()

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(createMockSchemaResponse())
      })

      await envService.discoverSchema()

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/v1/schema/discover',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Token custom-token'
          })
        })
      )
    })

    it('should allow base URL changes at runtime', async () => {
      schemaService.setBaseUrl('https://new-api.example.com')

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(createMockSchemaResponse())
      })

      await schemaService.discoverSchema()

      expect(mockFetch).toHaveBeenCalledWith(
        'https://new-api.example.com/api/v1/schema/discover',
        expect.any(Object)
      )

      expect(schemaService.getBaseUrl()).toBe('https://new-api.example.com')
    })

    it('should handle missing environment variables gracefully', async () => {
      vi.stubEnv('VITE_API_BASE_URL', '')
      vi.stubEnv('VITE_REQUEST_TIMEOUT', '')
      vi.stubEnv('VITE_API_TOKEN', '')

      const defaultService = new SchemaService()

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(createMockSchemaResponse())
      })

      await defaultService.discoverSchema()

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/schema/discover',
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'Authorization': expect.any(String)
          })
        })
      )
    })
  })

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle empty filter requests', async () => {
      const emptyFilters: FilteredSchemaRequest = {}

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(createMockSchemaResponse())
      })

      const result = await schemaService.getFilteredSchema(emptyFilters)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/schema/filtered',
        expect.any(Object)
      )

      expect(result).toBeDefined()
    })

    it('should handle filters with undefined values', async () => {
      const filters: FilteredSchemaRequest = {
        apps: undefined,
        includeAbstract: undefined,
        maxDepth: undefined
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(createMockSchemaResponse())
      })

      await schemaService.getFilteredSchema(filters)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/schema/filtered',
        expect.any(Object)
      )
    })

    it('should handle special characters in app names', async () => {
      const filters: FilteredSchemaRequest = {
        apps: ['custom-app', 'app_with_underscore', 'app.with.dots']
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(createMockSchemaResponse())
      })

      await schemaService.getFilteredSchema(filters)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('apps=custom-app%2Capp_with_underscore%2Capp.with.dots'),
        expect.any(Object)
      )
    })

    it('should handle very deep max depth values', async () => {
      const filters: FilteredSchemaRequest = {
        maxDepth: 999999
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(createMockSchemaResponse())
      })

      await schemaService.getFilteredSchema(filters)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('max_depth=999999'),
        expect.any(Object)
      )
    })
  })
})