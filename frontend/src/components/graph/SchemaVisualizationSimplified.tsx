import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { ArrowPathIcon, MagnifyingGlassIcon, Squares2X2Icon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { NautobotNodeData, NautobotEdgeData } from '../../types/schema';
import { NautobotModelNode } from './NautobotModelNode';
import SimplifiedEdge from './SimplifiedEdge';
import { useSchemaVisualization } from '../../hooks/useSchemaVisualization';
import { coreNodesConfig, getCoreNodesStats } from '../../utils/coreNodesConfig';

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
  const [availableApps, setAvailableApps] = useState<string[]>([]);
  const [showCoreNodesInfo, setShowCoreNodesInfo] = useState(false);

  const {
    setReactFlowInstance,
    isLoading,
    layoutAlgorithm,
    isAutoLayoutEnabled,
    visibleApps,
    showOnlyCoreNodes,
    loadDemoData,
    loadSchemaData,
    filteredNodes,
    filteredEdges,
    toggleAppVisibility,
    toggleCoreNodesOnly,
    onConnect,
    onFitView,
    onLayoutChange,
    toggleAutoLayout,
    connectionMode,
    toggleConnectionMode,
    apiError,
    apiLoading,
    transformationError
  } = useSchemaVisualization();

  // Load schema data (demo or live API) on mount and when connection mode changes
  useEffect(() => {
    console.log('Component effect triggered:', { connectionMode, apiLoading });
    loadSchemaData().then(({ nodes: schemaNodes, edges: schemaEdges }) => {
      console.log('Component received data:', { nodeCount: schemaNodes.length, edgeCount: schemaEdges.length });
      setNodes(schemaNodes);
      setEdges(schemaEdges);
      
      // Extract available apps from nodes for persistent controls
      const apps = Array.from(new Set(schemaNodes.map(n => n.data?.app).filter(Boolean)));
      setAvailableApps(apps);
    });
  }, [loadSchemaData, connectionMode, apiLoading]);

  // Filter nodes and edges based on visible apps
  const displayNodes = useMemo(() => filteredNodes(nodes), [filteredNodes, nodes]);
  const displayEdges = useMemo(() => filteredEdges(displayNodes, edges), [filteredEdges, displayNodes, edges]);
  
  // Get core nodes statistics
  const coreNodesStats = useMemo(() => getCoreNodesStats(nodes), [nodes]);

  const handleConnect = useCallback((connection: Connection) => {
    onConnect(connection, edges, setEdges);
  }, [onConnect, edges]);

  const handleLayoutChange = useCallback((newAlgorithm: 'dagre' | 'hierarchical' | 'circular' | 'force' | 'elk') => {
    onLayoutChange(newAlgorithm, displayNodes, displayEdges, setNodes);
  }, [onLayoutChange, displayNodes, displayEdges]);

  // Apply proper layout algorithm after initial grid positioning
  useEffect(() => {
    if (nodes.length > 0 && displayNodes.length > 0 && isAutoLayoutEnabled) {
      const timeoutId = setTimeout(() => {
        handleLayoutChange(layoutAlgorithm);
      }, 600); // Wait a bit longer for nodes to settle
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [displayNodes.length, isAutoLayoutEnabled, layoutAlgorithm, handleLayoutChange, nodes.length]);

  // Keyboard shortcut for toggling core nodes (Ctrl/Cmd + K)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        toggleCoreNodesOnly();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleCoreNodesOnly]);

  const onResetLayout = useCallback(() => {
    loadSchemaData().then(({ nodes: schemaNodes, edges: schemaEdges }) => {
      setNodes(schemaNodes);
      setEdges(schemaEdges);
      
      // Extract available apps from nodes for persistent controls
      const apps = Array.from(new Set(schemaNodes.map(n => n.data?.app).filter(Boolean)));
      setAvailableApps(apps);
      
      setTimeout(() => {
        handleLayoutChange(layoutAlgorithm);
      }, 100);
    });
  }, [loadSchemaData, setNodes, setEdges, handleLayoutChange, layoutAlgorithm]);

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
      fitView: false, // Disable automatic fitView to allow manual zoom
      attributionPosition: 'bottom-left' as const,
      minZoom: 0.1,
      maxZoom: 4, // Increase max zoom for better detail viewing
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
        {/* Schema Controls Panel */}
        <Panel position="top-left" className="m-4">
          <div className="panel-nautobot panel-nautobot-glass p-4 space-y-4 min-w-64 animate-nautobot-fade-in-left">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-secondary-900 flex items-center">
                <svg className="w-4 h-4 mr-2 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                </svg>
                Schema Controls
              </h3>
              {isLoading && (
                <div className="spinner-nautobot spinner-nautobot-sm"></div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={onFitView}
                className="btn-nautobot btn-nautobot-sm btn-nautobot-secondary hover-lift"
                disabled={isLoading}
              >
                <MagnifyingGlassIcon className="h-4 w-4 mr-2" />
                Fit View
              </button>

              <button
                onClick={onResetLayout}
                className="btn-nautobot btn-nautobot-sm btn-nautobot-ghost hover-lift"
                disabled={isLoading}
              >
                <ArrowPathIcon className="h-4 w-4 mr-2" />
                Reset Layout
              </button>

              <button
                onClick={toggleAutoLayout}
                className={`btn-nautobot btn-nautobot-sm hover-lift ${
                  isAutoLayoutEnabled ? 'btn-nautobot-primary' : 'btn-nautobot-ghost'
                }`}
                disabled={isLoading}
              >
                <Squares2X2Icon className="h-4 w-4 mr-2" />
                Auto Layout
              </button>

              <button
                onClick={toggleConnectionMode}
                className={`btn-nautobot btn-nautobot-sm hover-lift ${
                  connectionMode === 'live' ? 'btn-nautobot-success' : 'btn-nautobot-secondary'
                }`}
                disabled={isLoading}
                title={connectionMode === 'live' ? 'Switch to Demo Mode' : 'Switch to Live API'}
              >
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  connectionMode === 'live' ? 'bg-green-500' : 'bg-blue-500'
                }`}></div>
                {connectionMode === 'live' ? 'Live' : 'Demo'}
              </button>

              <button
                onClick={toggleCoreNodesOnly}
                className={`btn-nautobot btn-nautobot-sm hover-lift ${
                  showOnlyCoreNodes ? 'btn-nautobot-primary' : 'btn-nautobot-ghost'
                }`}
                disabled={isLoading}
                title={showOnlyCoreNodes 
                  ? 'Show All Nodes - Switch to display all models including detailed/supporting models (Ctrl+K)' 
                  : 'Show Only Core Nodes - Switch to display only essential models for cleaner visualization (Ctrl+K)'
                }
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d={showOnlyCoreNodes 
                      ? "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" 
                      : "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    } 
                  />
                </svg>
                {showOnlyCoreNodes ? 'Core' : 'All'}
              </button>
            </div>

            {/* Layout Algorithm Selection */}
            {isAutoLayoutEnabled && (
              <div className="border-t border-secondary-200/30 pt-3">
                <div className="text-xs text-secondary-600 font-medium mb-2">Layout Algorithm</div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <button
                    onClick={() => handleLayoutChange('dagre')}
                    className={`btn-nautobot btn-nautobot-xs hover-lift ${
                      layoutAlgorithm === 'dagre' ? 'btn-nautobot-primary' : 'btn-nautobot-ghost'
                    }`}
                    disabled={isLoading}
                  >
                    Dagre
                  </button>
                  <button
                    onClick={() => handleLayoutChange('hierarchical')}
                    className={`btn-nautobot btn-nautobot-xs hover-lift ${
                      layoutAlgorithm === 'hierarchical' ? 'btn-nautobot-primary' : 'btn-nautobot-ghost'
                    }`}
                    disabled={isLoading}
                  >
                    Hierarchy
                  </button>
                  <button
                    onClick={() => handleLayoutChange('circular')}
                    className={`btn-nautobot btn-nautobot-xs hover-lift ${
                      layoutAlgorithm === 'circular' ? 'btn-nautobot-primary' : 'btn-nautobot-ghost'
                    }`}
                    disabled={isLoading}
                  >
                    Circular
                  </button>
                  <button
                    onClick={() => handleLayoutChange('force')}
                    className={`btn-nautobot btn-nautobot-xs hover-lift ${
                      layoutAlgorithm === 'force' ? 'btn-nautobot-primary' : 'btn-nautobot-ghost'
                    }`}
                    disabled={isLoading}
                  >
                    Force
                  </button>
                </div>
              </div>
            )}

            {/* Enhanced stats section */}
            <div className="border-t border-secondary-200/30 pt-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="text-center">
                  <div className="text-lg font-bold text-primary-600">{displayNodes.length}</div>
                  <div className="text-secondary-500 font-medium">
                    {showOnlyCoreNodes ? 'Core Models' : 'All Models'}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-success-600">{displayEdges.length}</div>
                  <div className="text-secondary-500 font-medium">Relations</div>
                </div>
              </div>
              
              {/* Node filtering info */}
              <div className="mt-2 text-center">
                <div className="text-xs text-secondary-400 space-y-1">
                  {showOnlyCoreNodes && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-primary-50 text-primary-700">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Core nodes only
                    </span>
                  )}
                  
                  <button
                    onClick={() => setShowCoreNodesInfo(true)}
                    className="inline-flex items-center text-xs text-secondary-500 hover:text-primary-600 transition-colors"
                  >
                    <InformationCircleIcon className="w-3 h-3 mr-1" />
                    What are core nodes?
                  </button>
                </div>
              </div>
            </div>

            {/* API Error Handling */}
            {connectionMode === 'live' && apiError && (
              <div className="border-t border-secondary-200/30 pt-3">
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center mb-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                    <span className="text-xs font-medium text-red-700">API Connection Error</span>
                  </div>
                  <p className="text-xs text-red-600 mb-2">{apiError.message}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="btn-nautobot btn-nautobot-xs btn-nautobot-danger w-full"
                  >
                    Retry Connection
                  </button>
                </div>
              </div>
            )}

            {/* Transformation Error Handling */}
            {transformationError && (
              <div className="border-t border-secondary-200/30 pt-3">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-center mb-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></div>
                    <span className="text-xs font-medium text-yellow-700">Data Processing Warning</span>
                  </div>
                  <p className="text-xs text-yellow-600 mb-2">{transformationError}</p>
                  <button
                    onClick={onResetLayout}
                    className="btn-nautobot btn-nautobot-xs btn-nautobot-warning w-full"
                    disabled={isLoading}
                  >
                    Retry Data Load
                  </button>
                </div>
              </div>
            )}

            {/* Connection Status */}
            {connectionMode === 'live' && !apiError && (
              <div className="border-t border-secondary-200/30 pt-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-secondary-600">Connection Status</span>
                  <div className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-2 ${
                      apiLoading ? 'bg-yellow-500' : 'bg-green-500'
                    }`}></div>
                    <span className={`font-medium ${
                      apiLoading ? 'text-yellow-700' : 'text-green-700'
                    }`}>
                      {apiLoading ? 'Connecting...' : 'Connected'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Django Apps Filter */}
            <div className="border-t border-secondary-200/30 pt-3">
              <div className="text-xs text-secondary-600 font-medium mb-2 flex items-center justify-between">
                <span>Django Apps</span>
                {showOnlyCoreNodes && (
                  <span className="text-xs text-primary-600">({displayNodes.length}/{nodes.length} shown)</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {availableApps.map(app => (
                  <button
                    key={app}
                    onClick={() => toggleAppVisibility(app)}
                    className={`badge-nautobot badge-nautobot-sm transition-all duration-200 hover-lift cursor-pointer ${
                      visibleApps.has(app)
                        ? `badge-app-${app}`
                        : 'opacity-40 grayscale hover:opacity-70'
                    }`}
                    disabled={isLoading}
                    title={visibleApps.has(app) ? `Hide ${app} models` : `Show ${app} models`}
                  >
                    {app}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Panel>

        {/* Core Nodes Information Panel */}
        {showCoreNodesInfo && (
          <Panel position="top-center" className="m-4">
            <div className="panel-nautobot panel-nautobot-glass p-4 max-w-2xl animate-nautobot-fade-in">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-secondary-900 flex items-center">
                  <InformationCircleIcon className="w-4 h-4 mr-2 text-primary-600" />
                  Core Nodes Overview
                </h3>
                <button
                  onClick={() => setShowCoreNodesInfo(false)}
                  className="text-secondary-400 hover:text-secondary-600 transition-colors"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
              
              <div className="text-xs text-secondary-600 mb-4 space-y-2">
                <p>
                  <strong>Core nodes</strong> represent the most essential and commonly used models in each Nautobot app. 
                  This filtering reduces visual complexity by showing only the key infrastructure components.
                </p>
                <div className="bg-secondary-50 rounded-lg p-3">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <div className="font-medium text-secondary-700 mb-1">Statistics</div>
                      <div className="space-y-1">
                        <div>Total models: <span className="font-medium">{coreNodesStats.total}</span></div>
                        <div>Core models: <span className="font-medium text-primary-600">{coreNodesStats.core}</span></div>
                        <div>Reduction: <span className="font-medium text-success-600">{100 - coreNodesStats.corePercentage}% fewer nodes</span></div>
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-secondary-700 mb-1">Quick Reference</div>
                      <div className="text-xs text-secondary-500 space-y-1">
                        <div>• Press <kbd className="px-1 py-0.5 bg-secondary-200 rounded text-xs">Ctrl+K</kbd> to toggle</div>
                        <div>• Core models per app: 2-5 essential types</div>
                        <div>• Focuses on primary infrastructure</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                {Object.entries(coreNodesConfig).map(([app, models]) => (
                  <div key={app} className="bg-white/50 rounded-lg p-2 border border-secondary-100">
                    <div className={`font-medium mb-1 badge-app-${app} inline-block px-2 py-1 rounded text-xs`}>
                      {app}
                    </div>
                    <div className="space-y-0.5">
                      {models.map(model => (
                        <div key={model} className="text-secondary-600 text-xs">
                          • {model}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        )}


        {/* Legend Panel */}
        <Panel position="bottom-left" className="m-4">
          <div className="panel-nautobot panel-nautobot-glass p-3 animate-nautobot-fade-in-up">
            <div className="text-xs text-secondary-600 font-medium mb-2">Relationship Types</div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-0.5 bg-secondary-400"></div>
                <span className="text-xs text-secondary-600">Foreign Key</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-0.5 bg-primary-500"></div>
                <span className="text-xs text-secondary-600">Many to Many</span>
              </div>
            </div>
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
          position="bottom-right"
          className="bg-white border border-secondary-200 rounded-lg shadow-soft"
        />

        <Background
          color="#E2E8F0"
          gap={20}
          size={1}
        />
      </ReactFlow>
    </div>
  );
}