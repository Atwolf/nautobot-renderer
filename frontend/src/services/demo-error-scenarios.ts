/**
 * Demo script to test enhanced SchemaService error scenarios
 * Run this in the browser console to see the enhanced error handling in action
 */

import { SchemaService, SchemaServiceError } from './schema.service';

export class ErrorScenarioDemo {
  private service: SchemaService;

  constructor() {
    this.service = new SchemaService();

    // Enable logging for demo
    if (typeof window !== 'undefined') {
      (window as any).VITE_ENABLE_REQUEST_LOGGING = 'true';
    }
  }

  /**
   * Demo 1: Test timeout handling
   */
  async demoTimeoutHandling(): Promise<void> {
    console.log('🕐 Demo: Testing timeout handling...');

    const shortTimeoutService = new SchemaService('https://httpbin.org/delay/10', 2000);

    try {
      await shortTimeoutService.healthCheck();
    } catch (error) {
      if (error instanceof SchemaServiceError) {
        console.log('✅ Timeout handled gracefully:', {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
          guidance: error.developmentGuidance,
          details: error.details
        });
      }
    }
  }

  /**
   * Demo 2: Test network error handling
   */
  async demoNetworkError(): Promise<void> {
    console.log('🌐 Demo: Testing network error handling...');

    const invalidService = new SchemaService('http://nonexistent-host:9999', 5000);

    try {
      await invalidService.healthCheck();
    } catch (error) {
      if (error instanceof SchemaServiceError) {
        console.log('✅ Network error handled gracefully:', {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
          guidance: error.developmentGuidance
        });
      }
    }
  }

  /**
   * Demo 3: Test authentication error simulation
   */
  async demoAuthenticationError(): Promise<void> {
    console.log('🔐 Demo: Testing authentication error handling...');

    // Create service pointing to a 401 endpoint
    const authErrorService = new SchemaService('https://httpstat.us/401', 5000);

    try {
      await authErrorService.healthCheck();
    } catch (error) {
      if (error instanceof SchemaServiceError) {
        console.log('✅ Authentication error handled gracefully:', {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
          guidance: error.developmentGuidance
        });
      }
    }
  }

  /**
   * Demo 4: Test rate limiting with retry
   */
  async demoRateLimitHandling(): Promise<void> {
    console.log('🚦 Demo: Testing rate limit handling...');

    const rateLimitService = new SchemaService('https://httpstat.us/429', 5000);

    // Configure faster retry for demo
    rateLimitService.setRetryConfig({
      maxAttempts: 2,
      baseDelay: 500,
      maxDelay: 2000
    });

    try {
      await rateLimitService.healthCheck();
    } catch (error) {
      if (error instanceof SchemaServiceError) {
        console.log('✅ Rate limit handled with retry:', {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
          guidance: error.developmentGuidance
        });
      }
    }
  }

  /**
   * Demo 5: Test service diagnostics
   */
  demoDiagnostics(): void {
    console.log('🔍 Demo: Service diagnostics...');

    const diagnostics = this.service.getDiagnostics();
    console.log('✅ Service diagnostics:', diagnostics);

    console.log('✅ Authentication status:', this.service.isAuthenticated());
    console.log('✅ Retry configuration:', this.service.getRetryConfig());
  }

  /**
   * Demo 6: Test connection testing
   */
  async demoConnectionTest(): Promise<void> {
    console.log('🔌 Demo: Connection testing...');

    // Test with current service
    const result = await this.service.testConnection();
    console.log('✅ Connection test result:', result);

    // Test with invalid service
    const invalidService = new SchemaService('http://invalid:9999', 2000);
    const invalidResult = await invalidService.testConnection();
    console.log('✅ Invalid connection test result:', invalidResult);
  }

  /**
   * Demo 7: Show all error guidance
   */
  demoErrorGuidance(): void {
    console.log('📚 Demo: Error guidance examples...');

    const errorScenarios = [
      { status: 400, name: 'Bad Request' },
      { status: 401, name: 'Unauthorized' },
      { status: 403, name: 'Forbidden' },
      { status: 404, name: 'Not Found' },
      { status: 409, name: 'Conflict' },
      { status: 422, name: 'Validation Error' },
      { status: 429, name: 'Rate Limited' },
      { status: 500, name: 'Internal Server Error' },
      { status: 502, name: 'Bad Gateway' },
      { status: 503, name: 'Service Unavailable' },
      { status: 504, name: 'Gateway Timeout' }
    ];

    errorScenarios.forEach(({ status, name }) => {
      const error = new SchemaServiceError(
        `${name} error example`,
        `HTTP_${status}`,
        { status },
        [408, 429, 502, 503, 504].includes(status),
        this.getGuidanceForStatus(status)
      );

      console.log(`✅ ${name} (${status}):`, {
        message: error.message,
        guidance: error.developmentGuidance,
        retryable: error.retryable
      });
    });
  }

  private getGuidanceForStatus(status: number): string {
    const guidanceMap: Record<number, string> = {
      400: 'Check the request parameters and ensure all required fields are provided with valid values.',
      401: 'Clear browser storage and re-authenticate, or check if your API token is still valid',
      403: 'Verify that your API token has the required permissions for this operation',
      404: 'The requested resource was not found. Verify the endpoint URL and ensure the resource exists.',
      409: 'Conflict with current state. Check for duplicate resources or concurrent modifications.',
      422: 'Validation error. Review the request data format and field requirements.',
      429: 'Reduce the frequency of API calls or implement request queuing',
      500: 'Internal server error. Check server logs and try again later.',
      502: 'Bad gateway. The server is likely temporarily unavailable.',
      503: 'Service unavailable. The server may be under maintenance or overloaded.',
      504: 'Gateway timeout. The server took too long to respond.'
    };

    return guidanceMap[status] || 'An HTTP error occurred. Check the server status and your request parameters.';
  }

  /**
   * Run all demos
   */
  async runAllDemos(): Promise<void> {
    console.log('🚀 Starting Enhanced SchemaService Error Handling Demos...\n');

    try {
      await this.demoTimeoutHandling();
      console.log('');

      await this.demoNetworkError();
      console.log('');

      await this.demoAuthenticationError();
      console.log('');

      await this.demoRateLimitHandling();
      console.log('');

      this.demoDiagnostics();
      console.log('');

      await this.demoConnectionTest();
      console.log('');

      this.demoErrorGuidance();
      console.log('');

      console.log('✅ All demos completed! Check the console output above for detailed error handling examples.');
    } catch (error) {
      console.error('❌ Demo failed:', error);
    }
  }
}

// Export for use in browser console
export default ErrorScenarioDemo;

// Browser console helper
if (typeof window !== 'undefined') {
  (window as any).ErrorScenarioDemo = ErrorScenarioDemo;
  console.log('🎯 ErrorScenarioDemo available! Run: new ErrorScenarioDemo().runAllDemos()');
}