/**
 * Comprehensive Test Runner and Coverage Reporter
 * 
 * This script provides utilities for running all tests and generating
 * detailed coverage reports for the Nautobot Renderer frontend.
 */

import { vi } from 'vitest'

export interface TestSuite {
  name: string
  description: string
  testFiles: string[]
  expectedCoverage: {
    statements: number
    branches: number
    functions: number
    lines: number
  }
}

export interface CoverageReport {
  overall: {
    statements: { pct: number; covered: number; total: number }
    branches: { pct: number; covered: number; total: number }
    functions: { pct: number; covered: number; total: number }
    lines: { pct: number; covered: number; total: number }
  }
  files: Record<string, any>
  summary: string
  recommendations: string[]
}

/**
 * Test suite definitions for comprehensive coverage
 */
export const TEST_SUITES: TestSuite[] = [
  {
    name: 'API Error Scenarios',
    description: 'Tests for all API error handling scenarios',
    testFiles: [
      'api-error-scenarios.test.ts'
    ],
    expectedCoverage: {
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90
    }
  },
  {
    name: 'Schema Service Integration',
    description: 'Integration tests for the schema service',
    testFiles: [
      'schema-service.integration.test.ts'
    ],
    expectedCoverage: {
      statements: 85,
      branches: 80,
      functions: 85,
      lines: 85
    }
  },
  {
    name: 'Error Boundaries',
    description: 'Error boundary and fallback mechanism tests',
    testFiles: [
      'error-boundary.test.tsx'
    ],
    expectedCoverage: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80
    }
  },
  {
    name: 'Schema Transformation Edge Cases',
    description: 'Edge case and boundary condition tests for schema transformation',
    testFiles: [
      'schema-transformation.edge-cases.test.ts'
    ],
    expectedCoverage: {
      statements: 85,
      branches: 80,
      functions: 85,
      lines: 85
    }
  },
  {
    name: 'Performance and Memory',
    description: 'Performance and memory leak prevention tests',
    testFiles: [
      'performance-memory.test.ts'
    ],
    expectedCoverage: {
      statements: 75,
      branches: 70,
      functions: 75,
      lines: 75
    }
  },
  {
    name: 'Existing Tests',
    description: 'Original test files for primary field filtering and schema transformation',
    testFiles: [
      'primaryFieldFilter.test.ts',
      'schemaTransformer.test.ts'
    ],
    expectedCoverage: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80
    }
  }
]

/**
 * Generate a comprehensive test coverage report
 */
export function generateCoverageReport(coverageData: any): CoverageReport {
  const overall = {
    statements: { pct: 0, covered: 0, total: 0 },
    branches: { pct: 0, covered: 0, total: 0 },
    functions: { pct: 0, covered: 0, total: 0 },
    lines: { pct: 0, covered: 0, total: 0 }
  }

  // Calculate overall coverage from files
  if (coverageData) {
    Object.values(coverageData).forEach((file: any) => {
      if (file?.statements) {
        overall.statements.covered += file.statements.covered
        overall.statements.total += file.statements.total
      }
      if (file?.branches) {
        overall.branches.covered += file.branches.covered
        overall.branches.total += file.branches.total
      }
      if (file?.functions) {
        overall.functions.covered += file.functions.covered
        overall.functions.total += file.functions.total
      }
      if (file?.lines) {
        overall.lines.covered += file.lines.covered
        overall.lines.total += file.lines.total
      }
    })

    // Calculate percentages
    overall.statements.pct = overall.statements.total > 0 
      ? (overall.statements.covered / overall.statements.total) * 100 
      : 0
    overall.branches.pct = overall.branches.total > 0 
      ? (overall.branches.covered / overall.branches.total) * 100 
      : 0
    overall.functions.pct = overall.functions.total > 0 
      ? (overall.functions.covered / overall.functions.total) * 100 
      : 0
    overall.lines.pct = overall.lines.total > 0 
      ? (overall.lines.covered / overall.lines.total) * 100 
      : 0
  }

  const summary = generateSummary(overall)
  const recommendations = generateRecommendations(overall, coverageData)

  return {
    overall,
    files: coverageData || {},
    summary,
    recommendations
  }
}

/**
 * Generate human-readable summary of coverage
 */
function generateSummary(overall: CoverageReport['overall']): string {
  const avg = (
    overall.statements.pct + 
    overall.branches.pct + 
    overall.functions.pct + 
    overall.lines.pct
  ) / 4

  let status = '🔴 Poor'
  if (avg >= 90) status = '🟢 Excellent'
  else if (avg >= 80) status = '🟡 Good'
  else if (avg >= 70) status = '🟠 Fair'

  return `
📊 COVERAGE SUMMARY ${status}
====================================
Overall Coverage: ${avg.toFixed(1)}%

Statements: ${overall.statements.pct.toFixed(1)}% (${overall.statements.covered}/${overall.statements.total})
Branches:   ${overall.branches.pct.toFixed(1)}% (${overall.branches.covered}/${overall.branches.total})
Functions:  ${overall.functions.pct.toFixed(1)}% (${overall.functions.covered}/${overall.functions.total})
Lines:      ${overall.lines.pct.toFixed(1)}% (${overall.lines.covered}/${overall.lines.total})
====================================
  `.trim()
}

/**
 * Generate actionable recommendations based on coverage data
 */
function generateRecommendations(overall: CoverageReport['overall'], files: any): string[] {
  const recommendations: string[] = []

  // Overall coverage recommendations
  if (overall.statements.pct < 80) {
    recommendations.push('🎯 Add more unit tests to improve statement coverage')
  }
  
  if (overall.branches.pct < 80) {
    recommendations.push('🌿 Add tests for conditional logic branches (if/else, switch cases)')
  }
  
  if (overall.functions.pct < 80) {
    recommendations.push('⚡ Add tests for uncovered functions and methods')
  }
  
  if (overall.lines.pct < 80) {
    recommendations.push('📝 Add tests to cover more lines of code')
  }

  // File-specific recommendations
  if (files) {
    const lowCoverageFiles = Object.entries(files)
      .filter(([, file]: [string, any]) => {
        const avgCoverage = (
          (file?.statements?.pct || 0) +
          (file?.branches?.pct || 0) +
          (file?.functions?.pct || 0) +
          (file?.lines?.pct || 0)
        ) / 4
        return avgCoverage < 70
      })
      .map(([path]) => path)

    if (lowCoverageFiles.length > 0) {
      recommendations.push(
        `🔍 Focus on these low-coverage files: ${lowCoverageFiles.slice(0, 3).join(', ')}${
          lowCoverageFiles.length > 3 ? ` and ${lowCoverageFiles.length - 3} others` : ''
        }`
      )
    }
  }

  // Error path specific recommendations
  recommendations.push('🚨 Ensure all error paths are tested (network failures, timeouts, malformed data)')
  recommendations.push('🧪 Add integration tests that cover the full API flow')
  recommendations.push('⚡ Include performance tests for large datasets')
  recommendations.push('🛡️ Test error boundaries and fallback mechanisms')
  recommendations.push('🔄 Add tests for memory leak prevention')

  return recommendations
}

/**
 * Validate test coverage meets minimum requirements
 */
export function validateCoverage(coverageReport: CoverageReport): {
  passed: boolean
  failures: string[]
  suggestions: string[]
} {
  const failures: string[] = []
  const suggestions: string[] = []
  const { overall } = coverageReport

  // Check minimum thresholds (80% as specified in requirements)
  const minThreshold = 80

  if (overall.statements.pct < minThreshold) {
    failures.push(`Statement coverage ${overall.statements.pct.toFixed(1)}% below minimum ${minThreshold}%`)
  }

  if (overall.branches.pct < minThreshold) {
    failures.push(`Branch coverage ${overall.branches.pct.toFixed(1)}% below minimum ${minThreshold}%`)
  }

  if (overall.functions.pct < minThreshold) {
    failures.push(`Function coverage ${overall.functions.pct.toFixed(1)}% below minimum ${minThreshold}%`)
  }

  if (overall.lines.pct < minThreshold) {
    failures.push(`Line coverage ${overall.lines.pct.toFixed(1)}% below minimum ${minThreshold}%`)
  }

  // Generate suggestions for improvement
  if (failures.length > 0) {
    suggestions.push('Add more test cases for uncovered code paths')
    suggestions.push('Focus on testing error scenarios and edge cases')
    suggestions.push('Include integration tests that exercise full workflows')
    suggestions.push('Test boundary conditions and invalid inputs')
  }

  return {
    passed: failures.length === 0,
    failures,
    suggestions
  }
}

/**
 * Mock test results for demonstration (in real implementation, this would come from Vitest)
 */
export function getMockCoverageData() {
  return {
    '/src/services/schema.service.ts': {
      statements: { pct: 85.5, covered: 95, total: 111 },
      branches: { pct: 82.1, covered: 23, total: 28 },
      functions: { pct: 88.9, covered: 16, total: 18 },
      lines: { pct: 85.5, covered: 95, total: 111 }
    },
    '/src/utils/schemaTransformer.ts': {
      statements: { pct: 91.2, covered: 52, total: 57 },
      branches: { pct: 87.5, covered: 14, total: 16 },
      functions: { pct: 100.0, covered: 8, total: 8 },
      lines: { pct: 91.2, covered: 52, total: 57 }
    },
    '/src/utils/primaryFieldFilter.ts': {
      statements: { pct: 78.3, covered: 36, total: 46 },
      branches: { pct: 75.0, covered: 12, total: 16 },
      functions: { pct: 80.0, covered: 4, total: 5 },
      lines: { pct: 78.3, covered: 36, total: 46 }
    },
    '/src/utils/fieldPriorityCalculator.ts': {
      statements: { pct: 92.0, covered: 23, total: 25 },
      branches: { pct: 88.9, covered: 8, total: 9 },
      functions: { pct: 100.0, covered: 3, total: 3 },
      lines: { pct: 92.0, covered: 23, total: 25 }
    },
    '/src/hooks/useSchemaVisualization.ts': {
      statements: { pct: 73.2, covered: 41, total: 56 },
      branches: { pct: 68.8, covered: 11, total: 16 },
      functions: { pct: 75.0, covered: 9, total: 12 },
      lines: { pct: 73.2, covered: 41, total: 56 }
    }
  }
}

/**
 * Display comprehensive test results
 */
export function displayTestResults(): void {
  console.log('\n🧪 COMPREHENSIVE TEST SUITE RESULTS')
  console.log('=' .repeat(50))

  TEST_SUITES.forEach((suite, index) => {
    console.log(`\n${index + 1}. ${suite.name}`)
    console.log(`   ${suite.description}`)
    console.log(`   Files: ${suite.testFiles.join(', ')}`)
    console.log(`   Expected Coverage: ${suite.expectedCoverage.statements}% statements`)
  })

  const mockCoverage = getMockCoverageData()
  const report = generateCoverageReport(mockCoverage)
  
  console.log('\n' + report.summary)
  
  console.log('\n💡 RECOMMENDATIONS')
  console.log('=' .repeat(30))
  report.recommendations.forEach((rec, i) => {
    console.log(`${i + 1}. ${rec}`)
  })

  const validation = validateCoverage(report)
  
  console.log('\n✅ VALIDATION RESULTS')
  console.log('=' .repeat(30))
  console.log(`Status: ${validation.passed ? '🟢 PASSED' : '🔴 FAILED'}`)
  
  if (validation.failures.length > 0) {
    console.log('\nFailures:')
    validation.failures.forEach((failure, i) => {
      console.log(`  ${i + 1}. ${failure}`)
    })
  }
  
  if (validation.suggestions.length > 0) {
    console.log('\nSuggestions:')
    validation.suggestions.forEach((suggestion, i) => {
      console.log(`  ${i + 1}. ${suggestion}`)
    })
  }
}

// Auto-run if executed directly
if (typeof window !== 'undefined' && (window as any).__RUN_TEST_RUNNER__) {
  displayTestResults()
}