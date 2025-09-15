import type { ModelField } from '../types/schema';

/**
 * Configuration for field priority calculation
 */
export interface FieldPriorityConfig {
  // Field name patterns with their priority scores
  highPriorityNames: string[];
  mediumPriorityNames: string[];
  lowPriorityNames: string[];

  // Field type priority scores
  fieldTypePriorities: Record<string, number>;

  // Base scoring modifiers
  requiredFieldBonus: number;
  uniqueFieldBonus: number;
  foreignKeyBonus: number;

  // Penalty scores
  timestampPenalty: number;
  internalFieldPenalty: number;
  longTextFieldPenalty: number;

  // Base score for all fields
  baseScore: number;
}

/**
 * Default configuration based on Django/Nautobot conventions
 */
export const DEFAULT_FIELD_PRIORITY_CONFIG: FieldPriorityConfig = {
  highPriorityNames: [
    'name', 'title', 'cid', 'prefix', 'id', 'pk', 'status', 'state',
    'enabled', 'active', 'slug', 'model', 'device_type', 'site'
  ],
  mediumPriorityNames: [
    'type', 'role', 'kind', 'category', 'tenant', 'vrf', 'provider',
    'manufacturer', 'device', 'interface', 'circuit_type', 'location'
  ],
  lowPriorityNames: [
    'description', 'comments', 'notes', 'created', 'modified', 'updated',
    'created_at', 'updated_at', 'last_updated', 'custom_field_data'
  ],

  fieldTypePriorities: {
    'CharField': 10,
    'SlugField': 15,
    'ForeignKey': 20,
    'BooleanField': 5,
    'IntegerField': 0,
    'PositiveIntegerField': 0,
    'PositiveSmallIntegerField': 0,
    'DateField': -5,
    'DateTimeField': -10,
    'TextField': -15,
    'JSONField': -10,
    'GenericForeignKey': 15,
    'ManyToManyField': 10,
    'OneToOneField': 20,
    'EmailField': 5,
    'URLField': 5,
    'IPAddressField': 10,
    'GenericIPAddressField': 10
  },

  requiredFieldBonus: 30,
  uniqueFieldBonus: 25,
  foreignKeyBonus: 20,

  timestampPenalty: 20,
  internalFieldPenalty: 50,
  longTextFieldPenalty: 10,

  baseScore: 100
};

/**
 * Calculate priority score for a single field
 */
export function calculateFieldPriority(
  field: ModelField,
  config: FieldPriorityConfig = DEFAULT_FIELD_PRIORITY_CONFIG
): number {
  let score = config.baseScore;
  const fieldName = field.name.toLowerCase();
  const fieldType = field.type;

  // Name-based priority scoring
  if (config.highPriorityNames.some(name => fieldName.includes(name.toLowerCase()))) {
    score += 50;
  } else if (config.mediumPriorityNames.some(name => fieldName.includes(name.toLowerCase()))) {
    score += 25;
  } else if (config.lowPriorityNames.some(name => fieldName.includes(name.toLowerCase()))) {
    score -= 20;
  }

  // Field type scoring
  const typeScore = config.fieldTypePriorities[fieldType] || 0;
  score += typeScore;

  // Required field bonus
  if (field.required) {
    score += config.requiredFieldBonus;
  }

  // Foreign key bonus (relationship fields are important for understanding model connections)
  if (field.relatedModel) {
    score += config.foreignKeyBonus;
  }

  // Penalties for less important field types

  // Timestamp fields (usually not primary display concern)
  if (fieldName.includes('created') || fieldName.includes('modified') ||
      fieldName.includes('updated') || fieldName.includes('timestamp')) {
    score -= config.timestampPenalty;
  }

  // Internal Django fields
  if (fieldName.startsWith('_') || fieldName.includes('_state') ||
      fieldName.includes('_meta') || fieldName.includes('cached_')) {
    score -= config.internalFieldPenalty;
  }

  // Long text fields (descriptions, notes, etc.)
  if (fieldType === 'TextField' || fieldName.includes('description') ||
      fieldName.includes('notes') || fieldName.includes('comment')) {
    score -= config.longTextFieldPenalty;
  }

  // Ensure score doesn't go below 0
  return Math.max(0, score);
}

/**
 * Calculate priority scores for all fields and return sorted by priority
 */
export function calculateFieldPriorities(
  fields: ModelField[],
  config: FieldPriorityConfig = DEFAULT_FIELD_PRIORITY_CONFIG
): Array<{ field: ModelField; priority: number }> {
  return fields
    .map(field => ({
      field,
      priority: calculateFieldPriority(field, config)
    }))
    .sort((a, b) => b.priority - a.priority);
}

/**
 * Get field priority category for UI display
 */
export function getFieldPriorityCategory(priority: number): 'high' | 'medium' | 'low' {
  if (priority >= 150) return 'high';
  if (priority >= 100) return 'medium';
  return 'low';
}

/**
 * Debug utility to analyze field priorities for a model
 */
export function analyzeFieldPriorities(
  fields: ModelField[],
  modelName: string,
  config: FieldPriorityConfig = DEFAULT_FIELD_PRIORITY_CONFIG
): void {
  console.group(`Field Priority Analysis for ${modelName}`);

  const prioritizedFields = calculateFieldPriorities(fields, config);

  prioritizedFields.forEach(({ field, priority }, index) => {
    const category = getFieldPriorityCategory(priority);
    const indicators = [];

    if (field.required) indicators.push('REQUIRED');
    if (field.relatedModel) indicators.push(`FK->${field.relatedModel}`);
    if (!field.nullable) indicators.push('NOT_NULL');

    console.log(
      `${index + 1}. ${field.name} (${field.type}) - Score: ${priority} [${category.toUpperCase()}]` +
      (indicators.length > 0 ? ` ${indicators.join(', ')}` : '')
    );
  });

  console.groupEnd();
}