/**
 * Performance Monitoring and Optimization Utility
 * 
 * Provides comprehensive performance tracking, timing measurements, and optimization
 * recommendations for schema transformations and large dataset handling.
 * 
 * Features:
 * - High-precision timing measurements
 * - Memory usage tracking
 * - Algorithm complexity analysis
 * - Performance warnings and recommendations
 * - Debug console integration
 * - Metrics aggregation and reporting
 */

export interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  memoryStart?: number;
  memoryEnd?: number;
  memoryDelta?: number;
  dataSize?: number;
  complexity?: string;
  category: 'transformation' | 'layout' | 'rendering' | 'api' | 'calculation';
  details?: Record<string, any>;
}

export interface PerformanceReport {
  totalDuration: number;
  slowestOperations: PerformanceMetric[];
  memoryUsage: {
    peak: number;
    total: number;
    average: number;
  };
  recommendations: string[];
  warnings: string[];
  complexityAnalysis: Record<string, string>;
}

export interface PerformanceThresholds {
  transformationWarning: number; // ms
  transformationError: number; // ms
  layoutWarning: number; // ms
  layoutError: number; // ms
  memoryWarning: number; // MB
  largeDatasetThreshold: number; // number of nodes
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private activeTimers: Map<string, PerformanceMetric> = new Map();
  private isEnabled: boolean = true;
  private debugMode: boolean = false;

  // Performance thresholds
  private thresholds: PerformanceThresholds = {
    transformationWarning: 1000, // 1 second
    transformationError: 5000,   // 5 seconds
    layoutWarning: 100,          // 100ms
    layoutError: 1000,           // 1 second
    memoryWarning: 100,          // 100MB
    largeDatasetThreshold: 100,  // 100 nodes
  };

  constructor() {
    this.initializeDebugConsole();
  }

  /**
   * Enable or disable performance monitoring
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.clearMetrics();
    }
  }

  /**
   * Enable debug mode for detailed logging
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    if (enabled) {
      console.log('Performance Monitor: Debug mode enabled');
    }
  }

  /**
   * Update performance thresholds
   */
  updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
  }

  /**
   * Start timing a performance metric
   */
  startTiming(
    name: string, 
    category: PerformanceMetric['category'],
    dataSize?: number,
    details?: Record<string, any>
  ): void {
    if (!this.isEnabled) return;

    const metric: PerformanceMetric = {
      name,
      startTime: performance.now(),
      memoryStart: this.getMemoryUsage(),
      dataSize,
      category,
      details,
    };

    this.activeTimers.set(name, metric);

    if (this.debugMode) {
      console.log(`🟡 Performance: Started timing "${name}" (${category})`, {
        dataSize,
        memoryStart: `${metric.memoryStart}MB`,
        details
      });
    }
  }

  /**
   * End timing a performance metric
   */
  endTiming(name: string, additionalDetails?: Record<string, any>): PerformanceMetric | null {
    if (!this.isEnabled) return null;

    const activeMetric = this.activeTimers.get(name);
    if (!activeMetric) {
      console.warn(`Performance Monitor: No active timer found for "${name}"`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - activeMetric.startTime;
    const memoryEnd = this.getMemoryUsage();
    const memoryDelta = memoryEnd - (activeMetric.memoryStart || 0);

    const completedMetric: PerformanceMetric = {
      ...activeMetric,
      endTime,
      duration,
      memoryEnd,
      memoryDelta,
      details: { ...activeMetric.details, ...additionalDetails },
      complexity: this.analyzeComplexity(activeMetric.dataSize, duration)
    };

    // Store completed metric
    this.metrics.set(name, completedMetric);
    this.activeTimers.delete(name);

    // Check for performance issues
    this.checkPerformanceThresholds(completedMetric);

    if (this.debugMode) {
      console.log(`🟢 Performance: Completed timing "${name}"`, {
        duration: `${duration.toFixed(2)}ms`,
        memory: `${memoryDelta > 0 ? '+' : ''}${memoryDelta.toFixed(2)}MB`,
        complexity: completedMetric.complexity
      });
    }

    return completedMetric;
  }

  /**
   * Time a function execution
   */
  async timeFunction<T>(
    name: string,
    category: PerformanceMetric['category'],
    fn: () => T | Promise<T>,
    dataSize?: number,
    details?: Record<string, any>
  ): Promise<{ result: T; metric: PerformanceMetric }> {
    if (!this.isEnabled) {
      const result = await fn();
      return { 
        result, 
        metric: { 
          name, 
          startTime: 0, 
          duration: 0, 
          category, 
          dataSize, 
          details 
        } 
      };
    }

    this.startTiming(name, category, dataSize, details);
    
    try {
      const result = await fn();
      const metric = this.endTiming(name, { success: true });
      return { result, metric: metric! };
    } catch (error) {
      const metric = this.endTiming(name, { 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Measure algorithmic complexity based on data size and execution time
   */
  private analyzeComplexity(dataSize?: number, duration?: number): string {
    if (!dataSize || !duration || dataSize < 10) {
      return 'O(1) - Constant';
    }

    // Analyze time complexity based on data size vs duration patterns
    const timePerItem = duration / dataSize;
    
    if (timePerItem < 0.1) {
      return 'O(1) - Constant';
    } else if (timePerItem < 1) {
      return 'O(n) - Linear';
    } else if (timePerItem < Math.log2(dataSize) * 2) {
      return 'O(n log n) - Linearithmic';
    } else if (timePerItem < dataSize) {
      return 'O(n²) - Quadratic';
    } else {
      return 'O(n³+) - Polynomial/Exponential';
    }
  }

  /**
   * Check performance against thresholds and emit warnings
   */
  private checkPerformanceThresholds(metric: PerformanceMetric): void {
    const duration = metric.duration || 0;
    const category = metric.category;
    const dataSize = metric.dataSize || 0;

    let shouldWarn = false;
    let shouldError = false;
    const issues: string[] = [];

    // Check transformation thresholds
    if (category === 'transformation') {
      if (duration > this.thresholds.transformationError) {
        shouldError = true;
        issues.push(`Transformation took ${duration.toFixed(0)}ms (>${this.thresholds.transformationError}ms)`);
      } else if (duration > this.thresholds.transformationWarning) {
        shouldWarn = true;
        issues.push(`Transformation took ${duration.toFixed(0)}ms (>${this.thresholds.transformationWarning}ms)`);
      }
    }

    // Check layout thresholds
    if (category === 'layout') {
      if (duration > this.thresholds.layoutError) {
        shouldError = true;
        issues.push(`Layout calculation took ${duration.toFixed(0)}ms (>${this.thresholds.layoutError}ms)`);
      } else if (duration > this.thresholds.layoutWarning) {
        shouldWarn = true;
        issues.push(`Layout calculation took ${duration.toFixed(0)}ms (>${this.thresholds.layoutWarning}ms)`);
      }
    }

    // Check memory usage
    if (metric.memoryDelta && metric.memoryDelta > this.thresholds.memoryWarning) {
      shouldWarn = true;
      issues.push(`High memory usage: +${metric.memoryDelta.toFixed(1)}MB`);
    }

    // Check large dataset handling
    if (dataSize > this.thresholds.largeDatasetThreshold) {
      const recommendations = this.generateOptimizationRecommendations(metric);
      if (recommendations.length > 0) {
        issues.push(`Large dataset detected (${dataSize} items). Recommendations: ${recommendations.join(', ')}`);
      }
    }

    // Emit warnings/errors
    if (shouldError) {
      console.error(`🔴 Performance Error: ${metric.name}`, {
        duration: `${duration.toFixed(2)}ms`,
        dataSize,
        complexity: metric.complexity,
        issues
      });
    } else if (shouldWarn) {
      console.warn(`🟡 Performance Warning: ${metric.name}`, {
        duration: `${duration.toFixed(2)}ms`,
        dataSize,
        complexity: metric.complexity,
        issues
      });
    }
  }

  /**
   * Generate optimization recommendations based on metric analysis
   */
  private generateOptimizationRecommendations(metric: PerformanceMetric): string[] {
    const recommendations: string[] = [];
    const duration = metric.duration || 0;
    const dataSize = metric.dataSize || 0;
    const complexity = metric.complexity || '';

    // Transformation optimizations
    if (metric.category === 'transformation') {
      if (complexity.includes('Quadratic') || complexity.includes('Polynomial')) {
        recommendations.push('Consider algorithm optimization to reduce complexity');
      }
      if (dataSize > 500) {
        recommendations.push('Use data chunking or progressive loading');
        recommendations.push('Implement memoization for repeated calculations');
      }
      if (duration > 2000) {
        recommendations.push('Move heavy calculations to web worker');
      }
    }

    // Layout optimizations
    if (metric.category === 'layout') {
      if (dataSize > 100) {
        recommendations.push('Use virtualization for large node sets');
        recommendations.push('Implement viewport-based rendering');
      }
      if (duration > 500) {
        recommendations.push('Consider simpler layout algorithms for large datasets');
      }
    }

    // Memory optimizations
    if (metric.memoryDelta && metric.memoryDelta > 50) {
      recommendations.push('Optimize data structures to reduce memory usage');
      recommendations.push('Clean up unused references and objects');
    }

    return recommendations;
  }

  /**
   * Get current memory usage in MB
   */
  getMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024;
    }
    return 0;
  }

  /**
   * Generate comprehensive performance report
   */
  generateReport(): PerformanceReport {
    const metrics = Array.from(this.metrics.values());
    const completedMetrics = metrics.filter(m => m.duration !== undefined);

    if (completedMetrics.length === 0) {
      return {
        totalDuration: 0,
        slowestOperations: [],
        memoryUsage: { peak: 0, total: 0, average: 0 },
        recommendations: ['No performance data available'],
        warnings: [],
        complexityAnalysis: {}
      };
    }

    // Calculate totals
    const totalDuration = completedMetrics.reduce((sum, m) => sum + (m.duration || 0), 0);
    
    // Find slowest operations
    const slowestOperations = completedMetrics
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 5);

    // Calculate memory usage
    const memoryValues = completedMetrics
      .map(m => m.memoryEnd || 0)
      .filter(m => m > 0);
    
    const memoryUsage = {
      peak: memoryValues.length > 0 ? Math.max(...memoryValues) : 0,
      total: memoryValues.reduce((sum, m) => sum + m, 0),
      average: memoryValues.length > 0 ? memoryValues.reduce((sum, m) => sum + m, 0) / memoryValues.length : 0
    };

    // Generate recommendations
    const recommendations: string[] = [];
    const warnings: string[] = [];
    const complexityAnalysis: Record<string, string> = {};

    completedMetrics.forEach(metric => {
      if (metric.complexity) {
        complexityAnalysis[metric.name] = metric.complexity;
      }

      const duration = metric.duration || 0;
      const dataSize = metric.dataSize || 0;

      // Add warnings for slow operations
      if (duration > 1000) {
        warnings.push(`${metric.name}: ${duration.toFixed(0)}ms execution time`);
      }

      // Add recommendations based on performance patterns
      const metricRecommendations = this.generateOptimizationRecommendations(metric);
      recommendations.push(...metricRecommendations);
    });

    // Remove duplicate recommendations
    const uniqueRecommendations = [...new Set(recommendations)];

    return {
      totalDuration,
      slowestOperations,
      memoryUsage,
      recommendations: uniqueRecommendations,
      warnings,
      complexityAnalysis
    };
  }

  /**
   * Get metrics for a specific category
   */
  getMetricsByCategory(category: PerformanceMetric['category']): PerformanceMetric[] {
    return Array.from(this.metrics.values())
      .filter(metric => metric.category === category);
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics.clear();
    this.activeTimers.clear();
  }

  /**
   * Initialize debug console commands
   */
  private initializeDebugConsole(): void {
    if (typeof window !== 'undefined') {
      // Add global performance commands to window for debug console access
      (window as any).performanceMonitor = {
        getReport: () => this.generateReport(),
        clearMetrics: () => this.clearMetrics(),
        setDebugMode: (enabled: boolean) => this.setDebugMode(enabled),
        getMetrics: () => Array.from(this.metrics.values()),
        getActiveTimers: () => Array.from(this.activeTimers.values()),
        exportMetrics: () => {
          const report = this.generateReport();
          console.log('Performance Report:', report);
          return report;
        }
      };
    }
  }

  /**
   * Export performance data for analysis
   */
  exportMetrics(): string {
    const report = this.generateReport();
    return JSON.stringify(report, null, 2);
  }
}

// Performance monitoring utilities
export class PerformanceUtils {
  /**
   * Measure position calculation performance
   */
  static measurePositionCalculation<T>(
    nodes: T[],
    calculator: (nodes: T[]) => any[],
    name: string = 'Position Calculation'
  ): { result: any[]; duration: number } {
    const start = performance.now();
    const result = calculator(nodes);
    const duration = performance.now() - start;

    if (duration > 100) {
      console.warn(`🟡 Slow position calculation: ${name} took ${duration.toFixed(2)}ms for ${nodes.length} nodes`);
    }

    return { result, duration };
  }

  /**
   * Measure memory usage of a function
   */
  static measureMemoryUsage<T>(fn: () => T): { result: T; memoryDelta: number } {
    const memoryBefore = performanceMonitor.getMemoryUsage();
    const result = fn();
    const memoryAfter = performanceMonitor.getMemoryUsage();
    const memoryDelta = memoryAfter - memoryBefore;

    return { result, memoryDelta };
  }

  /**
   * Create a memoized version of a function with performance tracking
   */
  static memoizeWithPerformance<TArgs extends any[], TReturn>(
    fn: (...args: TArgs) => TReturn,
    keyFn?: (...args: TArgs) => string,
    name?: string
  ): (...args: TArgs) => TReturn {
    const cache = new Map<string, TReturn>();
    let hits = 0;
    let misses = 0;

    return (...args: TArgs): TReturn => {
      const key = keyFn ? keyFn(...args) : JSON.stringify(args);
      
      if (cache.has(key)) {
        hits++;
        if (name && hits % 100 === 0) {
          console.log(`📊 Memoization stats for ${name}: ${hits} hits, ${misses} misses (${((hits / (hits + misses)) * 100).toFixed(1)}% hit rate)`);
        }
        return cache.get(key)!;
      }

      misses++;
      const result = fn(...args);
      cache.set(key, result);
      
      return result;
    };
  }

  /**
   * Debounce function with performance tracking
   */
  static debounceWithPerformance<TArgs extends any[]>(
    fn: (...args: TArgs) => void,
    delay: number,
    name?: string
  ): (...args: TArgs) => void {
    let timeoutId: NodeJS.Timeout;
    let callCount = 0;

    return (...args: TArgs): void => {
      callCount++;
      clearTimeout(timeoutId);
      
      timeoutId = setTimeout(() => {
        if (name) {
          performanceMonitor.startTiming(`${name} (debounced)`, 'calculation');
        }
        
        fn(...args);
        
        if (name) {
          performanceMonitor.endTiming(`${name} (debounced)`, { 
            debouncedCalls: callCount,
            delay 
          });
        }
        
        callCount = 0;
      }, delay);
    };
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// Enable debug mode in development
if (process.env.NODE_ENV === 'development') {
  performanceMonitor.setDebugMode(true);
}

export default performanceMonitor;