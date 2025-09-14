import { useCallback, useState } from 'react';
import type { Node, Edge, Connection, ReactFlowInstance } from 'reactflow';
import { addEdge } from 'reactflow';
import type { NautobotNodeData, NautobotEdgeData } from '../types/schema';
import { globalAutoLayout } from '../utils/layout/autoLayout';
import { demoNodes, demoEdges } from '../utils/demoData';

export function useSchemaVisualization() {
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [layoutAlgorithm, setLayoutAlgorithm] = useState<'dagre' | 'hierarchical' | 'circular' | 'force' | 'elk'>('dagre');
  const [isAutoLayoutEnabled, setIsAutoLayoutEnabled] = useState(true);
  const [visibleApps, setVisibleApps] = useState(new Set(['dcim', 'circuits', 'ipam']));

  const loadDemoData = useCallback(() => {
    console.log('Loading demo data...');
    setIsLoading(true);

    // Simulate API loading delay
    return new Promise<{ nodes: Node<NautobotNodeData>[], edges: Edge<NautobotEdgeData>[] }>((resolve) => {
      setTimeout(() => {
        setIsLoading(false);
        resolve({ nodes: demoNodes, edges: demoEdges });
      }, 500);
    });
  }, []);

  const filteredNodes = useCallback((nodes: Node<NautobotNodeData>[]) => {
    return nodes.filter(node => {
      const app = (node.data as any)?.app;
      return !app || visibleApps.has(app);
    });
  }, [visibleApps]);

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
    setLayoutAlgorithm(newAlgorithm);

    if (isAutoLayoutEnabled && nodes.length > 0) {
      console.log(`Applying ${newAlgorithm} layout...`);
      setIsLoading(true);

      try {
        const result = await globalAutoLayout.applyLayout(nodes, edges, {
          algorithm: newAlgorithm,
          nodeSpacing: 150,
          rankSpacing: 100
        });
        const layoutedNodes = result.nodes;

        setNodes(layoutedNodes);

        setTimeout(() => {
          if (reactFlowInstance) {
            reactFlowInstance.fitView({ padding: 0.1, duration: 500 });
          }
        }, 100);
      } catch (error) {
        console.error('Layout failed:', error);
      } finally {
        setIsLoading(false);
      }
    }
  }, [isAutoLayoutEnabled, reactFlowInstance]);

  const toggleAutoLayout = useCallback(() => {
    setIsAutoLayoutEnabled(prev => !prev);
  }, []);

  return {
    reactFlowInstance,
    setReactFlowInstance,
    isLoading,
    setIsLoading,
    layoutAlgorithm,
    isAutoLayoutEnabled,
    visibleApps,
    loadDemoData,
    filteredNodes,
    filteredEdges,
    toggleAppVisibility,
    onConnect,
    onFitView,
    onLayoutChange,
    toggleAutoLayout
  };
}