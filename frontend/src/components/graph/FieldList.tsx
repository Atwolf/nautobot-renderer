import React from 'react';
import type { ModelField } from '../../types/schema';
import {
  filterPrimaryFields,
  type PrimaryFieldFilterConfig,
  DEFAULT_PRIMARY_FIELD_CONFIG
} from '../../utils/primaryFieldFilter';

interface FieldListProps {
  fields: ModelField[];
  expanded: boolean;
  maxVisible?: number;
  className?: string;
  modelName?: string;
  usePrimaryFiltering?: boolean;
  primaryFieldConfig?: PrimaryFieldFilterConfig;
  onToggleExpanded?: () => void;
}

interface FieldItemProps {
  field: ModelField;
  showDetails?: boolean;
  isPrimary?: boolean;
}

const FieldItem: React.FC<FieldItemProps> = React.memo(({ field, showDetails = false, isPrimary = false }) => {
  return (
    <div
      className={`
        flex items-center justify-between py-1 px-2 rounded text-xs
        ${showDetails ? 'bg-gray-50 border-l-2 border-l-gray-300' : ''}
        ${isPrimary ? 'border-l-2 border-l-blue-400' : ''}
        transition-colors duration-150
      `}
      title={field.description || `${field.type} field${field.required ? ' (required)' : ''}${isPrimary ? ' (primary)' : ''}`}
    >
      <div className="flex items-center space-x-2 flex-1 min-w-0">
        {/* Primary field indicator */}
        {isPrimary && !showDetails && (
          <div className="w-1 h-1 bg-blue-500 rounded-full flex-shrink-0"></div>
        )}

        {/* Field name */}
        <span
          className={`
            font-medium truncate
            ${field.required ? 'text-gray-900' : 'text-gray-600'}
            ${isPrimary ? 'font-semibold' : ''}
          `}
        >
          {field.name}
        </span>

        {/* Required indicator */}
        {field.required && (
          <span className="text-red-500 text-xs font-bold">*</span>
        )}

        {/* Related model indicator */}
        {field.relatedModel && (
          <span className="text-blue-600 text-xs bg-blue-100 px-1 rounded">
            → {field.relatedModel}
          </span>
        )}
      </div>

      {/* Field type badge for expanded view */}
      {showDetails && (
        <span className="text-xs text-gray-500 bg-gray-100 px-1 rounded flex-shrink-0">
          {field.type}
        </span>
      )}
    </div>
  );
});

FieldItem.displayName = 'FieldItem';

export const FieldList: React.FC<FieldListProps> = React.memo(({
  fields,
  expanded,
  maxVisible = 5,
  className = '',
  modelName,
  usePrimaryFiltering = true,
  primaryFieldConfig = DEFAULT_PRIMARY_FIELD_CONFIG,
  onToggleExpanded
}) => {
  // Apply primary field filtering if enabled
  const filteredResult = React.useMemo(() => {
    if (!usePrimaryFiltering || expanded) {
      return {
        primaryFields: fields,
        remainingFields: [],
        totalFields: fields.length,
        strategy: 'none' as const,
        appliedConfig: primaryFieldConfig
      };
    }

    return filterPrimaryFields(fields, primaryFieldConfig, modelName);
  }, [fields, expanded, usePrimaryFiltering, primaryFieldConfig, modelName]);

  const { primaryFields, remainingFields, totalFields } = filteredResult;

  // Determine what fields to show based on expansion state
  const visibleFields = React.useMemo(() => {
    if (expanded) {
      return [...primaryFields, ...remainingFields];
    }

    if (usePrimaryFiltering) {
      return primaryFields;
    }

    return fields.slice(0, maxVisible);
  }, [expanded, usePrimaryFiltering, primaryFields, remainingFields, fields, maxVisible]);

  // Calculate hidden count
  const hiddenCount = React.useMemo(() => {
    if (expanded) return 0;

    if (usePrimaryFiltering) {
      return remainingFields.length;
    }

    return Math.max(0, fields.length - maxVisible);
  }, [expanded, usePrimaryFiltering, remainingFields.length, fields.length, maxVisible]);

  // Handle click to toggle expansion
  const handleHeaderClick = React.useCallback(() => {
    if (onToggleExpanded) {
      onToggleExpanded();
    }
  }, [onToggleExpanded]);

  if (totalFields === 0) {
    return (
      <div className={`text-xs text-gray-400 italic px-2 py-1 ${className}`}>
        No fields
      </div>
    );
  }

  return (
    <div className={`space-y-1 ${className}`}>
      {/* Field count summary with click handler */}
      <div
        className={`
          flex items-center justify-between px-2 py-1 bg-gray-100 rounded text-xs font-medium text-gray-700
          ${onToggleExpanded ? 'cursor-pointer hover:bg-gray-200 transition-colors' : ''}
        `}
        onClick={handleHeaderClick}
        role={onToggleExpanded ? 'button' : undefined}
        tabIndex={onToggleExpanded ? 0 : undefined}
        title={onToggleExpanded ? (expanded ? 'Click to collapse' : 'Click to expand') : undefined}
      >
        <div className="flex items-center space-x-2">
          <span>
            {usePrimaryFiltering && !expanded ? 'Primary Fields' : 'Fields'} ({totalFields})
          </span>
          {usePrimaryFiltering && !expanded && primaryFields.length < totalFields && (
            <span className="text-xs text-blue-600 bg-blue-100 px-1 rounded">
              {primaryFields.length} of {totalFields}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {!expanded && hiddenCount > 0 && (
            <span className="text-gray-500">+{hiddenCount} more</span>
          )}
          {onToggleExpanded && (
            <svg
              className={`w-3 h-3 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </div>

      {/* Fields list */}
      <div className="space-y-0.5 max-h-40 overflow-y-auto">
        {visibleFields.map((field) => {
          const isPrimary = usePrimaryFiltering && primaryFields.includes(field);

          return (
            <FieldItem
              key={field.name}
              field={field}
              showDetails={expanded}
              isPrimary={isPrimary}
            />
          );
        })}
      </div>

      {/* Expansion hint for collapsed state */}
      {!expanded && hiddenCount > 0 && !onToggleExpanded && (
        <div className="text-xs text-gray-400 text-center py-1 border-t border-gray-200">
          Double-click node to expand
        </div>
      )}

      {/* Primary filtering info when expanded */}
      {expanded && usePrimaryFiltering && primaryFields.length > 0 && remainingFields.length > 0 && (
        <div className="text-xs text-gray-500 px-2 py-1 border-t border-gray-200">
          <div className="flex items-center space-x-1">
            <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
            <span>Primary fields ({primaryFields.length})</span>
          </div>
        </div>
      )}
    </div>
  );
});

FieldList.displayName = 'FieldList';

export default FieldList;