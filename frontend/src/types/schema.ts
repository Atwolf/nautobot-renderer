export interface ModelField {
  name: string;
  type: string;
  required: boolean;
  nullable: boolean;
  relatedModel?: string;
  description?: string;
}

export interface CustomField {
  name: string;
  type: 'text' | 'integer' | 'boolean' | 'date' | 'datetime' | 'select' | 'multiselect' | 'json' | 'url' | 'email' | 'textarea' | 'decimal';
  required: boolean;
  unique: boolean;
  choices?: string[];
  validation_regex?: string;
  default?: any;
  description?: string;
}

export interface ModelRelationship {
  id: string;
  fromModel: string;
  toModel: string;
  type: 'foreign_key' | 'many_to_many' | 'one_to_one' | 'reverse_foreign_key' | 'cable_connection' | 'power_connection' | 'console_connection' | 'through_table' | 'custom_relationship';
  fieldName: string;
  relatedName?: string;
  // Cable-specific properties
  cableType?: string;
  cableColor?: string;
  cableLength?: number;
  // Through table properties
  throughTable?: string;
  // Custom relationship properties
  customRelationshipName?: string;
}

export interface ModelNode {
  id: string;
  name: string;
  app: string;
  fields: ModelField[];
  customFields?: CustomField[];
  relationships: {
    outgoing: ModelRelationship[];
    incoming: ModelRelationship[];
  };
  isAbstract: boolean;
  description?: string;
  position?: { x: number; y: number };
}

export interface SchemaMetadata {
  discoveredAt: string;
  nautobotVersion: string;
  modelCount: number;
  relationshipCount: number;
  apps: string[];
}

export interface SchemaResponse {
  nodes: ModelNode[];
  edges: ModelRelationship[];
  metadata: SchemaMetadata;
}

export interface FilteredSchemaRequest {
  apps?: string[] | undefined;
  includeAbstract?: boolean | undefined;
  maxDepth?: number | undefined;
}

export interface SchemaStatistics {
  totalModels: number;
  totalRelationships: number;
  modelsByApp: Record<string, number>;
  relationshipsByType: Record<string, number>;
  averageFieldsPerModel: number;
  mostConnectedModels: Array<{
    modelName: string;
    connectionCount: number;
  }>;
}

export interface ApiError {
  message: string;
  code?: string | undefined;
  details?: Record<string, any> | undefined;
}

export interface ApiResponse<T> {
  data?: T | undefined;
  error?: ApiError | undefined;
  loading: boolean;
}

// React Flow types
export interface NautobotNodeData extends ModelNode {
  expanded?: boolean;
  selected?: boolean;
  color?: string;
  fieldCount?: number;
  relatedModels?: string[];
}

export interface NautobotEdgeData extends ModelRelationship {
  animated?: boolean;
  highlighted?: boolean;
  relationshipType?: string;
  sourceModel?: string;
  targetModel?: string;
  label?: string;
  isRequired?: boolean;
  color?: string;
}

// Node component specific types
export interface NodeComponentProps {
  id: string;
  data: NautobotNodeData;
  selected?: boolean;
  xPos: number;
  yPos: number;
}

export interface NodeInteractionState {
  isHovered: boolean;
  isSelected: boolean;
  isDragging: boolean;
  tooltipPosition: { x: number; y: number } | undefined;
}

export interface HandleConfig {
  id: string;
  type: 'source' | 'target';
  position: 'top' | 'bottom' | 'left' | 'right';
  relationshipType: 'foreign_key' | 'many_to_many' | 'one_to_one' | 'reverse_foreign_key' | 'cable_connection' | 'power_connection' | 'console_connection' | 'through_table' | 'custom_relationship';
  fieldName: string;
  relatedModel: string;
}