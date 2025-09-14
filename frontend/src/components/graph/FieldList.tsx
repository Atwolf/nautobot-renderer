import React from 'react';
import type { ModelField } from '../../types/schema';

interface FieldListProps {
  fields: ModelField[];
  expanded: boolean;
  maxVisible?: number;
  className?: string;
}

interface FieldItemProps {
  field: ModelField;
  showDetails?: boolean;
}

const FieldItem: React.FC<FieldItemProps> = React.memo(({ field, showDetails = false }) => {
  return (
    <div
      className={`
        flex items-center justify-between py-1 px-2 rounded text-xs
        ${showDetails ? 'bg-gray-50 border-l-2 border-l-gray-300' : ''}
        transition-colors duration-150
      `}
      title={field.description || `${field.type} field${field.required ? ' (required)' : ''}`}
    >
      <div className="flex items-center space-x-2 flex-1 min-w-0">
        {/* Field name */}
        <span
          className={`
            font-medium truncate
            ${field.required ? 'text-gray-900' : 'text-gray-600'}
          `}
        >
          {field.name}
        </span>

        {/* Related model indicator */}
        {field.relatedModel && (
          <span className="text-blue-600 text-xs bg-blue-100 px-1 rounded">
            → {field.relatedModel}
          </span>
        )}
      </div>

    </div>
  );
});

FieldItem.displayName = 'FieldItem';

export const FieldList: React.FC<FieldListProps> = React.memo(({
  fields,
  expanded,
  maxVisible = 5,
  className = ''
}) => {
  const visibleFields = expanded ? fields : fields.slice(0, maxVisible);
  const hiddenCount = fields.length - maxVisible;

  if (fields.length === 0) {
    return (
      <div className={`text-xs text-gray-400 italic px-2 py-1 ${className}`}>
        No fields
      </div>
    );
  }

  return (
    <div className={`space-y-1 ${className}`}>
      {/* Field count summary */}
      <div className="flex items-center justify-between px-2 py-1 bg-gray-100 rounded text-xs font-medium text-gray-700">
        <span>Fields ({fields.length})</span>
        {!expanded && hiddenCount > 0 && (
          <span className="text-gray-500">+{hiddenCount} more</span>
        )}
      </div>

      {/* Fields list */}
      <div className="space-y-0.5 max-h-40 overflow-y-auto">
        {visibleFields.map((field) => (
          <FieldItem
            key={field.name}
            field={field}
            showDetails={expanded}
          />
        ))}
      </div>

      {/* Expansion hint for collapsed state */}
      {!expanded && hiddenCount > 0 && (
        <div className="text-xs text-gray-400 text-center py-1 border-t border-gray-200">
          Double-click to expand
        </div>
      )}
    </div>
  );
});

FieldList.displayName = 'FieldList';

export default FieldList;