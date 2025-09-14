import type { Node, Edge } from 'reactflow';
import { MarkerType } from 'reactflow';
import type { NautobotNodeData, NautobotEdgeData } from '../types/schema';

export const demoNodes: Node<NautobotNodeData>[] = [
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
        incoming: []
      },
      isAbstract: false,
      color: '#3B82F6',
      fieldCount: 4,
      relatedModels: ['Site', 'DeviceType', 'Interface'],
      position: { x: 250, y: 100 }
    }
  },
  {
    id: 'site',
    type: 'nautobotModel',
    position: { x: 50, y: 300 },
    data: {
      id: 'site',
      name: 'Site',
      app: 'dcim',
      fields: [
        { name: 'name', type: 'CharField', required: true, nullable: false },
        { name: 'slug', type: 'SlugField', required: true, nullable: false },
        { name: 'region', type: 'ForeignKey', required: false, nullable: true, relatedModel: 'Region' },
        { name: 'tenant', type: 'ForeignKey', required: false, nullable: true, relatedModel: 'Tenant' },
        { name: 'facility', type: 'CharField', required: false, nullable: true },
        { name: 'asn', type: 'PositiveIntegerField', required: false, nullable: true },
        { name: 'time_zone', type: 'CharField', required: false, nullable: true },
        { name: 'description', type: 'TextField', required: false, nullable: true },
        { name: 'physical_address', type: 'TextField', required: false, nullable: true },
        { name: 'shipping_address', type: 'TextField', required: false, nullable: true },
        { name: 'latitude', type: 'DecimalField', required: false, nullable: true },
        { name: 'longitude', type: 'DecimalField', required: false, nullable: true },
      ],
      customFields: [
        { name: 'contact_phone', type: 'text', required: false, unique: false, description: 'Primary contact phone number' },
        { name: 'emergency_contact', type: 'text', required: false, unique: false, description: 'Emergency contact information' },
        { name: 'access_instructions', type: 'textarea', required: false, unique: false, description: 'Site access instructions' },
        { name: 'security_level', type: 'select', required: true, unique: false, choices: ['Low', 'Medium', 'High', 'Critical'], description: 'Site security classification' },
      ],
      relationships: {
        outgoing: [
          {
            id: 'site-region',
            fromModel: 'Site',
            toModel: 'Region',
            type: 'foreign_key',
            fieldName: 'region',
          },
          {
            id: 'site-tenant',
            fromModel: 'Site',
            toModel: 'Tenant',
            type: 'foreign_key',
            fieldName: 'tenant',
          }
        ],
        incoming: [
          {
            id: 'device-site',
            fromModel: 'Device',
            toModel: 'Site',
            type: 'foreign_key',
            fieldName: 'site',
          }
        ]
      },
      isAbstract: false,
      color: '#10B981',
      fieldCount: 12,
      relatedModels: ['Device', 'Region', 'Tenant', 'Rack'],
      position: { x: 50, y: 300 }
    }
  },
  {
    id: 'devicetype',
    type: 'nautobotModel',
    position: { x: 450, y: 300 },
    data: {
      id: 'devicetype',
      name: 'DeviceType',
      app: 'dcim',
      fields: [
        { name: 'model', type: 'CharField', required: true, nullable: false },
        { name: 'slug', type: 'SlugField', required: true, nullable: false },
        { name: 'manufacturer', type: 'ForeignKey', required: true, nullable: false, relatedModel: 'Manufacturer' },
        { name: 'part_number', type: 'CharField', required: false, nullable: true },
        { name: 'u_height', type: 'PositiveSmallIntegerField', required: false, nullable: true },
        { name: 'is_full_depth', type: 'BooleanField', required: false, nullable: false },
        { name: 'subdevice_role', type: 'CharField', required: false, nullable: true },
        { name: 'airflow', type: 'CharField', required: false, nullable: true },
      ],
      customFields: [
        { name: 'power_consumption', type: 'integer', required: false, unique: false, description: 'Power consumption in watts' },
        { name: 'weight', type: 'decimal', required: false, unique: false, description: 'Weight in kilograms' },
        { name: 'datasheet_url', type: 'url', required: false, unique: false, description: 'Manufacturer datasheet URL' },
      ],
      relationships: {
        outgoing: [
          {
            id: 'devicetype-manufacturer',
            fromModel: 'DeviceType',
            toModel: 'Manufacturer',
            type: 'foreign_key',
            fieldName: 'manufacturer',
          }
        ],
        incoming: [
          {
            id: 'device-devicetype',
            fromModel: 'Device',
            toModel: 'DeviceType',
            type: 'foreign_key',
            fieldName: 'device_type',
          }
        ]
      },
      isAbstract: false,
      color: '#8B5CF6',
      fieldCount: 8,
      relatedModels: ['Device', 'Manufacturer', 'InterfaceTemplate', 'PowerPortTemplate'],
      position: { x: 450, y: 300 }
    }
  },
  {
    id: 'interface',
    type: 'nautobotModel',
    position: { x: 250, y: 500 },
    data: {
      id: 'interface',
      name: 'Interface',
      app: 'dcim',
      fields: [
        { name: 'name', type: 'CharField', required: true, nullable: false },
        { name: 'device', type: 'ForeignKey', required: true, nullable: false, relatedModel: 'Device' },
        { name: 'type', type: 'CharField', required: true, nullable: false },
        { name: 'enabled', type: 'BooleanField', required: false, nullable: false },
        { name: 'mtu', type: 'PositiveIntegerField', required: false, nullable: true },
        { name: 'mac_address', type: 'CharField', required: false, nullable: true },
        { name: 'mgmt_only', type: 'BooleanField', required: false, nullable: false },
        { name: 'description', type: 'TextField', required: false, nullable: true },
      ],
      customFields: [
        { name: 'monitoring_enabled', type: 'boolean', required: false, unique: false, description: 'Enable SNMP monitoring' },
        { name: 'vlan_mode', type: 'select', required: false, unique: false, choices: ['Access', 'Trunk', 'Tagged'], description: 'VLAN mode configuration' },
        { name: 'speed_override', type: 'select', required: false, unique: false, choices: ['10M', '100M', '1G', '10G', '25G', '40G', '100G'], description: 'Manual speed override' },
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
        incoming: []
      },
      isAbstract: false,
      color: '#F59E0B',
      fieldCount: 8,
      relatedModels: ['Device', 'Cable', 'IPAddress'],
      position: { x: 250, y: 500 }
    }
  },
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
        { name: 'provider', type: 'ForeignKey', required: true, nullable: false, relatedModel: 'Provider' },
        { name: 'type', type: 'ForeignKey', required: true, nullable: false, relatedModel: 'CircuitType' },
        { name: 'status', type: 'CharField', required: true, nullable: false },
        { name: 'tenant', type: 'ForeignKey', required: false, nullable: true, relatedModel: 'Tenant' },
        { name: 'install_date', type: 'DateField', required: false, nullable: true },
        { name: 'commit_rate', type: 'PositiveIntegerField', required: false, nullable: true },
        { name: 'description', type: 'TextField', required: false, nullable: true },
      ],
      customFields: [
        { name: 'contract_number', type: 'text', required: false, unique: false, description: 'Provider contract number' },
        { name: 'monthly_cost', type: 'decimal', required: false, unique: false, description: 'Monthly recurring cost' },
        { name: 'support_level', type: 'select', required: false, unique: false, choices: ['Basic', 'Premium', '24x7'], description: 'Support service level' },
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
        incoming: []
      },
      isAbstract: false,
      color: '#EF4444',
      fieldCount: 8,
      relatedModels: ['Provider', 'CircuitType', 'CircuitTermination'],
      position: { x: 650, y: 100 }
    }
  },
  {
    id: 'prefix',
    type: 'nautobotModel',
    position: { x: 850, y: 300 },
    data: {
      id: 'prefix',
      name: 'Prefix',
      app: 'ipam',
      fields: [
        { name: 'prefix', type: 'CharField', required: true, nullable: false },
        { name: 'site', type: 'ForeignKey', required: false, nullable: true, relatedModel: 'Site' },
        { name: 'vrf', type: 'ForeignKey', required: false, nullable: true, relatedModel: 'VRF' },
        { name: 'tenant', type: 'ForeignKey', required: false, nullable: true, relatedModel: 'Tenant' },
        { name: 'vlan', type: 'ForeignKey', required: false, nullable: true, relatedModel: 'VLAN' },
        { name: 'status', type: 'CharField', required: true, nullable: false },
        { name: 'role', type: 'ForeignKey', required: false, nullable: true, relatedModel: 'Role' },
        { name: 'is_pool', type: 'BooleanField', required: false, nullable: false },
        { name: 'description', type: 'TextField', required: false, nullable: true },
      ],
      customFields: [
        { name: 'dhcp_enabled', type: 'boolean', required: false, unique: false, description: 'DHCP service enabled' },
        { name: 'dns_servers', type: 'text', required: false, unique: false, description: 'Comma-separated DNS servers' },
        { name: 'routing_policy', type: 'select', required: false, unique: false, choices: ['Default', 'Static', 'OSPF', 'BGP'], description: 'Routing policy' },
      ],
      relationships: {
        outgoing: [
          {
            id: 'prefix-site',
            fromModel: 'Prefix',
            toModel: 'Site',
            type: 'foreign_key',
            fieldName: 'site',
          }
        ],
        incoming: []
      },
      isAbstract: false,
      color: '#06B6D4',
      fieldCount: 9,
      relatedModels: ['Site', 'VRF', 'VLAN', 'IPAddress'],
      position: { x: 850, y: 300 }
    }
  }
];

export const demoEdges: Edge<NautobotEdgeData>[] = [
  {
    id: 'device-site',
    source: 'device',
    target: 'site',
    type: 'simplified',
    animated: false,
    data: {
      id: 'device-site',
      relationshipType: 'foreign_key',
      fieldName: 'site',
      sourceModel: 'Device',
      targetModel: 'Site',
      label: 'belongs to',
      isRequired: true,
      isAbstract: false,
      color: '#64748B'
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      isAbstract: false,
      color: '#64748B'
    },
    style: {
      stroke: '#64748B',
      strokeWidth: 2
    }
  },
  {
    id: 'device-devicetype',
    source: 'device',
    target: 'devicetype',
    type: 'simplified',
    animated: false,
    data: {
      id: 'device-devicetype',
      relationshipType: 'foreign_key',
      fieldName: 'device_type',
      sourceModel: 'Device',
      targetModel: 'DeviceType',
      label: 'has type',
      isRequired: true,
      isAbstract: false,
      color: '#64748B'
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      isAbstract: false,
      color: '#64748B'
    },
    style: {
      stroke: '#64748B',
      strokeWidth: 2
    }
  },
  {
    id: 'interface-device',
    source: 'interface',
    target: 'device',
    type: 'simplified',
    animated: false,
    data: {
      id: 'interface-device',
      relationshipType: 'foreign_key',
      fieldName: 'device',
      sourceModel: 'Interface',
      targetModel: 'Device',
      label: 'belongs to',
      isRequired: true,
      isAbstract: false,
      color: '#64748B'
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      isAbstract: false,
      color: '#64748B'
    },
    style: {
      stroke: '#64748B',
      strokeWidth: 2
    }
  },
  {
    id: 'circuit-provider',
    source: 'circuit',
    target: 'provider',
    type: 'simplified',
    animated: false,
    data: {
      id: 'circuit-provider',
      relationshipType: 'foreign_key',
      fieldName: 'provider',
      sourceModel: 'Circuit',
      targetModel: 'Provider',
      label: 'provided by',
      isRequired: true,
      isAbstract: false,
      color: '#64748B'
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      isAbstract: false,
      color: '#64748B'
    },
    style: {
      stroke: '#64748B',
      strokeWidth: 2
    }
  },
  {
    id: 'prefix-site',
    source: 'prefix',
    target: 'site',
    type: 'simplified',
    animated: false,
    data: {
      id: 'prefix-site',
      relationshipType: 'foreign_key',
      fieldName: 'site',
      sourceModel: 'Prefix',
      targetModel: 'Site',
      label: 'assigned to',
      isRequired: false,
      isAbstract: false,
      color: '#64748B'
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      isAbstract: false,
      color: '#64748B'
    },
    style: {
      stroke: '#64748B',
      strokeWidth: 1,
      strokeDasharray: '5,5'
    }
  }
];