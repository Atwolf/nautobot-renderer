import React from 'react';
import type { CustomField } from '../../types/schema';

interface CustomFieldListProps {
  customFields: CustomField[];
  expanded: boolean;
  maxVisible?: number;
  className?: string;
}

interface CustomFieldItemProps {
  field: CustomField;
  showDetails?: boolean;
}

const CustomFieldItem: React.FC<CustomFieldItemProps> = React.memo(({ field, showDetails = false }) => {
  return (
    <div
      className={`
        flex items-center justify-between py-1 px-2 rounded text-xs
        ${showDetails ? 'bg-gray-50 border-l-2 border-l-gray-300' : ''}
        transition-colors duration-150
      `}
      title={field.description || `Custom ${field.type} field${field.required ? ' (required)' : ''}${field.unique ? ' (unique)' : ''}`}
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
      </div>
    </div>
  );
});

CustomFieldItem.displayName = 'CustomFieldItem';

export const CustomFieldList: React.FC<CustomFieldListProps> = React.memo(({
  customFields,
  expanded,
  maxVisible = 3,
  className = ''
}) => {
  const visibleFields = customFields;

  if (customFields.length === 0 || !expanded) {
    return null; // Don't show anything if no custom fields or not expanded
  }

  return (
    <div className={`space-y-1 ${className}`}>
      {/* Custom fields header */}
      <div className="flex items-center justify-between px-2 py-1 bg-gray-100 rounded text-xs font-medium text-gray-700">
        <span>Custom Fields ({customFields.length})</span>
      </div>

      {/* Custom fields list */}
      <div className="space-y-0.5 max-h-32 overflow-y-auto">
        {visibleFields.map((field) => (
          <CustomFieldItem
            key={field.name}
            field={field}
            showDetails={expanded}
          />
        ))}
      </div>

    </div>
  );
});

CustomFieldList.displayName = 'CustomFieldList';

export default CustomFieldList;