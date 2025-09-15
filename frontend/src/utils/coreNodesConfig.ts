/**
 * Core Nodes Configuration
 * 
 * Defines the most important "core" nodes for each Nautobot app
 * to reduce visual complexity by showing only essential models by default.
 */

export interface CoreNodesConfig {
  [app: string]: string[];
}

/**
 * Core nodes configuration mapping each app to its essential models
 * These represent the most commonly used and important models for each app
 */
export const coreNodesConfig: CoreNodesConfig = {
  // Data Center Infrastructure Management - Core infrastructure components
  dcim: [
    'DeviceType',        // Main device types/models
    'LocationType',      // Physical locations
    'RackType',          // Rack infrastructure
    'InterfaceType',     // Network interfaces
    'PlatformType'       // Device platforms
  ],

  // Circuits - Essential connectivity models
  circuits: [
    'CircuitType',              // Circuit definitions
    'CircuitTerminationType',   // Circuit endpoints
    'ProviderType'              // Service providers
  ],

  // IP Address Management - Core IP/networking models
  ipam: [
    'IPAddressType',     // IP address assignments
    'PrefixType',        // Network prefixes/subnets
    'VLANType',          // Virtual LANs
    'VRFType'            // Virtual routing and forwarding
  ],

  // Tenancy - Multi-tenancy core models
  tenancy: [
    'TenantType',
    'TenantGroupType'
  ],

  // Users and Authentication - Core user management
  users: [
    'UserType',
    'GroupType',
    'DynamicGroupType'
  ],

  // Extras - Essential extensibility features
  extras: [
    'TagType',
    'StatusType',
    'CustomFieldType'
  ],

  // Virtualization - Core VM infrastructure
  virtualization: [
    'VirtualMachineType',
    'ClusterType'
  ],

  // Core Django/Nautobot functionality
  core: [
    'ContentTypeType',
    'ComputedFieldType'
  ]
};

/**
 * Get all core node names across all apps
 */
export function getAllCoreNodes(): string[] {
  return Object.values(coreNodesConfig).flat();
}

/**
 * Get core nodes for a specific app
 */
export function getCoreNodesForApp(app: string): string[] {
  return coreNodesConfig[app] || [];
}

/**
 * Check if a model is considered a core node for its app
 */
export function isCoreNode(app: string, modelName: string): boolean {
  console.log(`=== CORE NODE CHECK ===`);
  console.log(`Checking if "${modelName}" in app "${app}" is a core node`);

  const coreNodes = getCoreNodesForApp(app);
  console.log(`Core nodes for app "${app}":`, coreNodes);

  const isCore = coreNodes.includes(modelName);
  console.log(`Result: ${isCore} (${modelName} ${isCore ? 'IS' : 'IS NOT'} in core nodes list)`);

  // If not found, check for case sensitivity issues or partial matches
  if (!isCore) {
    console.log('=== DEBUGGING NON-CORE MATCH ===');
    console.log(`Exact match check: "${modelName}" in [${coreNodes.map(n => `"${n}"`).join(', ')}]`);

    // Check case-insensitive matches
    const caseInsensitiveMatch = coreNodes.some(coreNode =>
      coreNode.toLowerCase() === modelName.toLowerCase()
    );
    console.log(`Case-insensitive match: ${caseInsensitiveMatch}`);

    // Check partial matches
    const partialMatches = coreNodes.filter(coreNode =>
      coreNode.includes(modelName) || modelName.includes(coreNode)
    );
    if (partialMatches.length > 0) {
      console.log(`Partial matches found:`, partialMatches);
    }
  }

  return isCore;
}

/**
 * Get statistics about core vs non-core nodes
 */
export function getCoreNodesStats(nodes: Array<{ data?: { app?: string; name?: string } }>): {
  total: number;
  core: number;
  nonCore: number;
  corePercentage: number;
} {
  const total = nodes.length;
  const core = nodes.filter(node => 
    node.data?.app && node.data?.name && 
    isCoreNode(node.data.app, node.data.name)
  ).length;
  const nonCore = total - core;
  const corePercentage = total > 0 ? Math.round((core / total) * 100) : 0;
  
  return { total, core, nonCore, corePercentage };
}