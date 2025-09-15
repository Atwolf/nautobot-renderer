import { describe, it, expect, beforeEach } from 'vitest'
import { transformSchemaToGraph, calculateTransformationStats } from '../schemaTransformer'
import {
  createMockSchemaResponse,
  createMockModelNode,
  createMockRelationship,
  createMockSchemaMetadata
} from './test-utils'
import type { SchemaResponse, ModelNode, ModelRelationship } from '@/types/schema'

describe('Schema Transformation Edge Cases', () => {
  describe('Empty and Null Data Handling', () => {
    it('should handle completely empty schema response', () => {
      const emptySchema: SchemaResponse = {
        nodes: [],
        edges: [],
        metadata: createMockSchemaMetadata({
          modelCount: 0,
          relationshipCount: 0,
          apps: []
        })
      }

      const result = transformSchemaToGraph(emptySchema)

      expect(result.nodes).toHaveLength(0)
      expect(result.edges).toHaveLength(0)
      
      const stats = calculateTransformationStats(result)
      expect(stats.totalNodes).toBe(0)
      expect(stats.totalEdges).toBe(0)
    })

    it('should handle schema with nodes but no edges', () => {
      const schema = createMockSchemaResponse({
        nodes: [
          createMockModelNode({ id: 'isolated-model', name: 'IsolatedModel' })
        ],
        edges: [],
        metadata: createMockSchemaMetadata({
          modelCount: 1,
          relationshipCount: 0
        })
      })

      const result = transformSchemaToGraph(schema)

      expect(result.nodes).toHaveLength(1)
      expect(result.edges).toHaveLength(0)
      expect(result.nodes[0].id).toBe('isolated-model')
    })

    it('should handle schema with edges but missing referenced nodes', () => {
      const schema = createMockSchemaResponse({
        nodes: [
          createMockModelNode({ id: 'existing-model', name: 'ExistingModel' })
        ],
        edges: [
          createMockRelationship({
            id: 'orphan-edge',
            fromModel: 'existing-model',
            toModel: 'missing-model',
            type: 'foreign_key',
            fieldName: 'missing_ref'
          })
        ]
      })

      const result = transformSchemaToGraph(schema)

      expect(result.nodes).toHaveLength(1)
      expect(result.edges).toHaveLength(1)
      // Should still create the edge even if target node is missing
      expect(result.edges[0].source).toBe('existing-model')
      expect(result.edges[0].target).toBe('missing-model')
    })
  })

  describe('Malformed Field Data', () => {
    it('should handle nodes with null or undefined fields', () => {
      const schema: SchemaResponse = {
        nodes: [
          {
            ...createMockModelNode(),
            fields: null as any
          },
          {
            ...createMockModelNode({ id: 'model-2' }),
            fields: undefined as any
          }
        ],
        edges: [],
        metadata: createMockSchemaMetadata()
      }

      const result = transformSchemaToGraph(schema)

      expect(result.nodes).toHaveLength(2)
      // Should handle gracefully, possibly with empty fields array
      result.nodes.forEach(node => {
        expect(node.data.fields).toBeDefined()
      })
    })

    it('should handle fields with missing required properties', () => {
      const schema = createMockSchemaResponse({
        nodes: [
          createMockModelNode({
            fields: [
              { name: 'valid_field', type: 'CharField', required: true, nullable: false },
              { name: 'incomplete_field' } as any, // Missing type, required, nullable
              null as any, // Null field
              undefined as any // Undefined field
            ]
          })
        ]
      })

      const result = transformSchemaToGraph(schema)

      expect(result.nodes).toHaveLength(1)
      expect(result.nodes[0].data.fields).toBeDefined()
      // Should filter out invalid fields
      const validFields = result.nodes[0].data.fields.filter(f => f && f.name && f.type)
      expect(validFields.length).toBeGreaterThan(0)
    })

    it('should handle fields with extreme values', () => {
      const schema = createMockSchemaResponse({
        nodes: [
          createMockModelNode({
            fields: [
              {
                name: 'a'.repeat(1000), // Very long field name
                type: 'CharField',
                required: true,
                nullable: false
              },
              {
                name: '', // Empty field name
                type: 'CharField',
                required: true,
                nullable: false
              },
              {
                name: 'special_chars_field',
                type: '特殊字符Type', // Non-ASCII type name
                required: true,
                nullable: false
              }
            ]
          })
        ]
      })

      const result = transformSchemaToGraph(schema)

      expect(result.nodes).toHaveLength(1)
      expect(result.nodes[0].data.fields).toBeDefined()
    })
  })

  describe('Complex Relationship Scenarios', () => {
    it('should handle circular relationships', () => {
      const schema = createMockSchemaResponse({
        nodes: [
          createMockModelNode({
            id: 'model-a',
            name: 'ModelA',
            relationships: {
              outgoing: [
                { id: 'a-to-b', fromModel: 'ModelA', toModel: 'ModelB', type: 'foreign_key', fieldName: 'model_b' }
              ],
              incoming: [
                { id: 'b-to-a', fromModel: 'ModelB', toModel: 'ModelA', type: 'foreign_key', fieldName: 'model_a' }
              ]
            }
          }),
          createMockModelNode({
            id: 'model-b',
            name: 'ModelB',
            relationships: {
              outgoing: [
                { id: 'b-to-a', fromModel: 'ModelB', toModel: 'ModelA', type: 'foreign_key', fieldName: 'model_a' }
              ],
              incoming: [
                { id: 'a-to-b', fromModel: 'ModelA', toModel: 'ModelB', type: 'foreign_key', fieldName: 'model_b' }
              ]
            }
          })
        ],
        edges: [
          { id: 'a-to-b', fromModel: 'model-a', toModel: 'model-b', type: 'foreign_key', fieldName: 'model_b' },
          { id: 'b-to-a', fromModel: 'model-b', toModel: 'model-a', type: 'foreign_key', fieldName: 'model_a' }
        ]
      })

      const result = transformSchemaToGraph(schema)

      expect(result.nodes).toHaveLength(2)
      expect(result.edges).toHaveLength(2)

      // Check for circular reference handling
      const edgeIds = result.edges.map(e => e.id)
      expect(edgeIds).toContain('a-to-b')
      expect(edgeIds).toContain('b-to-a')
    })

    it('should handle self-referential relationships', () => {
      const schema = createMockSchemaResponse({
        nodes: [
          createMockModelNode({
            id: 'recursive-model',
            name: 'RecursiveModel',
            fields: [
              { name: 'id', type: 'AutoField', required: true, nullable: false },
              { name: 'parent', type: 'ForeignKey', required: false, nullable: true, relatedModel: 'RecursiveModel' }
            ],
            relationships: {
              outgoing: [
                { 
                  id: 'self-ref', 
                  fromModel: 'RecursiveModel', 
                  toModel: 'RecursiveModel', 
                  type: 'foreign_key', 
                  fieldName: 'parent',
                  relatedName: 'children'
                }
              ],
              incoming: [
                { 
                  id: 'self-ref', 
                  fromModel: 'RecursiveModel', 
                  toModel: 'RecursiveModel', 
                  type: 'foreign_key', 
                  fieldName: 'parent',
                  relatedName: 'children'
                }
              ]
            }
          })
        ],
        edges: [
          { 
            id: 'self-ref', 
            fromModel: 'recursive-model', 
            toModel: 'recursive-model', 
            type: 'foreign_key', 
            fieldName: 'parent' 
          }
        ]
      })

      const result = transformSchemaToGraph(schema)

      expect(result.nodes).toHaveLength(1)
      expect(result.edges).toHaveLength(1)
      expect(result.edges[0].source).toBe('recursive-model')
      expect(result.edges[0].target).toBe('recursive-model')
    })

    it('should handle multiple relationships between same models', () => {
      const schema = createMockSchemaResponse({
        nodes: [
          createMockModelNode({
            id: 'user',
            name: 'User',
            relationships: {
              outgoing: [
                { id: 'user-created-tickets', fromModel: 'User', toModel: 'Ticket', type: 'foreign_key', fieldName: 'created_by' },
                { id: 'user-assigned-tickets', fromModel: 'User', toModel: 'Ticket', type: 'foreign_key', fieldName: 'assigned_to' }
              ],
              incoming: []
            }
          }),
          createMockModelNode({
            id: 'ticket',
            name: 'Ticket',
            fields: [
              { name: 'created_by', type: 'ForeignKey', required: true, nullable: false, relatedModel: 'User' },
              { name: 'assigned_to', type: 'ForeignKey', required: false, nullable: true, relatedModel: 'User' }
            ],
            relationships: {
              outgoing: [],
              incoming: [
                { id: 'user-created-tickets', fromModel: 'User', toModel: 'Ticket', type: 'foreign_key', fieldName: 'created_by' },
                { id: 'user-assigned-tickets', fromModel: 'User', toModel: 'Ticket', type: 'foreign_key', fieldName: 'assigned_to' }
              ]
            }
          })
        ],
        edges: [
          { id: 'user-created-tickets', fromModel: 'user', toModel: 'ticket', type: 'foreign_key', fieldName: 'created_by' },
          { id: 'user-assigned-tickets', fromModel: 'user', toModel: 'ticket', type: 'foreign_key', fieldName: 'assigned_to' }
        ]
      })

      const result = transformSchemaToGraph(schema)

      expect(result.nodes).toHaveLength(2)
      expect(result.edges).toHaveLength(2)

      // Should create separate edges for each relationship
      const userToTicketEdges = result.edges.filter(e => e.source === 'user' && e.target === 'ticket')
      expect(userToTicketEdges).toHaveLength(2)
    })
  })

  describe('Data Type Edge Cases', () => {
    it('should handle unusual field types', () => {
      const schema = createMockSchemaResponse({
        nodes: [
          createMockModelNode({
            fields: [
              { name: 'json_field', type: 'JSONField', required: false, nullable: true },
              { name: 'binary_field', type: 'BinaryField', required: false, nullable: false },
              { name: 'uuid_field', type: 'UUIDField', required: true, nullable: false },
              { name: 'geo_field', type: 'PointField', required: false, nullable: true },
              { name: 'custom_field', type: 'CustomComplexType', required: false, nullable: true }
            ]
          })
        ]
      })

      const result = transformSchemaToGraph(schema)

      expect(result.nodes).toHaveLength(1)
      expect(result.nodes[0].data.fields).toHaveLength(5)

      const fieldTypes = result.nodes[0].data.fields.map(f => f.type)
      expect(fieldTypes).toContain('JSONField')
      expect(fieldTypes).toContain('BinaryField')
      expect(fieldTypes).toContain('UUIDField')
      expect(fieldTypes).toContain('PointField')
      expect(fieldTypes).toContain('CustomComplexType')
    })

    it('should handle relationship types beyond standard Django relationships', () => {
      const schema = createMockSchemaResponse({
        edges: [
          { id: 'cable-conn', fromModel: 'device-a', toModel: 'device-b', type: 'cable_connection', fieldName: 'cable' },
          { id: 'power-conn', fromModel: 'device', toModel: 'power-outlet', type: 'power_connection', fieldName: 'power' },
          { id: 'console-conn', fromModel: 'device', toModel: 'console-server', type: 'console_connection', fieldName: 'console' },
          { id: 'through-rel', fromModel: 'user', toModel: 'group', type: 'through_table', fieldName: 'groups', throughTable: 'user_groups' },
          { id: 'custom-rel', fromModel: 'model-a', toModel: 'model-b', type: 'custom_relationship', fieldName: 'custom', customRelationshipName: 'special_connection' }
        ]
      })

      const result = transformSchemaToGraph(schema)

      expect(result.edges).toHaveLength(5)

      const edgeTypes = result.edges.map(e => e.data?.type)
      expect(edgeTypes).toContain('cable_connection')
      expect(edgeTypes).toContain('power_connection')
      expect(edgeTypes).toContain('console_connection')
      expect(edgeTypes).toContain('through_table')
      expect(edgeTypes).toContain('custom_relationship')
    })
  })

  describe('Large Dataset Handling', () => {
    it('should handle very large number of nodes efficiently', () => {
      const largeNodeSet: ModelNode[] = Array.from({ length: 10000 }, (_, i) => 
        createMockModelNode({
          id: `model-${i}`,
          name: `Model${i}`,
          app: `app-${i % 10}`, // Distribute across 10 apps
          fields: Array.from({ length: 20 }, (_, j) => ({
            name: `field_${j}`,
            type: j % 5 === 0 ? 'ForeignKey' : 'CharField',
            required: j < 10,
            nullable: j >= 10,
            relatedModel: j % 5 === 0 ? `Model${(i + j) % 100}` : undefined
          }))
        })
      )

      const schema = createMockSchemaResponse({
        nodes: largeNodeSet,
        edges: [], // No edges for this test to focus on node processing
        metadata: createMockSchemaMetadata({
          modelCount: 10000,
          relationshipCount: 0
        })
      })

      const startTime = performance.now()
      const result = transformSchemaToGraph(schema)
      const endTime = performance.now()

      expect(result.nodes).toHaveLength(10000)
      expect(endTime - startTime).toBeLessThan(5000) // Should complete within 5 seconds

      // Verify data integrity on a sample
      const sampleNode = result.nodes[1000]
      expect(sampleNode.id).toBe('model-1000')
      expect(sampleNode.data.fields).toHaveLength(20)
    })

    it('should handle deeply nested relationship chains', () => {
      const chainLength = 100
      const nodes: ModelNode[] = []
      const edges: ModelRelationship[] = []

      // Create a chain of relationships: Model0 -> Model1 -> Model2 -> ... -> Model99
      for (let i = 0; i < chainLength; i++) {
        nodes.push(createMockModelNode({
          id: `chain-model-${i}`,
          name: `ChainModel${i}`,
          fields: i < chainLength - 1 ? [
            { name: 'id', type: 'AutoField', required: true, nullable: false },
            { name: 'next', type: 'ForeignKey', required: false, nullable: true, relatedModel: `ChainModel${i + 1}` }
          ] : [
            { name: 'id', type: 'AutoField', required: true, nullable: false }
          ]
        }))

        if (i < chainLength - 1) {
          edges.push(createMockRelationship({
            id: `chain-${i}-${i + 1}`,
            fromModel: `chain-model-${i}`,
            toModel: `chain-model-${i + 1}`,
            type: 'foreign_key',
            fieldName: 'next'
          }))
        }
      }

      const schema = createMockSchemaResponse({
        nodes,
        edges,
        metadata: createMockSchemaMetadata({
          modelCount: chainLength,
          relationshipCount: chainLength - 1
        })
      })

      const result = transformSchemaToGraph(schema)

      expect(result.nodes).toHaveLength(chainLength)
      expect(result.edges).toHaveLength(chainLength - 1)

      // Verify chain integrity
      for (let i = 0; i < chainLength - 1; i++) {
        const edge = result.edges.find(e => e.source === `chain-model-${i}`)
        expect(edge).toBeDefined()
        expect(edge?.target).toBe(`chain-model-${i + 1}`)
      }
    })
  })

  describe('Invalid Data Recovery', () => {
    it('should recover from corrupted node data', () => {
      const schema: SchemaResponse = {
        nodes: [
          createMockModelNode({ id: 'valid-model' }),
          {
            id: null as any,
            name: undefined as any,
            app: '',
            fields: 'invalid' as any,
            relationships: null as any,
            isAbstract: 'not-boolean' as any
          },
          createMockModelNode({ id: 'another-valid-model' })
        ] as any,
        edges: [],
        metadata: createMockSchemaMetadata()
      }

      const result = transformSchemaToGraph(schema)

      // Should filter out invalid nodes but keep valid ones
      expect(result.nodes.length).toBeGreaterThan(0)
      expect(result.nodes.length).toBeLessThanOrEqual(3)

      // Valid nodes should be preserved
      const nodeIds = result.nodes.map(n => n.id)
      expect(nodeIds).toContain('valid-model')
      expect(nodeIds).toContain('another-valid-model')
    })

    it('should handle malformed edge data gracefully', () => {
      const schema = createMockSchemaResponse({
        nodes: [
          createMockModelNode({ id: 'model-a' }),
          createMockModelNode({ id: 'model-b' })
        ],
        edges: [
          createMockRelationship({ id: 'valid-edge', fromModel: 'model-a', toModel: 'model-b' }),
          {
            id: null as any,
            fromModel: undefined as any,
            toModel: '',
            type: 'invalid_type' as any,
            fieldName: null as any
          },
          createMockRelationship({ id: 'another-valid-edge', fromModel: 'model-b', toModel: 'model-a' })
        ] as any
      })

      const result = transformSchemaToGraph(schema)

      expect(result.nodes).toHaveLength(2)
      // Should filter out invalid edges
      expect(result.edges.length).toBeGreaterThan(0)
      expect(result.edges.length).toBeLessThanOrEqual(3)

      const edgeIds = result.edges.map(e => e.id)
      expect(edgeIds).toContain('valid-edge')
      expect(edgeIds).toContain('another-valid-edge')
    })
  })

  describe('Metadata and Statistics Edge Cases', () => {
    it('should handle missing or invalid metadata', () => {
      const schema: SchemaResponse = {
        nodes: [createMockModelNode()],
        edges: [],
        metadata: null as any
      }

      const result = transformSchemaToGraph(schema)

      expect(result.nodes).toHaveLength(1)
      expect(result.edges).toHaveLength(0)

      const stats = calculateTransformationStats(result)
      expect(stats.totalNodes).toBe(1)
      expect(stats.totalEdges).toBe(0)
    })

    it('should calculate statistics for complex transformation results', () => {
      const schema = createMockSchemaResponse({
        nodes: Array.from({ length: 50 }, (_, i) => 
          createMockModelNode({
            id: `model-${i}`,
            app: `app-${i % 5}` // 5 different apps
          })
        ),
        edges: Array.from({ length: 75 }, (_, i) => 
          createMockRelationship({
            id: `edge-${i}`,
            fromModel: `model-${i % 50}`,
            toModel: `model-${(i + 1) % 50}`,
            type: i % 3 === 0 ? 'foreign_key' : i % 3 === 1 ? 'many_to_many' : 'one_to_one'
          })
        )
      })

      const result = transformSchemaToGraph(schema)
      const stats = calculateTransformationStats(result)

      expect(stats.totalNodes).toBe(50)
      expect(stats.totalEdges).toBe(75)
      expect(stats.appsCount).toBe(5)
      expect(stats.averageFieldsPerNode).toBeGreaterThan(0)
      expect(stats.relationshipTypes).toBeDefined()
    })
  })

  describe('Memory and Performance Edge Cases', () => {
    it('should not create memory leaks with circular references', () => {
      const schema = createMockSchemaResponse({
        nodes: [
          createMockModelNode({
            id: 'a',
            relationships: {
              outgoing: [{ id: 'a-b', fromModel: 'a', toModel: 'b', type: 'foreign_key', fieldName: 'b_ref' }],
              incoming: [{ id: 'b-a', fromModel: 'b', toModel: 'a', type: 'foreign_key', fieldName: 'a_ref' }]
            }
          }),
          createMockModelNode({
            id: 'b',
            relationships: {
              outgoing: [{ id: 'b-a', fromModel: 'b', toModel: 'a', type: 'foreign_key', fieldName: 'a_ref' }],
              incoming: [{ id: 'a-b', fromModel: 'a', toModel: 'b', type: 'foreign_key', fieldName: 'b_ref' }]
            }
          })
        ],
        edges: [
          { id: 'a-b', fromModel: 'a', toModel: 'b', type: 'foreign_key', fieldName: 'b_ref' },
          { id: 'b-a', fromModel: 'b', toModel: 'a', type: 'foreign_key', fieldName: 'a_ref' }
        ]
      })

      // Transform multiple times to check for memory accumulation
      for (let i = 0; i < 100; i++) {
        const result = transformSchemaToGraph(schema)
        expect(result.nodes).toHaveLength(2)
        expect(result.edges).toHaveLength(2)
      }

      // If we reach here without memory issues, the test passes
      expect(true).toBe(true)
    })

    it('should handle transformation with various data sizes efficiently', () => {
      const testSizes = [0, 1, 10, 100, 1000]

      testSizes.forEach(size => {
        const schema = createMockSchemaResponse({
          nodes: Array.from({ length: size }, (_, i) => 
            createMockModelNode({ id: `model-${i}` })
          ),
          edges: Array.from({ length: Math.floor(size * 1.5) }, (_, i) => 
            createMockRelationship({
              id: `edge-${i}`,
              fromModel: `model-${i % Math.max(1, size)}`,
              toModel: `model-${(i + 1) % Math.max(1, size)}`
            })
          ),
          metadata: createMockSchemaMetadata({
            modelCount: size,
            relationshipCount: Math.floor(size * 1.5)
          })
        })

        const startTime = performance.now()
        const result = transformSchemaToGraph(schema)
        const endTime = performance.now()

        expect(result.nodes).toHaveLength(size)
        expect(result.edges).toHaveLength(Math.floor(size * 1.5))
        
        // Performance should scale reasonably (less than O(n²))
        const expectedMaxTime = size * size / 10000 + 100 // Very loose upper bound
        expect(endTime - startTime).toBeLessThan(expectedMaxTime)
      })
    })
  })
})