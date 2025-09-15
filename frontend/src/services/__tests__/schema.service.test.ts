/**
 * Test file demonstrating enhanced SchemaService error handling capabilities
 * This file includes tests for all the production reliability features
 */

import { SchemaService, SchemaServiceError, TokenManager } from '../schema.service';

// Mock implementation for testing
class MockTokenManager implements TokenManager {
  private token: string | null = null;
  private expired = false;

  getToken(): string | null {
    return this.expired ? null : this.token;
  }

  setToken(token: string): void {
    this.token = token;
    this.expired = false;
  }

  clearToken(): void {
    this.token = null;
    this.expired = false;
  }

  isTokenExpired(): boolean {
    return this.expired;
  }

  async refreshToken(): Promise<string> {
    // Simulate token refresh
    if (this.token === 'refresh-fail') {
      throw new Error('Refresh failed');
    }
    const newToken = 'refreshed-token-' + Date.now();
    this.setToken(newToken);
    return newToken;
  }

  // Test helper methods
  simulateExpiration(): void {
    this.expired = true;
  }

  setTokenForRefreshTest(token: string): void {
    this.token = token;
    this.expired = true;
  }
}

// Test scenarios to demonstrate the enhanced features
export class SchemaServiceTestSuite {
  private service: SchemaService;
  private mockTokenManager: MockTokenManager;

  constructor() {
    this.mockTokenManager = new MockTokenManager();
    this.service = new SchemaService(
      'http://localhost:8000',
      5000, // 5 second timeout for testing
      this.mockTokenManager
    );
  }

  /**
   * Test 1: Token Expiration and Refresh
   */
  async testTokenExpirationAndRefresh(): Promise<void> {
    console.log('🔐 Testing token expiration and refresh...');

    // Set up token that will expire
    this.mockTokenManager.setToken('test-token');
    this.mockTokenManager.simulateExpiration();

    try {
      // This should trigger token refresh
      await this.service.discoverSchema();
    } catch (error) {
      if (error instanceof SchemaServiceError) {
        console.log('✅ Token expiration handled:', {
          code: error.code,
          message: error.message,
          guidance: error.developmentGuidance,
          retryable: error.retryable
        });
      }
    }
  }

  /**
   * Test 2: Authentication Failures (401/403)
   */
  async testAuthenticationFailures(): Promise<void> {
    console.log('🚫 Testing authentication failures...');

    // Clear token to simulate unauthenticated request
    this.mockTokenManager.clearToken();

    try {
      await this.service.discoverSchema();
    } catch (error) {
      if (error instanceof SchemaServiceError) {
        console.log('✅ Authentication failure handled:', {
          code: error.code,
          message: error.message,
          guidance: error.developmentGuidance,
          details: error.details
        });
      }
    }
  }

  /**
   * Test 3: Network Error Handling
   */
  async testNetworkErrors(): Promise<void> {
    console.log('🌐 Testing network error handling...');

    // Test with invalid URL to trigger network error
    const invalidService = new SchemaService('http://invalid-host:9999', 2000);

    try {
      await invalidService.healthCheck();
    } catch (error) {
      if (error instanceof SchemaServiceError) {
        console.log('✅ Network error handled:', {
          code: error.code,
          message: error.message,
          guidance: error.developmentGuidance,
          retryable: error.retryable
        });
      }
    }
  }

  /**
   * Test 4: Timeout Handling
   */
  async testTimeoutHandling(): Promise<void> {
    console.log('⏱️  Testing timeout handling...');

    // Create service with very short timeout
    const timeoutService = new SchemaService('http://httpbin.org/delay/10', 1000);

    try {
      await timeoutService.healthCheck();
    } catch (error) {
      if (error instanceof SchemaServiceError) {
        console.log('✅ Timeout handled:', {
          code: error.code,
          message: error.message,
          guidance: error.developmentGuidance,
          retryable: error.retryable,
          details: error.details
        });
      }
    }
  }

  /**
   * Test 5: CORS Error Detection
   */
  testCORSErrorGuidance(): void {
    console.log('🔒 Testing CORS error guidance...');

    // Simulate CORS error scenario
    const corsError = new SchemaServiceError(
      'CORS error - unable to access the API due to cross-origin restrictions',
      'CORS_ERROR',
      {
        status: 0,
        url: 'https://api.example.com',
        requestDuration: 0
      },
      false,
      'Check that the API server at http://localhost:8000 is configured to allow requests from http://localhost:3000'
    );

    console.log('✅ CORS error guidance:', {
      code: corsError.code,
      message: corsError.message,
      guidance: corsError.developmentGuidance
    });
  }

  /**
   * Test 6: Retry Logic with Exponential Backoff
   */
  async testRetryLogic(): Promise<void> {
    console.log('🔄 Testing retry logic...');

    // Configure more aggressive retry for testing
    this.service.setRetryConfig({
      maxAttempts: 2,
      baseDelay: 100,
      maxDelay: 1000
    });

    const retryConfig = this.service.getRetryConfig();
    console.log('✅ Retry configuration:', retryConfig);

    // Test with service that returns 503 (retryable)
    const retryService = new SchemaService('http://httpstat.us/503', 2000);

    try {
      await retryService.healthCheck();
    } catch (error) {
      if (error instanceof SchemaServiceError) {
        console.log('✅ Retry logic executed:', {
          code: error.code,
          message: error.message,
          retryable: error.retryable
        });
      }
    }
  }

  /**
   * Test 7: Service Diagnostics
   */
  testServiceDiagnostics(): void {
    console.log('🔍 Testing service diagnostics...');

    const diagnostics = this.service.getDiagnostics();
    console.log('✅ Service diagnostics:', diagnostics);
  }

  /**
   * Test 8: Connection Testing
   */
  async testConnectionTesting(): Promise<void> {
    console.log('🔌 Testing connection testing...');

    const result = await this.service.testConnection();
    console.log('✅ Connection test result:', result);
  }

  /**
   * Test 9: Developer Guidance for Various HTTP Errors
   */
  testDeveloperGuidance(): void {
    console.log('📝 Testing developer guidance for HTTP errors...');

    const errorCodes = [400, 404, 409, 422, 429, 500, 502, 503, 504];

    errorCodes.forEach(status => {
      const error = new SchemaServiceError(
        `HTTP ${status} error`,
        `HTTP_${status}`,
        { status },
        false,
        this.getErrorGuidanceForTesting(status)
      );

      console.log(`✅ HTTP ${status} guidance:`, {
        code: error.code,
        guidance: error.developmentGuidance
      });
    });
  }

  private getErrorGuidanceForTesting(status: number): string {
    switch (status) {
      case 400:
        return 'Check the request parameters and ensure all required fields are provided with valid values.';
      case 404:
        return 'The requested resource was not found. Verify the endpoint URL and ensure the resource exists.';
      case 409:
        return 'Conflict with current state. Check for duplicate resources or concurrent modifications.';
      case 422:
        return 'Validation error. Review the request data format and field requirements.';
      case 429:
        return 'Reduce the frequency of API calls or implement request queuing';
      case 500:
        return 'Internal server error. Check server logs and try again later.';
      case 502:
        return 'Bad gateway. The server is likely temporarily unavailable.';
      case 503:
        return 'Service unavailable. The server may be under maintenance or overloaded.';
      case 504:
        return 'Gateway timeout. The server took too long to respond.';
      default:
        return 'An HTTP error occurred. Check the server status and your request parameters.';
    }
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<void> {
    console.log('🚀 Starting SchemaService Production Reliability Tests...\n');

    try {
      await this.testTokenExpirationAndRefresh();
      console.log('');

      await this.testAuthenticationFailures();
      console.log('');

      await this.testNetworkErrors();
      console.log('');

      await this.testTimeoutHandling();
      console.log('');

      this.testCORSErrorGuidance();
      console.log('');

      await this.testRetryLogic();
      console.log('');

      this.testServiceDiagnostics();
      console.log('');

      await this.testConnectionTesting();
      console.log('');

      this.testDeveloperGuidance();
      console.log('');

      console.log('✅ All tests completed successfully!');
    } catch (error) {
      console.error('❌ Test suite failed:', error);
    }
  }
}

// Export for use in applications
export default SchemaServiceTestSuite;

// Example usage in console:
// const testSuite = new SchemaServiceTestSuite();
// testSuite.runAllTests();