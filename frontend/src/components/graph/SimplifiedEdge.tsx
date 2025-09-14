/**
 * Simplified edge component using React Flow's built-in path utilities
 * Uses different path types based on relationship types for visual distinction
 */

import React, { useMemo } from 'react';
import {
  type EdgeProps,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  getSimpleBezierPath
} from 'reactflow';
import type { NautobotEdgeData } from '../../types/schema';

interface SimplifiedEdgeProps extends EdgeProps {
  data?: NautobotEdgeData;
}

const SimplifiedEdge: React.FC<SimplifiedEdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  style,
  label,
  labelStyle,
  labelShowBg = true,
  labelBgStyle,
  animated = false
}) => {
  // Calculate edge path using React Flow's built-in utilities
  const [edgePath, labelX, labelY] = useMemo(() => {
    // Choose path type based on relationship type
    switch (data?.type) {
      case 'foreign_key':
        // Use smooth step for foreign keys (clean, structured look)
        return getSmoothStepPath({
          sourceX,
          sourceY,
          sourcePosition,
          targetX,
          targetY,
          targetPosition,
          borderRadius: 15,
          offset: 20
        });

      case 'many_to_many':
        // Use bezier for many-to-many (curved, organic look)
        return getBezierPath({
          sourceX,
          sourceY,
          sourcePosition,
          targetX,
          targetY,
          targetPosition,
        });

      case 'one_to_one':
        // Use straight path for one-to-one (direct, simple)
        return getStraightPath({
          sourceX,
          sourceY,
          targetX,
          targetY,
        });

      case 'reverse_foreign_key':
        // Use simple bezier for reverse foreign keys (subtle curve)
        return getSimpleBezierPath({
          sourceX,
          sourceY,
          sourcePosition,
          targetX,
          targetY,
          targetPosition,
        });

      case 'cable_connection':
        // Use straight path for direct physical connections
        return getStraightPath({
          sourceX,
          sourceY,
          targetX,
          targetY,
        });

      case 'power_connection':
        // Use bezier for power connections
        return getBezierPath({
          sourceX,
          sourceY,
          sourcePosition,
          targetX,
          targetY,
          targetPosition,
        });

      case 'console_connection':
        // Use smooth step for console connections
        return getSmoothStepPath({
          sourceX,
          sourceY,
          sourcePosition,
          targetX,
          targetY,
          targetPosition,
          borderRadius: 8,
          offset: 15
        });

      case 'custom_relationship':
        // Use bezier for custom relationships with organic curves
        return getBezierPath({
          sourceX,
          sourceY,
          sourcePosition,
          targetX,
          targetY,
          targetPosition,
        });

      default:
        // Default to smooth step
        return getSmoothStepPath({
          sourceX,
          sourceY,
          sourcePosition,
          targetX,
          targetY,
          targetPosition,
          borderRadius: 10,
          offset: 15
        });
    }
  }, [
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    data?.type
  ]);

  // Get relationship-specific styling
  const relationshipStyles = useMemo(() => {
    const baseStyle = {
      stroke: '#64748b', // secondary-500
      strokeWidth: 2,
      fill: 'none',
      ...style
    };

    // Apply relationship-specific colors and styles
    switch (data?.type) {
      case 'foreign_key':
        return {
          ...baseStyle,
          stroke: '#3b82f6', // blue-500
          strokeWidth: 2,
          strokeDasharray: undefined // Solid line for one-to-many (foreign key)
        };
      case 'many_to_many':
        return {
          ...baseStyle,
          stroke: '#8b5cf6', // violet-500
          strokeWidth: 2.5,
          strokeDasharray: '8,4' // Long dashes for many-to-many
        };
      case 'one_to_one':
        return {
          ...baseStyle,
          stroke: '#ef4444', // red-500
          strokeWidth: 2,
          strokeDasharray: '3,3' // Small dashes for one-to-one
        };
      case 'reverse_foreign_key':
        return {
          ...baseStyle,
          stroke: '#10b981', // emerald-500
          strokeWidth: 1.5,
          opacity: 0.7,
          strokeDasharray: '6,2' // Medium dashes for reverse foreign key
        };
      case 'cable_connection':
        return {
          ...baseStyle,
          stroke: '#f97316', // orange-500
          strokeWidth: 3,
          strokeDasharray: animated ? '10,2' : '6,6',
          opacity: 0.9
        };
      case 'power_connection':
        return {
          ...baseStyle,
          stroke: '#dc2626', // red-500
          strokeWidth: 2.5,
          strokeDasharray: animated ? '6,3' : '8,4',
          opacity: 0.8
        };
      case 'console_connection':
        return {
          ...baseStyle,
          stroke: '#0891b2', // cyan-600
          strokeWidth: 2,
          strokeDasharray: animated ? '5,3' : '3,3',
          opacity: 0.7
        };
      case 'custom_relationship':
        return {
          ...baseStyle,
          stroke: '#ec4899', // pink-500
          strokeWidth: 2.5,
          background: 'linear-gradient(45deg, #ec4899, #8b5cf6)',
          strokeDasharray: animated ? '8,4' : undefined,
          opacity: 0.85
        };
      default:
        return baseStyle;
    }
  }, [data?.type, style, animated]);

  // Handle edge interaction states
  const [isHovered, setIsHovered] = React.useState(false);

  const interactiveStyles = useMemo(() => {
    if (!isHovered) return relationshipStyles;

    return {
      ...relationshipStyles,
      strokeWidth: (relationshipStyles.strokeWidth as number) + 1,
      opacity: Math.min(1, (relationshipStyles.opacity as number || 1) + 0.2)
    };
  }, [relationshipStyles, isHovered]);

  // Create cardinality markers based on relationship type
  const getCardinalityMarkers = () => {
    const markerColor = relationshipStyles.stroke;

    const markers = (
      <defs>
        {/* One-to-one markers */}
        <marker
          id={`one-to-one-start-${id}`}
          markerWidth="8"
          markerHeight="8"
          refX="1"
          refY="4"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <line x1="1" y1="1" x2="1" y2="7" stroke={markerColor} strokeWidth="2" />
        </marker>
        <marker
          id={`one-to-one-end-${id}`}
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="4"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <line x1="7" y1="1" x2="7" y2="7" stroke={markerColor} strokeWidth="2" />
        </marker>

        {/* One-to-many markers */}
        <marker
          id={`one-to-many-start-${id}`}
          markerWidth="8"
          markerHeight="8"
          refX="1"
          refY="4"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <line x1="1" y1="1" x2="1" y2="7" stroke={markerColor} strokeWidth="2" />
        </marker>
        <marker
          id={`one-to-many-end-${id}`}
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          {/* Crow's foot */}
          <path d="M2,2 L8,5 L2,8 M8,2 L8,8" stroke={markerColor} strokeWidth="1.5" fill="none" />
        </marker>

        {/* Many-to-many markers */}
        <marker
          id={`many-to-many-start-${id}`}
          markerWidth="10"
          markerHeight="10"
          refX="8"
          refY="5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M2,2 L8,5 L2,8 M8,2 L8,8" stroke={markerColor} strokeWidth="1.5" fill="none" />
        </marker>
        <marker
          id={`many-to-many-end-${id}`}
          markerWidth="10"
          markerHeight="10"
          refX="2"
          refY="5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M8,2 L2,5 L8,8 M2,2 L2,8" stroke={markerColor} strokeWidth="1.5" fill="none" />
        </marker>
      </defs>
    );

    return markers;
  };

  // Get appropriate markers for the relationship type
  const getMarkerStart = () => {
    switch (data?.type) {
      case 'one_to_one':
        return `url(#one-to-one-start-${id})`;
      case 'foreign_key':
        return `url(#one-to-many-start-${id})`;
      case 'many_to_many':
        return `url(#many-to-many-start-${id})`;
      default:
        return undefined;
    }
  };

  const getMarkerEnd = () => {
    switch (data?.type) {
      case 'one_to_one':
        return `url(#one-to-one-end-${id})`;
      case 'foreign_key':
      case 'reverse_foreign_key':
        return `url(#one-to-many-end-${id})`;
      case 'many_to_many':
        return `url(#many-to-many-end-${id})`;
      default:
        return markerEnd;
    }
  };

  return (
    <>
      {/* SVG definitions for cardinality markers */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        {getCardinalityMarkers()}
      </svg>

      {/* Main edge path */}
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        markerStart={getMarkerStart()}
        markerEnd={getMarkerEnd()}
        style={interactiveStyles}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      {/* Edge label with enhanced information */}
      {(label || data?.cableType || data?.customRelationshipName) && (
        <>
          {/* Enhanced label text */}
          {(() => {
            const labelText = data?.customRelationshipName || label;
            const subLabel = data?.cableType ? `${data.cableType}${data.cableLength ? ` (${data.cableLength}m)` : ''}` : '';
            const fullLabel = subLabel ? `${labelText}\n${subLabel}` : labelText;
            const lines = String(fullLabel).split('\n');
            const maxLineLength = Math.max(...lines.map(line => line.length));

            return (
              <>
                {/* Label background for better readability */}
                {labelShowBg && (
                  <rect
                    x={labelX - (maxLineLength * 3.5)}
                    y={labelY - (lines.length > 1 ? 16 : 8)}
                    width={maxLineLength * 7}
                    height={lines.length * 16}
                    fill="white"
                    stroke={data?.type?.includes('cable') ? '#f97316' : data?.type === 'custom_relationship' ? '#ec4899' : "#e5e7eb"}
                    strokeWidth={1}
                    rx={4}
                    className="react-flow__edge-text-bg"
                    style={{
                      opacity: 0.9,
                      ...labelBgStyle
                    }}
                  />
                )}

                {/* Label text lines */}
                {lines.map((line, index) => (
                  <text
                    key={index}
                    x={labelX}
                    y={labelY + (index - (lines.length - 1) / 2) * 14}
                    className="react-flow__edge-text"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{
                      fontSize: index === 0 ? '11px' : '9px',
                      fontWeight: index === 0 ? 500 : 400,
                      fill: index === 0 ? '#374151' : '#6b7280',
                      pointerEvents: 'none',
                      ...labelStyle
                    }}
                  >
                    {line}
                  </text>
                ))}
              </>
            );
          })()}
        </>
      )}

      {/* Relationship type indicator dot for complex relationships */}
      {data?.type === 'many_to_many' && (
        <circle
          cx={labelX + (String(label || '').length * 3.5) + 8}
          cy={labelY}
          r={3}
          fill="#8b5cf6"
          stroke="white"
          strokeWidth={1}
          className="react-flow__edge-indicator"
        />
      )}

      {/* Animation overlay for animated edges */}
      {animated && (
        <path
          d={edgePath}
          fill="none"
          stroke="rgba(59, 130, 246, 0.4)"
          strokeWidth={1}
          className="react-flow__edge-animation"
          style={{
            strokeDasharray: '6,6',
            animation: 'dash 1s linear infinite'
          }}
        />
      )}
    </>
  );
};

// Animation keyframes for animated edges
const animationStyles = `
@keyframes dash {
  to {
    stroke-dashoffset: -12;
  }
}
`;

// Inject animation styles into document head
if (typeof document !== 'undefined' && !document.getElementById('simplified-edge-animations')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'simplified-edge-animations';
  styleSheet.textContent = animationStyles;
  document.head.appendChild(styleSheet);
}

export default SimplifiedEdge;