/**
 * Integration example showing how to use the schemaTransformer with the existing
 * useSchemaVisualization hook for both demo data and real API data.
 */

import type { SchemaResponse, ApiResponse } from '../types/schema';
import { transformSchemaToGraph } from './schemaTransformer';
import { demoNodes, demoEdges } from './demoData';

/**
 * Enhanced data loading function that can handle both demo and real API data
 */
export async function loadSchemaData(
  useDemoData: boolean = true,
  apiEndpoint?: string
): Promise<{ nodes: any[], edges: any[], metadata?: any }> {
  if (useDemoData) {
    // Return demo data in the expected format
    console.log('Loading demo data...');
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay
    return { nodes: demoNodes, edges: demoEdges };
  }

  if (!apiEndpoint) {
    throw new Error('API endpoint is required for real data loading');
  }

  try {
    console.log(`Loading real data from ${apiEndpoint}...`);

    // Fetch real schema data from backend
    const response = await fetch(apiEndpoint);
    if (!response.ok) {
      throw new Error(`Failed to fetch schema: ${response.statusText}`);
    }

    const schemaResponse: SchemaResponse = await response.json();

    // Transform backend format to ReactFlow format
    const { nodes, edges } = transformSchemaToGraph(schemaResponse);

    console.log(`Transformed ${nodes.length} nodes and ${edges.length} edges`);

    return {
      nodes,
      edges,
      metadata: schemaResponse.metadata
    };

  } catch (error) {
    console.error('Failed to load schema data:', error);
    // Fallback to demo data on error
    return { nodes: demoNodes, edges: demoEdges };
  }
}

/**
 * Hook enhancement that shows how to integrate the transformer
 * This demonstrates the pattern to use in useSchemaVisualization
 */
export function createEnhancedLoadFunction(
  setIsLoading: (loading: boolean) => void,
  applyInitialLayout?: (nodes: any[], edges: any[]) => any[]
) {
  return async (apiEndpoint?: string) => {
    setIsLoading(true);

    try {
      // Use the new integrated loader
      const { nodes, edges, metadata } = await loadSchemaData(
        !apiEndpoint, // Use demo data if no endpoint provided
        apiEndpoint
      );

      // Apply layout if function is provided
      const finalNodes = applyInitialLayout
        ? applyInitialLayout(nodes, edges)
        : nodes;

      setIsLoading(false);

      return {
        nodes: finalNodes,
        edges,
        metadata
      };

    } catch (error) {
      console.error('Enhanced load function failed:', error);
      setIsLoading(false);
      throw error;
    }
  };
}

/**
 * Example of how to modify the existing useSchemaVisualization hook
 * to support both demo data and real API data:
 *
 * // In useSchemaVisualization.ts, replace the loadDemoData function:
 *
 * const loadData = useCallback(async (apiEndpoint?: string) => {
 *   console.log(apiEndpoint ? 'Loading API data...' : 'Loading demo data...');
 *   setIsLoading(true);
 *
 *   try {
 *     const { nodes, edges, metadata } = await loadSchemaData(
 *       !apiEndpoint, // Use demo data if no endpoint
 *       apiEndpoint
 *     );
 *
 *     // Apply initial layout if auto layout is enabled
 *     const layoutedNodes = isAutoLayoutEnabled
 *       ? applyInitialLayout(nodes, edges)
 *       : nodes;
 *
 *     setIsLoading(false);
 *     return { nodes: layoutedNodes, edges, metadata };
 *
 *   } catch (error) {
 *     console.error('Data loading failed:', error);
 *     setIsLoading(false);
 *     throw error;
 *   }
 * }, [isAutoLayoutEnabled]);
 */

// Export the pattern for easy integration
export const INTEGRATION_PATTERN = {
  // Replace existing demo loader with this enhanced version
  replaceFunction: 'loadDemoData',
  newFunction: 'loadData',
  additionalParameters: ['apiEndpoint?: string'],

  // Key changes needed in the hook
  changes: [
    'Import transformSchemaToGraph from schemaTransformer',
    'Use loadSchemaData function instead of direct demo data',
    'Handle both demo and real API data transparently',
    'Preserve existing layout and filtering logic',
    'Add error handling for API failures'
  ]
} as const;