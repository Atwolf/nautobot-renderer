import { useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  Panel,
  type Connection,
} from 'reactflow';
import { ArrowPathIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import type { NautobotNodeData, NautobotEdgeData } from '../../types/schema';
import { NautobotModelNode } from './NautobotModelNode';
import SimplifiedEdge from './SimplifiedEdge';
import { useSchemaVisualization } from '../../hooks/useSchemaVisualization';

// Define custom node and edge types
const nodeTypes = {
  nautobotModel: NautobotModelNode,
};

const edgeTypes = {
  default: SimplifiedEdge,
  simplified: SimplifiedEdge,
};

export function SchemaVisualizationSimplified() {
  const [nodes, setNodes, onNodesChange] = useNodesState<NautobotNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<NautobotEdgeData>([]);

  const {
    setReactFlowInstance,
    isLoading,
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
  } = useSchemaVisualization();

  // Load demo data on mount
  useEffect(() => {
    loadDemoData().then(({ nodes: demoNodes, edges: demoEdges }) => {
      setNodes(demoNodes);
      setEdges(demoEdges);
    });
  }, [loadDemoData, setNodes, setEdges]);

  // Filter nodes and edges based on visible apps
  const displayNodes = useMemo(() => filteredNodes(nodes), [filteredNodes, nodes]);
  const displayEdges = useMemo(() => filteredEdges(displayNodes, edges), [filteredEdges, displayNodes, edges]);

  const handleConnect = useCallback((connection: Connection) => {
    onConnect(connection, edges, setEdges);
  }, [onConnect, edges, setEdges]);

  const handleLayoutChange = useCallback((newAlgorithm: 'dagre' | 'hierarchical' | 'circular' | 'force' | 'elk') => {
    onLayoutChange(newAlgorithm, displayNodes, displayEdges, setNodes);
  }, [onLayoutChange, displayNodes, displayEdges, setNodes]);

  const onResetLayout = useCallback(() => {
    loadDemoData().then(({ nodes: demoNodes, edges: demoEdges }) => {
      setNodes(demoNodes);
      setEdges(demoEdges);
      setTimeout(() => {
        handleLayoutChange(layoutAlgorithm);
      }, 100);
    });
  }, [loadDemoData, setNodes, setEdges, handleLayoutChange, layoutAlgorithm]);

  const reactFlowProps = useMemo(() => ({
    nodes: displayNodes,
    edges: displayEdges,
    onNodesChange,
    onEdgesChange,
    onConnect: handleConnect,
    nodeTypes,
    edgeTypes,
    connectionMode: ConnectionMode.Strict,
    onInit: setReactFlowInstance,
    fitView: true,
    attributionPosition: 'bottom-left' as const,
    minZoom: 0.1,
    maxZoom: 2,
    defaultViewport: { x: 0, y: 0, zoom: 0.8 },
    snapToGrid: true,
    snapGrid: [20, 20] as [number, number],
    deleteKeyCode: 'Delete',
    multiSelectionKeyCode: 'Shift',
    selectionKeyCode: null,
    panOnDrag: true,
    panOnScroll: false,
    zoomOnScroll: true,
    zoomOnPinch: true,
    zoomOnDoubleClick: true,
    selectNodesOnDrag: false,
    preventScrolling: true,
    nodesDraggable: true,
    nodesConnectable: true,
    elementsSelectable: true,
  }), [displayNodes, displayEdges, onNodesChange, onEdgesChange, handleConnect, setReactFlowInstance]);

  return (
    <div className="h-full w-full relative overflow-hidden">
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            <div className="text-secondary-600 font-medium">Loading schema visualization...</div>
          </div>
        </div>
      )}

      <ReactFlow {...reactFlowProps}>
        {/* Controls Panel */}
        <Panel position="top-left" className="bg-white/90 backdrop-blur-md rounded-lg shadow-soft p-4 border border-secondary-200/50">
          <div className="flex flex-col space-y-3">
            <div className="text-sm font-semibold text-secondary-900 border-b border-secondary-200 pb-2">
              Layout Controls
            </div>

            <div className="flex flex-wrap gap-2">
              {(['dagre', 'hierarchical', 'circular', 'force', 'elk'] as const).map((algo) => (
                <button
                  key={algo}
                  onClick={() => handleLayoutChange(algo)}
                  className={`px-3 py-1 text-xs rounded-md border font-medium transition-colors ${
                    layoutAlgorithm === algo
                      ? 'bg-primary-50 border-primary-200 text-primary-700'
                      : 'bg-white border-secondary-200 text-secondary-700 hover:bg-secondary-50'
                  }`}
                >
                  {algo.charAt(0).toUpperCase() + algo.slice(1)}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={isAutoLayoutEnabled}
                  onChange={toggleAutoLayout}
                  className="rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-secondary-700">Auto Layout</span>
              </label>
            </div>
          </div>
        </Panel>

        {/* App Filter Panel */}
        <Panel position="top-right" className="bg-white/90 backdrop-blur-md rounded-lg shadow-soft p-4 border border-secondary-200/50">
          <div className="flex flex-col space-y-3">
            <div className="text-sm font-semibold text-secondary-900 border-b border-secondary-200 pb-2">
              App Filter
            </div>

            <div className="flex flex-col space-y-2">
              {['dcim', 'circuits', 'ipam', 'tenancy', 'users', 'extras'].map((app) => (
                <label key={app} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={visibleApps.has(app)}
                    onChange={() => toggleAppVisibility(app)}
                    className="rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-secondary-700 capitalize">{app}</span>
                </label>
              ))}
            </div>
          </div>
        </Panel>

        {/* Action Buttons */}
        <Panel position="bottom-left" className="flex space-x-2">
          <button
            onClick={onFitView}
            className="btn-nautobot btn-nautobot-base btn-nautobot-ghost"
            title="Fit View"
          >
            <MagnifyingGlassIcon className="w-4 h-4" />
          </button>

          <button
            onClick={onResetLayout}
            className="btn-nautobot btn-nautobot-base btn-nautobot-ghost"
            title="Reset Layout"
          >
            <ArrowPathIcon className="w-4 h-4" />
          </button>
        </Panel>

        {/* Schema Stats */}
        <Panel position="bottom-right" className="bg-white/90 backdrop-blur-md rounded-lg shadow-soft p-3 border border-secondary-200/50">
          <div className="text-xs text-secondary-600 space-y-1">
            <div>Nodes: <span className="font-medium text-secondary-900">{displayNodes.length}</span></div>
            <div>Edges: <span className="font-medium text-secondary-900">{displayEdges.length}</span></div>
            <div>Apps: <span className="font-medium text-secondary-900">{visibleApps.size}</span></div>
          </div>
        </Panel>

        <Controls
          showZoom={true}
          showFitView={false}
          showInteractive={true}
          position="bottom-center"
        />

        <MiniMap
          nodeColor={(node) => (node.data as NautobotNodeData)?.color || '#64748B'}
          nodeStrokeWidth={3}
          zoomable
          pannable
          position="top-center"
          className="bg-white border border-secondary-200 rounded-lg shadow-soft"
        />

        <Background
          color="#E2E8F0"
          gap={20}
          size={1}
          variant="dots"
        />
      </ReactFlow>
    </div>
  );
}