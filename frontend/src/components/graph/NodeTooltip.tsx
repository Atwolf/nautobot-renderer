import React from 'react';
import type { ModelNode, ModelRelationship } from '../../types/schema';
import { getAppColors, getModelTypeConfig } from '../../utils/nodeColors';

interface NodeTooltipProps {
  node: ModelNode;
  className?: string;
}

interface RelationshipSummaryProps {
  relationships: ModelRelationship[];
  title: string;
  maxShow?: number;
}

const RelationshipSummary: React.FC<RelationshipSummaryProps> = React.memo(({
  relationships,
  title,
  maxShow = 3
}) => {
  if (relationships.length === 0) return null;

  const visibleRels = relationships.slice(0, maxShow);
  const hiddenCount = relationships.length - maxShow;

  return (
    <div className="mb-3">
      <h4 className="font-semibold text-xs text-gray-700 mb-1">
        {title} ({relationships.length})
      </h4>
      <div className="space-y-1">
        {visibleRels.map((rel) => (
          <div key={rel.id} className="flex items-center text-xs">
            <span className="text-gray-600 mr-1">
              {rel.type === 'foreign_key' && '→'}
              {rel.type === 'reverse_foreign_key' && '←'}
              {rel.type === 'many_to_many' && '↔'}
              {rel.type === 'one_to_one' && '↕'}
            </span>
            <span className="font-medium text-blue-600">
              {rel.type === 'reverse_foreign_key' ? rel.fromModel : rel.toModel}
            </span>
            <span className="text-gray-500 ml-1">({rel.fieldName})</span>
          </div>
        ))}
        {hiddenCount > 0 && (
          <div className="text-xs text-gray-400 italic">
            +{hiddenCount} more...
          </div>
        )}
      </div>
    </div>
  );
});

RelationshipSummary.displayName = 'RelationshipSummary';

export const NodeTooltip: React.FC<NodeTooltipProps> = React.memo(({ node, className = '' }) => {
  const appColors = getAppColors(node.app);
  const modelConfig = getModelTypeConfig(node.name);

  // Calculate statistics with safe access
  const outgoingCount = node.relationships?.outgoing?.length || 0;
  const incomingCount = node.relationships?.incoming?.length || 0;
  const totalRelationships = outgoingCount + incomingCount;
  const requiredFields = node.fields?.filter(f => f.required)?.length || 0;
  const relationshipFields = node.fields?.filter(f => f.relatedModel)?.length || 0;

  return (
    <div
      className={`
        bg-white border-2 rounded-lg shadow-lg p-4 min-w-64 max-w-80 z-50
        ${className}
      `}
      style={{ borderColor: appColors.primary }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-lg" role="img" aria-label="Model type">
            {modelConfig.icon}
          </span>
          <div>
            <h3 className="font-bold text-gray-900 text-sm">
              {node.name}
              {node.isAbstract && (
                <span className="ml-1 text-xs text-gray-500 font-normal">
                  (abstract)
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-600">
              App: <span className="font-medium" style={{ color: appColors.primary }}>
                {node.app}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Description */}
      {node.description && (
        <div className="mb-3 text-xs text-gray-600">
          <p>{node.description}</p>
        </div>
      )}

      {/* Statistics Grid */}
      <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
        <div className="bg-gray-50 p-2 rounded">
          <div className="font-semibold text-gray-700">Fields</div>
          <div className="text-lg font-bold text-blue-600">{node.fields?.length || 0}</div>
          {requiredFields > 0 && (
            <div className="text-gray-500">{requiredFields} required</div>
          )}
        </div>
        <div className="bg-gray-50 p-2 rounded">
          <div className="font-semibold text-gray-700">Relationships</div>
          <div className="text-lg font-bold text-green-600">{totalRelationships}</div>
          {relationshipFields > 0 && (
            <div className="text-gray-500">{relationshipFields} fields</div>
          )}
        </div>
      </div>

      {/* Relationship breakdown */}
      <div className="border-t pt-3 space-y-2">
        <RelationshipSummary
          relationships={node.relationships?.outgoing || []}
          title="Outgoing Relations"
        />
        <RelationshipSummary
          relationships={node.relationships?.incoming || []}
          title="Incoming Relations"
        />
      </div>

      {/* Quick field type summary */}
      {(node.fields?.length || 0) > 0 && (
        <div className="border-t pt-3 mt-3">
          <h4 className="font-semibold text-xs text-gray-700 mb-1">Field Types</h4>
          <div className="flex flex-wrap gap-1">
            {Array.from(new Set((node.fields || []).map(f => f.type))).map(type => (
              <span
                key={type}
                className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
              >
                {type.replace('Field', '')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Interactive hints */}
      <div className="border-t pt-3 mt-3 text-xs text-gray-500 space-y-1">
        <div>• Click to select/focus</div>
        <div>• Double-click to expand/collapse</div>
        <div>• Handles show relationship connections</div>
      </div>
    </div>
  );
});

NodeTooltip.displayName = 'NodeTooltip';

// Wrapper component for positioning tooltip
interface TooltipWrapperProps {
  children: React.ReactNode;
  tooltip: React.ReactNode;
  show: boolean;
  position: { x: number; y: number } | undefined;
}

export const TooltipWrapper: React.FC<TooltipWrapperProps> = ({
  children,
  tooltip,
  show,
  position
}) => {
  return (
    <div className="relative">
      {children}
      {show && (
        <div
          className="absolute pointer-events-none z-50"
          style={{
            left: position ? position.x : 0,
            top: position ? position.y : 0,
            transform: 'translate(10px, -50%)'
          }}
        >
          {tooltip}
        </div>
      )}
    </div>
  );
};

export default NodeTooltip;