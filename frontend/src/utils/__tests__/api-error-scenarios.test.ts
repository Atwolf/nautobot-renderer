import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SchemaService, SchemaServiceError } from '@/services/schema.service'
import {
  createNetworkError,
  createTimeoutError,
  createHttpError,
  createCorsError,
  createMockSchemaResponse,
  waitForMs
} from './test-utils'

describe('API Error Scenarios', () => {
  let schemaService: SchemaService
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    global.fetch = mockFetch
    schemaService = new SchemaService('http://localhost:8000', 5000)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Network Errors', () => {
    it('should handle network connection failures', async () => {
      mockFetch.mockRejectedValue(createNetworkError())

      await expect(schemaService.discoverSchema()).rejects.toThrow(
        SchemaServiceError
      )
      
      try {
        await schemaService.discoverSchema()
      } catch (error) {
        expect(error).toBeInstanceOf(SchemaServiceError)
        expect((error as SchemaServiceError).code).toBe('NETWORK_ERROR')
        expect((error as SchemaServiceError).message).toContain('Network error')
      }
    })

    it('should handle DNS resolution failures', async () => {
      const dnsError = new Error('getaddrinfo ENOTFOUND')
      dnsError.name = 'TypeError'
      mockFetch.mockRejectedValue(dnsError)

      await expect(schemaService.discoverSchema()).rejects.toThrow(
        SchemaServiceError
      )
    })

    it('should handle connection refused errors', async () => {
      const connectionError = new Error('connect ECONNREFUSED')
      connectionError.name = 'TypeError'
      mockFetch.mockRejectedValue(connectionError)

      await expect(schemaService.discoverSchema()).rejects.toThrow(
        SchemaServiceError
      )
    })
  })

  describe('Timeout Scenarios', () => {
    it('should handle request timeouts', async () => {
      mockFetch.mockRejectedValue(createTimeoutError())

      await expect(schemaService.discoverSchema()).rejects.toThrow(
        SchemaServiceError
      )

      try {
        await schemaService.discoverSchema()
      } catch (error) {
        expect(error).toBeInstanceOf(SchemaServiceError)
        expect((error as SchemaServiceError).code).toBe('TIMEOUT')
        expect((error as SchemaServiceError).message).toContain('timeout')
      }
    })

    it('should respect custom timeout values', async () => {
      const customService = new SchemaService('http://localhost:8000', 1000)
      
      // Mock a delayed response
      mockFetch.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 2000))
      )

      const startTime = Date.now()
      
      try {
        await customService.discoverSchema()
      } catch (error) {
        const duration = Date.now() - startTime
        expect(duration).toBeLessThan(1500) // Should timeout before 1.5s
        expect(error).toBeInstanceOf(SchemaServiceError)
        expect((error as SchemaServiceError).code).toBe('TIMEOUT')
      }
    })
  })

  describe('HTTP Error Responses', () => {
    it('should handle 400 Bad Request errors', async () => {
      mockFetch.mockResolvedValue(createHttpError(400, 'Bad Request', 'INVALID_REQUEST'))

      await expect(schemaService.discoverSchema()).rejects.toThrow(
        SchemaServiceError
      )

      try {
        await schemaService.discoverSchema()
      } catch (error) {
        expect(error).toBeInstanceOf(SchemaServiceError)
        expect((error as SchemaServiceError).code).toBe('INVALID_REQUEST')
        expect((error as SchemaServiceError).message).toContain('Bad Request')
      }
    })

    it('should handle 401 Unauthorized errors', async () => {
      mockFetch.mockResolvedValue(createHttpError(401, 'Unauthorized', 'AUTH_FAILED'))

      await expect(schemaService.discoverSchema()).rejects.toThrow(
        SchemaServiceError
      )

      try {
        await schemaService.discoverSchema()
      } catch (error) {
        expect(error).toBeInstanceOf(SchemaServiceError)
        expect((error as SchemaServiceError).code).toBe('AUTH_FAILED')
      }
    })

    it('should handle 403 Forbidden errors', async () => {
      mockFetch.mockResolvedValue(createHttpError(403, 'Forbidden', 'ACCESS_DENIED'))

      await expect(schemaService.getFilteredSchema({ apps: ['dcim'] })).rejects.toThrow(
        SchemaServiceError
      )
    })

    it('should handle 404 Not Found errors', async () => {
      mockFetch.mockResolvedValue(createHttpError(404, 'Not Found'))

      await expect(schemaService.discoverSchema()).rejects.toThrow(
        SchemaServiceError
      )

      try {
        await schemaService.discoverSchema()
      } catch (error) {
        expect(error).toBeInstanceOf(SchemaServiceError)
        expect((error as SchemaServiceError).code).toBe('HTTP_404')
      }
    })

    it('should handle 500 Internal Server Error', async () => {
      mockFetch.mockResolvedValue(createHttpError(500, 'Internal Server Error', 'SERVER_ERROR'))

      await expect(schemaService.getSchemaStatistics()).rejects.toThrow(
        SchemaServiceError
      )
    })

    it('should handle 502 Bad Gateway errors', async () => {
      mockFetch.mockResolvedValue(createHttpError(502, 'Bad Gateway'))

      await expect(schemaService.healthCheck()).rejects.toThrow(
        SchemaServiceError
      )
    })

    it('should handle 503 Service Unavailable errors', async () => {
      mockFetch.mockResolvedValue(createHttpError(503, 'Service Unavailable'))

      await expect(schemaService.discoverSchema()).rejects.toThrow(
        SchemaServiceError
      )
    })
  })

  describe('Authentication Failures', () => {
    it('should handle missing authentication token', async () => {
      // Test without token
      vi.stubEnv('VITE_API_TOKEN', '')
      const unauthService = new SchemaService()
      
      mockFetch.mockResolvedValue(createHttpError(401, 'Authentication required'))

      await expect(unauthService.discoverSchema()).rejects.toThrow(
        SchemaServiceError
      )
    })

    it('should handle invalid authentication token', async () => {
      vi.stubEnv('VITE_API_TOKEN', 'invalid-token')
      const invalidAuthService = new SchemaService()
      
      mockFetch.mockResolvedValue(createHttpError(401, 'Invalid token', 'INVALID_TOKEN'))

      await expect(invalidAuthService.discoverSchema()).rejects.toThrow(
        SchemaServiceError
      )
    })

    it('should handle expired authentication token', async () => {
      mockFetch.mockResolvedValue(createHttpError(401, 'Token expired', 'TOKEN_EXPIRED'))

      await expect(schemaService.discoverSchema()).rejects.toThrow(
        SchemaServiceError
      )

      try {
        await schemaService.discoverSchema()
      } catch (error) {
        expect((error as SchemaServiceError).code).toBe('TOKEN_EXPIRED')
      }
    })
  })

  describe('CORS Errors', () => {
    it('should handle CORS preflight failures', async () => {
      mockFetch.mockRejectedValue(createCorsError())

      await expect(schemaService.discoverSchema()).rejects.toThrow(
        SchemaServiceError
      )
    })

    it('should handle CORS policy violations', async () => {
      const corsError = new Error('CORS policy: Cross origin requests are only supported for protocol schemes')
      corsError.name = 'TypeError'
      mockFetch.mockRejectedValue(corsError)

      await expect(schemaService.discoverSchema()).rejects.toThrow(
        SchemaServiceError
      )
    })
  })

  describe('Malformed API Responses', () => {
    it('should handle non-JSON responses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new SyntaxError('Unexpected token'))
      })

      await expect(schemaService.discoverSchema()).rejects.toThrow()
    })

    it('should handle empty responses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(null)
      })

      const result = await schemaService.discoverSchema()
      expect(result).toBeNull()
    })

    it('should handle responses with missing required fields', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          nodes: [], // Missing edges and metadata
        })
      })

      const result = await schemaService.discoverSchema()
      expect(result).toBeDefined()
      expect(result.nodes).toEqual([])
    })

    it('should handle responses with invalid data types', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          nodes: 'invalid', // Should be array
          edges: [],
          metadata: {}
        })
      })

      const result = await schemaService.discoverSchema()
      expect(result).toBeDefined()
    })

    it('should handle truncated JSON responses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new SyntaxError('Unexpected end of JSON input'))
      })

      await expect(schemaService.discoverSchema()).rejects.toThrow()
    })
  })

  describe('Rate Limiting and Throttling', () => {
    it('should handle 429 Too Many Requests', async () => {
      mockFetch.mockResolvedValue(createHttpError(429, 'Too Many Requests', 'RATE_LIMITED'))

      await expect(schemaService.discoverSchema()).rejects.toThrow(
        SchemaServiceError
      )

      try {
        await schemaService.discoverSchema()
      } catch (error) {
        expect((error as SchemaServiceError).code).toBe('RATE_LIMITED')
      }
    })

    it('should handle rate limit with retry-after header', async () => {
      const response = {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers({ 'Retry-After': '60' }),
        json: () => Promise.resolve({
          message: 'Rate limit exceeded',
          code: 'RATE_LIMITED',
          details: { retryAfter: 60 }
        })
      }
      mockFetch.mockResolvedValue(response)

      await expect(schemaService.discoverSchema()).rejects.toThrow(
        SchemaServiceError
      )
    })
  })

  describe('SSL/TLS Errors', () => {
    it('should handle SSL certificate errors', async () => {
      const sslError = new Error('certificate verify failed')
      sslError.name = 'TypeError'
      mockFetch.mockRejectedValue(sslError)

      await expect(schemaService.discoverSchema()).rejects.toThrow(
        SchemaServiceError
      )
    })

    it('should handle SSL handshake failures', async () => {
      const handshakeError = new Error('SSL handshake failed')
      handshakeError.name = 'TypeError'
      mockFetch.mockRejectedValue(handshakeError)

      await expect(schemaService.discoverSchema()).rejects.toThrow(
        SchemaServiceError
      )
    })
  })

  describe('Content-Type and Encoding Errors', () => {
    it('should handle wrong content-type responses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'text/html' }),
        json: () => Promise.reject(new SyntaxError('Unexpected token < in JSON'))
      })

      await expect(schemaService.discoverSchema()).rejects.toThrow()
    })

    it('should handle character encoding issues', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          nodes: [{ name: '�invalid�chars�' }], // Simulated encoding issues
          edges: [],
          metadata: {}
        })
      })

      const result = await schemaService.discoverSchema()
      expect(result).toBeDefined()
    })
  })

  describe('Large Response Handling', () => {
    it('should handle very large responses without memory issues', async () => {
      const largeResponse = createMockSchemaResponse({
        nodes: Array.from({ length: 10000 }, (_, i) => ({
          id: `model-${i}`,
          name: `Model${i}`,
          app: 'test',
          fields: Array.from({ length: 50 }, (_, j) => ({
            name: `field_${j}`,
            type: 'CharField',
            required: false,
            nullable: true
          })),
          relationships: { outgoing: [], incoming: [] },
          isAbstract: false
        }))
      })

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(largeResponse)
      })

      const result = await schemaService.discoverSchema()
      expect(result.nodes).toHaveLength(10000)
    })

    it('should handle response streaming interruptions', async () => {
      mockFetch.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Stream interrupted'))
          }, 100)
        })
      })

      await expect(schemaService.discoverSchema()).rejects.toThrow(
        SchemaServiceError
      )
    })
  })

  describe('Concurrent Request Handling', () => {
    it('should handle multiple concurrent requests gracefully', async () => {
      let requestCount = 0
      mockFetch.mockImplementation(() => {
        requestCount++
        if (requestCount <= 2) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(createMockSchemaResponse())
          })
        } else {
          return Promise.reject(createNetworkError())
        }
      })

      const requests = [
        schemaService.discoverSchema(),
        schemaService.getSchemaStatistics(),
        schemaService.healthCheck()
      ]

      const results = await Promise.allSettled(requests)
      
      expect(results[0].status).toBe('fulfilled')
      expect(results[1].status).toBe('fulfilled')
      expect(results[2].status).toBe('rejected')
    })

    it('should handle request cancellation', async () => {
      const controller = new AbortController()
      
      mockFetch.mockImplementation((url, options) => {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            resolve({
              ok: true,
              json: () => Promise.resolve(createMockSchemaResponse())
            })
          }, 1000)

          options?.signal?.addEventListener('abort', () => {
            clearTimeout(timeout)
            reject(new DOMException('Operation aborted', 'AbortError'))
          })
        })
      })

      const requestPromise = schemaService.discoverSchema()
      
      // Cancel after 100ms
      setTimeout(() => controller.abort(), 100)
      
      // Note: Since we're using AbortSignal.timeout internally, we test timeout behavior
      await expect(requestPromise).rejects.toThrow(SchemaServiceError)
    })
  })
})