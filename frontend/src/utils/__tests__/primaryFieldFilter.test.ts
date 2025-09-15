/**
 * Simple validation tests for primary field filtering
 * These tests validate the core functionality without requiring a test runner
 */

import type { ModelField } from '../../types/schema';
import {
  calculateFieldPriorities
} from '../fieldPriorityCalculator';
import {
  filterPrimaryFields,
  DEFAULT_PRIMARY_FIELD_CONFIG
} from '../primaryFieldFilter';

// Test data
const testFields: ModelField[] = [
  { name: 'id', type: 'AutoField', required: true, nullable: false },
  { name: 'name', type: 'CharField', required: true, nullable: false },
  { name: 'description', type: 'TextField', required: false, nullable: true },
  { name: 'created', type: 'DateTimeField', required: false, nullable: false },
  { name: 'status', type: 'CharField', required: true, nullable: false },
  { name: 'device_type', type: 'ForeignKey', required: true, nullable: false, relatedModel: 'DeviceType' },
  { name: 'site', type: 'ForeignKey', required: false, nullable: true, relatedModel: 'Site' },
  { name: 'custom_field_data', type: 'JSONField', required: false, nullable: true },
  { name: '_state', type: 'ModelState', required: false, nullable: true },
  { name: 'enabled', type: 'BooleanField', required: false, nullable: false }
];

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

/**
 * Run a single test and return result
 */
function runTest(name: string, testFn: () => void | boolean): TestResult {
  try {
    const result = testFn();
    return {
      name,
      passed: result !== false,
      details: result
    };
  } catch (error) {
    return {
      name,
      passed: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Test field priority calculation
 */
function testFieldPriorityCalculation(): TestResult {
  return runTest('Field Priority Calculation', () => {
    const priorities = calculateFieldPriorities(testFields);

    // Verify that high-priority fields (name, status) score higher than low-priority ones
    const nameField = priorities.find(p => p.field.name === 'name');
    const descField = priorities.find(p => p.field.name === 'description');
    const stateField = priorities.find(p => p.field.name === '_state');

    if (!nameField || !descField || !stateField) {
      throw new Error('Missing expected fields in priority calculation');
    }

    // Name should be higher priority than description
    if (nameField.priority <= descField.priority) {
      throw new Error(`Name field priority (${nameField.priority}) should be higher than description (${descField.priority})`);
    }

    // Any field should be higher priority than internal _state field
    if (nameField.priority <= stateField.priority) {
      throw new Error(`Name field priority (${nameField.priority}) should be higher than _state (${stateField.priority})`);
    }

    return true;
  });
}

/**
 * Test smart ranking strategy
 */
function testSmartRankingStrategy(): TestResult {
  return runTest('Smart Ranking Strategy', () => {
    const result = filterPrimaryFields(testFields, {
      ...DEFAULT_PRIMARY_FIELD_CONFIG,
      strategy: 'smart-ranking',
      maxPrimaryFields: 4
    });

    // Should have exactly 4 primary fields
    if (result.primaryFields.length !== 4) {
      throw new Error(`Expected 4 primary fields, got ${result.primaryFields.length}`);
    }

    // Should include name field (high priority)
    const hasName = result.primaryFields.some(f => f.name === 'name');
    if (!hasName) {
      throw new Error('Primary fields should include name field');
    }

    // Should NOT include internal fields
    const hasInternalField = result.primaryFields.some(f => f.name.startsWith('_'));
    if (hasInternalField) {
      throw new Error('Primary fields should not include internal fields');
    }

    return true; // Return boolean instead of object
  });
}

/**
 * Test required-only strategy
 */
function testRequiredOnlyStrategy(): TestResult {
  return runTest('Required-Only Strategy', () => {
    const result = filterPrimaryFields(testFields, {
      ...DEFAULT_PRIMARY_FIELD_CONFIG,
      strategy: 'required-only'
    });

    // All primary fields should be required
    const allRequired = result.primaryFields.every(f => f.required);
    if (!allRequired) {
      throw new Error('All primary fields should be required when using required-only strategy');
    }

    // All remaining fields should be optional
    const allOptional = result.remainingFields.every(f => !f.required);
    if (!allOptional) {
      throw new Error('All remaining fields should be optional when using required-only strategy');
    }

    return true;
  });
}

/**
 * Test context-aware strategy with model name
 */
function testContextAwareStrategy(): TestResult {
  return runTest('Context-Aware Strategy', () => {
    // Test with Device model (should have specific rules)
    const deviceResult = filterPrimaryFields(testFields, {
      ...DEFAULT_PRIMARY_FIELD_CONFIG,
      strategy: 'context-aware'
    }, 'Device');

    // Test with unknown model (should fall back to default)
    const unknownResult = filterPrimaryFields(testFields, {
      ...DEFAULT_PRIMARY_FIELD_CONFIG,
      strategy: 'context-aware'
    }, 'UnknownModel');

    // Both should work without errors
    if (deviceResult.primaryFields.length === 0) {
      throw new Error('Device context-aware filtering returned no primary fields');
    }

    if (unknownResult.primaryFields.length === 0) {
      throw new Error('Unknown model context-aware filtering returned no primary fields');
    }

    return true;
  });
}

/**
 * Test field count limits
 */
function testFieldCountLimits(): TestResult {
  return runTest('Field Count Limits', () => {
    // Test with very low limit
    const lowLimitResult = filterPrimaryFields(testFields, {
      ...DEFAULT_PRIMARY_FIELD_CONFIG,
      maxPrimaryFields: 2,
      minPrimaryFields: 2
    });

    if (lowLimitResult.primaryFields.length !== 2) {
      throw new Error(`Expected exactly 2 primary fields, got ${lowLimitResult.primaryFields.length}`);
    }

    // Test with very high limit
    const highLimitResult = filterPrimaryFields(testFields, {
      ...DEFAULT_PRIMARY_FIELD_CONFIG,
      maxPrimaryFields: 100
    });

    if (highLimitResult.primaryFields.length > testFields.length) {
      throw new Error('Primary fields count should not exceed total fields');
    }

    return true;
  });
}

/**
 * Test edge cases
 */
function testEdgeCases(): TestResult {
  return runTest('Edge Cases', () => {
    // Empty fields array
    const emptyResult = filterPrimaryFields([]);
    if (emptyResult.primaryFields.length !== 0 || emptyResult.remainingFields.length !== 0) {
      throw new Error('Empty fields array should return empty results');
    }

    // Single field
    const singleFieldResult = filterPrimaryFields([testFields[0]]);
    if (singleFieldResult.primaryFields.length !== 1) {
      throw new Error('Single field should be selected as primary');
    }

    // All fields required
    const allRequiredFields = testFields.map(f => ({ ...f, required: true }));
    const allRequiredResult = filterPrimaryFields(allRequiredFields, {
      ...DEFAULT_PRIMARY_FIELD_CONFIG,
      strategy: 'required-only',
      maxPrimaryFields: 3
    });

    if (allRequiredResult.primaryFields.length !== 3) {
      throw new Error('Should limit primary fields even when all are required');
    }

    return true;
  });
}

/**
 * Run all tests and return results
 */
export function runPrimaryFieldFilterTests(): TestResult[] {
  const tests = [
    testFieldPriorityCalculation,
    testSmartRankingStrategy,
    testRequiredOnlyStrategy,
    testContextAwareStrategy,
    testFieldCountLimits,
    testEdgeCases
  ];

  return tests.map(test => test());
}

/**
 * Run tests and log results to console
 */
export function validatePrimaryFieldFiltering(): void {
  console.group('🧪 Primary Field Filtering Validation Tests');

  const results = runPrimaryFieldFilterTests();
  let passedCount = 0;
  let failedCount = 0;

  results.forEach(result => {
    if (result.passed) {
      passedCount++;
      console.log(`✅ ${result.name}`);
      if (result.details && typeof result.details === 'object') {
        console.log('   Details:', result.details);
      }
    } else {
      failedCount++;
      console.error(`❌ ${result.name}`);
      if (result.error) {
        console.error('   Error:', result.error);
      }
    }
  });

  console.log(`\n📊 Test Summary: ${passedCount} passed, ${failedCount} failed`);

  if (failedCount === 0) {
    console.log('🎉 All tests passed! Primary field filtering is working correctly.');
  } else {
    console.error('⚠️  Some tests failed. Please check the implementation.');
  }

  console.groupEnd();

  return;
}

// Export test utilities for external use
export { testFields, runTest };

// Auto-run validation if this file is executed directly
if (typeof window !== 'undefined' && (window as any).__VALIDATE_PRIMARY_FIELD_FILTERING__) {
  validatePrimaryFieldFiltering();
}