/**
 * Web Worker for Heavy Layout Calculations
 * 
 * Offloads computationally intensive layout algorithms to prevent UI blocking.
 * Supports force-directed, hierarchical, and complex auto-layout calculations.
 * 
 * Features:
 * - Non-blocking layout computation
 * - Progress reporting for long-running operations
 * - Memory-efficient data transfer
 * - Cancellation support
 * - Performance monitoring integration
 */

import type { Node, Edge } from 'reactflow';
import type { LayoutOptions, LayoutResult } from '../layout/autoLayout';

// Message types for worker communication
export interface LayoutWorkerMessage {
  type: 'LAYOUT_REQUEST' | 'LAYOUT_PROGRESS' | 'LAYOUT_COMPLETE' | 'LAYOUT_ERROR' | 'CANCEL';
  id: string;
  payload?: any;
}

export interface LayoutWorkerRequest {
  nodes: Node<any>[];
  edges: Edge[];
  options: LayoutOptions;
  algorithm: 'dagre' | 'hierarchical' | 'circular' | 'force' | 'elk';
}

export interface LayoutWorkerResponse {
  nodes: Node<any>[];
  edges: Edge[];
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  performanceMetrics: {
    duration: number;
    algorithm: string;
    nodeCount: number;
    edgeCount: number;
    complexity: string;
  };
}

export interface LayoutProgressInfo {
  progress: number; // 0-100
  step: string;
  iteration?: number;
  totalIterations?: number;
}

/**
 * Layout Worker Manager
 * Manages web worker lifecycle and communication for layout calculations
 */
export class LayoutWorkerManager {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, {
    resolve: (result: LayoutWorkerResponse) => void;
    reject: (error: Error) => void;
    onProgress?: (progress: LayoutProgressInfo) => void;
  }>();
  private isWorkerSupported: boolean;

  constructor() {
    this.isWorkerSupported = typeof Worker !== 'undefined';
    if (this.isWorkerSupported) {
      this.initializeWorker();
    }
  }

  /**
   * Initialize the web worker
   */
  private initializeWorker(): void {
    try {
      // Create worker from inline code to avoid separate file requirements
      const workerCode = this.generateWorkerCode();
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      
      this.worker = new Worker(workerUrl);
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      this.worker.onerror = this.handleWorkerError.bind(this);
      
      // Clean up the blob URL
      URL.revokeObjectURL(workerUrl);
      
      console.log('Layout worker initialized successfully');
    } catch (error) {
      console.warn('Failed to initialize layout worker, falling back to main thread:', error);
      this.isWorkerSupported = false;
    }
  }

  /**
   * Handle messages from the worker
   */
  private handleWorkerMessage(event: MessageEvent<LayoutWorkerMessage>): void {
    const { type, id, payload } = event.data;
    const request = this.pendingRequests.get(id);

    if (!request) {
      console.warn('Received message for unknown request ID:', id);
      return;
    }

    switch (type) {
      case 'LAYOUT_PROGRESS':
        if (request.onProgress) {
          request.onProgress(payload);
        }
        break;

      case 'LAYOUT_COMPLETE':
        this.pendingRequests.delete(id);
        request.resolve(payload);
        break;

      case 'LAYOUT_ERROR':
        this.pendingRequests.delete(id);
        request.reject(new Error(payload.message || 'Layout calculation failed'));
        break;
    }
  }

  /**
   * Handle worker errors
   */
  private handleWorkerError(error: ErrorEvent): void {
    console.error('Layout worker error:', error);
    
    // Reject all pending requests
    this.pendingRequests.forEach(({ reject }) => {
      reject(new Error('Worker error: ' + error.message));
    });
    this.pendingRequests.clear();

    // Reinitialize worker
    this.terminate();
    this.initializeWorker();
  }

  /**
   * Calculate layout using web worker (or fallback to main thread)
   */
  async calculateLayout<T>(
    nodes: Node<T>[],
    edges: Edge[],
    options: LayoutOptions,
    onProgress?: (progress: LayoutProgressInfo) => void
  ): Promise<LayoutResult<T>> {
    // Fallback to main thread if worker not supported or for small datasets
    if (!this.isWorkerSupported || !this.worker || nodes.length < 50) {
      return this.calculateLayoutMainThread(nodes, edges, options, onProgress);
    }

    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();
      
      // Store request handlers
      this.pendingRequests.set(requestId, {
        resolve: (result: LayoutWorkerResponse) => resolve(result as LayoutResult<T>),
        reject,
        onProgress
      });

      // Send request to worker
      const message: LayoutWorkerMessage = {
        type: 'LAYOUT_REQUEST',
        id: requestId,
        payload: {
          nodes: this.serializeNodesForWorker(nodes),
          edges: this.serializeEdgesForWorker(edges),
          options,
          algorithm: options.algorithm
        } as LayoutWorkerRequest
      };

      this.worker!.postMessage(message);

      // Set timeout for long-running operations
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Layout calculation timeout'));
        }
      }, 30000); // 30 second timeout
    });
  }

  /**
   * Fallback layout calculation on main thread
   */
  private async calculateLayoutMainThread<T>(
    nodes: Node<T>[],
    edges: Edge[],
    options: LayoutOptions,
    onProgress?: (progress: LayoutProgressInfo) => void
  ): Promise<LayoutResult<T>> {
    const startTime = performance.now();
    
    if (onProgress) {
      onProgress({ progress: 0, step: 'Initializing layout calculation' });
    }

    // Dynamic import to avoid bundling issues
    const { globalAutoLayout } = await import('../layout/autoLayout');
    
    if (onProgress) {
      onProgress({ progress: 50, step: 'Calculating positions' });
    }

    const result = await globalAutoLayout.applyLayout(nodes, edges, options);
    
    if (onProgress) {
      onProgress({ progress: 100, step: 'Layout complete' });
    }

    const duration = performance.now() - startTime;
    
    return {
      ...result,
      performanceMetrics: {
        duration,
        algorithm: options.algorithm,
        nodeCount: nodes.length,
        edgeCount: edges.length,
        complexity: this.estimateComplexity(nodes.length, edges.length, options.algorithm)
      }
    } as LayoutResult<T> & { performanceMetrics: any };
  }

  /**
   * Cancel a pending layout calculation
   */
  cancelLayout(requestId: string): void {
    if (this.pendingRequests.has(requestId)) {
      this.pendingRequests.delete(requestId);
      
      if (this.worker) {
        this.worker.postMessage({
          type: 'CANCEL',
          id: requestId
        } as LayoutWorkerMessage);
      }
    }
  }

  /**
   * Terminate the worker
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingRequests.clear();
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `layout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Serialize nodes for worker transfer (remove non-serializable properties)
   */
  private serializeNodesForWorker<T>(nodes: Node<T>[]): any[] {
    return nodes.map(node => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: {
        // Only include essential data for layout calculation
        name: (node.data as any)?.name,
        app: (node.data as any)?.app,
        fields: (node.data as any)?.fields?.length || 0,
        fieldCount: (node.data as any)?.fieldCount || 0
      },
      width: node.width,
      height: node.height
    }));
  }

  /**
   * Serialize edges for worker transfer
   */
  private serializeEdgesForWorker(edges: Edge[]): any[] {
    return edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      data: {
        type: (edge.data as any)?.type,
        relationshipType: (edge.data as any)?.relationshipType
      }
    }));
  }

  /**
   * Estimate algorithmic complexity
   */
  private estimateComplexity(nodeCount: number, edgeCount: number, algorithm: string): string {
    switch (algorithm) {
      case 'dagre':
        return 'O(V + E)';
      case 'hierarchical':
        return 'O(V log V)';
      case 'circular':
        return 'O(V)';
      case 'force':
        return 'O(V² × iterations)';
      case 'elk':
        return 'O(V + E)';
      default:
        return 'O(V + E)';
    }
  }

  /**
   * Generate worker code as string
   */
  private generateWorkerCode(): string {
    return `
      // Layout Worker Implementation
      // This runs in a separate thread to avoid blocking the UI
      
      let activeRequests = new Map();
      
      // Simplified layout algorithms for worker
      class WorkerLayoutEngine {
        static calculateDagreLayout(nodes, edges, options) {
          // Simplified Dagre-like algorithm
          const positioned = nodes.map((node, index) => ({
            ...node,
            position: {
              x: (index % 5) * (options.nodeSpacing || 150),
              y: Math.floor(index / 5) * (options.rankSpacing || 100)
            }
          }));
          
          return {
            nodes: positioned,
            edges,
            bounds: this.calculateBounds(positioned)
          };
        }
        
        static calculateHierarchicalLayout(nodes, edges, options) {
          // Group by app and arrange hierarchically
          const nodesByApp = new Map();
          nodes.forEach((node, index) => {
            const app = node.data?.app || 'unknown';
            if (!nodesByApp.has(app)) {
              nodesByApp.set(app, []);
            }
            nodesByApp.get(app).push({ ...node, originalIndex: index });
          });
          
          const positioned = [];
          let appIndex = 0;
          
          nodesByApp.forEach((appNodes) => {
            appNodes.forEach((node, nodeIndex) => {
              positioned[node.originalIndex] = {
                ...node,
                position: {
                  x: (nodeIndex % 4) * (options.nodeSpacing || 150),
                  y: appIndex * 200 + Math.floor(nodeIndex / 4) * (options.rankSpacing || 100)
                }
              };
            });
            appIndex++;
          });
          
          return {
            nodes: positioned,
            edges,
            bounds: this.calculateBounds(positioned)
          };
        }
        
        static calculateCircularLayout(nodes, edges, options) {
          const center = { x: 400, y: 300 };
          const radius = Math.max(200, nodes.length * 15);
          
          const positioned = nodes.map((node, index) => {
            const angle = (2 * Math.PI * index) / nodes.length;
            return {
              ...node,
              position: {
                x: center.x + radius * Math.cos(angle),
                y: center.y + radius * Math.sin(angle)
              }
            };
          });
          
          return {
            nodes: positioned,
            edges,
            bounds: this.calculateBounds(positioned)
          };
        }
        
        static calculateForceLayout(nodes, edges, options, onProgress) {
          // Simplified force-directed algorithm with progress reporting
          const positioned = nodes.map(node => ({
            ...node,
            position: node.position || {
              x: Math.random() * 800,
              y: Math.random() * 600
            }
          }));
          
          const iterations = Math.min(50, Math.max(10, nodes.length));
          let temperature = 100;
          const cooling = 0.95;
          
          for (let i = 0; i < iterations; i++) {
            // Report progress
            if (onProgress && i % 5 === 0) {
              onProgress({
                progress: (i / iterations) * 100,
                step: 'Running force simulation',
                iteration: i + 1,
                totalIterations: iterations
              });
            }
            
            // Simple force calculation
            positioned.forEach((nodeA, indexA) => {
              let forceX = 0;
              let forceY = 0;
              
              // Repulsion from other nodes
              positioned.forEach((nodeB, indexB) => {
                if (indexA !== indexB) {
                  const dx = nodeA.position.x - nodeB.position.x;
                  const dy = nodeA.position.y - nodeB.position.y;
                  const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                  const force = temperature * 1000 / (distance * distance);
                  
                  forceX += (dx / distance) * force;
                  forceY += (dy / distance) * force;
                }
              });
              
              // Attraction from connected nodes
              edges.forEach(edge => {
                if (edge.source === nodeA.id) {
                  const target = positioned.find(n => n.id === edge.target);
                  if (target) {
                    const dx = target.position.x - nodeA.position.x;
                    const dy = target.position.y - nodeA.position.y;
                    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                    const force = distance * distance / (temperature * 500);
                    
                    forceX += (dx / distance) * force;
                    forceY += (dy / distance) * force;
                  }
                }
              });
              
              // Apply forces
              const displacement = Math.sqrt(forceX * forceX + forceY * forceY);
              if (displacement > 0) {
                const limitedDisplacement = Math.min(displacement, temperature);
                nodeA.position.x += (forceX / displacement) * limitedDisplacement;
                nodeA.position.y += (forceY / displacement) * limitedDisplacement;
              }
              
              // Keep in bounds
              nodeA.position.x = Math.max(50, Math.min(1150, nodeA.position.x));
              nodeA.position.y = Math.max(50, Math.min(750, nodeA.position.y));
            });
            
            temperature *= cooling;
          }
          
          return {
            nodes: positioned,
            edges,
            bounds: this.calculateBounds(positioned)
          };
        }
        
        static calculateBounds(nodes) {
          if (nodes.length === 0) {
            return { x: 0, y: 0, width: 0, height: 0 };
          }
          
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          
          nodes.forEach(node => {
            const x = node.position?.x || 0;
            const y = node.position?.y || 0;
            const width = node.width || 200;
            const height = node.height || 150;
            
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
      
      // Handle messages from main thread
      self.onmessage = function(event) {
        const { type, id, payload } = event.data;
        
        if (type === 'LAYOUT_REQUEST') {
          try {
            const { nodes, edges, options, algorithm } = payload;
            const startTime = performance.now();
            
            // Progress callback
            const onProgress = (progress) => {
              self.postMessage({
                type: 'LAYOUT_PROGRESS',
                id,
                payload: progress
              });
            };
            
            let result;
            
            // Calculate layout based on algorithm
            switch (algorithm) {
              case 'dagre':
                result = WorkerLayoutEngine.calculateDagreLayout(nodes, edges, options);
                break;
              case 'hierarchical':
                result = WorkerLayoutEngine.calculateHierarchicalLayout(nodes, edges, options);
                break;
              case 'circular':
                result = WorkerLayoutEngine.calculateCircularLayout(nodes, edges, options);
                break;
              case 'force':
                result = WorkerLayoutEngine.calculateForceLayout(nodes, edges, options, onProgress);
                break;
              default:
                result = WorkerLayoutEngine.calculateDagreLayout(nodes, edges, options);
            }
            
            const duration = performance.now() - startTime;
            
            // Send result back to main thread
            self.postMessage({
              type: 'LAYOUT_COMPLETE',
              id,
              payload: {
                ...result,
                performanceMetrics: {
                  duration,
                  algorithm,
                  nodeCount: nodes.length,
                  edgeCount: edges.length,
                  complexity: getComplexity(algorithm)
                }
              }
            });
            
          } catch (error) {
            self.postMessage({
              type: 'LAYOUT_ERROR',
              id,
              payload: { message: error.message }
            });
          }
        } else if (type === 'CANCEL') {
          // Handle cancellation
          activeRequests.delete(id);
        }
      };
      
      function getComplexity(algorithm) {
        const complexityMap = {
          'dagre': 'O(V + E)',
          'hierarchical': 'O(V log V)',
          'circular': 'O(V)',
          'force': 'O(V² × iterations)',
          'elk': 'O(V + E)'
        };
        return complexityMap[algorithm] || 'O(V + E)';
      }
    `;
  }
}

// Global instance
export const layoutWorkerManager = new LayoutWorkerManager();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    layoutWorkerManager.terminate();
  });
}