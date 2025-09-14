/**
 * Automatic layout algorithms for React Flow nodes
 * Includes enhanced Dagre layouts and hierarchical positioning
 */

import dagre from 'dagre';
import ELK, { type ElkNode } from 'elkjs/lib/elk.bundled.js';
import type { Node, Edge } from 'reactflow';

export interface LayoutOptions {
  algorithm: 'dagre' | 'hierarchical' | 'circular' | 'force' | 'elk';
  direction: 'TB' | 'BT' | 'LR' | 'RL';
  nodeSpacing: number;
  rankSpacing: number;
  animate: boolean;
  alignNodes: boolean;
  compactMode: boolean;
}

export interface LayoutResult<T> {
  nodes: Node<T>[];
  edges: Edge[];
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export class AutoLayout {
  private elk: InstanceType<typeof ELK>;

  constructor() {
    this.elk = new ELK();
  }

  /**
   * Apply automatic layout using the specified algorithm
   */
  async applyLayout<T>(
    nodes: Node<T>[],
    edges: Edge[],
    options: Partial<LayoutOptions> = {}
  ): Promise<LayoutResult<T>> {
    const config: LayoutOptions = {
      algorithm: 'dagre',
      direction: 'TB',
      nodeSpacing: 80,
      rankSpacing: 120,
      animate: true,
      alignNodes: true,
      compactMode: false,
      ...options
    };

    switch (config.algorithm) {
      case 'dagre':
        return this.applyDagreLayout(nodes, edges, config);
      case 'hierarchical':
        return this.applyHierarchicalLayout(nodes, edges, config);
      case 'circular':
        return this.applyCircularLayout(nodes, edges, config);
      case 'force':
        return this.applyForceDirectedLayout(nodes, edges, config);
      case 'elk':
        return await this.applyELKLayout(nodes, edges, config);
      default:
        return this.applyDagreLayout(nodes, edges, config);
    }
  }

  /**
   * Enhanced Dagre layout
   */
  private applyDagreLayout<T>(
    nodes: Node<T>[],
    edges: Edge[],
    options: LayoutOptions
  ): LayoutResult<T> {
    const dagreGraph = new dagre.graphlib.Graph();

    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({
      rankdir: options.direction,
      nodesep: options.nodeSpacing,
      ranksep: options.rankSpacing,
      marginx: 50,
      marginy: 50,
      compound: true, // Enable compound nodes
      align: options.alignNodes ? 'UL' : undefined
    });

    // Add nodes to dagre with proper dimensions
    nodes.forEach((node) => {
      const width = this.getNodeWidth(node);
      const height = this.getNodeHeight(node);

      dagreGraph.setNode(node.id, {
        width,
        height,
        label: node.data?.name || node.id
      });
    });

    // Add edges to dagre
    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target, {
        weight: this.getEdgeWeight(edge),
        minlen: 1
      });
    });

    // Calculate layout
    dagre.layout(dagreGraph);

    // Apply calculated positions
    const layoutedNodes = nodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      const width = this.getNodeWidth(node);
      const height = this.getNodeHeight(node);

      return {
        ...node,
        position: {
          x: nodeWithPosition.x - width / 2,
          y: nodeWithPosition.y - height / 2
        },
        width,
        height
      };
    });

    const finalNodes = layoutedNodes;

    return {
      nodes: finalNodes,
      edges,
      bounds: this.calculateBounds(finalNodes)
    };
  }

  /**
   * Hierarchical layout based on Django app structure
   */
  private applyHierarchicalLayout<T>(
    nodes: Node<T>[],
    edges: Edge[],
    options: LayoutOptions
  ): LayoutResult<T> {
    // Group nodes by Django app and determine hierarchy
    const nodesByApp = new Map<string, Node<T>[]>();
    const nodeHierarchy = new Map<string, number>();

    nodes.forEach((node) => {
      const app = (node.data as any)?.app || 'unknown';
      const nodeType = (node.data as any)?.name || 'unknown';

      if (!nodesByApp.has(app)) {
        nodesByApp.set(app, []);
      }
      nodesByApp.get(app)!.push(node);

      // Define hierarchy levels based on model importance
      const hierarchy = this.getModelHierarchy(nodeType);
      nodeHierarchy.set(node.id, hierarchy);
    });

    // Sort apps by importance
    const appOrder = ['dcim', 'ipam', 'circuits', 'tenancy', 'users', 'extras'];
    const sortedApps = Array.from(nodesByApp.keys()).sort((a, b) => {
      const aIndex = appOrder.indexOf(a);
      const bIndex = appOrder.indexOf(b);
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });

    // Layout nodes in hierarchy
    const layoutedNodes: Node<T>[] = [];
    let currentX = 100;
    const appSpacing = options.nodeSpacing * 3;

    sortedApps.forEach((app) => {
      const appNodes = nodesByApp.get(app)!;

      // Sort nodes within app by hierarchy
      const sortedNodes = appNodes.sort((a, b) => {
        const aLevel = nodeHierarchy.get(a.id) || 0;
        const bLevel = nodeHierarchy.get(b.id) || 0;
        return aLevel - bLevel;
      });

      // Layout nodes in columns by hierarchy level
      const levelNodes = new Map<number, Node<T>[]>();
      sortedNodes.forEach(node => {
        const level = nodeHierarchy.get(node.id) || 0;
        if (!levelNodes.has(level)) {
          levelNodes.set(level, []);
        }
        levelNodes.get(level)!.push(node);
      });

      let appMaxX = currentX;

      // Position nodes by level
      Array.from(levelNodes.entries()).forEach(([level, levelNodeList]) => {
        const x = currentX + level * (options.nodeSpacing * 2);
        let y = 100;

        levelNodeList.forEach((node) => {
          const width = this.getNodeWidth(node);
          const height = this.getNodeHeight(node);

          layoutedNodes.push({
            ...node,
            position: { x, y },
            width,
            height
          });

          y += height + options.nodeSpacing;
        });

        appMaxX = Math.max(appMaxX, x + options.nodeSpacing);
      });

      currentX = appMaxX + appSpacing;
    });

    const finalNodes = layoutedNodes;

    return {
      nodes: finalNodes,
      edges,
      bounds: this.calculateBounds(finalNodes)
    };
  }

  /**
   * Circular layout for better visualization of relationships
   */
  private applyCircularLayout<T>(
    nodes: Node<T>[],
    edges: Edge[],
    options: LayoutOptions
  ): LayoutResult<T> {
    const center = { x: 400, y: 300 };
    const radius = Math.max(200, nodes.length * 20);

    const layoutedNodes = nodes.map((node, index) => {
      const angle = (2 * Math.PI * index) / nodes.length;
      const x = center.x + radius * Math.cos(angle);
      const y = center.y + radius * Math.sin(angle);

      const width = this.getNodeWidth(node);
      const height = this.getNodeHeight(node);

      return {
        ...node,
        position: {
          x: x - width / 2,
          y: y - height / 2
        },
        width,
        height
      };
    });

    return {
      nodes: layoutedNodes,
      edges,
      bounds: this.calculateBounds(layoutedNodes)
    };
  }

  /**
   * Force-directed layout for organic positioning
   */
  private applyForceDirectedLayout<T>(
    nodes: Node<T>[],
    edges: Edge[],
    options: LayoutOptions
  ): LayoutResult<T> {
    // Simple force-directed simulation
    const layoutedNodes = [...nodes];
    const iterations = 50;
    const cooling = 0.95;
    let temperature = 100;

    // Initialize random positions if not set
    layoutedNodes.forEach(node => {
      if (!node.position) {
        const width = this.getNodeWidth(node);
        const height = this.getNodeHeight(node);

        node.position = {
          x: Math.random() * 800,
          y: Math.random() * 600
        };
        node.width = width;
        node.height = height;
      }
    });

    // Run simulation
    for (let i = 0; i < iterations; i++) {
      const forces = new Map<string, { x: number; y: number }>();

      // Initialize forces
      layoutedNodes.forEach(node => {
        forces.set(node.id, { x: 0, y: 0 });
      });

      // Repulsion forces (all nodes repel each other)
      for (let j = 0; j < layoutedNodes.length; j++) {
        for (let k = j + 1; k < layoutedNodes.length; k++) {
          const nodeA = layoutedNodes[j];
          const nodeB = layoutedNodes[k];

          const dx = nodeB.position!.x - nodeA.position!.x;
          const dy = nodeB.position!.y - nodeA.position!.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;

          const repulsionForce = temperature * 10000 / (distance * distance);
          const forceX = (dx / distance) * repulsionForce;
          const forceY = (dy / distance) * repulsionForce;

          forces.get(nodeA.id)!.x -= forceX;
          forces.get(nodeA.id)!.y -= forceY;
          forces.get(nodeB.id)!.x += forceX;
          forces.get(nodeB.id)!.y += forceY;
        }
      }

      // Attraction forces (connected nodes attract)
      edges.forEach(edge => {
        const sourceNode = layoutedNodes.find(n => n.id === edge.source);
        const targetNode = layoutedNodes.find(n => n.id === edge.target);

        if (sourceNode && targetNode) {
          const dx = targetNode.position!.x - sourceNode.position!.x;
          const dy = targetNode.position!.y - sourceNode.position!.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;

          const attractionForce = distance * distance / (temperature * 100);
          const forceX = (dx / distance) * attractionForce;
          const forceY = (dy / distance) * attractionForce;

          forces.get(sourceNode.id)!.x += forceX;
          forces.get(sourceNode.id)!.y += forceY;
          forces.get(targetNode.id)!.x -= forceX;
          forces.get(targetNode.id)!.y -= forceY;
        }
      });

      // Apply forces
      layoutedNodes.forEach(node => {
        const force = forces.get(node.id)!;
        const displacement = Math.sqrt(force.x * force.x + force.y * force.y);

        if (displacement > 0) {
          const limitedDisplacement = Math.min(displacement, temperature);
          node.position!.x += (force.x / displacement) * limitedDisplacement;
          node.position!.y += (force.y / displacement) * limitedDisplacement;
        }

        // Keep nodes within bounds
        node.position!.x = Math.max(0, Math.min(1200, node.position!.x));
        node.position!.y = Math.max(0, Math.min(800, node.position!.y));
      });

      temperature *= cooling;
    }

    return {
      nodes: layoutedNodes,
      edges,
      bounds: this.calculateBounds(layoutedNodes)
    };
  }

  /**
   * ELK (Eclipse Layout Kernel) layout for advanced positioning
   */
  private async applyELKLayout<T>(
    nodes: Node<T>[],
    edges: Edge[],
    options: LayoutOptions
  ): Promise<LayoutResult<T>> {
    const elkNodes: ElkNode['children'] = nodes.map(node => ({
      id: node.id,
      width: this.getNodeWidth(node),
      height: this.getNodeHeight(node),
      properties: {
        'org.eclipse.elk.nodeLabels.placement': 'INSIDE',
        'org.eclipse.elk.algorithm': 'layered'
      }
    }));

    const elkEdges = edges.map(edge => ({
      id: edge.id || `${edge.source}-${edge.target}`,
      sources: [edge.source],
      targets: [edge.target]
    }));

    const graph: ElkNode = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': options.direction,
        'elk.spacing.nodeNode': options.nodeSpacing.toString(),
        'elk.layered.spacing.nodeNodeBetweenLayers': options.rankSpacing.toString(),
        'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX'
      },
      children: elkNodes,
      edges: elkEdges
    };

    try {
      const elkResult = await this.elk.layout(graph);

      const layoutedNodes = nodes.map(node => {
        const elkNode = elkResult.children?.find(child => child.id === node.id);
        if (elkNode) {
          return {
            ...node,
            position: {
              x: elkNode.x || 0,
              y: elkNode.y || 0
            },
            width: elkNode.width,
            height: elkNode.height
          };
        }
        return node;
      });

      return {
        nodes: layoutedNodes,
        edges,
        bounds: this.calculateBounds(layoutedNodes)
      };
    } catch (error) {
      console.warn('ELK layout failed, falling back to Dagre:', error);
      return this.applyDagreLayout(nodes, edges, options);
    }
  }


  /**
   * Get node width based on content
   */
  private getNodeWidth<T>(node: Node<T>): number {
    const baseWidth = 280;
    const data = node.data as any;

    if (data?.fields?.length) {
      // Adjust width based on field count and names
      const maxFieldLength = Math.max(
        ...data.fields.map((field: any) => field.name?.length || 0)
      );
      return Math.max(baseWidth, Math.min(400, baseWidth + maxFieldLength * 8));
    }

    return baseWidth;
  }

  /**
   * Get node height based on content
   */
  private getNodeHeight<T>(node: Node<T>): number {
    const baseHeight = 120;
    const data = node.data as any;

    if (data?.fields?.length) {
      // Calculate height based on field count
      const fieldHeight = Math.min(10, data.fields.length) * 24; // Max 10 visible fields
      return baseHeight + fieldHeight;
    }

    return baseHeight;
  }

  /**
   * Get edge weight for layout algorithms
   */
  private getEdgeWeight(edge: Edge): number {
    const data = edge.data as any;

    // Higher weight for foreign keys (stronger connections)
    switch (data?.type) {
      case 'foreign_key':
        return 3;
      case 'one_to_one':
        return 2;
      case 'many_to_many':
        return 1;
      default:
        return 1;
    }
  }

  /**
   * Get model hierarchy level for hierarchical layout
   */
  private getModelHierarchy(modelName: string): number {
    const hierarchyMap: Record<string, number> = {
      // Core infrastructure (level 0)
      'Site': 0,
      'Region': 0,
      'RackGroup': 0,

      // Physical infrastructure (level 1)
      'Rack': 1,
      'Device': 1,
      'DeviceType': 1,
      'Manufacturer': 1,

      // Network components (level 2)
      'Interface': 2,
      'Cable': 2,
      'Circuit': 2,

      // IP infrastructure (level 3)
      'IPAddress': 3,
      'Prefix': 3,
      'VLAN': 3,
      'VRF': 3,

      // Services and applications (level 4)
      'Service': 4,
      'Tenant': 4,
      'TenantGroup': 4,

      // Default level
      'default': 2
    };

    return hierarchyMap[modelName] || hierarchyMap.default;
  }

  /**
   * Calculate bounding box for all nodes
   */
  private calculateBounds<T>(nodes: Node<T>[]): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    if (nodes.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodes.forEach(node => {
      const x = node.position?.x || 0;
      const y = node.position?.y || 0;
      const width = node.width || 280;
      const height = node.height || 200;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    });

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }
}

// Singleton instance for global use
export const globalAutoLayout = new AutoLayout();