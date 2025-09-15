import type { ModelField } from '../types/schema';
import {
  calculateFieldPriorities,
  type FieldPriorityConfig,
  DEFAULT_FIELD_PRIORITY_CONFIG
} from './fieldPriorityCalculator';

/**
 * Strategy for selecting primary fields
 */
export type PrimaryFieldStrategy =
  | 'rule-based'      // Use priority scoring system
  | 'required-only'   // Show only required fields
  | 'smart-ranking'   // Combination of rules and field count limits
  | 'context-aware';  // Model-specific rules

/**
 * Configuration for primary field filtering
 */
export interface PrimaryFieldFilterConfig {
  strategy: PrimaryFieldStrategy;
  maxPrimaryFields: number;
  minPrimaryFields: number;
  showRequiredFirst: boolean;
  priorityConfig?: FieldPriorityConfig;
  modelSpecificRules?: Record<string, Partial<PrimaryFieldFilterConfig>>;
}

/**
 * Default configuration for primary field filtering
 */
export const DEFAULT_PRIMARY_FIELD_CONFIG: PrimaryFieldFilterConfig = {
  strategy: 'smart-ranking',
  maxPrimaryFields: 5,
  minPrimaryFields: 2,
  showRequiredFirst: true,
  priorityConfig: DEFAULT_FIELD_PRIORITY_CONFIG,
  modelSpecificRules: {
    // Device models should emphasize identity and location
    'Device': {
      maxPrimaryFields: 4,
      priorityConfig: {
        ...DEFAULT_FIELD_PRIORITY_CONFIG,
        highPriorityNames: ['name', 'device_type', 'site', 'status', 'role']
      }
    },
    // Site models should emphasize identity and basic info
    'Site': {
      maxPrimaryFields: 4,
      priorityConfig: {
        ...DEFAULT_FIELD_PRIORITY_CONFIG,
        highPriorityNames: ['name', 'slug', 'status', 'facility', 'region']
      }
    },
    // Interface models should emphasize device relationship and type
    'Interface': {
      maxPrimaryFields: 5,
      priorityConfig: {
        ...DEFAULT_FIELD_PRIORITY_CONFIG,
        highPriorityNames: ['name', 'device', 'type', 'enabled', 'status']
      }
    },
    // Circuit models should emphasize provider and identifiers
    'Circuit': {
      maxPrimaryFields: 5,
      priorityConfig: {
        ...DEFAULT_FIELD_PRIORITY_CONFIG,
        highPriorityNames: ['cid', 'provider', 'type', 'status', 'tenant']
      }
    },
    // IP/Network models should emphasize the IP information
    'Prefix': {
      maxPrimaryFields: 5,
      priorityConfig: {
        ...DEFAULT_FIELD_PRIORITY_CONFIG,
        highPriorityNames: ['prefix', 'site', 'vrf', 'status', 'role']
      }
    },
    'IPAddress': {
      maxPrimaryFields: 4,
      priorityConfig: {
        ...DEFAULT_FIELD_PRIORITY_CONFIG,
        highPriorityNames: ['address', 'vrf', 'status', 'role']
      }
    }
  }
};

/**
 * Result of primary field filtering
 */
export interface PrimaryFieldResult {
  primaryFields: ModelField[];
  remainingFields: ModelField[];
  totalFields: number;
  strategy: PrimaryFieldStrategy;
  appliedConfig: PrimaryFieldFilterConfig;
}

/**
 * Apply required-only strategy
 */
function applyRequiredOnlyStrategy(
  fields: ModelField[],
  config: PrimaryFieldFilterConfig
): { primary: ModelField[]; remaining: ModelField[] } {
  const requiredFields = fields.filter(field => field.required);
  const remainingFields = fields.filter(field => !field.required);

  // If we have too many required fields, prioritize them
  if (requiredFields.length > config.maxPrimaryFields) {
    const prioritized = calculateFieldPriorities(requiredFields, config.priorityConfig);
    const primary = prioritized.slice(0, config.maxPrimaryFields).map(p => p.field);
    const remaining = [
      ...prioritized.slice(config.maxPrimaryFields).map(p => p.field),
      ...remainingFields
    ];
    return { primary, remaining };
  }

  return { primary: requiredFields, remaining: remainingFields };
}

/**
 * Apply rule-based strategy using priority scoring
 */
function applyRuleBasedStrategy(
  fields: ModelField[],
  config: PrimaryFieldFilterConfig
): { primary: ModelField[]; remaining: ModelField[] } {
  const prioritized = calculateFieldPriorities(fields, config.priorityConfig);

  let primary: ModelField[] = [];
  let remaining: ModelField[] = [];

  // If showRequiredFirst is enabled, ensure required fields are prioritized
  if (config.showRequiredFirst) {
    const requiredPrioritized = prioritized.filter(p => p.field.required);
    const optionalPrioritized = prioritized.filter(p => !p.field.required);

    // Take up to maxPrimaryFields, preferring required fields
    const requiredToTake = Math.min(requiredPrioritized.length, config.maxPrimaryFields);
    const optionalToTake = Math.max(0, config.maxPrimaryFields - requiredToTake);

    primary = [
      ...requiredPrioritized.slice(0, requiredToTake).map(p => p.field),
      ...optionalPrioritized.slice(0, optionalToTake).map(p => p.field)
    ];

    remaining = [
      ...requiredPrioritized.slice(requiredToTake).map(p => p.field),
      ...optionalPrioritized.slice(optionalToTake).map(p => p.field)
    ];
  } else {
    // Simple top-N approach
    primary = prioritized.slice(0, config.maxPrimaryFields).map(p => p.field);
    remaining = prioritized.slice(config.maxPrimaryFields).map(p => p.field);
  }

  return { primary, remaining };
}

/**
 * Apply smart-ranking strategy (hybrid approach)
 */
function applySmartRankingStrategy(
  fields: ModelField[],
  config: PrimaryFieldFilterConfig
): { primary: ModelField[]; remaining: ModelField[] } {
  // Start with rule-based approach
  let { primary, remaining } = applyRuleBasedStrategy(fields, config);

  // Ensure we have at least the minimum number of fields
  if (primary.length < config.minPrimaryFields && remaining.length > 0) {
    const additionalCount = Math.min(
      config.minPrimaryFields - primary.length,
      remaining.length
    );

    primary = [...primary, ...remaining.slice(0, additionalCount)];
    remaining = remaining.slice(additionalCount);
  }

  // Ensure we have key identifier fields (name, id, etc.)
  const hasIdentifier = primary.some(field =>
    ['name', 'id', 'pk', 'cid', 'prefix', 'title'].includes(field.name.toLowerCase())
  );

  if (!hasIdentifier) {
    const identifierField = remaining.find(field =>
      ['name', 'id', 'pk', 'cid', 'prefix', 'title'].includes(field.name.toLowerCase())
    );

    if (identifierField) {
      // Replace the lowest priority field with the identifier
      if (primary.length >= config.maxPrimaryFields) {
        remaining = [primary[primary.length - 1], ...remaining.filter(f => f !== identifierField)];
        primary = [...primary.slice(0, -1), identifierField];
      } else {
        primary = [...primary, identifierField];
        remaining = remaining.filter(f => f !== identifierField);
      }
    }
  }

  return { primary, remaining };
}

/**
 * Apply context-aware strategy using model-specific rules
 */
function applyContextAwareStrategy(
  fields: ModelField[],
  config: PrimaryFieldFilterConfig,
  modelName?: string
): { primary: ModelField[]; remaining: ModelField[] } {
  // Get model-specific configuration
  const modelConfig = modelName && config.modelSpecificRules?.[modelName];
  const effectiveConfig = modelConfig ? { ...config, ...modelConfig } : config;

  // Use smart-ranking with model-specific config
  return applySmartRankingStrategy(fields, effectiveConfig);
}

/**
 * Main function to filter fields into primary and remaining sets
 */
export function filterPrimaryFields(
  fields: ModelField[],
  config: PrimaryFieldFilterConfig = DEFAULT_PRIMARY_FIELD_CONFIG,
  modelName?: string
): PrimaryFieldResult {
  if (fields.length === 0) {
    return {
      primaryFields: [],
      remainingFields: [],
      totalFields: 0,
      strategy: config.strategy,
      appliedConfig: config
    };
  }

  let primary: ModelField[];
  let remaining: ModelField[];

  switch (config.strategy) {
    case 'required-only':
      ({ primary, remaining } = applyRequiredOnlyStrategy(fields, config));
      break;

    case 'rule-based':
      ({ primary, remaining } = applyRuleBasedStrategy(fields, config));
      break;

    case 'smart-ranking':
      ({ primary, remaining } = applySmartRankingStrategy(fields, config));
      break;

    case 'context-aware':
      ({ primary, remaining } = applyContextAwareStrategy(fields, config, modelName));
      break;

    default:
      ({ primary, remaining } = applySmartRankingStrategy(fields, config));
  }

  return {
    primaryFields: primary,
    remainingFields: remaining,
    totalFields: fields.length,
    strategy: config.strategy,
    appliedConfig: config
  };
}

/**
 * Get a summary of primary field filtering for debugging
 */
export function getPrimaryFieldSummary(
  result: PrimaryFieldResult,
  modelName?: string
): string {
  const { primaryFields, remainingFields, totalFields, strategy } = result;

  return [
    `Model: ${modelName || 'Unknown'}`,
    `Strategy: ${strategy}`,
    `Total fields: ${totalFields}`,
    `Primary fields: ${primaryFields.length} (${primaryFields.map(f => f.name).join(', ')})`,
    `Remaining fields: ${remainingFields.length}`,
    `Hidden fields: ${remainingFields.map(f => f.name).join(', ') || 'none'}`
  ].join('\n');
}

/**
 * Analyze and log primary field filtering results for debugging
 */
export function analyzePrimaryFieldFiltering(
  fields: ModelField[],
  modelName: string,
  config: PrimaryFieldFilterConfig = DEFAULT_PRIMARY_FIELD_CONFIG
): PrimaryFieldResult {
  const result = filterPrimaryFields(fields, config, modelName);

  console.group(`Primary Field Analysis for ${modelName}`);
  console.log(getPrimaryFieldSummary(result, modelName));
  console.groupEnd();

  return result;
}