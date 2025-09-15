/**
 * Example usage of the schemaTransformer utility
 *
 * This demonstrates how to use the transformer to convert backend
 * SchemaResponse data to ReactFlow format for visualization.
 */

import type { SchemaResponse } from '../types/schema';
import { transformSchemaToGraph, calculateTransformationStats } from './schemaTransformer';

// Example: Using the transformer with API data
export async function loadAndTransformSchema(apiEndpoint: string) {
  try {
    // 1. Fetch schema data from backend API
    const response = await fetch(apiEndpoint);
    const schemaData: SchemaResponse = await response.json();

    // 2. Transform to ReactFlow format
    const { nodes, edges } = transformSchemaToGraph(schemaData);

    // 3. Calculate statistics (optional)
    const stats = calculateTransformationStats({ nodes, edges });

    console.log('Schema transformation completed:');
    console.log(`- Transformed ${stats.totalNodes} nodes and ${stats.totalEdges} edges`);
    console.log(`- Apps: ${Object.keys(stats.nodesByApp).join(', ')}`);
    console.log(`- Most connected: ${stats.mostConnectedNodes[0]?.nodeName} (${stats.mostConnectedNodes[0]?.connectionCount} connections)`);

    return { nodes, edges, stats };

  } catch (error) {
    console.error('Failed to load and transform schema:', error);
    return { nodes: [], edges: [], stats: null };
  }
}

// Example: Using with React component
export function useSchemaVisualization(schemaResponse?: SchemaResponse) {
  if (!schemaResponse) {
    return { nodes: [], edges: [] };
  }

  // Transform the data when schema response changes
  return transformSchemaToGraph(schemaResponse);
}

// Example: Filtering and transforming partial data
export function transformFilteredSchema(
  fullSchema: SchemaResponse,
  selectedApps: string[]
) {
  // Filter nodes by selected apps
  const filteredNodes = fullSchema.nodes.filter(node =>
    selectedApps.includes(node.app)
  );

  // Filter edges to only include relationships between filtered nodes
  const nodeIds = new Set(filteredNodes.map(node => node.id));
  const filteredEdges = fullSchema.edges.filter(edge =>
    nodeIds.has(edge.fromModel.toLowerCase()) &&
    nodeIds.has(edge.toModel.toLowerCase())
  );

  // Create filtered schema response
  const filteredSchema: SchemaResponse = {
    ...fullSchema,
    nodes: filteredNodes,
    edges: filteredEdges,
    metadata: {
      ...fullSchema.metadata,
      modelCount: filteredNodes.length,
      relationshipCount: filteredEdges.length,
      apps: selectedApps
    }
  };

  // Transform filtered data
  return transformSchemaToGraph(filteredSchema);
}

// Example: Incremental updates (useful for real-time updates)
export function updateSchemaVisualization(
  existingNodes: any[],
  existingEdges: any[],
  newSchemaData: SchemaResponse
) {
  // Transform new data
  const { nodes: newNodes, edges: newEdges } = transformSchemaToGraph(newSchemaData);

  // Preserve existing positions where possible
  const updatedNodes = newNodes.map(newNode => {
    const existingNode = existingNodes.find(existing => existing.id === newNode.id);
    if (existingNode) {
      return {
        ...newNode,
        position: existingNode.position, // Preserve user-adjusted position
        data: {
          ...newNode.data,
          expanded: existingNode.data?.expanded, // Preserve UI state
          selected: existingNode.data?.selected,
        }
      };
    }
    return newNode;
  });

  return { nodes: updatedNodes, edges: newEdges };
}