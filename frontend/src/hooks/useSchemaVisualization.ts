import { useCallback, useState, useEffect, useRef } from 'react';
import type { Node, Edge, Connection, ReactFlowInstance } from 'reactflow';
import { addEdge } from 'reactflow';
import type { NautobotNodeData, NautobotEdgeData } from '../types/schema';
import { globalAutoLayout } from '../utils/layout/autoLayout';
import { demoNodes, demoEdges } from '../utils/demoData';
import { useDiscoverSchema } from './useSchema';
import { transformSchemaToGraph } from '../utils/schemaTransformer';
import { isCoreNode } from '../utils/coreNodesConfig';

export function useSchemaVisualization() {
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [layoutAlgorithm, setLayoutAlgorithm] = useState<'dagre' | 'hierarchical' | 'circular' | 'force' | 'elk'>('dagre');
  const [isAutoLayoutEnabled, setIsAutoLayoutEnabled] = useState(true);
  const [visibleApps, setVisibleApps] = useState(new Set(['dcim', 'ipam', 'circuits']));
  const [showOnlyCoreNodes, setShowOnlyCoreNodes] = useState(true);
  const [connectionMode, setConnectionMode] = useState<'demo' | 'live'>('live');
  const [transformationError, setTransformationError] = useState<string | null>(null);

  // Ref to track component mount status for preventing memory leaks
  const isMountedRef = useRef(true);

  // API integration - conditionally enabled based on connection mode
  const { data: schemaResponse, isLoading: apiLoading, error: apiError } = useDiscoverSchema({
    enabled: connectionMode === 'live',
    retry: 2 // Reduced retries for UI responsiveness
  });

  const loadDemoData = useCallback(async () => {
    try {
      console.log('Loading demo data...');
      if (!isMountedRef.current) return { nodes: [], edges: [] };

      setIsLoading(true);
      setTransformationError(null);

      // Return demo data immediately for testing
      try {
        setIsLoading(false);
        console.log('Demo data loaded, applying layout...');
        // Apply initial layout if auto layout is enabled
        const layoutedNodes = isAutoLayoutEnabled ? applyInitialLayout(demoNodes, demoEdges) : demoNodes;
        console.log('Demo data processed:', { nodeCount: layoutedNodes.length, edgeCount: demoEdges.length });
        return { nodes: layoutedNodes, edges: demoEdges };
      } catch (error) {
        console.error('Error processing demo data:', error);
        if (isMountedRef.current) {
          setTransformationError('Failed to load demo data');
          setIsLoading(false);
        }
        throw error;
      }
    } catch (error) {
      console.error('Error in loadDemoData:', error);
      if (isMountedRef.current) {
        setIsLoading(false);
        setTransformationError('Failed to load demo data');
      }
      return { nodes: [], edges: [] };
    }
  }, [isAutoLayoutEnabled]);

  const applyInitialLayout = useCallback((nodes: Node<NautobotNodeData>[], edges: Edge<NautobotEdgeData>[]) => {
    // Apply a simple grid layout for initial positioning to avoid overlaps
    const gridSize = Math.ceil(Math.sqrt(nodes.length));
    const spacing = 140; // Reduced from 200px (30% reduction)

    return nodes.map((node, index) => ({
      ...node,
      position: {
        x: (index % gridSize) * spacing + 100,
        y: Math.floor(index / gridSize) * spacing + 100
      }
    }));
  }, []);

  const filteredNodes = useCallback((nodes: Node<NautobotNodeData>[]) => {
    console.log('=== NODE FILTERING DEBUG ===');
    console.log('Filtering nodes:', {
      total: nodes.length,
      visibleApps: Array.from(visibleApps),
      showOnlyCoreNodes
    });

    // Log all nodes being processed with their app and model names
    console.log('=== ALL NODES BEING PROCESSED ===');
    nodes.forEach((node, index) => {
      const app = (node.data as any)?.app;
      const modelName = (node.data as any)?.name;
      const modelId = (node.data as any)?.id;
      console.log(`Node ${index}: id="${node.id}", app="${app}", name="${modelName}", dataId="${modelId}"`);
    });

    // Group nodes by app for overview
    const nodesByApp = new Map<string, number>();
    nodes.forEach(node => {
      const app = (node.data as any)?.app || 'unknown';
      nodesByApp.set(app, (nodesByApp.get(app) || 0) + 1);
    });
    console.log('=== NODES BY APP ===');
    nodesByApp.forEach((count, app) => {
      console.log(`${app}: ${count} nodes`);
    });

    const filtered = nodes.filter(node => {
      const app = (node.data as any)?.app;
      const modelName = (node.data as any)?.name;

      // Log every node's filtering process
      console.log(`\n=== FILTERING NODE: ${node.id} ===`);
      console.log(`App: "${app}", Model: "${modelName}"`);

      // First filter: App visibility
      const appVisible = !app || visibleApps.has(app);
      console.log(`App visible: ${appVisible} (app="${app}", visibleApps=${JSON.stringify(Array.from(visibleApps))})`);
      if (!appVisible) {
        console.log('❌ Filtered out - app not visible');
        return false;
      }

      // Second filter: Core nodes only (if enabled)
      if (showOnlyCoreNodes && app && modelName) {
        const isCore = isCoreNode(app, modelName);
        console.log(`Core node check: ${isCore} (app="${app}", model="${modelName}")`);
        if (!isCore) {
          console.log('❌ Filtered out - not a core node');
          return false;
        }
      }

      console.log('✅ Node passes all filters');
      return true;
    });

    console.log('=== FILTERING RESULTS ===');
    console.log(`Original: ${nodes.length} nodes`);
    console.log(`Filtered: ${filtered.length} nodes`);
    console.log(`Removed: ${nodes.length - filtered.length} nodes`);

    // Log the final filtered nodes
    console.log('=== FINAL FILTERED NODES ===');
    filtered.forEach((node, index) => {
      const app = (node.data as any)?.app;
      const modelName = (node.data as any)?.name;
      console.log(`Final ${index}: "${node.id}" (${app}.${modelName})`);
    });

    return filtered;
  }, [visibleApps, showOnlyCoreNodes]);

  const filteredEdges = useCallback((nodes: Node<NautobotNodeData>[], allEdges: Edge<NautobotEdgeData>[]) => {
    const visibleNodeIds = new Set(nodes.map(node => node.id));
    return allEdges.filter(edge =>
      visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    );
  }, []);

  const toggleAppVisibility = useCallback((app: string) => {
    setVisibleApps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(app)) {
        newSet.delete(app);
      } else {
        newSet.add(app);
      }
      return newSet;
    });
  }, []);

  const toggleCoreNodesOnly = useCallback(() => {
    setShowOnlyCoreNodes(prev => !prev);
  }, []);

  const onConnect = useCallback(
    (params: Connection, edges: Edge<NautobotEdgeData>[], setEdges: (edges: Edge<NautobotEdgeData>[] | ((prev: Edge<NautobotEdgeData>[]) => Edge<NautobotEdgeData>[])) => void) => {
      console.log('Creating new connection:', params);

      const newEdge: Edge<NautobotEdgeData> = {
        ...params,
        id: `${params.source}-${params.target}`,
        type: 'simplified',
        animated: false,
        data: {
          id: `${params.source}-${params.target}`,
          fromModel: params.source || '',
          toModel: params.target || '',
          type: 'custom_relationship',
          fieldName: 'custom',
          relationshipType: 'custom_relationship',
          sourceModel: params.source || '',
          targetModel: params.target || '',
          label: 'connected to',
          isRequired: false,
          color: '#94A3B8'
        }
      };

      setEdges(eds => addEdge(newEdge, eds));
    },
    []
  );

  const onFitView = useCallback(() => {
    console.log('Fitting view...');
    if (reactFlowInstance) {
      reactFlowInstance.fitView({
        padding: 0.2,
        includeHiddenNodes: false,
        minZoom: 0.1,
        maxZoom: 2,
        duration: 800
      });
    }
  }, [reactFlowInstance]);

  const onLayoutChange = useCallback(async (
    newAlgorithm: 'dagre' | 'hierarchical' | 'circular' | 'force' | 'elk',
    nodes: Node<NautobotNodeData>[],
    edges: Edge<NautobotEdgeData>[],
    setNodes: (nodes: Node<NautobotNodeData>[] | ((prev: Node<NautobotNodeData>[]) => Node<NautobotNodeData>[])) => void
  ) => {
    try {
      if (!isMountedRef.current) return;

      setLayoutAlgorithm(newAlgorithm);
      setTransformationError(null);

      if (isAutoLayoutEnabled && nodes.length > 0) {
        console.log(`Applying ${newAlgorithm} layout...`);
        setIsLoading(true);

        try {
          const result = await globalAutoLayout.applyLayout(nodes, edges, {
            algorithm: newAlgorithm,
            nodeSpacing: 100, // Reduced from 150px (33% reduction)
            rankSpacing: 70   // Reduced from 100px (30% reduction)
          });

          if (!isMountedRef.current) return;

          const layoutedNodes = result.nodes;
          setNodes(layoutedNodes);

          // Removed automatic fitView to prevent zoom bouncing
          // Users can manually use Fit View button if needed
          // setTimeout(() => {
          //   if (reactFlowInstance) {
          //     reactFlowInstance.fitView({ padding: 0.1, duration: 500 });
          //   }
          // }, 100);
        } catch (error) {
          console.error('Layout failed:', error);
          if (isMountedRef.current) {
            setTransformationError(`Layout ${newAlgorithm} failed - using previous layout`);
          }
        } finally {
          if (isMountedRef.current) {
            setIsLoading(false);
          }
        }
      }
    } catch (error) {
      console.error('Error in onLayoutChange:', error);
      if (isMountedRef.current) {
        setIsLoading(false);
        setTransformationError('Layout operation failed');
      }
    }
  }, [isAutoLayoutEnabled]);

  const toggleAutoLayout = useCallback(() => {
    setIsAutoLayoutEnabled(prev => !prev);
  }, []);

  // New loadSchemaData function that works with both demo and API data
  const loadSchemaData = useCallback(async (): Promise<{ nodes: Node<NautobotNodeData>[], edges: Edge<NautobotEdgeData>[] }> => {
    try {
      console.log('loadSchemaData called:', { connectionMode, hasSchemaResponse: !!schemaResponse, isMounted: isMountedRef.current });

      if (!isMountedRef.current) return { nodes: [], edges: [] };

      setTransformationError(null);

      if (connectionMode === 'demo') {
        console.log('Using demo mode');
        return await loadDemoData();
      }

      // For live mode, we return transformed API data or fall back to demo data
      if (schemaResponse) {
        try {
          console.log('=== LIVE API DATA PROCESSING ===');
          console.log('Transforming API schema data...', {
            schemaResponseKeys: Object.keys(schemaResponse),
            hasSchemaGraph: !!(schemaResponse as any).schema_graph,
            nodeCount: (schemaResponse as any).schema_graph?.nodes?.length || schemaResponse.nodes?.length || 0
          });

          console.log('Raw schema response structure:', {
            type: typeof schemaResponse,
            keys: Object.keys(schemaResponse),
            hasNodes: !!(schemaResponse as any).nodes,
            hasSchemaGraph: !!(schemaResponse as any).schema_graph,
            schemaGraphType: typeof (schemaResponse as any).schema_graph,
          });

          const { nodes, edges } = transformSchemaToGraph(schemaResponse);
          console.log('=== TRANSFORM COMPLETE ===');
          console.log('Transform result:', { nodeCount: nodes.length, edgeCount: edges.length });

          if (!isMountedRef.current) return { nodes: [], edges: [] };

          const layoutedNodes = isAutoLayoutEnabled ? applyInitialLayout(nodes, edges) : nodes;
          console.log('After layout:', { layoutedNodeCount: layoutedNodes.length });

          // Check if transformation was successful
          if (nodes.length === 0 && ((schemaResponse as any).schema_graph?.nodes?.length > 0 || schemaResponse.nodes?.length > 0)) {
            console.warn('Schema transformation returned empty nodes, falling back to demo data');
            if (isMountedRef.current) {
              setTransformationError('API data transformation failed, using demo data');
            }
            return await loadDemoData();
          }

          console.log('Returning API data:', { finalNodeCount: layoutedNodes.length, finalEdgeCount: edges.length });
          return { nodes: layoutedNodes, edges };
        } catch (transformError) {
          console.error('Error transforming API schema:', transformError);
          if (isMountedRef.current) {
            setTransformationError('API data transformation failed, using demo data');
          }
          // Graceful fallback to demo data when transformation fails
          return await loadDemoData();
        }
      }

      // Return empty data if API data not available yet
      console.log('No schema response available yet, returning empty data');
      return { nodes: [], edges: [] };
    } catch (error) {
      console.error('Error in loadSchemaData:', error);
      if (isMountedRef.current) {
        setTransformationError('Failed to load schema data');
      }
      // Ultimate fallback to demo data
      try {
        return await loadDemoData();
      } catch (demoError) {
        console.error('Failed to load demo data as fallback:', demoError);
        return { nodes: [], edges: [] };
      }
    }
  }, [connectionMode, loadDemoData, schemaResponse, isAutoLayoutEnabled, applyInitialLayout]);


  // Combined loading state
  const combinedLoading = isLoading || (connectionMode === 'live' && apiLoading);

  const toggleConnectionMode = useCallback(() => {
    if (!isMountedRef.current) return;
    setConnectionMode(prev => prev === 'demo' ? 'live' : 'demo');
    setTransformationError(null); // Clear errors when switching modes
  }, []);

  // Cleanup effect to prevent memory leaks
  useEffect(() => {
    isMountedRef.current = true; // Ensure it's true when component mounts/remounts
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    reactFlowInstance,
    setReactFlowInstance,
    isLoading: combinedLoading,
    setIsLoading,
    layoutAlgorithm,
    isAutoLayoutEnabled,
    visibleApps,
    showOnlyCoreNodes,
    loadDemoData,
    loadSchemaData, // New unified data loading function
    filteredNodes,
    filteredEdges,
    toggleAppVisibility,
    toggleCoreNodesOnly,
    onConnect,
    onFitView,
    onLayoutChange,
    toggleAutoLayout,
    // API integration values
    connectionMode,
    toggleConnectionMode,
    apiError,
    apiLoading,
    // Error handling
    transformationError
  };
}