import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import type {
  NautobotNodeData,
  NodeInteractionState,
  HandleConfig
} from '../../types/schema';
import {
  // getNodeClasses, // Commented out - currently unused
  getNodeStyles,
  getAppColors,
  // getModelTypeConfig // Commented out - currently unused
} from '../../utils/nodeColors';
import { FieldList } from './FieldList';
import { CustomFieldList } from './CustomFieldList';
import { NodeTooltip, TooltipWrapper } from './NodeTooltip';

// Custom hook for node interaction state
const useNodeInteraction = (selected: boolean) => {
  const [state, setState] = useState<NodeInteractionState>({
    isHovered: false,
    isSelected: selected,
    isDragging: false,
    tooltipPosition: undefined
  });

  const handleMouseEnter = useCallback((event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setState(prev => ({
      ...prev,
      isHovered: true,
      tooltipPosition: {
        x: rect.width + 10,
        y: rect.height / 2
      }
    }));
  }, []);

  const handleMouseLeave = useCallback(() => {
    setState(prev => ({
      ...prev,
      isHovered: false,
      tooltipPosition: undefined
    }));
  }, []);

  const handleMouseDown = useCallback(() => {
    setState(prev => ({ ...prev, isDragging: true }));
  }, []);

  const handleMouseUp = useCallback(() => {
    setState(prev => ({ ...prev, isDragging: false }));
  }, []);

  // Update selected state when prop changes
  React.useEffect(() => {
    setState(prev => ({ ...prev, isSelected: selected }));
  }, [selected]);

  return {
    state,
    handlers: {
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      onMouseDown: handleMouseDown,
      onMouseUp: handleMouseUp
    }
  };
};

// Generate React Flow handles based on relationships
const generateHandles = (data: NautobotNodeData): HandleConfig[] => {
  const handles: HandleConfig[] = [];

  // Since API nodes don't have relationship data embedded,
  // add default handles that edges can connect to

  // Add default source handles (right side)
  handles.push({
    id: `${data.id || data.name}-source-right`,
    type: 'source',
    position: 'right',
    relationshipType: 'default',
    fieldName: 'default',
    relatedModel: ''
  });

  // Add default target handles (left side)
  handles.push({
    id: `${data.id || data.name}-target-left`,
    type: 'target',
    position: 'left',
    relationshipType: 'default',
    fieldName: 'default',
    relatedModel: ''
  });

  // Add additional handles for more connection flexibility
  handles.push({
    id: `${data.id || data.name}-source-top`,
    type: 'source',
    position: 'top',
    relationshipType: 'default',
    fieldName: 'default',
    relatedModel: ''
  });

  handles.push({
    id: `${data.id || data.name}-target-bottom`,
    type: 'target',
    position: 'bottom',
    relationshipType: 'default',
    fieldName: 'default',
    relatedModel: ''
  });

  return handles;
};

// Convert handle position to React Flow Position enum
const getReactFlowPosition = (position: string): Position => {
  switch (position) {
    case 'top': return Position.Top;
    case 'bottom': return Position.Bottom;
    case 'left': return Position.Left;
    case 'right': return Position.Right;
    default: return Position.Right;
  }
};

// Handle component for rendering connection points
interface HandleComponentProps {
  handle: HandleConfig;
  appColors: ReturnType<typeof getAppColors>;
}

const HandleComponent: React.FC<HandleComponentProps> = React.memo(({ handle, appColors }) => {
  const handleStyle = useMemo(() => ({
    backgroundColor: handle.type === 'source' ? appColors.primary : appColors.secondary,
    border: `2px solid ${appColors.text}`,
    width: 8,
    height: 8,
  }), [handle.type, appColors]);

  return (
    <Handle
      id={handle.id}
      type={handle.type}
      position={getReactFlowPosition(handle.position)}
      style={handleStyle}
      title={`${handle.relationshipType}: ${handle.fieldName} → ${handle.relatedModel}`}
      className="transition-all duration-200 hover:scale-150"
    />
  );
});

HandleComponent.displayName = 'HandleComponent';

// Get appropriate MUI-style icon based on model type
const getModelIcon = (modelName: string) => {
  const iconProps = {
    width: "16",
    height: "16",
    fill: "currentColor",
    viewBox: "0 0 24 24"
  };

  switch (modelName.toLowerCase()) {
    case 'device':
    case 'devicetype':
      return (
        <svg {...iconProps}>
          <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/>
        </svg>
      );
    case 'circuit':
    case 'circuittype':
      return (
        <svg {...iconProps}>
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      );
    case 'site':
    case 'location':
      return (
        <svg {...iconProps}>
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      );
    case 'cable':
      return (
        <svg {...iconProps}>
          <path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v9h-2V8zm3 2h2v7h-2v-7zM8 10h2v5H8v-5z"/>
        </svg>
      );
    case 'rack':
      return (
        <svg {...iconProps}>
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zm0 2v3h16V6H4zm0 5v3h16v-3H4zm0 5v3h16v-3H4z"/>
        </svg>
      );
    case 'interface':
      return (
        <svg {...iconProps}>
          <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.07 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/>
        </svg>
      );
    case 'ipaddress':
      return (
        <svg {...iconProps}>
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
        </svg>
      );
    case 'prefix':
      return (
        <svg {...iconProps}>
          <path d="M3 3v18h18v-2H5V3H3zm4 4l4 4 4-4 1.5 1.5L12 13 7.5 8.5 9 7zm7.5 9.5L12 19l-4.5-4.5L9 13l3 3 3-3 1.5 1.5z"/>
        </svg>
      );
    case 'vrf':
      return (
        <svg {...iconProps}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2zm0 4.24L9.16 11.1 12 12.5l2.84-1.4L12 6.24z"/>
        </svg>
      );
    case 'vlan':
      return (
        <svg {...iconProps}>
          <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.07 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/>
        </svg>
      );
    case 'role':
      return (
        <svg {...iconProps}>
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
        </svg>
      );
    case 'service':
      return (
        <svg {...iconProps}>
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      );
    case 'aggregate':
      return (
        <svg {...iconProps}>
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.20.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/>
        </svg>
      );
    case 'rir':
      return (
        <svg {...iconProps}>
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      );
    default:
      return (
        <svg {...iconProps}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      );
  }
};

// Main node component
export const NautobotModelNode: React.FC<NodeProps<NautobotNodeData>> = React.memo(({
  data,
  selected = false
}) => {
  // Debug logging removed to prevent console spam

  // Early return for missing data
  if (!data) {
    console.error('NautobotModelNode: No data provided');
    return (
      <div className="border-2 border-red-500 bg-red-100 p-4 rounded">
        <p className="text-red-700 font-bold">Error: No node data</p>
      </div>
    );
  }

  if (!data.name || !data.app) {
    console.error('NautobotModelNode: Missing required data fields:', data);
    return (
      <div className="border-2 border-orange-500 bg-orange-100 p-4 rounded">
        <p className="text-orange-700 font-bold">Error: Invalid node data</p>
        <p className="text-xs text-orange-600">Missing name or app field</p>
      </div>
    );
  }
  const { state, handlers } = useNodeInteraction(selected);
  const [expanded, setExpanded] = useState(data.expanded);

  // Handle double-click to toggle expansion
  const handleDoubleClick = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setExpanded(prev => !prev);
  }, []);

  // Memoized calculations with error handling
  const appColors = useMemo(() => {
    try {
      const colors = getAppColors(data.app);
      return colors;
    } catch (error) {
      console.error('Error getting app colors:', error);
      return getAppColors('default');
    }
  }, [data.app]);

  // Model configuration (currently unused)
  // const modelConfig = useMemo(() => {
  //   try {
  //     const config = getModelTypeConfig(data.name);
  //     console.log('Model config for', data.name, ':', config);
  //     return config;
  //   } catch (error) {
  //     console.error('Error getting model config:', error);
  //     return getModelTypeConfig('default');
  //   }
  // }, [data.name]);

  const handles = useMemo(() => {
    try {
      if (!data.relationships) {
        console.warn('No relationships data for node:', data.name);
        return [];
      }
      const generatedHandles = generateHandles(data);
      return generatedHandles;
    } catch (error) {
      console.error('Error generating handles:', error);
      return [];
    }
  }, [data]);

  // Node classes (currently unused)
  // const nodeClasses = useMemo(() => {
  //   try {
  //     return getNodeClasses(data.app, data.name, data.isAbstract, state.isSelected, state.isHovered);
  //   } catch (error) {
  //     console.error('Error getting node classes:', error);
  //     return 'nautobot-node border-2 rounded-lg shadow-md bg-white border-gray-300';
  //   }
  // }, [data.app, data.name, data.isAbstract, state.isSelected, state.isHovered]);

  const nodeStyles = useMemo(() => {
    try {
      return getNodeStyles(data.app, state.isSelected, state.isHovered);
    } catch (error) {
      console.error('Error getting node styles:', error);
      return { borderColor: '#6b7280', color: '#374151' };
    }
  }, [data.app, state.isSelected, state.isHovered]);

  // Relationship counts for badges
  const relationshipCounts = useMemo(() => {
    const outgoing = data.relationships?.outgoing?.length || 0;
    const incoming = data.relationships?.incoming?.length || 0;
    return {
      outgoing,
      incoming,
      total: outgoing + incoming
    };
  }, [data.relationships]);

  return (
    <TooltipWrapper
      tooltip={
        <NodeTooltip
          node={data}
          className="animate-nautobot-scale-in"
        />
      }
      show={state.isHovered && !state.isDragging}
      position={state.tooltipPosition}
    >
      <div
        className="nautobot-node animate-scale-in"
        style={{
          minWidth: 'var(--node-min-width)',
          minHeight: 'var(--node-min-height)',
          backgroundColor: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          // Explicitly prevent any blue borders or focus styles
          outline: 'none',
          boxShadow: state.isSelected
            ? '0 0 0 3px rgba(59, 130, 246, 0.3), 0 10px 25px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
            : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        }}
        onDoubleClick={handleDoubleClick}
        {...handlers}
      >
        {/* Render handles */}
        {handles.map((handle) => (
          <HandleComponent
            key={handle.id}
            handle={handle}
            appColors={appColors}
          />
        ))}

        {/* Enhanced Node header with gradient */}
        <div
          className="px-4 py-3 border-b border-secondary-200/50 relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${appColors.primary}08 0%, ${appColors.primary}03 100%)`
          }}
        >
          {/* App color accent line */}
          <div
            className="absolute top-0 left-0 right-0 h-0.5"
            style={{ backgroundColor: appColors.primary }}
          ></div>

          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center space-x-3 min-w-0 flex-1">
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-base text-secondary-900 truncate" title={data.name}>
                    {data.name}
                  </h3>
                  {data.isAbstract && (
                    <div className="badge-nautobot badge-nautobot-sm bg-warning-100 text-warning-700">
                      Abstract
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Enhanced badges */}
            <div className="flex items-center space-x-1.5 flex-shrink-0">
              {/* Field count badge */}
              <div
                className="badge-nautobot badge-nautobot-sm badge-nautobot-primary"
                title={`${data.fields?.length || 0} core fields`}
              >
                {data.fields?.length || 0}
              </div>


              {/* Relationship count badge */}
              {relationshipCounts.total > 0 && (
                <div
                  className="badge-nautobot badge-nautobot-sm badge-nautobot-success"
                  title={`${relationshipCounts.total} relationships`}
                >
                  ↔{relationshipCounts.total}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Enhanced Node body - Field list */}
        <div className="px-4 py-3">
          <FieldList
            fields={data.fields || []}
            expanded={expanded}
            maxVisible={5}
            modelName={data.name}
            usePrimaryFiltering
            onToggleExpanded={() => setExpanded(prev => !prev)}
          />
        </div>

        {/* Custom Fields section - only in expanded view */}
        {expanded && data.customFields && data.customFields.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-200/50">
            <CustomFieldList
              customFields={data.customFields}
              expanded={expanded}
              maxVisible={3}
            />
          </div>
        )}

        {/* Enhanced Node footer - Relationship summary when collapsed */}
        {!expanded && relationshipCounts.total > 0 && (
          <div className="px-4 py-3 border-t border-secondary-200/50 bg-gradient-to-r from-secondary-50/50 to-transparent rounded-b-xl">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-secondary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <span className="font-medium text-secondary-700">Relations</span>
              </div>
              <div className="flex items-center space-x-3">
                {relationshipCounts.outgoing > 0 && (
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
                    <span className="text-secondary-600 font-medium">
                      {relationshipCounts.outgoing} out
                    </span>
                  </div>
                )}
                {relationshipCounts.incoming > 0 && (
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-success-500 rounded-full"></div>
                    <span className="text-secondary-600 font-medium">
                      {relationshipCounts.incoming} in
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Expansion indicator */}
        <div className="absolute bottom-2 right-2 text-secondary-400">
          <svg
            className={`w-3 h-3 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Hover effect overlay */}
        {state.isHovered && (
          <div
            className="absolute inset-0 rounded-xl pointer-events-none opacity-10"
            style={{ background: appColors.primary }}
          ></div>
        )}

        {/* Accessibility enhancements */}
        <div className="sr-only">
          <p>Model {data.name} from {data.app} app</p>
          <p>{data.fields?.length || 0} fields, {relationshipCounts.total} relationships</p>
          <p>{expanded ? 'Expanded view' : 'Collapsed view. Double-click to expand'}</p>
          {data.isAbstract && <p>This is an abstract model</p>}
        </div>
      </div>
    </TooltipWrapper>
  );
});

NautobotModelNode.displayName = 'NautobotModelNode';

export default NautobotModelNode;