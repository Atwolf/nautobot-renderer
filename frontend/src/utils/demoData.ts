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
      color: '#3B82F6',
      fieldCount: 4,
      relatedModels: ['Site', 'DeviceType', 'Interface'],
      position: { x: 250, y: 100 }
    }
  },
  {
    id: 'site',
    type: 'nautobotModel',
    position: { x: 50, y: 100 },
    data: {
      id: 'site',
      name: 'Site',
      app: 'dcim',
      fields: [
        { name: 'name', type: 'CharField', required: true, nullable: false },
        { name: 'slug', type: 'SlugField', required: true, nullable: false },
        { name: 'status', type: 'CharField', required: true, nullable: false },
        { name: 'facility', type: 'CharField', required: false, nullable: true },
        { name: 'time_zone', type: 'CharField', required: false, nullable: true },
      ],
      customFields: [
        { name: 'contact_phone', type: 'text', required: false, unique: false, description: 'Primary contact phone number' },
        { name: 'business_hours', type: 'text', required: false, unique: false, description: 'Site business hours' },
        { name: 'security_level', type: 'select', required: true, unique: false, choices: ['Low', 'Medium', 'High', 'Critical'], description: 'Security classification' },
      ],
      relationships: {
        outgoing: [],
        incoming: [
          {
            id: 'device-site',
            fromModel: 'Device',
            toModel: 'Site',
            type: 'foreign_key',
            fieldName: 'site',
            relatedName: 'devices',
          }
        ]
      },
      isAbstract: false,
      color: '#3B82F6',
      fieldCount: 5,
      relatedModels: ['Device'],
      position: { x: 50, y: 100 }
    }
  },
  {
    id: 'devicetype',
    type: 'nautobotModel',
    position: { x: 450, y: 100 },
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
      ],
      customFields: [
        { name: 'power_consumption', type: 'integer', required: false, unique: false, description: 'Power consumption in watts' },
        { name: 'weight', type: 'decimal', required: false, unique: false, description: 'Weight in pounds' },
        { name: 'eol_date', type: 'date', required: false, unique: false, description: 'End of life date' },
      ],
      relationships: {
        outgoing: [],
        incoming: [
          {
            id: 'device-devicetype',
            fromModel: 'Device',
            toModel: 'DeviceType',
            type: 'foreign_key',
            fieldName: 'device_type',
            relatedName: 'devices',
          }
        ]
      },
      isAbstract: false,
      color: '#3B82F6',
      fieldCount: 6,
      relatedModels: ['Device', 'Manufacturer'],
      position: { x: 450, y: 100 }
    }
  },
  {
    id: 'interface',
    type: 'nautobotModel',
    position: { x: 250, y: 300 },
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
      ],
      customFields: [
        { name: 'vlan_id', type: 'integer', required: false, unique: false, description: 'VLAN ID assignment' },
        { name: 'cable_id', type: 'text', required: false, unique: false, description: 'Physical cable identifier' },
        { name: 'monitoring_enabled', type: 'boolean', required: false, unique: false, description: 'Enable SNMP monitoring' },
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
      color: '#3B82F6',
      fieldCount: 6,
      relatedModels: ['Device'],
      position: { x: 250, y: 300 }
    }
  },
  {
    id: 'circuit',
    type: 'nautobotModel',
    position: { x: 650, y: 200 },
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
      ],
      customFields: [
        { name: 'monthly_cost', type: 'decimal', required: false, unique: false, description: 'Monthly recurring cost' },
        { name: 'contract_id', type: 'text', required: false, unique: false, description: 'Provider contract identifier' },
        { name: 'escalation_contact', type: 'email', required: false, unique: false, description: 'Provider escalation email' },
      ],
      relationships: {
        outgoing: [],
        incoming: []
      },
      isAbstract: false,
      color: '#8B5CF6',
      fieldCount: 7,
      relatedModels: ['Provider', 'CircuitType', 'Tenant'],
      position: { x: 650, y: 200 }
    }
  },
  // Additional non-core nodes to demonstrate filtering
  {
    id: 'manufacturer',
    type: 'nautobotModel',
    position: { x: 650, y: 100 },
    data: {
      id: 'manufacturer',
      name: 'Manufacturer',
      app: 'dcim',
      fields: [
        { name: 'name', type: 'CharField', required: true, nullable: false },
        { name: 'slug', type: 'SlugField', required: true, nullable: false },
      ],
      customFields: [],
      relationships: {
        outgoing: [],
        incoming: []
      },
      isAbstract: false,
      color: '#3B82F6',
      fieldCount: 2,
      relatedModels: [],
      position: { x: 650, y: 100 }
    }
  },
  {
    id: 'rack',
    type: 'nautobotModel',
    position: { x: 450, y: 300 },
    data: {
      id: 'rack',
      name: 'Rack',
      app: 'dcim',
      fields: [
        { name: 'name', type: 'CharField', required: true, nullable: false },
        { name: 'site', type: 'ForeignKey', required: true, nullable: false, relatedModel: 'Site' },
        { name: 'u_height', type: 'PositiveSmallIntegerField', required: false, nullable: true },
      ],
      customFields: [],
      relationships: {
        outgoing: [],
        incoming: []
      },
      isAbstract: false,
      color: '#3B82F6',
      fieldCount: 3,
      relatedModels: ['Site'],
      position: { x: 450, y: 300 }
    }
  },
  {
    id: 'provider',
    type: 'nautobotModel',
    position: { x: 850, y: 200 },
    data: {
      id: 'provider',
      name: 'Provider',
      app: 'circuits',
      fields: [
        { name: 'name', type: 'CharField', required: true, nullable: false },
        { name: 'slug', type: 'SlugField', required: true, nullable: false },
        { name: 'account', type: 'CharField', required: false, nullable: true },
      ],
      customFields: [],
      relationships: {
        outgoing: [],
        incoming: []
      },
      isAbstract: false,
      color: '#8B5CF6',
      fieldCount: 3,
      relatedModels: [],
      position: { x: 850, y: 200 }
    }
  },
  {
    id: 'circuittype',
    type: 'nautobotModel',
    position: { x: 650, y: 300 },
    data: {
      id: 'circuittype',
      name: 'CircuitType',
      app: 'circuits',
      fields: [
        { name: 'name', type: 'CharField', required: true, nullable: false },
        { name: 'slug', type: 'SlugField', required: true, nullable: false },
      ],
      customFields: [],
      relationships: {
        outgoing: [],
        incoming: []
      },
      isAbstract: false,
      color: '#8B5CF6',
      fieldCount: 2,
      relatedModels: [],
      position: { x: 650, y: 300 }
    }
  },
  {
    id: 'ipaddress',
    type: 'nautobotModel',
    position: { x: 250, y: 500 },
    data: {
      id: 'ipaddress',
      name: 'IPAddress',
      app: 'ipam',
      fields: [
        { name: 'address', type: 'CharField', required: true, nullable: false },
        { name: 'vrf', type: 'ForeignKey', required: false, nullable: true, relatedModel: 'VRF' },
        { name: 'tenant', type: 'ForeignKey', required: false, nullable: true, relatedModel: 'Tenant' },
      ],
      customFields: [],
      relationships: {
        outgoing: [],
        incoming: []
      },
      isAbstract: false,
      color: '#10B981',
      fieldCount: 3,
      relatedModels: ['VRF', 'Tenant'],
      position: { x: 250, y: 500 }
    }
  },
  {
    id: 'vlan',
    type: 'nautobotModel',
    position: { x: 450, y: 500 },
    data: {
      id: 'vlan',
      name: 'VLAN',
      app: 'ipam',
      fields: [
        { name: 'vid', type: 'PositiveSmallIntegerField', required: true, nullable: false },
        { name: 'name', type: 'CharField', required: true, nullable: false },
        { name: 'site', type: 'ForeignKey', required: false, nullable: true, relatedModel: 'Site' },
      ],
      customFields: [],
      relationships: {
        outgoing: [],
        incoming: []
      },
      isAbstract: false,
      color: '#10B981',
      fieldCount: 3,
      relatedModels: ['Site'],
      position: { x: 450, y: 500 }
    }
  },
  {
    id: 'vrf',
    type: 'nautobotModel',
    position: { x: 50, y: 500 },
    data: {
      id: 'vrf',
      name: 'VRF',
      app: 'ipam',
      fields: [
        { name: 'name', type: 'CharField', required: true, nullable: false },
        { name: 'rd', type: 'CharField', required: false, nullable: true },
        { name: 'tenant', type: 'ForeignKey', required: false, nullable: true, relatedModel: 'Tenant' },
      ],
      customFields: [],
      relationships: {
        outgoing: [],
        incoming: []
      },
      isAbstract: false,
      color: '#10B981',
      fieldCount: 3,
      relatedModels: ['Tenant'],
      position: { x: 50, y: 500 }
    }
  },
  {
    id: 'tenant',
    type: 'nautobotModel',
    position: { x: 850, y: 300 },
    data: {
      id: 'tenant',
      name: 'Tenant',
      app: 'tenancy',
      fields: [
        { name: 'name', type: 'CharField', required: true, nullable: false },
        { name: 'slug', type: 'SlugField', required: true, nullable: false },
        { name: 'group', type: 'ForeignKey', required: false, nullable: true, relatedModel: 'TenantGroup' },
      ],
      customFields: [],
      relationships: {
        outgoing: [],
        incoming: []
      },
      isAbstract: false,
      color: '#F59E0B',
      fieldCount: 3,
      relatedModels: ['TenantGroup'],
      position: { x: 850, y: 300 }
    }
  },
  {
    id: 'tenantgroup',
    type: 'nautobotModel',
    position: { x: 850, y: 400 },
    data: {
      id: 'tenantgroup',
      name: 'TenantGroup',
      app: 'tenancy',
      fields: [
        { name: 'name', type: 'CharField', required: true, nullable: false },
        { name: 'slug', type: 'SlugField', required: true, nullable: false },
      ],
      customFields: [],
      relationships: {
        outgoing: [],
        incoming: []
      },
      isAbstract: false,
      color: '#F59E0B',
      fieldCount: 2,
      relatedModels: [],
      position: { x: 850, y: 400 }
    }
  },
  {
    id: 'user',
    type: 'nautobotModel',
    position: { x: 1050, y: 200 },
    data: {
      id: 'user',
      name: 'User',
      app: 'users',
      fields: [
        { name: 'username', type: 'CharField', required: true, nullable: false },
        { name: 'email', type: 'EmailField', required: true, nullable: false },
        { name: 'first_name', type: 'CharField', required: false, nullable: true },
        { name: 'last_name', type: 'CharField', required: false, nullable: true },
      ],
      customFields: [],
      relationships: {
        outgoing: [],
        incoming: []
      },
      isAbstract: false,
      color: '#6366F1',
      fieldCount: 4,
      relatedModels: [],
      position: { x: 1050, y: 200 }
    }
  },
  {
    id: 'group',
    type: 'nautobotModel',
    position: { x: 1050, y: 300 },
    data: {
      id: 'group',
      name: 'Group',
      app: 'users',
      fields: [
        { name: 'name', type: 'CharField', required: true, nullable: false },
      ],
      customFields: [],
      relationships: {
        outgoing: [],
        incoming: []
      },
      isAbstract: false,
      color: '#6366F1',
      fieldCount: 1,
      relatedModels: [],
      position: { x: 1050, y: 300 }
    }
  },
  {
    id: 'tag',
    type: 'nautobotModel',
    position: { x: 1250, y: 200 },
    data: {
      id: 'tag',
      name: 'Tag',
      app: 'extras',
      fields: [
        { name: 'name', type: 'CharField', required: true, nullable: false },
        { name: 'slug', type: 'SlugField', required: true, nullable: false },
        { name: 'color', type: 'CharField', required: false, nullable: true },
      ],
      customFields: [],
      relationships: {
        outgoing: [],
        incoming: []
      },
      isAbstract: false,
      color: '#EC4899',
      fieldCount: 3,
      relatedModels: [],
      position: { x: 1250, y: 200 }
    }
  },
  {
    id: 'customfield',
    type: 'nautobotModel',
    position: { x: 1250, y: 300 },
    data: {
      id: 'customfield',
      name: 'CustomField',
      app: 'extras',
      fields: [
        { name: 'name', type: 'CharField', required: true, nullable: false },
        { name: 'type', type: 'CharField', required: true, nullable: false },
        { name: 'label', type: 'CharField', required: false, nullable: true },
      ],
      customFields: [],
      relationships: {
        outgoing: [],
        incoming: []
      },
      isAbstract: false,
      color: '#EC4899',
      fieldCount: 3,
      relatedModels: [],
      position: { x: 1250, y: 300 }
    }
  },
  {
    id: 'status',
    type: 'nautobotModel',
    position: { x: 1250, y: 400 },
    data: {
      id: 'status',
      name: 'Status',
      app: 'extras',
      fields: [
        { name: 'name', type: 'CharField', required: true, nullable: false },
        { name: 'slug', type: 'SlugField', required: true, nullable: false },
        { name: 'color', type: 'CharField', required: false, nullable: true },
      ],
      customFields: [],
      relationships: {
        outgoing: [],
        incoming: []
      },
      isAbstract: false,
      color: '#EC4899',
      fieldCount: 3,
      relatedModels: [],
      position: { x: 1250, y: 400 }
    }
  },
  {
    id: 'virtualmachine',
    type: 'nautobotModel',
    position: { x: 650, y: 500 },
    data: {
      id: 'virtualmachine',
      name: 'VirtualMachine',
      app: 'virtualization',
      fields: [
        { name: 'name', type: 'CharField', required: true, nullable: false },
        { name: 'cluster', type: 'ForeignKey', required: true, nullable: false, relatedModel: 'Cluster' },
        { name: 'status', type: 'CharField', required: true, nullable: false },
      ],
      customFields: [],
      relationships: {
        outgoing: [],
        incoming: []
      },
      isAbstract: false,
      color: '#8B5CF6',
      fieldCount: 3,
      relatedModels: ['Cluster'],
      position: { x: 650, y: 500 }
    }
  },
  {
    id: 'cluster',
    type: 'nautobotModel',
    position: { x: 850, y: 500 },
    data: {
      id: 'cluster',
      name: 'Cluster',
      app: 'virtualization',
      fields: [
        { name: 'name', type: 'CharField', required: true, nullable: false },
        { name: 'type', type: 'ForeignKey', required: true, nullable: false, relatedModel: 'ClusterType' },
        { name: 'site', type: 'ForeignKey', required: false, nullable: true, relatedModel: 'Site' },
      ],
      customFields: [],
      relationships: {
        outgoing: [],
        incoming: []
      },
      isAbstract: false,
      color: '#8B5CF6',
      fieldCount: 3,
      relatedModels: ['ClusterType', 'Site'],
      position: { x: 850, y: 500 }
    }
  },
  {
    id: 'location',
    type: 'nautobotModel',
    position: { x: 50, y: 200 },
    data: {
      id: 'location',
      name: 'Location',
      app: 'dcim',
      fields: [
        { name: 'name', type: 'CharField', required: true, nullable: false },
        { name: 'slug', type: 'SlugField', required: true, nullable: false },
        { name: 'site', type: 'ForeignKey', required: true, nullable: false, relatedModel: 'Site' },
        { name: 'parent', type: 'ForeignKey', required: false, nullable: true, relatedModel: 'Location' },
      ],
      customFields: [],
      relationships: {
        outgoing: [],
        incoming: []
      },
      isAbstract: false,
      color: '#3B82F6',
      fieldCount: 4,
      relatedModels: ['Site', 'Location'],
      position: { x: 50, y: 200 }
    }
  },
  {
    id: 'platform',
    type: 'nautobotModel',
    position: { x: 450, y: 200 },
    data: {
      id: 'platform',
      name: 'Platform',
      app: 'dcim',
      fields: [
        { name: 'name', type: 'CharField', required: true, nullable: false },
        { name: 'slug', type: 'SlugField', required: true, nullable: false },
        { name: 'manufacturer', type: 'ForeignKey', required: false, nullable: true, relatedModel: 'Manufacturer' },
      ],
      customFields: [],
      relationships: {
        outgoing: [],
        incoming: []
      },
      isAbstract: false,
      color: '#3B82F6',
      fieldCount: 3,
      relatedModels: ['Manufacturer'],
      position: { x: 450, y: 200 }
    }
  },
  {
    id: 'prefix',
    type: 'nautobotModel',
    position: { x: 50, y: 300 },
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
      ],
      customFields: [
        { name: 'dhcp_enabled', type: 'boolean', required: false, unique: false, description: 'DHCP server enabled' },
        { name: 'dns_servers', type: 'text', required: false, unique: false, description: 'Comma-separated DNS servers' },
        { name: 'gateway_redundancy', type: 'select', required: false, unique: false, choices: ['None', 'HSRP', 'VRRP', 'GLBP'], description: 'Gateway redundancy protocol' },
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
      color: '#10B981',
      fieldCount: 8,
      relatedModels: ['Site', 'VRF', 'Tenant', 'VLAN', 'Role'],
      position: { x: 50, y: 300 }
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
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: '#64748B',
    },
    data: {
      id: 'device-site',
      fromModel: 'Device',
      toModel: 'Site',
      type: 'foreign_key',
      fieldName: 'site',
      relationshipType: 'foreign_key',
      sourceModel: 'Device',
      targetModel: 'Site',
      label: 'site',
      isRequired: true,
      color: '#64748B'
    }
  },
  {
    id: 'device-devicetype',
    source: 'device',
    target: 'devicetype',
    type: 'simplified',
    animated: false,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: '#64748B',
    },
    data: {
      id: 'device-devicetype',
      fromModel: 'Device',
      toModel: 'DeviceType',
      type: 'foreign_key',
      fieldName: 'device_type',
      relationshipType: 'foreign_key',
      sourceModel: 'Device',
      targetModel: 'DeviceType',
      label: 'device_type',
      isRequired: true,
      color: '#64748B'
    }
  },
  {
    id: 'interface-device',
    source: 'interface',
    target: 'device',
    type: 'simplified',
    animated: false,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: '#64748B',
    },
    data: {
      id: 'interface-device',
      fromModel: 'Interface',
      toModel: 'Device',
      type: 'foreign_key',
      fieldName: 'device',
      relationshipType: 'foreign_key',
      sourceModel: 'Interface',
      targetModel: 'Device',
      label: 'device',
      isRequired: true,
      color: '#64748B'
    }
  },
  {
    id: 'prefix-site',
    source: 'prefix',
    target: 'site',
    type: 'simplified',
    animated: false,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: '#64748B',
    },
    data: {
      id: 'prefix-site',
      fromModel: 'Prefix',
      toModel: 'Site',
      type: 'foreign_key',
      fieldName: 'site',
      relationshipType: 'foreign_key',
      sourceModel: 'Prefix',
      targetModel: 'Site',
      label: 'site',
      isRequired: false,
      color: '#64748B'
    }
  },
  {
    id: 'circuit-provider',
    source: 'circuit',
    target: 'provider',
    type: 'simplified',
    animated: false,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: '#8B5CF6',
    },
    data: {
      id: 'circuit-provider',
      fromModel: 'Circuit',
      toModel: 'Provider',
      type: 'foreign_key',
      fieldName: 'provider',
      relationshipType: 'foreign_key',
      sourceModel: 'Circuit',
      targetModel: 'Provider',
      label: 'provider',
      isRequired: true,
      color: '#8B5CF6'
    }
  },
  {
    id: 'circuit-circuittype',
    source: 'circuit',
    target: 'circuittype',
    type: 'simplified',
    animated: false,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: '#8B5CF6',
    },
    data: {
      id: 'circuit-circuittype',
      fromModel: 'Circuit',
      toModel: 'CircuitType',
      type: 'foreign_key',
      fieldName: 'type',
      relationshipType: 'foreign_key',
      sourceModel: 'Circuit',
      targetModel: 'CircuitType',
      label: 'type',
      isRequired: true,
      color: '#8B5CF6'
    }
  },
  {
    id: 'ipaddress-vrf',
    source: 'ipaddress',
    target: 'vrf',
    type: 'simplified',
    animated: false,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: '#10B981',
    },
    data: {
      id: 'ipaddress-vrf',
      fromModel: 'IPAddress',
      toModel: 'VRF',
      type: 'foreign_key',
      fieldName: 'vrf',
      relationshipType: 'foreign_key',
      sourceModel: 'IPAddress',
      targetModel: 'VRF',
      label: 'vrf',
      isRequired: false,
      color: '#10B981'
    }
  },
  {
    id: 'ipaddress-interface',
    source: 'ipaddress',
    target: 'interface',
    type: 'simplified',
    animated: false,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: '#10B981',
    },
    data: {
      id: 'ipaddress-interface',
      fromModel: 'IPAddress',
      toModel: 'Interface',
      type: 'foreign_key',
      fieldName: 'assigned_object',
      relationshipType: 'foreign_key',
      sourceModel: 'IPAddress',
      targetModel: 'Interface',
      label: 'assigned_object',
      isRequired: false,
      color: '#10B981'
    }
  },
  {
    id: 'vlan-site',
    source: 'vlan',
    target: 'site',
    type: 'simplified',
    animated: false,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: '#10B981',
    },
    data: {
      id: 'vlan-site',
      fromModel: 'VLAN',
      toModel: 'Site',
      type: 'foreign_key',
      fieldName: 'site',
      relationshipType: 'foreign_key',
      sourceModel: 'VLAN',
      targetModel: 'Site',
      label: 'site',
      isRequired: false,
      color: '#10B981'
    }
  },
  {
    id: 'vrf-tenant',
    source: 'vrf',
    target: 'tenant',
    type: 'simplified',
    animated: false,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: '#10B981',
    },
    data: {
      id: 'vrf-tenant',
      fromModel: 'VRF',
      toModel: 'Tenant',
      type: 'foreign_key',
      fieldName: 'tenant',
      relationshipType: 'foreign_key',
      sourceModel: 'VRF',
      targetModel: 'Tenant',
      label: 'tenant',
      isRequired: false,
      color: '#10B981'
    }
  },
  {
    id: 'rack-site',
    source: 'rack',
    target: 'site',
    type: 'simplified',
    animated: false,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: '#3B82F6',
    },
    data: {
      id: 'rack-site',
      fromModel: 'Rack',
      toModel: 'Site',
      type: 'foreign_key',
      fieldName: 'site',
      relationshipType: 'foreign_key',
      sourceModel: 'Rack',
      targetModel: 'Site',
      label: 'site',
      isRequired: true,
      color: '#3B82F6'
    }
  },
  {
    id: 'devicetype-manufacturer',
    source: 'devicetype',
    target: 'manufacturer',
    type: 'simplified',
    animated: false,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: '#3B82F6',
    },
    data: {
      id: 'devicetype-manufacturer',
      fromModel: 'DeviceType',
      toModel: 'Manufacturer',
      type: 'foreign_key',
      fieldName: 'manufacturer',
      relationshipType: 'foreign_key',
      sourceModel: 'DeviceType',
      targetModel: 'Manufacturer',
      label: 'manufacturer',
      isRequired: true,
      color: '#3B82F6'
    }
  },
  {
    id: 'platform-manufacturer',
    source: 'platform',
    target: 'manufacturer',
    type: 'simplified',
    animated: false,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: '#3B82F6',
    },
    data: {
      id: 'platform-manufacturer',
      fromModel: 'Platform',
      toModel: 'Manufacturer',
      type: 'foreign_key',
      fieldName: 'manufacturer',
      relationshipType: 'foreign_key',
      sourceModel: 'Platform',
      targetModel: 'Manufacturer',
      label: 'manufacturer',
      isRequired: false,
      color: '#3B82F6'
    }
  },
  {
    id: 'prefix-vrf',
    source: 'prefix',
    target: 'vrf',
    type: 'simplified',
    animated: false,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: '#10B981',
    },
    data: {
      id: 'prefix-vrf',
      fromModel: 'Prefix',
      toModel: 'VRF',
      type: 'foreign_key',
      fieldName: 'vrf',
      relationshipType: 'foreign_key',
      sourceModel: 'Prefix',
      targetModel: 'VRF',
      label: 'vrf',
      isRequired: false,
      color: '#10B981'
    }
  },
  {
    id: 'prefix-vlan',
    source: 'prefix',
    target: 'vlan',
    type: 'simplified',
    animated: false,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: '#10B981',
    },
    data: {
      id: 'prefix-vlan',
      fromModel: 'Prefix',
      toModel: 'VLAN',
      type: 'foreign_key',
      fieldName: 'vlan',
      relationshipType: 'foreign_key',
      sourceModel: 'Prefix',
      targetModel: 'VLAN',
      label: 'vlan',
      isRequired: false,
      color: '#10B981'
    }
  },
  {
    id: 'tenant-tenantgroup',
    source: 'tenant',
    target: 'tenantgroup',
    type: 'simplified',
    animated: false,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: '#F59E0B',
    },
    data: {
      id: 'tenant-tenantgroup',
      fromModel: 'Tenant',
      toModel: 'TenantGroup',
      type: 'foreign_key',
      fieldName: 'group',
      relationshipType: 'foreign_key',
      sourceModel: 'Tenant',
      targetModel: 'TenantGroup',
      label: 'group',
      isRequired: false,
      color: '#F59E0B'
    }
  },
  {
    id: 'location-site',
    source: 'location',
    target: 'site',
    type: 'simplified',
    animated: false,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: '#3B82F6',
    },
    data: {
      id: 'location-site',
      fromModel: 'Location',
      toModel: 'Site',
      type: 'foreign_key',
      fieldName: 'site',
      relationshipType: 'foreign_key',
      sourceModel: 'Location',
      targetModel: 'Site',
      label: 'site',
      isRequired: true,
      color: '#3B82F6'
    }
  },
  {
    id: 'cluster-site',
    source: 'cluster',
    target: 'site',
    type: 'simplified',
    animated: false,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: '#8B5CF6',
    },
    data: {
      id: 'cluster-site',
      fromModel: 'Cluster',
      toModel: 'Site',
      type: 'foreign_key',
      fieldName: 'site',
      relationshipType: 'foreign_key',
      sourceModel: 'Cluster',
      targetModel: 'Site',
      label: 'site',
      isRequired: false,
      color: '#8B5CF6'
    }
  },
  {
    id: 'virtualmachine-cluster',
    source: 'virtualmachine',
    target: 'cluster',
    type: 'simplified',
    animated: false,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: '#8B5CF6',
    },
    data: {
      id: 'virtualmachine-cluster',
      fromModel: 'VirtualMachine',
      toModel: 'Cluster',
      type: 'foreign_key',
      fieldName: 'cluster',
      relationshipType: 'foreign_key',
      sourceModel: 'VirtualMachine',
      targetModel: 'Cluster',
      label: 'cluster',
      isRequired: true,
      color: '#8B5CF6'
    }
  }
];