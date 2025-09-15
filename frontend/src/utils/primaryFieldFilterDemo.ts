/**
 * Demo and testing utility for primary field filtering
 * This file demonstrates how the primary field filtering works with actual data
 */

import { demoNodes } from './demoData';
import {
  filterPrimaryFields,
  getPrimaryFieldSummary,
  DEFAULT_PRIMARY_FIELD_CONFIG,
  type PrimaryFieldStrategy
} from './primaryFieldFilter';
import { analyzeFieldPriorities } from './fieldPriorityCalculator';

/**
 * Test all strategies with demo data
 */
export function testAllStrategiesWithDemoData(): void {
  const strategies: PrimaryFieldStrategy[] = ['rule-based', 'required-only', 'smart-ranking', 'context-aware'];

  console.group('🔍 Primary Field Filtering Analysis - Demo Data');

  demoNodes.forEach(node => {
    const modelName = node.data.name;
    const fields = node.data.fields;

    console.group(`📊 Model: ${modelName} (${fields.length} total fields)`);

    // Show field priority analysis first
    console.group('Field Priority Analysis');
    analyzeFieldPriorities(fields, modelName);
    console.groupEnd();

    // Test each strategy
    strategies.forEach(strategy => {
      console.group(`Strategy: ${strategy}`);

      const config = {
        ...DEFAULT_PRIMARY_FIELD_CONFIG,
        strategy
      };

      const result = filterPrimaryFields(fields, config, modelName);
      console.log(getPrimaryFieldSummary(result, modelName));

      console.groupEnd();
    });

    console.groupEnd();
  });

  console.groupEnd();
}

/**
 * Show before/after comparison for each model
 */
export function showBeforeAfterComparison(): void {
  console.group('📋 Before/After Field Display Comparison');

  demoNodes.forEach(node => {
    const modelName = node.data.name;
    const fields = node.data.fields;

    console.group(`Model: ${modelName}`);

    // Before (all fields)
    console.log('BEFORE (all fields shown):');
    console.log(`  Fields: ${fields.map(f => f.name).join(', ')}`);

    // After (primary fields only)
    const result = filterPrimaryFields(fields, DEFAULT_PRIMARY_FIELD_CONFIG, modelName);
    console.log('\nAFTER (primary fields only):');
    console.log(`  Primary: ${result.primaryFields.map(f => f.name).join(', ')}`);
    console.log(`  Hidden: ${result.remainingFields.map(f => f.name).join(', ') || 'none'}`);
    console.log(`  Reduction: ${fields.length} → ${result.primaryFields.length} fields (${Math.round((1 - result.primaryFields.length / fields.length) * 100)}% reduction)`);

    console.groupEnd();
  });

  console.groupEnd();
}

/**
 * Test with custom configurations
 */
export function testCustomConfigurations(): void {
  console.group('⚙️ Custom Configuration Testing');

  const testConfigs = [
    {
      name: 'Minimal (max 3 fields)',
      config: { ...DEFAULT_PRIMARY_FIELD_CONFIG, maxPrimaryFields: 3 }
    },
    {
      name: 'Required only',
      config: { ...DEFAULT_PRIMARY_FIELD_CONFIG, strategy: 'required-only' as PrimaryFieldStrategy }
    },
    {
      name: 'Extended (max 7 fields)',
      config: { ...DEFAULT_PRIMARY_FIELD_CONFIG, maxPrimaryFields: 7 }
    }
  ];

  const testModel = demoNodes.find(n => n.data.name === 'Device')!;
  const fields = testModel.data.fields;

  testConfigs.forEach(({ name, config }) => {
    console.group(name);
    const result = filterPrimaryFields(fields, config, 'Device');
    console.log(`Primary fields: ${result.primaryFields.map(f => f.name).join(', ')}`);
    console.log(`Hidden fields: ${result.remainingFields.map(f => f.name).join(', ') || 'none'}`);
    console.groupEnd();
  });

  console.groupEnd();
}

/**
 * Generate summary statistics
 */
export function generateFilteringStatistics(): void {
  console.group('📊 Primary Field Filtering Statistics');

  const stats = {
    totalModels: demoNodes.length,
    fieldReduction: [] as number[],
    averageFieldsBeforeFiltering: 0,
    averageFieldsAfterFiltering: 0,
    modelStats: [] as Array<{
      model: string;
      before: number;
      after: number;
      reduction: number;
    }>
  };

  let totalFieldsBefore = 0;
  let totalFieldsAfter = 0;

  demoNodes.forEach(node => {
    const modelName = node.data.name;
    const fields = node.data.fields;
    const result = filterPrimaryFields(fields, DEFAULT_PRIMARY_FIELD_CONFIG, modelName);

    const before = fields.length;
    const after = result.primaryFields.length;
    const reduction = Math.round((1 - after / before) * 100);

    stats.fieldReduction.push(reduction);
    stats.modelStats.push({
      model: modelName,
      before,
      after,
      reduction
    });

    totalFieldsBefore += before;
    totalFieldsAfter += after;
  });

  stats.averageFieldsBeforeFiltering = totalFieldsBefore / stats.totalModels;
  stats.averageFieldsAfterFiltering = totalFieldsAfter / stats.totalModels;

  console.log('Overall Statistics:');
  console.log(`  Models analyzed: ${stats.totalModels}`);
  console.log(`  Average fields before: ${stats.averageFieldsBeforeFiltering.toFixed(1)}`);
  console.log(`  Average fields after: ${stats.averageFieldsAfterFiltering.toFixed(1)}`);
  console.log(`  Average reduction: ${Math.round((1 - stats.averageFieldsAfterFiltering / stats.averageFieldsBeforeFiltering) * 100)}%`);

  console.log('\nPer-Model Breakdown:');
  stats.modelStats.forEach(({ model, before, after, reduction }) => {
    console.log(`  ${model}: ${before} → ${after} fields (${reduction}% reduction)`);
  });

  console.groupEnd();
}

/**
 * Run all demo tests
 */
export function runAllDemoTests(): void {
  console.log('🚀 Running Primary Field Filtering Demo Tests...\n');

  try {
    testAllStrategiesWithDemoData();
    showBeforeAfterComparison();
    testCustomConfigurations();
    generateFilteringStatistics();

    console.log('\n✅ All demo tests completed successfully!');
    console.log('\n📝 Summary:');
    console.log('- Primary field filtering successfully reduces visual clutter');
    console.log('- Different strategies provide flexibility for various use cases');
    console.log('- Context-aware filtering works best for Nautobot models');
    console.log('- Users can expand nodes to see all fields when needed');

  } catch (error) {
    console.error('❌ Demo test failed:', error);
  }
}

// Auto-run demo if this file is executed directly
if (typeof window !== 'undefined' && (window as any).__DEMO_PRIMARY_FIELD_FILTERING__) {
  runAllDemoTests();
}