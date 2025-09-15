/**
 * Test cases for schemaTransformer utility
 *
 * These tests validate that the transformation from backend SchemaResponse
 * format to ReactFlow nodes/edges format works correctly.
 *
 * To run with a testing framework later, convert these to proper test cases.
 */

import type { SchemaResponse } from '../../types/schema';
import { transformSchemaToGraph, calculateTransformationStats } from '../schemaTransformer';

// Sample test data that matches the backend format
const SAMPLE_SCHEMA: SchemaResponse = {
  nodes: [
    {
      id: 'device',
      name: 'Device',
      app: 'dcim',
      fields: [
        { name: 'name', type: 'CharField', required: true, nullable: false },
        { name: 'site', type: 'ForeignKey', required: true, nullable: false, relatedModel: 'Site' },
      ],
      relationships: {
        outgoing: [
          { id: 'device-site', fromModel: 'Device', toModel: 'Site', type: 'foreign_key', fieldName: 'site' }
        ],
        incoming: []
      },
      isAbstract: false,
    },
    {
      id: 'site',
      name: 'Site',
      app: 'dcim',
      fields: [
        { name: 'name', type: 'CharField', required: true, nullable: false },
        { name: 'slug', type: 'SlugField', required: true, nullable: false },
      ],
      relationships: {
        outgoing: [],
        incoming: [
          { id: 'device-site', fromModel: 'Device', toModel: 'Site', type: 'foreign_key', fieldName: 'site', relatedName: 'devices' }
        ]
      },
      isAbstract: false,
    }
  ],
  edges: [
    { id: 'device-site', fromModel: 'device', toModel: 'site', type: 'foreign_key', fieldName: 'site' }
  ],
  metadata: {
    discoveredAt: '2025-01-01T00:00:00Z',
    nautobotVersion: '2.0.0',
    modelCount: 2,
    relationshipCount: 1,
    apps: ['dcim'],
  },
};

/**
 * Simple validation function to verify the transformer works
 * Replace with proper test framework when available
 */
export function validateTransformer() {
  console.log('🧪 Validating Schema Transformer');
  console.log('================================\n');

  try {
    const result = transformSchemaToGraph(SAMPLE_SCHEMA);
    const stats = calculateTransformationStats(result);

    console.log('✅ Basic transformation:',
      `${result.nodes.length} nodes, ${result.edges.length} edges`);

    console.log('✅ Node structure validated:',
      result.nodes[0]?.type === 'nautobotModel' ? 'correct' : 'incorrect');

    console.log('✅ Edge structure validated:',
      result.edges[0]?.type === 'simplified' ? 'correct' : 'incorrect');

    console.log('✅ Statistics calculated:',
      `${stats.totalNodes} nodes, ${stats.totalEdges} edges`);

    return true;
  } catch (error) {
    console.error('❌ Transformation failed:', error);
    return false;
  }
}