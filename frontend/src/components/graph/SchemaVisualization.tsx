import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  addEdge,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  Panel,
  type ReactFlowInstance,
  type Connection,
} from 'reactflow';
import { ArrowPathIcon, Squares2X2Icon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { appConstants } from '../../utils/config';
import type { NautobotNodeData, NautobotEdgeData } from '../../types/schema';
import { NautobotModelNode } from './NautobotModelNode';
import SimplifiedEdge from './SimplifiedEdge';
import { globalAutoLayout } from '../../utils/layout/autoLayout';

// Initial empty state for the flow
const initialNodes: Node<NautobotNodeData>[] = [];
const initialEdges: Edge<NautobotEdgeData>[] = [];

// Define custom node and edge types
const nodeTypes = {
  nautobotModel: NautobotModelNode,
};

const edgeTypes = {
  default: SimplifiedEdge,
  simplified: SimplifiedEdge,
};

export function SchemaVisualization() {
  // Debug logging
  useEffect(() => {
    console.log('SchemaVisualization component mounted');
    console.log('React Flow version check - ReactFlow:', typeof ReactFlow);
    console.log('Node types:', nodeTypes);
  }, []);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionMode] = useState<ConnectionMode>(ConnectionMode.Strict);
  const [layoutAlgorithm, setLayoutAlgorithm] = useState<'dagre' | 'hierarchical' | 'circular' | 'force' | 'elk'>('dagre');
  const [isAutoLayoutEnabled, setIsAutoLayoutEnabled] = useState(true);
  const [visibleApps, setVisibleApps] = useState(new Set(['dcim', 'circuits', 'ipam']));
  const [availableApps, setAvailableApps] = useState<string[]>([]);

  // Demo data for testing - this will be replaced with real API data later
  const loadDemoData = useCallback(() => {
    console.log('Loading demo data...');
    setIsLoading(true);

    // Simulate API loading delay
    setTimeout(async () => {
      try {
      const demoNodes: Node<NautobotNodeData>[] = [
        {
          id: 'device',
          type: 'nautobotModel',
          position: { x: 250, y: 100 },
          data: {
            id: 'device',
            name: 'Device',
            app: 'dcim',
            fields: [
              { name: 'name', type: 'CharField', required: true, nullable: false },
              { name: 'device_type', type: 'ForeignKey', required: true, nullable: false, relatedModel: 'DeviceType' },
              { name: 'site', type: 'ForeignKey', required: true, nullable: false, relatedModel: 'Site' },
              { name: 'status', type: 'CharField', required: true, nullable: false },
            ],
            customFields: [
              { name: 'asset_tag', type: 'text', required: true, unique: true, description: 'Asset tag number' },
              { name: 'warranty_expiry', type: 'date', required: false, unique: false, description: 'Warranty expiration date' },
              { name: 'owner_department', type: 'select', required: false, unique: false, choices: ['IT', 'Network', 'Security', 'Operations'], description: 'Owning department' },
            ],
            relationships: {
              outgoing: [
                {
                  id: 'device-site',
                  fromModel: 'Device',
                  toModel: 'Site',
                  type: 'foreign_key',
                  fieldName: 'site',
                },
                {
                  id: 'device-devicetype',
                  fromModel: 'Device',
                  toModel: 'DeviceType',
                  type: 'foreign_key',
                  fieldName: 'device_type',
                }
              ],
              incoming: [
                {
                  id: 'interface-device',
                  fromModel: 'Interface',
                  toModel: 'Device',
                  type: 'reverse_foreign_key',
                  fieldName: 'device',
                  relatedName: 'interfaces',
                }
              ]
            },
            isAbstract: false,
            expanded: true,
            selected: false,
          },
        },
        {
          id: 'interface',
          type: 'nautobotModel',
          position: { x: 600, y: 100 },
          data: {
            id: 'interface',
            name: 'Interface',
            app: 'dcim',
            fields: [
              { name: 'name', type: 'CharField', required: true, nullable: false },
              { name: 'type', type: 'CharField', required: true, nullable: false },
              { name: 'enabled', type: 'BooleanField', required: false, nullable: false },
              { name: 'mtu', type: 'PositiveIntegerField', required: false, nullable: true },
              { name: 'description', type: 'TextField', required: false, nullable: false },
            ],
            relationships: {
              outgoing: [
                {
                  id: 'interface-device',
                  fromModel: 'Interface',
                  toModel: 'Device',
                  type: 'foreign_key',
                  fieldName: 'device',
                }
              ],
              incoming: [
                {
                  id: 'ipaddress-interface',
                  fromModel: 'IPAddress',
                  toModel: 'Interface',
                  type: 'reverse_foreign_key',
                  fieldName: 'assigned_object',
                  relatedName: 'ip_addresses',
                }
              ]
            },
            isAbstract: false,
            expanded: true,
            selected: false,
          },
        },
        {
          id: 'site',
          type: 'nautobotModel',
          position: { x: 100, y: 250 },
          data: {
            id: 'site',
            name: 'Site',
            app: 'dcim',
            fields: [
              { name: 'name', type: 'CharField', required: true, nullable: false },
              { name: 'slug', type: 'SlugField', required: true, nullable: false },
              { name: 'region', type: 'ForeignKey', required: false, nullable: true, relatedModel: 'Region' },
            ],
            relationships: {
              outgoing: [],
              incoming: [
                {
                  id: 'device-site',
                  fromModel: 'Device',
                  toModel: 'Site',
                  type: 'reverse_foreign_key',
                  fieldName: 'site',
                  relatedName: 'devices',
                }
              ]
            },
            isAbstract: false,
            expanded: true,
            selected: false,
          },
        },
        {
          id: 'devicetype',
          type: 'nautobotModel',
          position: { x: 400, y: 250 },
          data: {
            id: 'devicetype',
            name: 'DeviceType',
            app: 'dcim',
            fields: [
              { name: 'model', type: 'CharField', required: true, nullable: false },
              { name: 'manufacturer', type: 'ForeignKey', required: true, nullable: false, relatedModel: 'Manufacturer' },
              { name: 'u_height', type: 'PositiveSmallIntegerField', required: false, nullable: false },
            ],
            relationships: {
              outgoing: [],
              incoming: [
                {
                  id: 'device-devicetype',
                  fromModel: 'Device',
                  toModel: 'DeviceType',
                  type: 'reverse_foreign_key',
                  fieldName: 'device_type',
                  relatedName: 'devices',
                }
              ]
            },
            isAbstract: false,
            expanded: true,
            selected: false,
          },
        },
        // Circuit models
        {
          id: 'circuit',
          type: 'nautobotModel',
          position: { x: 650, y: 100 },
          data: {
            id: 'circuit',
            name: 'Circuit',
            app: 'circuits',
            fields: [
              { name: 'cid', type: 'CharField', required: true, nullable: false },
              { name: 'status', type: 'CharField', required: true, nullable: false },
              { name: 'commit_rate', type: 'PositiveIntegerField', required: false, nullable: true },
              { name: 'install_date', type: 'DateField', required: false, nullable: true },
              { name: 'provider', type: 'ForeignKey', required: true, nullable: false, relatedModel: 'Provider' },
              { name: 'type', type: 'ForeignKey', required: true, nullable: false, relatedModel: 'CircuitType' },
            ],
            customFields: [
              { name: 'business_priority', type: 'select', required: false, unique: false, choices: ['Low', 'Medium', 'High', 'Critical'], description: 'Business priority level' },
              { name: 'installation_notes', type: 'text', required: false, unique: false, description: 'Installation notes and comments' },
              { name: 'maintenance_window', type: 'datetime', required: false, unique: false, description: 'Scheduled maintenance window' },
              { name: 'is_legacy', type: 'boolean', required: false, unique: false, description: 'Whether this is a legacy circuit' },
            ],
            relationships: {
              outgoing: [
                {
                  id: 'circuit-provider',
                  fromModel: 'Circuit',
                  toModel: 'Provider',
                  type: 'foreign_key',
                  fieldName: 'provider',
                },
                {
                  id: 'circuit-circuittype',
                  fromModel: 'Circuit',
                  toModel: 'CircuitType',
                  type: 'foreign_key',
                  fieldName: 'type',
                }
              ],
              incoming: [
                {
                  id: 'circuittermination-circuit',
                  fromModel: 'CircuitTermination',
                  toModel: 'Circuit',
                  type: 'reverse_foreign_key',
                  fieldName: 'circuit',
                  relatedName: 'terminations',
                }
              ]
            },
            isAbstract: false,
            expanded: true,
            selected: false,
          },
        },
        {
          id: 'provider',
          type: 'nautobotModel',
          position: { x: 850, y: 100 },
          data: {
            id: 'provider',
            name: 'Provider',
            app: 'circuits',
            fields: [
              { name: 'name', type: 'CharField', required: true, nullable: false },
              { name: 'slug', type: 'SlugField', required: true, nullable: false },
              { name: 'asn', type: 'PositiveIntegerField', required: false, nullable: true },
              { name: 'account', type: 'CharField', required: false, nullable: false },
              { name: 'portal_url', type: 'URLField', required: false, nullable: true },
            ],
            relationships: {
              outgoing: [],
              incoming: [
                {
                  id: 'circuit-provider',
                  fromModel: 'Circuit',
                  toModel: 'Provider',
                  type: 'reverse_foreign_key',
                  fieldName: 'provider',
                  relatedName: 'circuits',
                }
              ]
            },
            isAbstract: false,
            expanded: true,
            selected: false,
          },
        },
        {
          id: 'circuittermination',
          type: 'nautobotModel',
          position: { x: 650, y: 300 },
          data: {
            id: 'circuittermination',
            name: 'CircuitTermination',
            app: 'circuits',
            fields: [
              { name: 'term_side', type: 'CharField', required: true, nullable: false },
              { name: 'port_speed', type: 'PositiveIntegerField', required: false, nullable: true },
              { name: 'xconnect_id', type: 'CharField', required: false, nullable: false },
              { name: 'pp_info', type: 'CharField', required: false, nullable: false },
              { name: 'description', type: 'TextField', required: false, nullable: false },
              { name: 'circuit', type: 'ForeignKey', required: true, nullable: false, relatedModel: 'Circuit' },
            ],
            relationships: {
              outgoing: [
                {
                  id: 'circuittermination-circuit',
                  fromModel: 'CircuitTermination',
                  toModel: 'Circuit',
                  type: 'foreign_key',
                  fieldName: 'circuit',
                }
              ],
              incoming: []
            },
            isAbstract: false,
            expanded: true,
            selected: false,
          },
        },
        {
          id: 'circuittype',
          type: 'nautobotModel',
          position: { x: 850, y: 300 },
          data: {
            id: 'circuittype',
            name: 'CircuitType',
            app: 'circuits',
            fields: [
              { name: 'name', type: 'CharField', required: true, nullable: false },
              { name: 'slug', type: 'SlugField', required: true, nullable: false },
              { name: 'description', type: 'TextField', required: false, nullable: false },
            ],
            relationships: {
              outgoing: [],
              incoming: [
                {
                  id: 'circuit-circuittype',
                  fromModel: 'Circuit',
                  toModel: 'CircuitType',
                  type: 'reverse_foreign_key',
                  fieldName: 'type',
                  relatedName: 'circuits',
                }
              ]
            },
            isAbstract: false,
            expanded: true,
            selected: false,
          },
        },
        // IPAM Models
        {
          id: 'vrf',
          type: 'nautobotModel',
          position: { x: 100, y: 600 },
          data: {
            id: 'vrf',
            name: 'VRF',
            app: 'ipam',
            fields: [
              { name: 'name', type: 'CharField', required: true, nullable: false },
              { name: 'rd', type: 'CharField', required: false, nullable: true },
              { name: 'enforce_unique', type: 'BooleanField', required: false, nullable: false },
              { name: 'description', type: 'TextField', required: false, nullable: false },
            ],
            relationships: {
              outgoing: [],
              incoming: [
                {
                  id: 'prefix-vrf',
                  fromModel: 'Prefix',
                  toModel: 'VRF',
                  type: 'reverse_foreign_key',
                  fieldName: 'vrf',
                  relatedName: 'prefixes',
                },
                {
                  id: 'ipaddress-vrf',
                  fromModel: 'IPAddress',
                  toModel: 'VRF',
                  type: 'reverse_foreign_key',
                  fieldName: 'vrf',
                  relatedName: 'ip_addresses',
                }
              ]
            },
            isAbstract: false,
            expanded: true,
            selected: false,
          },
        },
        {
          id: 'prefix',
          type: 'nautobotModel',
          position: { x: 300, y: 600 },
          data: {
            id: 'prefix',
            name: 'Prefix',
            app: 'ipam',
            fields: [
              { name: 'prefix', type: 'CharField', required: true, nullable: false },
              { name: 'status', type: 'CharField', required: true, nullable: false },
              { name: 'role', type: 'ForeignKey', required: false, nullable: true, relatedModel: 'Role' },
              { name: 'is_pool', type: 'BooleanField', required: false, nullable: false },
              { name: 'description', type: 'TextField', required: false, nullable: false },
            ],
            customFields: [
              { name: 'allocation_type', type: 'select', required: false, unique: false, choices: ['Infrastructure', 'Customer', 'Management'], description: 'Type of IP allocation' },
              { name: 'subnet_mask', type: 'text', required: false, unique: false, description: 'Subnet mask notation' },
            ],
            relationships: {
              outgoing: [
                {
                  id: 'prefix-vrf',
                  fromModel: 'Prefix',
                  toModel: 'VRF',
                  type: 'foreign_key',
                  fieldName: 'vrf',
                },
                {
                  id: 'prefix-role',
                  fromModel: 'Prefix',
                  toModel: 'Role',
                  type: 'foreign_key',
                  fieldName: 'role',
                },
                {
                  id: 'prefix-parent',
                  fromModel: 'Prefix',
                  toModel: 'Prefix',
                  type: 'foreign_key',
                  fieldName: 'parent',
                }
              ],
              incoming: [
                {
                  id: 'prefix-parent-children',
                  fromModel: 'Prefix',
                  toModel: 'Prefix',
                  type: 'reverse_foreign_key',
                  fieldName: 'parent',
                  relatedName: 'children',
                },
                {
                  id: 'ipaddress-prefix',
                  fromModel: 'IPAddress',
                  toModel: 'Prefix',
                  type: 'reverse_foreign_key',
                  fieldName: 'prefix',
                  relatedName: 'ip_addresses',
                }
              ]
            },
            isAbstract: false,
            expanded: true,
            selected: false,
          },
        },
        {
          id: 'ipaddress',
          type: 'nautobotModel',
          position: { x: 500, y: 600 },
          data: {
            id: 'ipaddress',
            name: 'IPAddress',
            app: 'ipam',
            fields: [
              { name: 'address', type: 'CharField', required: true, nullable: false },
              { name: 'status', type: 'CharField', required: true, nullable: false },
              { name: 'role', type: 'CharField', required: false, nullable: false },
              { name: 'dns_name', type: 'CharField', required: false, nullable: false },
              { name: 'description', type: 'TextField', required: false, nullable: false },
            ],
            relationships: {
              outgoing: [
                {
                  id: 'ipaddress-vrf',
                  fromModel: 'IPAddress',
                  toModel: 'VRF',
                  type: 'foreign_key',
                  fieldName: 'vrf',
                },
                {
                  id: 'ipaddress-prefix',
                  fromModel: 'IPAddress',
                  toModel: 'Prefix',
                  type: 'foreign_key',
                  fieldName: 'prefix',
                },
                {
                  id: 'ipaddress-interface',
                  fromModel: 'IPAddress',
                  toModel: 'Interface',
                  type: 'foreign_key',
                  fieldName: 'assigned_object',
                }
              ],
              incoming: [
                {
                  id: 'service-ipaddress',
                  fromModel: 'Service',
                  toModel: 'IPAddress',
                  type: 'reverse_foreign_key',
                  fieldName: 'ipaddresses',
                  relatedName: 'services',
                }
              ]
            },
            isAbstract: false,
            expanded: true,
            selected: false,
          },
        },
        {
          id: 'vlan',
          type: 'nautobotModel',
          position: { x: 700, y: 600 },
          data: {
            id: 'vlan',
            name: 'VLAN',
            app: 'ipam',
            fields: [
              { name: 'vid', type: 'PositiveSmallIntegerField', required: true, nullable: false },
              { name: 'name', type: 'CharField', required: true, nullable: false },
              { name: 'status', type: 'CharField', required: true, nullable: false },
              { name: 'role', type: 'ForeignKey', required: false, nullable: true, relatedModel: 'Role' },
              { name: 'description', type: 'TextField', required: false, nullable: false },
            ],
            relationships: {
              outgoing: [
                {
                  id: 'vlan-role',
                  fromModel: 'VLAN',
                  toModel: 'Role',
                  type: 'foreign_key',
                  fieldName: 'role',
                }
              ],
              incoming: []
            },
            isAbstract: false,
            expanded: true,
            selected: false,
          },
        },
        {
          id: 'role',
          type: 'nautobotModel',
          position: { x: 900, y: 600 },
          data: {
            id: 'role',
            name: 'Role',
            app: 'ipam',
            fields: [
              { name: 'name', type: 'CharField', required: true, nullable: false },
              { name: 'slug', type: 'SlugField', required: true, nullable: false },
              { name: 'weight', type: 'PositiveSmallIntegerField', required: false, nullable: false },
              { name: 'description', type: 'TextField', required: false, nullable: false },
            ],
            relationships: {
              outgoing: [],
              incoming: [
                {
                  id: 'prefix-role',
                  fromModel: 'Prefix',
                  toModel: 'Role',
                  type: 'reverse_foreign_key',
                  fieldName: 'role',
                  relatedName: 'prefixes',
                },
                {
                  id: 'vlan-role',
                  fromModel: 'VLAN',
                  toModel: 'Role',
                  type: 'reverse_foreign_key',
                  fieldName: 'role',
                  relatedName: 'vlans',
                }
              ]
            },
            isAbstract: false,
            expanded: true,
            selected: false,
          },
        },
        {
          id: 'service',
          type: 'nautobotModel',
          position: { x: 300, y: 800 },
          data: {
            id: 'service',
            name: 'Service',
            app: 'ipam',
            fields: [
              { name: 'name', type: 'CharField', required: true, nullable: false },
              { name: 'protocol', type: 'CharField', required: true, nullable: false },
              { name: 'ports', type: 'JSONField', required: true, nullable: false },
              { name: 'description', type: 'TextField', required: false, nullable: false },
            ],
            relationships: {
              outgoing: [
                {
                  id: 'service-ipaddress',
                  fromModel: 'Service',
                  toModel: 'IPAddress',
                  type: 'many_to_many',
                  fieldName: 'ipaddresses',
                }
              ],
              incoming: []
            },
            isAbstract: false,
            expanded: true,
            selected: false,
          },
        },
        {
          id: 'aggregate',
          type: 'nautobotModel',
          position: { x: 100, y: 800 },
          data: {
            id: 'aggregate',
            name: 'Aggregate',
            app: 'ipam',
            fields: [
              { name: 'prefix', type: 'CharField', required: true, nullable: false },
              { name: 'rir', type: 'ForeignKey', required: true, nullable: false, relatedModel: 'RIR' },
              { name: 'date_added', type: 'DateField', required: false, nullable: true },
              { name: 'description', type: 'TextField', required: false, nullable: false },
            ],
            relationships: {
              outgoing: [
                {
                  id: 'aggregate-rir',
                  fromModel: 'Aggregate',
                  toModel: 'RIR',
                  type: 'foreign_key',
                  fieldName: 'rir',
                }
              ],
              incoming: []
            },
            isAbstract: false,
            expanded: true,
            selected: false,
          },
        },
        {
          id: 'rir',
          type: 'nautobotModel',
          position: { x: 500, y: 800 },
          data: {
            id: 'rir',
            name: 'RIR',
            app: 'ipam',
            fields: [
              { name: 'name', type: 'CharField', required: true, nullable: false },
              { name: 'slug', type: 'SlugField', required: true, nullable: false },
              { name: 'is_private', type: 'BooleanField', required: false, nullable: false },
              { name: 'description', type: 'TextField', required: false, nullable: false },
            ],
            relationships: {
              outgoing: [],
              incoming: [
                {
                  id: 'aggregate-rir',
                  fromModel: 'Aggregate',
                  toModel: 'RIR',
                  type: 'reverse_foreign_key',
                  fieldName: 'rir',
                  relatedName: 'aggregates',
                }
              ]
            },
            isAbstract: false,
            expanded: true,
            selected: false,
          },
        },
      ];

      const demoEdges: Edge<NautobotEdgeData>[] = [
        {
          id: 'device-site',
          source: 'device',
          target: 'site',
          type: 'simplified',
          animated: false,
          data: {
            id: 'device-site',
            fromModel: 'Device',
            toModel: 'Site',
            type: 'foreign_key',
            fieldName: 'site',
          },
        },
        {
          id: 'device-devicetype',
          source: 'device',
          target: 'devicetype',
          type: 'simplified',
          animated: false,
          data: {
            id: 'device-devicetype',
            fromModel: 'Device',
            toModel: 'DeviceType',
            type: 'foreign_key',
            fieldName: 'device_type',
          },
        },
        // Circuit relationships
        {
          id: 'circuit-provider',
          source: 'circuit',
          target: 'provider',
          type: 'simplified',
          animated: false,
          data: {
            id: 'circuit-provider',
            fromModel: 'Circuit',
            toModel: 'Provider',
            type: 'foreign_key',
            fieldName: 'provider',
          },
        },
        {
          id: 'circuit-circuittype',
          source: 'circuit',
          target: 'circuittype',
          type: 'simplified',
          animated: false,
          data: {
            id: 'circuit-circuittype',
            fromModel: 'Circuit',
            toModel: 'CircuitType',
            type: 'foreign_key',
            fieldName: 'type',
          },
        },
        {
          id: 'circuittermination-circuit',
          source: 'circuittermination',
          target: 'circuit',
          type: 'simplified',
          animated: false,
          data: {
            id: 'circuittermination-circuit',
            fromModel: 'CircuitTermination',
            toModel: 'Circuit',
            type: 'foreign_key',
            fieldName: 'circuit',
          },
        },
        // Demo custom relationship
        {
          id: 'device-circuit-custom',
          source: 'device',
          target: 'circuit',
          type: 'simplified',
          animated: false,
          data: {
            id: 'device-circuit-custom',
            fromModel: 'Device',
            toModel: 'Circuit',
            type: 'custom_relationship',
            fieldName: 'related_circuit',
            customRelationshipName: 'Primary Circuit',
          },
        },
        // IPAM relationships
        {
          id: 'prefix-vrf',
          source: 'prefix',
          target: 'vrf',
          type: 'simplified',
          animated: false,
          data: {
            id: 'prefix-vrf',
            fromModel: 'Prefix',
            toModel: 'VRF',
            type: 'foreign_key',
            fieldName: 'vrf',
          },
        },
        {
          id: 'ipaddress-vrf',
          source: 'ipaddress',
          target: 'vrf',
          type: 'simplified',
          animated: false,
          data: {
            id: 'ipaddress-vrf',
            fromModel: 'IPAddress',
            toModel: 'VRF',
            type: 'foreign_key',
            fieldName: 'vrf',
          },
        },
        {
          id: 'ipaddress-prefix',
          source: 'ipaddress',
          target: 'prefix',
          type: 'simplified',
          animated: false,
          data: {
            id: 'ipaddress-prefix',
            fromModel: 'IPAddress',
            toModel: 'Prefix',
            type: 'foreign_key',
            fieldName: 'prefix',
          },
        },
        {
          id: 'prefix-role',
          source: 'prefix',
          target: 'role',
          type: 'simplified',
          animated: false,
          data: {
            id: 'prefix-role',
            fromModel: 'Prefix',
            toModel: 'Role',
            type: 'foreign_key',
            fieldName: 'role',
          },
        },
        {
          id: 'vlan-role',
          source: 'vlan',
          target: 'role',
          type: 'simplified',
          animated: false,
          data: {
            id: 'vlan-role',
            fromModel: 'VLAN',
            toModel: 'Role',
            type: 'foreign_key',
            fieldName: 'role',
          },
        },
        {
          id: 'service-ipaddress',
          source: 'service',
          target: 'ipaddress',
          type: 'simplified',
          animated: false,
          data: {
            id: 'service-ipaddress',
            fromModel: 'Service',
            toModel: 'IPAddress',
            type: 'many_to_many',
            fieldName: 'ipaddresses',
          },
        },
        {
          id: 'aggregate-rir',
          source: 'aggregate',
          target: 'rir',
          type: 'simplified',
          animated: false,
          data: {
            id: 'aggregate-rir',
            fromModel: 'Aggregate',
            toModel: 'RIR',
            type: 'foreign_key',
            fieldName: 'rir',
          },
        },
        // Hierarchical prefix relationship
        {
          id: 'prefix-parent',
          source: 'prefix',
          target: 'prefix',
          type: 'simplified',
          animated: false,
          data: {
            id: 'prefix-parent',
            fromModel: 'Prefix',
            toModel: 'Prefix',
            type: 'foreign_key',
            fieldName: 'parent',
          },
        },
        // IPAM-DCIM cross-app relationships
        {
          id: 'interface-device',
          source: 'interface',
          target: 'device',
          type: 'simplified',
          animated: false,
          data: {
            id: 'interface-device',
            fromModel: 'Interface',
            toModel: 'Device',
            type: 'foreign_key',
            fieldName: 'device',
          },
        },
        {
          id: 'ipaddress-interface',
          source: 'ipaddress',
          target: 'interface',
          type: 'simplified',
          animated: false,
          data: {
            id: 'ipaddress-interface',
            fromModel: 'IPAddress',
            toModel: 'Interface',
            type: 'foreign_key',
            fieldName: 'assigned_object',
          },
        },
      ];

        console.log('Demo data created:', { nodes: demoNodes.length, edges: demoEdges.length });

        // Apply auto-layout if enabled
        if (isAutoLayoutEnabled) {
          try {
            const startTime = Date.now();
            const layoutResult = await globalAutoLayout.applyLayout(demoNodes, demoEdges, {
              algorithm: layoutAlgorithm,
              direction: 'TB',
              nodeSpacing: 150,
              rankSpacing: 250,
              animate: true
            });
            const duration = Date.now() - startTime;
            console.log('Layout applied:', layoutAlgorithm, `in ${duration}ms`);

            // Use simplified edges
            const enhancedEdges = layoutResult.edges.map(edge => ({
              ...edge,
              type: 'simplified',
              data: {
                ...edge.data,
              }
            }));

            setNodes(layoutResult.nodes);
            setEdges(enhancedEdges);
            
            // Extract available apps from nodes for persistent controls
            const apps = Array.from(new Set(layoutResult.nodes.map(n => n.data?.app).filter(Boolean)));
            setAvailableApps(apps);

            // No longer need edge router updates with simplified approach

          } catch (error) {
            console.error('Layout failed, using original positions:', error);
            setNodes(demoNodes);
            setEdges(demoEdges);
          }
        } else {
          setNodes(demoNodes);
          setEdges(demoEdges);
          
          // Extract available apps from nodes for persistent controls
          const apps = Array.from(new Set(demoNodes.map(n => n.data?.app).filter(Boolean)));
          setAvailableApps(apps);
        }

        setIsLoading(false);
        console.log('Demo data loaded successfully');
      } catch (error) {
        console.error('Error loading demo data:', error);
        setIsLoading(false);
      }
    }, 1000);
  }, [setNodes, setEdges, isAutoLayoutEnabled, layoutAlgorithm]);

  // Load demo data on component mount
  useEffect(() => {
    loadDemoData();
  }, [loadDemoData]);

  // Filter nodes and edges based on visible apps
  const filteredNodes = useMemo(() => {
    return nodes.filter(node => {
      const app = (node.data as any)?.app;
      return visibleApps.has(app);
    });
  }, [nodes, visibleApps]);

  const filteredEdges = useMemo(() => {
    const visibleNodeIds = new Set(filteredNodes.map(node => node.id));
    return edges.filter(edge =>
      visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    );
  }, [edges, filteredNodes]);

  // Toggle app visibility
  const toggleAppVisibility = useCallback((app: string) => {
    setVisibleApps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(app)) {
        newSet.delete(app);
      } else {
        newSet.add(app);
      }
      return newSet;
    });
  }, []);

  // Handle new connections (for demo purposes)
  const onConnect = useCallback(
    (params: Connection) => {
      console.log('Creating new connection:', params);
      try {
        setEdges((eds) => addEdge(params, eds));
      } catch (error) {
        console.error('Error creating connection:', error);
      }
    },
    [setEdges]
  );

  // Simple node drag stop handler (no collision detection needed for simplicity)
  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, _node: Node) => {
      // With simplified approach, just let React Flow handle node positioning
    },
    []
  );

  // Handle fit view
  const onFitView = useCallback(() => {
    console.log('Fitting view...');
    if (reactFlowInstance) {
      try {
        reactFlowInstance.fitView({ padding: 0.2 });
        console.log('Fit view successful');
      } catch (error) {
        console.error('Error fitting view:', error);
      }
    } else {
      console.warn('React Flow instance not available for fit view');
    }
  }, [reactFlowInstance]);

  // Handle reset layout
  const onResetLayout = useCallback(() => {
    loadDemoData();
    setTimeout(() => {
      if (reactFlowInstance) {
        reactFlowInstance.fitView({ padding: 0.2 });
      }
    }, 100);
  }, [loadDemoData, reactFlowInstance]);

  // Handle layout algorithm change
  const onLayoutChange = useCallback(async (newAlgorithm: 'dagre' | 'hierarchical' | 'circular' | 'force' | 'elk') => {
    setLayoutAlgorithm(newAlgorithm);

    if (nodes.length > 0 && isAutoLayoutEnabled) {
      setIsLoading(true);
      try {
        const startTime = Date.now();
        const layoutResult = await globalAutoLayout.applyLayout(nodes, edges, {
          algorithm: newAlgorithm,
          direction: 'TB',
          nodeSpacing: 150,
          rankSpacing: 250,
          animate: true
        });
        const duration = Date.now() - startTime;
        console.log('Layout changed to:', newAlgorithm, `in ${duration}ms`);

        // Use simplified edges
        const enhancedEdges = layoutResult.edges.map(edge => ({
          ...edge,
          type: 'simplified',
          data: {
            ...edge.data,
          }
        }));

        setNodes(layoutResult.nodes);
        setEdges(enhancedEdges);
        
        // Extract available apps from nodes for persistent controls
        const apps = Array.from(new Set(layoutResult.nodes.map(n => n.data?.app).filter(Boolean)));
        setAvailableApps(apps);

        // No longer need edge router updates with simplified approach

        setTimeout(() => {
          if (reactFlowInstance) {
            reactFlowInstance.fitView({ padding: 0.2 });
          }
        }, 100);
      } catch (error) {
        console.error('Layout change failed:', error);
      } finally {
        setIsLoading(false);
      }
    }
  }, [nodes, edges, reactFlowInstance, isAutoLayoutEnabled]);

  // Toggle auto-layout
  const toggleAutoLayout = useCallback(() => {
    setIsAutoLayoutEnabled(prev => !prev);
  }, []);


  // Configure React Flow with app constants
  const { minZoom, maxZoom, defaultZoom } = appConstants.reactFlow;

  // Memoize React Flow props for performance
  const reactFlowProps = useMemo(() => ({
    nodes: filteredNodes,
    edges: filteredEdges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeDragStop,
    connectionMode,
    nodeTypes,
    edgeTypes,
    minZoom,
    maxZoom,
    defaultZoom,
    fitView: true,
    attributionPosition: 'top-right' as const,
    proOptions: { hideAttribution: true },
    deleteKeyCode: 'Delete',
    multiSelectionKeyCode: 'Shift',
  }), [
    filteredNodes,
    filteredEdges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeDragStop,
    connectionMode,
    minZoom,
    maxZoom,
    defaultZoom,
  ]);

  // Debug state logging removed to prevent console spam

  // Error handling for React Flow
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    // Reset error state when nodes change
    setRenderError(null);
  }, [nodes, edges]);

  if (renderError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-red-50">
        <div className="text-center p-8">
          <div className="text-red-600 text-xl font-bold mb-4">Rendering Error</div>
          <div className="text-red-700 mb-4">{renderError}</div>
          <button
            onClick={() => {
              setRenderError(null);
              loadDemoData();
            }}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  try {
    return (
      <div
        className="w-full h-full relative"
        style={{ width: '100%', height: '100%', minHeight: '500px' }}
      >
        <ReactFlow
          {...reactFlowProps}
          onInit={(instance) => {
            console.log('React Flow initialized:', instance);
            setReactFlowInstance(instance);
          }}
          onError={(error) => {
            console.error('React Flow error:', error);
            setRenderError(String(error) || 'Unknown React Flow error');
          }}
          className="bg-secondary-50"
          style={{ width: '100%', height: '100%' }}
        >
        {/* Enhanced Background pattern */}
        <Background
          color="#cbd5e1"
          gap={24}
          size={1.2}
          variant={"dots" as any}
          className="opacity-40"
        />

        {/* SVG definitions for smart edges */}
        <svg style={{ position: 'absolute', width: 0, height: 0 }}>
          <defs>
            <marker
              id="smart-edge-marker"
              markerWidth="8"
              markerHeight="8"
              refX="8"
              refY="3.5"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <polygon
                points="0 0, 8 3.5, 0 7"
                fill="#64748b"
              />
            </marker>
          </defs>
        </svg>

        {/* Enhanced Controls with glass morphism */}
        <Controls
          className="!bg-white/80 !backdrop-blur-sm !border-secondary-200/50 !shadow-soft !rounded-xl"
          showZoom={true}
          showFitView={true}
          showInteractive={true}
        />

        {/* Enhanced Mini map with better styling */}
        <MiniMap
          className="!bg-white/90 !backdrop-blur-sm !border-secondary-200/50 !shadow-soft !rounded-xl !overflow-hidden"
          nodeColor={(node) => {
            if (!node.data?.app) return '#64748b';

            // Enhanced color mapping with better contrast
            const appColors: Record<string, string> = {
              dcim: '#3b82f6',      // Blue
              ipam: '#10b981',      // Green
              circuits: '#f59e0b',  // Orange
              tenancy: '#8b5cf6',   // Purple
              extras: '#64748b',    // Gray
              users: '#ec4899',     // Pink
            };

            return appColors[node.data.app] || '#64748b';
          }}
          nodeStrokeWidth={1}
          nodeStrokeColor="#ffffff"
          pannable
          zoomable
          inversePan={false}
          maskColor="rgba(248, 250, 252, 0.8)"
        />

        {/* Enhanced Control Panel with Glass Morphism */}
        <Panel position="top-left" className="m-4">
          <div className="panel-nautobot panel-nautobot-glass p-4 space-y-4 min-w-64 animate-nautobot-fade-in-left">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-secondary-900 flex items-center">
                <svg className="w-4 h-4 mr-2 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                </svg>
                Schema Controls
              </h3>
              {isLoading && (
                <div className="spinner-nautobot spinner-nautobot-sm"></div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={onFitView}
                className="btn-nautobot btn-nautobot-sm btn-nautobot-secondary hover-lift"
                disabled={isLoading}
              >
                <MagnifyingGlassIcon className="h-4 w-4 mr-2" />
                Fit View
              </button>

              <button
                onClick={onResetLayout}
                className="btn-nautobot btn-nautobot-sm btn-nautobot-ghost hover-lift"
                disabled={isLoading}
              >
                <ArrowPathIcon className="h-4 w-4 mr-2" />
                Reset Layout
              </button>

              <button
                onClick={toggleAutoLayout}
                className={`btn-nautobot btn-nautobot-sm hover-lift ${
                  isAutoLayoutEnabled ? 'btn-nautobot-primary' : 'btn-nautobot-ghost'
                }`}
                disabled={isLoading}
              >
                <Squares2X2Icon className="h-4 w-4 mr-2" />
                Auto Layout
              </button>
            </div>

            {/* Layout Algorithm Selection */}
            {isAutoLayoutEnabled && (
              <div className="border-t border-secondary-200/30 pt-3">
                <div className="text-xs text-secondary-600 font-medium mb-2">Layout Algorithm</div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <button
                    onClick={() => onLayoutChange('dagre')}
                    className={`btn-nautobot btn-nautobot-xs hover-lift ${
                      layoutAlgorithm === 'dagre' ? 'btn-nautobot-primary' : 'btn-nautobot-ghost'
                    }`}
                    disabled={isLoading}
                  >
                    Dagre
                  </button>
                  <button
                    onClick={() => onLayoutChange('hierarchical')}
                    className={`btn-nautobot btn-nautobot-xs hover-lift ${
                      layoutAlgorithm === 'hierarchical' ? 'btn-nautobot-primary' : 'btn-nautobot-ghost'
                    }`}
                    disabled={isLoading}
                  >
                    Hierarchy
                  </button>
                  <button
                    onClick={() => onLayoutChange('circular')}
                    className={`btn-nautobot btn-nautobot-xs hover-lift ${
                      layoutAlgorithm === 'circular' ? 'btn-nautobot-primary' : 'btn-nautobot-ghost'
                    }`}
                    disabled={isLoading}
                  >
                    Circular
                  </button>
                  <button
                    onClick={() => onLayoutChange('force')}
                    className={`btn-nautobot btn-nautobot-xs hover-lift ${
                      layoutAlgorithm === 'force' ? 'btn-nautobot-primary' : 'btn-nautobot-ghost'
                    }`}
                    disabled={isLoading}
                  >
                    Force
                  </button>
                </div>
              </div>
            )}

            {/* Enhanced stats section */}
            <div className="border-t border-secondary-200/30 pt-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="text-center">
                  <div className="text-lg font-bold text-primary-600">{filteredNodes.length}</div>
                  <div className="text-secondary-500 font-medium">Models</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-success-600">{filteredEdges.length}</div>
                  <div className="text-secondary-500 font-medium">Relations</div>
                </div>
              </div>
            </div>

            {/* Django Apps Filter */}
            <div className="border-t border-secondary-200/30 pt-3">
              <div className="text-xs text-secondary-600 font-medium mb-2">Django Apps</div>
              <div className="flex flex-wrap gap-1">
                {availableApps.map(app => (
                  <button
                    key={app}
                    onClick={() => toggleAppVisibility(app)}
                    className={`badge-nautobot badge-nautobot-sm transition-all duration-200 hover-lift cursor-pointer ${
                      visibleApps.has(app)
                        ? `badge-app-${app}`
                        : 'opacity-40 grayscale hover:opacity-70'
                    }`}
                    disabled={isLoading}
                    title={visibleApps.has(app) ? `Hide ${app} models` : `Show ${app} models`}
                  >
                    {app}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Panel>

        {/* Enhanced Status Panel */}
        <Panel position="bottom-right" className="m-4">
          <div className="panel-nautobot panel-nautobot-glass p-3 animate-nautobot-fade-in-up">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                {isLoading ? (
                  <>
                    <div className="status-nautobot status-nautobot-loading"></div>
                    <span className="text-sm text-secondary-700 font-medium">Loading schema</span>
                    <div className="loading-dots-nautobot text-secondary-500"></div>
                  </>
                ) : (
                  <>
                    <div className="status-nautobot status-nautobot-online"></div>
                    <span className="text-sm text-secondary-700 font-medium">Schema ready</span>
                  </>
                )}
              </div>
              <div className="w-px h-4 bg-secondary-200"></div>
              <div className="text-xs text-secondary-500 font-medium">
                {new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>
        </Panel>

        {/* Legend Panel */}
        <Panel position="bottom-left" className="m-4">
          <div className="panel-nautobot panel-nautobot-glass p-3 animate-nautobot-fade-in-up">
            <div className="text-xs text-secondary-600 font-medium mb-2">Relationship Types</div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-0.5 bg-secondary-400"></div>
                <span className="text-xs text-secondary-600">Foreign Key</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-0.5 bg-primary-500"></div>
                <span className="text-xs text-secondary-600">Many to Many</span>
              </div>
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
  } catch (error: any) {
    console.error('Error rendering SchemaVisualization:', error);
    return (
      <div className="w-full h-full flex items-center justify-center bg-red-50">
        <div className="text-center p-8">
          <div className="text-red-600 text-xl font-bold mb-4">Component Render Error</div>
          <div className="text-red-700 mb-4">{error.message}</div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }
}