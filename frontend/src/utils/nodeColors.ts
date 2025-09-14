/**
 * App-specific color mappings and utility functions for Nautobot model visualization
 */

// Color palette based on Nautobot's app structure and visual hierarchy
export const APP_COLORS = {
  // Core apps
  dcim: {
    primary: '#2563eb',      // blue-600
    secondary: '#3b82f6',    // blue-500
    light: '#dbeafe',        // blue-100
    text: '#1e40af'          // blue-700
  },
  ipam: {
    primary: '#059669',      // emerald-600
    secondary: '#10b981',    // emerald-500
    light: '#d1fae5',        // emerald-100
    text: '#047857'          // emerald-700
  },
  circuits: {
    primary: '#7c3aed',      // violet-600
    secondary: '#8b5cf6',    // violet-500
    light: '#ede9fe',        // violet-100
    text: '#6d28d9'          // violet-700
  },
  tenancy: {
    primary: '#dc2626',      // red-600
    secondary: '#ef4444',    // red-500
    light: '#fee2e2',        // red-100
    text: '#b91c1c'          // red-700
  },
  extras: {
    primary: '#ea580c',      // orange-600
    secondary: '#f97316',    // orange-500
    light: '#fed7aa',        // orange-100
    text: '#c2410c'          // orange-700
  },
  users: {
    primary: '#0891b2',      // cyan-600
    secondary: '#06b6d4',    // cyan-500
    light: '#cffafe',        // cyan-100
    text: '#0e7490'          // cyan-700
  },
  // Default for unknown apps
  default: {
    primary: '#6b7280',      // gray-500
    secondary: '#9ca3af',    // gray-400
    light: '#f3f4f6',        // gray-100
    text: '#374151'          // gray-700
  }
};

// Model type specific configurations
export const MODEL_TYPE_CONFIGS = {
  Device: {
    icon: 'PC',
    priority: 'high' as const,
    strokeWidth: 2
  },
  Site: {
    icon: 'LOC',
    priority: 'high' as const,
    strokeWidth: 2
  },
  Circuit: {
    icon: 'CIR',
    priority: 'high' as const,
    strokeWidth: 2
  },
  Provider: {
    icon: 'PRV',
    priority: 'high' as const,
    strokeWidth: 2
  },
  CircuitTermination: {
    icon: 'TRM',
    priority: 'medium' as const,
    strokeWidth: 1.5
  },
  CircuitType: {
    icon: 'TYP',
    priority: 'medium' as const,
    strokeWidth: 1.5
  },
  Interface: {
    icon: 'INT',
    priority: 'medium' as const,
    strokeWidth: 1.5
  },
  IPAddress: {
    icon: 'IP',
    priority: 'medium' as const,
    strokeWidth: 1.5
  },
  VLAN: {
    icon: 'VL',
    priority: 'medium' as const,
    strokeWidth: 1.5
  },
  Prefix: {
    icon: 'PFX',
    priority: 'medium' as const,
    strokeWidth: 1.5
  },
  VRF: {
    icon: 'VRF',
    priority: 'high' as const,
    strokeWidth: 2
  },
  Role: {
    icon: 'ROL',
    priority: 'medium' as const,
    strokeWidth: 1.5
  },
  Service: {
    icon: 'SRV',
    priority: 'medium' as const,
    strokeWidth: 1.5
  },
  Aggregate: {
    icon: 'AGG',
    priority: 'high' as const,
    strokeWidth: 2
  },
  RIR: {
    icon: 'RIR',
    priority: 'high' as const,
    strokeWidth: 2
  },
  Tenant: {
    icon: 'TEN',
    priority: 'low' as const,
    strokeWidth: 1
  },
  default: {
    icon: 'DOC',
    priority: 'low' as const,
    strokeWidth: 1
  }
};

/**
 * Get color scheme for a given Django app
 */
export function getAppColors(appName: string) {
  return APP_COLORS[appName as keyof typeof APP_COLORS] || APP_COLORS.default;
}

/**
 * Get model type configuration
 */
export function getModelTypeConfig(modelName: string) {
  return MODEL_TYPE_CONFIGS[modelName as keyof typeof MODEL_TYPE_CONFIGS] || MODEL_TYPE_CONFIGS.default;
}

/**
 * Generate CSS classes for a node based on its app and state
 */
export function getNodeClasses(
  _appName: string,
  _modelName: string,
  isAbstract: boolean = false,
  isSelected: boolean = false,
  isHovered: boolean = false
): string {
  const baseClasses = [
    'nautobot-node',
    'border-2',
    'rounded-lg',
    'shadow-md',
    'transition-all',
    'duration-200',
    'bg-white'
  ];

  // App-specific border color
  baseClasses.push('border-current');

  // Abstract model styling
  if (isAbstract) {
    baseClasses.push('border-dashed', 'opacity-75');
  }

  // Interactive states
  if (isSelected) {
    baseClasses.push('ring-2', 'ring-offset-2', 'shadow-lg');
  }

  if (isHovered) {
    baseClasses.push('shadow-lg', 'scale-105');
  }

  return baseClasses.join(' ');
}

/**
 * Get inline styles for dynamic coloring
 */
export function getNodeStyles(
  appName: string,
  isSelected: boolean = false,
  isHovered: boolean = false
): React.CSSProperties {
  const colors = getAppColors(appName);

  return {
    borderColor: isSelected ? colors.primary : colors.secondary,
    color: colors.text,
    backgroundColor: isHovered ? colors.light : 'white',
  };
}

/**
 * Get field type indicator colors and icons
 */
export const FIELD_TYPE_STYLES = {
  CharField: { color: '#6b7280', icon: 'T' },
  TextField: { color: '#6b7280', icon: 'T+' },
  IntegerField: { color: '#3b82f6', icon: '#' },
  BooleanField: { color: '#059669', icon: 'B' },
  DateField: { color: '#7c3aed', icon: 'D' },
  DateTimeField: { color: '#7c3aed', icon: 'DT' },
  EmailField: { color: '#dc2626', icon: '@' },
  URLField: { color: '#ea580c', icon: 'U' },
  ForeignKey: { color: '#059669', icon: 'FK' },
  ManyToManyField: { color: '#7c3aed', icon: 'M2M' },
  OneToOneField: { color: '#dc2626', icon: '1:1' },
  JSONField: { color: '#ea580c', icon: 'JS' },
  SlugField: { color: '#6b7280', icon: 'SL' },
  PositiveIntegerField: { color: '#3b82f6', icon: '#' },
  default: { color: '#6b7280', icon: '?' }
};

/**
 * Get field type styling
 */
export function getFieldTypeStyle(fieldType: string) {
  return FIELD_TYPE_STYLES[fieldType as keyof typeof FIELD_TYPE_STYLES] || FIELD_TYPE_STYLES.default;
}

/**
 * Generate CSS variable definitions for an app theme
 */
export function generateAppCSSVariables(appName: string): Record<string, string> {
  const colors = getAppColors(appName);
  return {
    '--node-primary': colors.primary,
    '--node-secondary': colors.secondary,
    '--node-light': colors.light,
    '--node-text': colors.text
  };
}