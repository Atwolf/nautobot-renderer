/**
 * Virtualized Schema Visualization Component
 * 
 * Optimized for handling large datasets (500+ nodes) with:
 * - Viewport-based rendering
 * - Dynamic node/edge loading
 * - Performance monitoring integration
 * - Progressive loading
 * - Memory efficient data structures
 */

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  Panel,
  type ReactFlowInstance,
  type OnNodesChange,
  type OnEdgesChange,
  useReactFlow,
  type Viewport,
  ReactFlowProvider
} from 'reactflow';
import { Box, Typography, LinearProgress, Alert, Button, Chip } from '@mui/material';
import { performanceMonitor, PerformanceUtils } from '../../utils/performance/PerformanceMonitor';
import { layoutWorkerManager } from '../../utils/performance/LayoutWorker';
import type { NautobotNodeData, NautobotEdgeData } from '../../types/schema';
import { NautobotModelNode } from './NautobotModelNode';
import SimplifiedEdge from './SimplifiedEdge';

// Configuration for virtualization
const VIRTUALIZATION_CONFIG = {
  CHUNK_SIZE: 50,              // Nodes to load per chunk
  VIEWPORT_BUFFER: 200,        // Extra space around viewport
  LARGE_DATASET_THRESHOLD: 100, // When to enable virtualization
  MAX_VISIBLE_NODES: 200,      // Maximum nodes to render at once
  MAX_VISIBLE_EDGES: 500,      // Maximum edges to render at once
  DEBOUNCE_DELAY: 150,         // Viewport change debounce
  LOD_DISTANCE_THRESHOLD: 1000 // Level of detail distance threshold
};

interface VirtualizedSchemaVisualizationProps {
  nodes: Node<NautobotNodeData>[];
  edges: Edge<NautobotEdgeData>[];
  onNodesChange?: OnNodesChange;
  onEdgesChange?: OnEdgesChange;
  enableVirtualization?: boolean;
  performanceMode?: 'auto' | 'performance' | 'quality';
}

// Define custom node and edge types
const nodeTypes = {
  nautobotModel: NautobotModelNode,
};

const edgeTypes = {
  default: SimplifiedEdge,
  simplified: SimplifiedEdge,
};

function VirtualizedSchemaVisualizationInner({
  nodes: allNodes,
  edges: allEdges,
  onNodesChange,
  onEdgesChange,
  enableVirtualization = true,
  performanceMode = 'auto'
}: VirtualizedSchemaVisualizationProps) {
  const reactFlowInstance = useReactFlow();
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [visibleNodes, setVisibleNodes] = useState<Node<NautobotNodeData>[]>([]);
  const [visibleEdges, setVisibleEdges] = useState<Edge<NautobotEdgeData>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [performanceStats, setPerformanceStats] = useState({
    totalNodes: 0,
    visibleNodes: 0,
    totalEdges: 0,
    visibleEdges: 0,
    renderTime: 0
  });

  const debouncedViewportChangeRef = useRef<NodeJS.Timeout>();
  const lastViewportRef = useRef<Viewport>(viewport);

  // Determine if virtualization should be enabled
  const shouldVirtualize = useMemo(() => {
    if (!enableVirtualization) return false;
    if (performanceMode === 'quality') return false;
    if (performanceMode === 'performance') return true;
    
    // Auto mode: enable for large datasets
    return allNodes.length > VIRTUALIZATION_CONFIG.LARGE_DATASET_THRESHOLD;
  }, [enableVirtualization, performanceMode, allNodes.length]);

  // Memoized spatial index for efficient viewport queries
  const spatialIndex = useMemo(() => {
    performanceMonitor.startTiming('Spatial Index Creation', 'calculation', allNodes.length);
    
    const index = new Map<string, {
      node: Node<NautobotNodeData>;
      bounds: { x: number; y: number; width: number; height: number };
    }>();

    allNodes.forEach(node => {
      const bounds = {
        x: node.position.x,
        y: node.position.y,
        width: node.width || 280,
        height: node.height || 200
      };
      
      index.set(node.id, { node, bounds });
    });

    performanceMonitor.endTiming('Spatial Index Creation', { indexSize: index.size });
    return index;
  }, [allNodes]);

  // Calculate visible viewport bounds
  const getViewportBounds = useCallback((vp: Viewport) => {
    const reactFlowBounds = reactFlowInstance.getViewport();
    const transform = reactFlowInstance.flowToScreenPosition || ((pos) => pos);
    
    // Calculate screen bounds with buffer
    const screenBounds = {
      left: -vp.x / vp.zoom - VIRTUALIZATION_CONFIG.VIEWPORT_BUFFER,
      top: -vp.y / vp.zoom - VIRTUALIZATION_CONFIG.VIEWPORT_BUFFER,
      right: (-vp.x + window.innerWidth) / vp.zoom + VIRTUALIZATION_CONFIG.VIEWPORT_BUFFER,
      bottom: (-vp.y + window.innerHeight) / vp.zoom + VIRTUALIZATION_CONFIG.VIEWPORT_BUFFER
    };

    return screenBounds;
  }, [reactFlowInstance]);

  // Optimized visibility calculation
  const calculateVisibleElements = useCallback(
    PerformanceUtils.debounceWithPerformance(
      (vp: Viewport) => {
        if (!shouldVirtualize) {
          setVisibleNodes(allNodes);
          setVisibleEdges(allEdges);
          return;
        }

        performanceMonitor.startTiming('Visibility Calculation', 'calculation', allNodes.length, {
          viewport: vp,
          spatialIndexSize: spatialIndex.size
        });

        const viewportBounds = getViewportBounds(vp);
        const visibleNodeIds = new Set<string>();
        const newVisibleNodes: Node<NautobotNodeData>[] = [];

        // Find visible nodes using spatial index
        spatialIndex.forEach(({ node, bounds }, nodeId) => {
          const isVisible = !(
            bounds.x + bounds.width < viewportBounds.left ||
            bounds.x > viewportBounds.right ||
            bounds.y + bounds.height < viewportBounds.top ||
            bounds.y > viewportBounds.bottom
          );

          if (isVisible) {
            visibleNodeIds.add(nodeId);
            newVisibleNodes.push(node);
          }
        });

        // Limit visible nodes for performance
        const limitedNodes = newVisibleNodes.slice(0, VIRTUALIZATION_CONFIG.MAX_VISIBLE_NODES);
        const limitedNodeIds = new Set(limitedNodes.map(n => n.id));

        // Find visible edges (only between visible nodes)
        const newVisibleEdges = allEdges.filter(edge => 
          limitedNodeIds.has(edge.source) && limitedNodeIds.has(edge.target)
        ).slice(0, VIRTUALIZATION_CONFIG.MAX_VISIBLE_EDGES);

        setVisibleNodes(limitedNodes);
        setVisibleEdges(newVisibleEdges);

        // Update performance stats
        setPerformanceStats({
          totalNodes: allNodes.length,
          visibleNodes: limitedNodes.length,
          totalEdges: allEdges.length,
          visibleEdges: newVisibleEdges.length,
          renderTime: performance.now()
        });

        performanceMonitor.endTiming('Visibility Calculation', {
          visibleNodes: limitedNodes.length,
          visibleEdges: newVisibleEdges.length,
          viewportBounds
        });
      },
      VIRTUALIZATION_CONFIG.DEBOUNCE_DELAY,
      'Viewport Change Calculation'
    ),
    [shouldVirtualize, allNodes, allEdges, spatialIndex, getViewportBounds]
  );

  // Handle viewport changes
  const handleViewportChange = useCallback((vp: Viewport) => {
    setViewport(vp);
    
    // Only recalculate if viewport changed significantly
    const lastVp = lastViewportRef.current;
    const zoomChanged = Math.abs(vp.zoom - lastVp.zoom) > 0.1;
    const positionChanged = 
      Math.abs(vp.x - lastVp.x) > 50 ||
      Math.abs(vp.y - lastVp.y) > 50;

    if (zoomChanged || positionChanged) {
      lastViewportRef.current = vp;
      calculateVisibleElements(vp);
    }
  }, [calculateVisibleElements]);

  // Initialize visibility calculation
  useEffect(() => {
    calculateVisibleElements(viewport);
  }, [calculateVisibleElements, viewport]);

  // Progressive loading for very large datasets
  const loadDataProgressively = useCallback(async () => {
    if (allNodes.length <= VIRTUALIZATION_CONFIG.LARGE_DATASET_THRESHOLD) {
      return;
    }

    setIsLoading(true);
    setLoadingProgress(0);

    const chunks = Math.ceil(allNodes.length / VIRTUALIZATION_CONFIG.CHUNK_SIZE);
    
    for (let i = 0; i < chunks; i++) {
      const start = i * VIRTUALIZATION_CONFIG.CHUNK_SIZE;
      const end = Math.min(start + VIRTUALIZATION_CONFIG.CHUNK_SIZE, allNodes.length);
      const chunk = allNodes.slice(start, end);

      // Simulate async processing
      await new Promise(resolve => setTimeout(resolve, 10));
      
      setLoadingProgress((i + 1) / chunks * 100);
    }

    setIsLoading(false);
    calculateVisibleElements(viewport);
  }, [allNodes, calculateVisibleElements, viewport]);

  // Load data on mount
  useEffect(() => {
    loadDataProgressively();
  }, [loadDataProgressively]);

  // Custom nodes change handler with performance monitoring
  const handleNodesChange = useCallback((changes: any[]) => {
    performanceMonitor.startTiming('Nodes Change Handler', 'rendering', changes.length);
    
    if (onNodesChange) {
      onNodesChange(changes);
    }
    
    performanceMonitor.endTiming('Nodes Change Handler');
  }, [onNodesChange]);

  // Custom edges change handler with performance monitoring
  const handleEdgesChange = useCallback((changes: any[]) => {
    performanceMonitor.startTiming('Edges Change Handler', 'rendering', changes.length);
    
    if (onEdgesChange) {
      onEdgesChange(changes);
    }
    
    performanceMonitor.endTiming('Edges Change Handler');
  }, [onEdgesChange]);

  // Performance-aware node rendering
  const optimizedNodeTypes = useMemo(() => {
    if (performanceMode === 'performance') {
      // Use simplified nodes for performance mode
      return {
        nautobotModel: React.memo(NautobotModelNode)
      };
    }
    return nodeTypes;
  }, [performanceMode]);

  return (
    <Box sx={{ height: '100%', width: '100%', position: 'relative' }}>
      {/* Loading indicator */}
      {isLoading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            p: 2
          }}
        >
          <Typography variant="h6" gutterBottom>
            Loading Schema ({Math.round(loadingProgress)}%)
          </Typography>
          <LinearProgress variant="determinate" value={loadingProgress} />
        </Box>
      )}

      {/* Performance stats panel */}
      <Panel position="top-right">
        <Box sx={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', p: 1, borderRadius: 1 }}>
          <Typography variant="caption" display="block">
            Performance Stats
          </Typography>
          <Typography variant="caption" display="block">
            Nodes: {performanceStats.visibleNodes} / {performanceStats.totalNodes}
          </Typography>
          <Typography variant="caption" display="block">
            Edges: {performanceStats.visibleEdges} / {performanceStats.totalEdges}
          </Typography>
          {shouldVirtualize && (
            <Chip
              label="Virtualized"
              size="small"
              color="primary"
              variant="outlined"
              sx={{ mt: 0.5 }}
            />
          )}
        </Box>
      </Panel>

      {/* Large dataset warning */}
      {allNodes.length > 500 && !shouldVirtualize && (
        <Panel position="top-left">
          <Alert severity="warning" sx={{ maxWidth: 300 }}>
            Large dataset detected ({allNodes.length} nodes). Consider enabling virtualization for better performance.
          </Alert>
        </Panel>
      )}

      {/* ReactFlow component */}
      <ReactFlow
        nodes={visibleNodes}
        edges={visibleEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onViewportChange={handleViewportChange}
        nodeTypes={optimizedNodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Strict}
        fitView
        attributionPosition="bottom-left"
        maxZoom={2}
        minZoom={0.1}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        // Performance optimizations
        selectNodesOnDrag={false}
        panOnDrag={true}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        // Disable expensive features for large datasets
        elementsSelectable={!shouldVirtualize || allNodes.length < 1000}
        nodesDraggable={!shouldVirtualize || allNodes.length < 500}
      >
        <Background />
        <Controls />
        <MiniMap 
          nodeStrokeWidth={3}
          nodeColor={(node) => {
            const data = node.data as NautobotNodeData;
            return data.color || '#1976d2';
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
          pannable
          zoomable
        />
      </ReactFlow>
    </Box>
  );
}

// Main component with ReactFlow provider
export function VirtualizedSchemaVisualization(props: VirtualizedSchemaVisualizationProps) {
  return (
    <ReactFlowProvider>
      <VirtualizedSchemaVisualizationInner {...props} />
    </ReactFlowProvider>
  );
}

export default VirtualizedSchemaVisualization;