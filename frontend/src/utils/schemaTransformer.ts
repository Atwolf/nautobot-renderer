/**
 * Schema Transformer - Converts backend API responses to ReactFlow-compatible data structures
 * 
 * IMPORTANT FIX IMPLEMENTED: Relationship Embedding for API Nodes
 * 
 * Problem: API nodes lacked embedded relationship data that demo nodes have, causing
 * the node component to show undefined relationship counts.
 * 
 * Solution: The transformer now embeds relationship data from the API's separate 
 * relationships array into each node's data.relationships structure, ensuring
 * compatibility between API and demo data formats.
 * 
 * Key functions:
 * - embedRelationshipsIntoNodes: Groups API relationships by source/target and embeds them
 * - transformSchemaToGraph: Main function with dual-path logic for API vs demo data
 */

import type { Node, Edge } from 'reactflow';
import { MarkerType } from 'reactflow';
import type {
  SchemaResponse,
  ModelNode,
  ModelRelationship,
  NautobotNodeData,
  NautobotEdgeData
} from '../types/schema';
import { getAppColors } from './nodeColors';
import { performanceMonitor, PerformanceUtils } from './performance/PerformanceMonitor';

// Grid layout configuration - Optimized for more compact display
const GRID_CONFIG = {
  NODE_WIDTH: 200,
  NODE_HEIGHT: 150,
  HORIZONTAL_SPACING: 200, // Reduced from 300px (33% reduction)
  VERTICAL_SPACING: 120,   // Reduced from 200px (40% reduction)
  COLUMNS_PER_APP: 4,
  APP_VERTICAL_OFFSET: 280, // Reduced proportionally to maintain visual balance
};

// Memoized position calculation to avoid recalculating for identical datasets
const memoizedCalculatePositions = PerformanceUtils.memoizeWithPerformance(
  (nodes: ModelNode[]): Array<{ x: number; y: number }> => {
    performanceMonitor.startTiming('Grid Position Calculation', 'calculation', nodes.length, {
      algorithm: 'optimized-grid',
      complexity: 'O(n)'
    });

    try {
      // Group nodes by app using Map for better performance
      const nodesByApp = new Map<string, Array<{ node: ModelNode; originalIndex: number }>>();
      
      // Single pass to group nodes - O(n) complexity
      nodes.forEach((node, index) => {
        const app = node.app || (node as any).app_label || 'unknown';
        if (!nodesByApp.has(app)) {
          nodesByApp.set(app, []);
        }
        nodesByApp.get(app)!.push({ node, originalIndex: index });
      });

      // Pre-allocate positions array for better memory performance
      const positions: Array<{ x: number; y: number }> = new Array(nodes.length);

      let appIndex = 0;

      // Position each app's nodes in a grid - O(n) total complexity
      nodesByApp.forEach((appNodes, appName) => {
        const baseY = appIndex * GRID_CONFIG.APP_VERTICAL_OFFSET;

        // Batch position calculations for better cache performance
        for (let i = 0; i < appNodes.length; i++) {
          const { originalIndex } = appNodes[i];
          const row = Math.floor(i / GRID_CONFIG.COLUMNS_PER_APP);
          const col = i % GRID_CONFIG.COLUMNS_PER_APP;

          positions[originalIndex] = {
            x: col * GRID_CONFIG.HORIZONTAL_SPACING,
            y: baseY + row * GRID_CONFIG.VERTICAL_SPACING,
          };
        }

        appIndex++;
      });

      return positions;
    } finally {
      performanceMonitor.endTiming('Grid Position Calculation', {
        nodesProcessed: nodes.length,
        appsCount: new Set(nodes.map(n => n.app || (n as any).app_label)).size
      });
    }
  },
  // Custom key function for memoization based on node structure
  (nodes: ModelNode[]) => {
    // Create cache key based on node count, apps, and node names
    const apps = nodes.map(n => n.app || (n as any).app_label).sort();
    const nodeNames = nodes.map(n => n.name).sort();
    return `${nodes.length}-${apps.join(',')}-${nodeNames.slice(0, 10).join(',')}`;
  },
  'Position Calculation'
);

/**
 * Calculate grid-based positions organized by app
 * Optimized with memoization and O(n) complexity
 */
function calculateInitialPositions(nodes: ModelNode[]): Array<{ x: number; y: number }> {
  // Use performance monitoring to track position calculation efficiency
  return PerformanceUtils.measurePositionCalculation(
    nodes,
    memoizedCalculatePositions,
    'Grid Position Calculation'
  ).result;
}

/**
 * Extract related model names from a ModelNode's relationships
 */
function extractRelatedModels(node: ModelNode): string[] {
  const relatedModels = new Set<string>();

  // Handle relationships if they exist and have the expected structure
  if (node.relationships) {
    // Add models from outgoing relationships
    if (node.relationships.outgoing && Array.isArray(node.relationships.outgoing)) {
      node.relationships.outgoing.forEach(rel => {
        if (rel.toModel) {
          relatedModels.add(rel.toModel);
        }
      });
    }

    // Add models from incoming relationships
    if (node.relationships.incoming && Array.isArray(node.relationships.incoming)) {
      node.relationships.incoming.forEach(rel => {
        if (rel.fromModel) {
          relatedModels.add(rel.fromModel);
        }
      });
    }
  }

  // Also check fields for related models if fields exist
  if (node.fields && Array.isArray(node.fields)) {
    node.fields.forEach(field => {
      if (field && field.relatedModel && field.relatedModel !== node.name) {
        relatedModels.add(field.relatedModel);
      }
    });
  }

  return Array.from(relatedModels);
}

/**
 * Transform backend ModelNode to ReactFlow Node
 */
function transformModelToNode(
  model: ModelNode,
  index: number,
  position: { x: number; y: number }
): Node<NautobotNodeData> {
  const relatedModels = extractRelatedModels(model);

  // Handle different API response formats - backend uses 'app_label', frontend expects 'app'
  const modelApp = model.app || (model as any).app_label;

  // Convert backend ModelNode to frontend format
  const frontendModel: ModelNode = {
    ...model,
    app: modelApp, // Ensure app property is set from app_label
    // Transform fields if needed (backend FieldInfo vs frontend ModelField)
    fields: (model.fields || [])
      .filter(field => {
        // Enhanced field validation - check for field existence, name, and at least name length > 0
        return field &&
               typeof field === 'object' &&
               field.name &&
               typeof field.name === 'string' &&
               field.name.trim().length > 0;
      })
      .map(field => ({
        name: field.name.trim(),
        type: (field as any).field_type || field.type || 'unknown',
        required: (field as any).is_nullable !== undefined ? !(field as any).is_nullable : !field.nullable,
        nullable: (field as any).is_nullable !== undefined ? (field as any).is_nullable : (field.nullable ?? true),
        relatedModel: field.relatedModel,
        description: field.description,
      })),
  };

  return {
    id: model.id,
    type: 'nautobotModel',
    position,
    data: {
      // Copy all transformed ModelNode properties
      ...frontendModel,
      // Add ReactFlow-specific properties
      expanded: false,
      selected: false,
      color: getAppColors(modelApp).primary,
      fieldCount: frontendModel.fields.length,
      relatedModels,
      // Ensure position is set in data as well
      position,
    },
  };
}

/**
 * Determine if a relationship field is required based on the source model's fields
 */
function isRelationshipRequired(relationship: ModelRelationship, sourceNode?: ModelNode): boolean {
  if (!sourceNode) return false;

  const field = sourceNode.fields.find(f => f.name === relationship.fieldName);
  return field?.required ?? false;
}

/**
 * Generate a user-friendly label for the relationship
 */
function generateRelationshipLabel(relationship: ModelRelationship): string {
  // Use field name as primary label
  let label = relationship.fieldName;

  // For reverse relationships, use the related name if available
  if (relationship.type === 'reverse_foreign_key' && relationship.relatedName) {
    label = relationship.relatedName;
  }

  // Format label for readability (convert snake_case to readable format)
  return label.replace(/_/g, ' ');
}

/**
 * Get color for relationship type
 */
function getRelationshipColor(relationshipType: string): string {
  const colorMap: Record<string, string> = {
    'foreign_key': '#64748B',
    'one_to_one': '#3B82F6',
    'many_to_many': '#8B5CF6',
    'reverse_foreign_key': '#6B7280',
    'cable_connection': '#F59E0B',
    'power_connection': '#EF4444',
    'console_connection': '#10B981',
    'through_table': '#6366F1',
    'custom_relationship': '#EC4899',
  };

  return colorMap[relationshipType] || '#64748B';
}

/**
 * Transform backend ModelRelationship to ReactFlow Edge
 */
function transformRelationshipToEdge(
  relationship: ModelRelationship,
  allNodes: ModelNode[]
): Edge<NautobotEdgeData> {
  // Find source node to determine if relationship is required - prioritize ID match over name match
  const sourceNodeForRequired = allNodes.find(node => node.id === relationship.fromModel || node.name === relationship.fromModel);
  const isRequired = isRelationshipRequired(relationship, sourceNodeForRequired);
  const label = generateRelationshipLabel(relationship);
  const color = getRelationshipColor(relationship.type);

  // For edge source/target, use node IDs instead of model names
  // Find the actual node IDs from the available nodes - prioritize ID match over name match
  const sourceNode = allNodes.find(node => node.id === relationship.fromModel || node.name === relationship.fromModel);
  const targetNode = allNodes.find(node => node.id === relationship.toModel || node.name === relationship.toModel);
  const sourceNodeId = sourceNode?.id || relationship.fromModel;
  const targetNodeId = targetNode?.id || relationship.toModel;

  // Log ID lookup results for debugging
  if (!sourceNode || !targetNode) {
    console.warn(`Node lookup failed for relationship ${relationship.id}:`, {
      fromModel: relationship.fromModel,
      toModel: relationship.toModel,
      sourceNodeFound: !!sourceNode,
      targetNodeFound: !!targetNode,
      sourceNodeId,
      targetNodeId,
      availableNodeNames: allNodes.map(n => n.name).slice(0, 10)
    });
  }

  return {
    id: relationship.id,
    source: sourceNodeId, // Use actual node IDs, not lowercase model names
    target: targetNodeId, // Use actual node IDs, not lowercase model names
    sourceHandle: `${sourceNodeId}-source-right`, // Match the default handle ID from the source node
    targetHandle: `${targetNodeId}-target-left`, // Match the default handle ID from the target node
    type: 'simplified',
    animated: false,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color,
    },
    data: {
      // Copy all ModelRelationship properties
      ...relationship,
      // Add ReactFlow-specific properties
      animated: false,
      highlighted: false,
      relationshipType: relationship.type,
      sourceModel: relationship.fromModel,
      targetModel: relationship.toModel,
      label,
      isRequired,
      color,
    },
  };
}

/**
 * Validate that all edge references point to existing nodes
 */
function validateEdgeReferences(
  edges: Edge<NautobotEdgeData>[],
  nodeIds: Set<string>
): Edge<NautobotEdgeData>[] {
  console.log(`Validating ${edges.length} edges against ${nodeIds.size} available nodes`);
  console.log('Available node IDs:', Array.from(nodeIds).slice(0, 10), nodeIds.size > 10 ? '...' : '');

  let validCount = 0;
  let invalidCount = 0;
  const missingNodes = new Set<string>();

  const validEdges = edges.filter((edge, index) => {
    const hasValidSource = nodeIds.has(edge.source);
    const hasValidTarget = nodeIds.has(edge.target);

    if (!hasValidSource || !hasValidTarget) {
      invalidCount++;
      if (!hasValidSource) missingNodes.add(edge.source);
      if (!hasValidTarget) missingNodes.add(edge.target);

      // Log first few invalid edges for debugging
      if (invalidCount <= 5) {
        console.warn(
          `Edge ${index} invalid: ${edge.id} (${edge.data?.sourceModel} -> ${edge.data?.targetModel}). ` +
          `Source: ${edge.source} (exists: ${hasValidSource}), ` +
          `Target: ${edge.target} (exists: ${hasValidTarget})`
        );
      }
      return false;
    }

    validCount++;
    // Log first few valid edges for debugging
    if (validCount <= 5) {
      console.log(
        `Edge ${index} valid: ${edge.id} (${edge.data?.sourceModel} -> ${edge.data?.targetModel}). ` +
        `Source: ${edge.source}, Target: ${edge.target}`
      );
    }

    return true;
  });

  console.log(`Edge validation summary: ${validCount} valid, ${invalidCount} invalid`);
  if (missingNodes.size > 0) {
    console.warn(`Missing node IDs referenced by edges:`, Array.from(missingNodes).slice(0, 10), missingNodes.size > 10 ? '...' : '');
  }

  return validEdges;
}

/**
 * Embed relationships into node data structures
 * 
 * PERFORMANCE OPTIMIZED: Reduced from O(n*m) to O(n+m) complexity
 * 
 * This function solves the core issue where API nodes don't have relationship information
 * embedded in their data structure, unlike demo nodes. The API returns relationships
 * as a separate array, but the node component expects them to be embedded in each node's
 * data.relationships.outgoing and data.relationships.incoming arrays.
 * 
 * @param nodes - Array of ReactFlow nodes to embed relationships into
 * @param relationships - Array of processed relationships from the API
 */
function embedRelationshipsIntoNodes(
  nodes: Node<NautobotNodeData>[],
  relationships: ModelRelationship[]
): void {
  performanceMonitor.startTiming('Relationship Embedding', 'transformation', nodes.length, {
    relationshipCount: relationships.length,
    algorithm: 'optimized-map-grouping',
    originalComplexity: 'O(n*m)',
    optimizedComplexity: 'O(n+m)'
  });

  // Initialize outside try block to be accessible in finally block
  let processedRelationshipIds = new Set<string>();

  try {
    // OPTIMIZATION 1: Use Maps for O(1) lookup instead of array.find() which is O(n)
    const modelNameToNodeIndex = new Map<string, number>();
    
    // Single pass to build lookup map - O(n) complexity
    nodes.forEach((node, index) => {
      // Map both node.data.name and node.data.id to handle different referencing patterns
      modelNameToNodeIndex.set(node.data.name, index);
      if (node.data.id !== node.data.name) {
        modelNameToNodeIndex.set(node.data.id, index);
      }
    });

    // OPTIMIZATION 2: Pre-allocate Maps with estimated capacity
    const outgoingRelationships = new Map<string, ModelRelationship[]>();
    const incomingRelationships = new Map<string, ModelRelationship[]>();

    // Single pass to group relationships - O(m) complexity
    relationships.forEach(relationship => {
      // Group outgoing relationships (where this model is the source)
      let outgoing = outgoingRelationships.get(relationship.fromModel);
      if (!outgoing) {
        outgoing = [];
        outgoingRelationships.set(relationship.fromModel, outgoing);
      }
      outgoing.push(relationship);

      // Group incoming relationships (where this model is the target)
      let incoming = incomingRelationships.get(relationship.toModel);
      if (!incoming) {
        incoming = [];
        incomingRelationships.set(relationship.toModel, incoming);
      }
      incoming.push(relationship);
    });

    // OPTIMIZATION 3: Use Set for O(1) duplicate detection instead of array.findIndex() which is O(n)
    // processedRelationshipIds already declared outside try block
    
    // Single pass to embed relationships into nodes - O(n) complexity
    nodes.forEach((node) => {
      const modelName = node.data.name;
      const modelId = node.data.id;

      // Get outgoing relationships (where this node is the source)
      const outgoingForName = outgoingRelationships.get(modelName) || [];
      const outgoingForId = modelId !== modelName ? (outgoingRelationships.get(modelId) || []) : [];
      
      // Get incoming relationships (where this node is the target)
      const incomingForName = incomingRelationships.get(modelName) || [];
      const incomingForId = modelId !== modelName ? (incomingRelationships.get(modelId) || []) : [];

      // OPTIMIZATION 4: Use Set for deduplication instead of nested findIndex loops
      const uniqueOutgoing: ModelRelationship[] = [];
      const uniqueIncoming: ModelRelationship[] = [];
      const seenOutgoingIds = new Set<string>();
      const seenIncomingIds = new Set<string>();

      // Process outgoing relationships with deduplication
      [...outgoingForName, ...outgoingForId].forEach(rel => {
        if (!seenOutgoingIds.has(rel.id)) {
          seenOutgoingIds.add(rel.id);
          uniqueOutgoing.push(rel);
        }
      });

      // Process incoming relationships with deduplication
      [...incomingForName, ...incomingForId].forEach(rel => {
        if (!seenIncomingIds.has(rel.id)) {
          seenIncomingIds.add(rel.id);
          uniqueIncoming.push(rel);
        }
      });

      // Update node's relationship data
      node.data.relationships = {
        outgoing: uniqueOutgoing,
        incoming: uniqueIncoming
      };

      // OPTIMIZATION 5: Build related models set directly during relationship processing
      const relatedModels = new Set<string>();
      uniqueOutgoing.forEach(rel => {
        if (rel.toModel !== modelName && rel.toModel !== modelId) {
          relatedModels.add(rel.toModel);
        }
      });
      uniqueIncoming.forEach(rel => {
        if (rel.fromModel !== modelName && rel.fromModel !== modelId) {
          relatedModels.add(rel.fromModel);
        }
      });
      
      node.data.relatedModels = Array.from(relatedModels);

      // Track processed relationships for performance metrics
      uniqueOutgoing.forEach(rel => processedRelationshipIds.add(rel.id));
      uniqueIncoming.forEach(rel => processedRelationshipIds.add(rel.id));
    });

    console.log(`Relationship embedding complete: processed ${relationships.length} relationships across ${nodes.length} nodes`);
  } finally {
    performanceMonitor.endTiming('Relationship Embedding', {
      nodesProcessed: nodes.length,
      relationshipsProcessed: relationships.length,
      uniqueRelationships: processedRelationshipIds?.size || 0
    });
  }
}

/**
 * Main transformation function
 * Converts backend SchemaResponse to ReactFlow nodes and edges
 * 
 * PERFORMANCE MONITORED: Comprehensive timing and optimization tracking
 */
export function transformSchemaToGraph(response: SchemaResponse): {
  nodes: Node<NautobotNodeData>[];
  edges: Edge<NautobotEdgeData>[];
} {
  const startTime = performance.now();
  let dataSize = 0;
  
  // Start main transformation timing
  performanceMonitor.startTiming('Schema Transformation', 'transformation', undefined, {
    hasResponse: !!response,
    responseType: typeof response
  });

  try {
    // Log the actual response structure for debugging
    console.log('=== API RESPONSE DEBUG ===');
    console.log('Schema response received:', {
      hasResponse: !!response,
      responseType: typeof response,
      responseKeys: response ? Object.keys(response) : null,
      hasSchemaGraph: !!(response as any)?.schema_graph,
      schemaGraphKeys: (response as any)?.schema_graph ? Object.keys((response as any).schema_graph) : null,
      nodesType: response?.nodes ? typeof response.nodes : 'undefined',
      nodesIsArray: response?.nodes ? Array.isArray(response.nodes) : false,
      nodesLength: response?.nodes?.length || 0
    });

    // Log sample of actual API response for debugging
    if (response) {
      console.log('=== RAW API RESPONSE SAMPLE ===');
      console.log('Response keys:', Object.keys(response));
      if ((response as any).schema_graph) {
        console.log('Schema graph keys:', Object.keys((response as any).schema_graph));
      }
    }

    // Handle empty or invalid response
    if (!response) {
      console.warn('No schema response provided');
      return { nodes: [], edges: [] };
    }

    // Check if response has the expected structure (nodes directly) or new structure (schema_graph)
    let actualResponse: SchemaResponse;

    if (response.nodes && Array.isArray(response.nodes)) {
      // Original expected structure
      actualResponse = response;
    } else if ((response as any).schema_graph) {
      // New API structure with schema_graph wrapper
      console.log('Using schema_graph from response structure');
      actualResponse = (response as any).schema_graph;
    } else {
      console.warn('Schema response missing both nodes and schema_graph properties:', response);
      return { nodes: [], edges: [] };
    }

    if (!actualResponse.nodes) {
      console.warn('Schema response missing nodes property:', actualResponse);
      return { nodes: [], edges: [] };
    }

    if (!Array.isArray(actualResponse.nodes)) {
      console.warn('Schema response nodes is not an array:', typeof actualResponse.nodes, actualResponse.nodes);
      return { nodes: [], edges: [] };
    }

    if (actualResponse.nodes.length === 0) {
      console.warn('Schema response has empty nodes array');
      return { nodes: [], edges: [] };
    }

    // Update data size for performance tracking
    dataSize = actualResponse.nodes.length;
    const relationshipCount = actualResponse.relationships?.length || 0;
    
    // Performance warning for large datasets
    if (dataSize > 100) {
      console.warn(`🟡 Large dataset detected: ${dataSize} nodes, ${relationshipCount} relationships. Consider using virtualization.`);
    }
    
    // Update timing with actual data size
    performanceMonitor.endTiming('Schema Transformation');
    performanceMonitor.startTiming('Schema Transformation', 'transformation', dataSize, {
      nodeCount: dataSize,
      relationshipCount,
      hasRelationships: relationshipCount > 0
    });

    // Calculate positions for all nodes with performance monitoring
    performanceMonitor.startTiming('Position Calculation Phase', 'calculation', dataSize);
    const positions = calculateInitialPositions(actualResponse.nodes);
    performanceMonitor.endTiming('Position Calculation Phase');

    // Transform nodes with performance monitoring
    performanceMonitor.startTiming('Node Transformation', 'transformation', dataSize);

    // LOG ALL MODEL NAMES FROM API - This is the critical debug info!
    console.log('=== ALL API MODEL NAMES BY APP ===');
    const modelsByApp = new Map<string, string[]>();
    actualResponse.nodes.forEach((node, index) => {
      const app = node.app || (node as any).app_label || 'unknown';
      const modelName = node.name || 'unknown';

      if (!modelsByApp.has(app)) {
        modelsByApp.set(app, []);
      }
      modelsByApp.get(app)!.push(modelName);

      // Log first 10 nodes with complete structure
      if (index < 10) {
        console.log(`=== API Node ${index} Structure ===`);
        console.log(`ID: "${node.id}"`);
        console.log(`Name: "${node.name}"`);
        console.log(`App: "${node.app}"`);
        console.log(`App Label: "${(node as any).app_label}"`);
        console.log(`Has Relationships: ${!!node.relationships}`);
        console.log(`Has Fields: ${!!node.fields}`);
        console.log(`Fields Count: ${node.fields?.length || 0}`);
        console.log(`Full node keys:`, Object.keys(node));
        console.log('---');
      }
    });

    // Display organized view of all models by app
    modelsByApp.forEach((models, app) => {
      console.log(`\n📱 App: "${app}" (${models.length} models)`);
      models.forEach(model => {
        console.log(`  📄 "${model}"`);
      });
    });
    console.log('\n');

    const nodes: Node<NautobotNodeData>[] = actualResponse.nodes.map((node, index) => {

      // Handle different API response formats - backend uses 'app_label', frontend expects 'app'
      const nodeApp = node.app || (node as any).app_label;

      // Ensure node has required properties - filter out invalid nodes instead of throwing
      if (!node.id || !node.name || !nodeApp) {
        console.warn('Invalid node structure - skipping:', node);
        return null; // Return null to filter out invalid nodes
      }

      // Convert backend node format to frontend format
      const frontendNode: ModelNode = {
        ...node,
        app: nodeApp,
        fields: node.fields || [],
        relationships: node.relationships || { outgoing: [], incoming: [] },
        isAbstract: (node as any).is_abstract ?? node.isAbstract ?? false,
      };

      return transformModelToNode(frontendNode, index, positions[index]);
    })
    .filter(node => node !== null); // Filter out invalid nodes that returned null
    performanceMonitor.endTiming('Node Transformation', { nodesTransformed: nodes.length });

    // Create a set of valid node IDs for edge validation
    performanceMonitor.startTiming('Node ID Set Creation', 'calculation', dataSize);
    const nodeIds = new Set(nodes.map(node => node.id));
    performanceMonitor.endTiming('Node ID Set Creation');

    // Transform relationships (backend calls them 'relationships', not 'edges')
    let edges: Edge<NautobotEdgeData>[] = [];
    let processedRelationships: ModelRelationship[] = [];
    
    if ((actualResponse.relationships && Array.isArray(actualResponse.relationships)) ||
        (actualResponse.edges && Array.isArray(actualResponse.edges))) {

      const relationshipsToProcess = actualResponse.relationships || actualResponse.edges || [];
      console.log(`Processing ${relationshipsToProcess.length} relationships/edges for edge transformation`);

      // First, convert backend relationships to frontend format
      processedRelationships = relationshipsToProcess
        .map((relationship, index) => {
          // Convert backend relationships to frontend format, or use if already in frontend format
          const frontendRelationship: ModelRelationship = {
            id: relationship.id,
            fromModel: relationship.source_model || relationship.fromModel,
            toModel: relationship.target_model || relationship.toModel,
            type: relationship.relationship_type || relationship.type,
            fieldName: relationship.field_name || relationship.fieldName,
            relatedName: relationship.related_name || relationship.relatedName,
            // Map additional properties if they exist
            ...(relationship.through_model && { throughTable: relationship.through_model }),
            ...(relationship.description && { description: relationship.description }),
          };

          // Log first few relationships for debugging
          if (index < 5) {
            console.log(`Relationship ${index}:`, {
              id: frontendRelationship.id,
              fromModel: frontendRelationship.fromModel,
              toModel: frontendRelationship.toModel,
              type: frontendRelationship.type,
              fieldName: frontendRelationship.fieldName
            });
          }

          // Validate relationship structure
          if (!frontendRelationship.id || !frontendRelationship.fromModel || !frontendRelationship.toModel || !frontendRelationship.type) {
            console.warn('Invalid relationship structure:', relationship);
            return null;
          }

          return frontendRelationship;
        })
        .filter((relationship): relationship is ModelRelationship => relationship !== null);

      // CRITICAL FIX: Embed relationships into nodes BEFORE creating edges
      // This ensures that API nodes have the same relationship structure as demo nodes,
      // allowing the node component to display relationship counts correctly
      console.log(`Embedding ${processedRelationships.length} relationships into ${nodes.length} nodes`);
      embedRelationshipsIntoNodes(nodes, processedRelationships);

      // Then create edges from the processed relationships
      performanceMonitor.startTiming('Edge Transformation', 'transformation', processedRelationships.length);
      edges = processedRelationships
        .map((relationship, index) => {
          const edge = transformRelationshipToEdge(relationship, actualResponse.nodes);

          // Log edge transformation result for first few
          if (index < 5) {
            console.log(`Edge ${index} transformation result:`, {
              edgeId: edge.id,
              source: edge.source,
              target: edge.target,
              sourceModel: edge.data?.sourceModel,
              targetModel: edge.data?.targetModel
            });
          }

          return edge;
        });
      performanceMonitor.endTiming('Edge Transformation', { edgesTransformed: edges.length });

      console.log(`Successfully transformed ${edges.length} relationships to edges`);

      // Validate that all edges reference existing nodes
      performanceMonitor.startTiming('Edge Validation', 'calculation', edges.length);
      const validatedEdges = validateEdgeReferences(edges, nodeIds);
      performanceMonitor.endTiming('Edge Validation', {
        totalEdges: edges.length,
        validEdges: validatedEdges.length,
        filteredOut: edges.length - validatedEdges.length
      });
      console.log(`After validation: ${validatedEdges.length} edges remain (${edges.length - validatedEdges.length} filtered out)`);
      edges = validatedEdges;
    } else {
      // DEMO DATA COMPATIBILITY: Handle cases where relationships are already embedded in nodes
      // This maintains compatibility with existing demo data structure
      console.log('No relationships array from API - checking for embedded relationships in nodes');
      
      // Extract relationships from nodes that already have them embedded (like demo data)
      const embeddedRelationships: ModelRelationship[] = [];
      nodes.forEach(node => {
        if (node.data.relationships) {
          embeddedRelationships.push(...node.data.relationships.outgoing);
          embeddedRelationships.push(...node.data.relationships.incoming);
        }
      });
      
      if (embeddedRelationships.length > 0) {
        console.log(`Found ${embeddedRelationships.length} embedded relationships in demo data`);
        // Remove duplicates based on relationship ID
        processedRelationships = embeddedRelationships.filter((rel, index, arr) => 
          arr.findIndex(r => r.id === rel.id) === index
        );
        
        // Create edges from embedded relationships
        performanceMonitor.startTiming('Demo Edge Transformation', 'transformation', processedRelationships.length);
        edges = processedRelationships.map(relationship => 
          transformRelationshipToEdge(relationship, actualResponse.nodes)
        );
        performanceMonitor.endTiming('Demo Edge Transformation');
        
        performanceMonitor.startTiming('Demo Edge Validation', 'calculation', edges.length);
        const validatedEdges = validateEdgeReferences(edges, nodeIds);
        performanceMonitor.endTiming('Demo Edge Validation');
        edges = validatedEdges;
      }
    }

    // Calculate final transformation metrics
    const endTime = performance.now();
    const totalDuration = endTime - startTime;
    
    // Performance warnings for slow transformations
    if (totalDuration > 1000) {
      console.error(`🔴 SLOW TRANSFORMATION: ${totalDuration.toFixed(0)}ms for ${dataSize} nodes (>${1000}ms threshold)`);
      console.error('Recommendations:', {
        'Use chunking': dataSize > 500,
        'Implement virtualization': dataSize > 100,
        'Consider web workers': totalDuration > 2000,
        'Optimize algorithms': totalDuration > 5000
      });
    } else if (totalDuration > 500) {
      console.warn(`🟡 Slow transformation: ${totalDuration.toFixed(0)}ms for ${dataSize} nodes`);
    }
    
    console.log(`Transformed schema: ${nodes.length} nodes, ${edges.length} edges in ${totalDuration.toFixed(2)}ms`);
    
    // Log performance metrics for large datasets
    if (dataSize > 100) {
      const report = performanceMonitor.generateReport();
      console.log('📊 Performance Report for Large Dataset:', {
        totalDuration: `${report.totalDuration.toFixed(2)}ms`,
        nodeCount: dataSize,
        edgeCount: edges.length,
        slowestOperations: report.slowestOperations.slice(0, 3).map(op => ({
          name: op.name,
          duration: `${(op.duration || 0).toFixed(2)}ms`
        })),
        recommendations: report.recommendations.slice(0, 3)
      });
    }

    return { nodes, edges };

  } catch (error) {
    console.error('Error transforming schema:', error);
    
    // End timing on error
    performanceMonitor.endTiming('Schema Transformation', {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });

    // Return empty graph on error to prevent UI crashes
    return { nodes: [], edges: [] };
  } finally {
    // Ensure timing is ended even on success
    performanceMonitor.endTiming('Schema Transformation', {
      success: true,
      finalNodeCount: dataSize,
      totalDuration: performance.now() - startTime
    });
  }
}

/**
 * Transform a single ModelNode for updates (useful for incremental updates)
 */
export function transformSingleNode(
  node: ModelNode,
  position: { x: number; y: number }
): Node<NautobotNodeData> {
  return transformModelToNode(node, 0, position);
}

/**
 * Transform a single ModelRelationship for updates
 */
export function transformSingleEdge(
  relationship: ModelRelationship,
  sourceNodes: ModelNode[]
): Edge<NautobotEdgeData> {
  return transformRelationshipToEdge(relationship, sourceNodes);
}

/**
 * Calculate statistics from transformed data
 */
export function calculateTransformationStats(transformed: {
  nodes: Node<NautobotNodeData>[];
  edges: Edge<NautobotEdgeData>[];
}) {
  const stats = {
    totalNodes: transformed.nodes.length,
    totalEdges: transformed.edges.length,
    nodesByApp: {} as Record<string, number>,
    edgesByType: {} as Record<string, number>,
    averageFieldsPerNode: 0,
    mostConnectedNodes: [] as Array<{
      nodeId: string;
      nodeName: string;
      connectionCount: number;
    }>,
  };

  // Calculate nodes by app
  transformed.nodes.forEach(node => {
    const app = node.data.app;
    stats.nodesByApp[app] = (stats.nodesByApp[app] || 0) + 1;
  });

  // Calculate edges by type
  transformed.edges.forEach(edge => {
    const type = edge.data?.type || 'unknown';
    stats.edgesByType[type] = (stats.edgesByType[type] || 0) + 1;
  });

  // Calculate average fields per node
  const totalFields = transformed.nodes.reduce((sum, node) => sum + (node.data.fieldCount || 0), 0);
  stats.averageFieldsPerNode = transformed.nodes.length > 0 ? totalFields / transformed.nodes.length : 0;

  // Find most connected nodes
  const connectionCounts = new Map<string, number>();
  transformed.edges.forEach(edge => {
    connectionCounts.set(edge.source, (connectionCounts.get(edge.source) || 0) + 1);
    connectionCounts.set(edge.target, (connectionCounts.get(edge.target) || 0) + 1);
  });

  stats.mostConnectedNodes = Array.from(connectionCounts.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([nodeId, count]) => {
      const node = transformed.nodes.find(n => n.id === nodeId);
      return {
        nodeId,
        nodeName: node?.data.name || nodeId,
        connectionCount: count,
      };
    });

  return stats;
}