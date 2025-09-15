import type {
  SchemaResponse,
  SchemaStatistics,
  FilteredSchemaRequest,
} from '../types/schema';

export class SchemaServiceError extends Error {
  public code?: string | undefined;
  public details?: Record<string, any> | undefined;
  public retryable?: boolean | undefined;
  public timestamp: string;
  public developmentGuidance?: string | undefined;

  constructor(
    message: string,
    code?: string | undefined,
    details?: Record<string, any> | undefined,
    retryable: boolean = false,
    developmentGuidance?: string | undefined
  ) {
    super(message);
    this.name = 'SchemaServiceError';
    this.code = code;
    this.details = details;
    this.retryable = retryable;
    this.timestamp = new Date().toISOString();
    this.developmentGuidance = developmentGuidance;
  }
}

export interface TokenManager {
  getToken(): string | null;
  setToken(token: string): void;
  clearToken(): void;
  isTokenExpired(): boolean;
  refreshToken(): Promise<string>;
}

class LocalStorageTokenManager implements TokenManager {
  private readonly TOKEN_KEY = 'nautobot_api_token';
  private readonly TOKEN_EXPIRY_KEY = 'nautobot_token_expiry';

  getToken(): string | null {
    if (this.isTokenExpired()) {
      this.clearToken();
      return null;
    }
    return localStorage.getItem(this.TOKEN_KEY) || import.meta.env['VITE_API_TOKEN'] || null;
  }

  setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    // Set expiry to 23 hours from now (assuming 24h token lifetime)
    const expiryTime = Date.now() + (23 * 60 * 60 * 1000);
    localStorage.setItem(this.TOKEN_EXPIRY_KEY, expiryTime.toString());
  }

  clearToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.TOKEN_EXPIRY_KEY);
  }

  isTokenExpired(): boolean {
    const expiry = localStorage.getItem(this.TOKEN_EXPIRY_KEY);
    if (!expiry) return false; // Environment token doesn't expire
    return Date.now() > parseInt(expiry, 10);
  }

  async refreshToken(): Promise<string> {
    // In a real implementation, this would call a token refresh endpoint
    // For now, we'll trigger re-authentication
    throw new SchemaServiceError(
      'Token refresh required - please re-authenticate',
      'TOKEN_REFRESH_REQUIRED',
      {},
      false,
      'Implement token refresh endpoint or redirect to login'
    );
  }
}

interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  retryableStatusCodes: number[];
  retryableErrorCodes: string[];
}

export class SchemaService {
  private baseUrl: string;
  private timeout: number;
  private enableLogging: boolean;
  private tokenManager: TokenManager;
  private retryConfig: RetryConfig;
  private refreshingToken: Promise<string> | null = null;

  constructor(
    baseUrl?: string,
    timeout?: number,
    tokenManager?: TokenManager
  ) {
    this.baseUrl = baseUrl || import.meta.env['VITE_API_BASE_URL'] || 'http://localhost:8000';
    this.timeout = timeout || Number(import.meta.env['VITE_REQUEST_TIMEOUT']) || 30000;
    this.enableLogging = import.meta.env['VITE_ENABLE_REQUEST_LOGGING'] === 'true';
    this.tokenManager = tokenManager || new LocalStorageTokenManager();

    this.retryConfig = {
      maxAttempts: 3,
      baseDelay: 1000, // 1 second
      maxDelay: 10000, // 10 seconds
      retryableStatusCodes: [408, 429, 502, 503, 504],
      retryableErrorCodes: ['TIMEOUT', 'NETWORK_ERROR', 'RATE_LIMITED']
    };
  }

  /**
   * Enhanced HTTP request method with authentication, retry logic, and comprehensive error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    attempt: number = 1
  ): Promise<T> {
    const startTime = performance.now();
    const url = `${this.baseUrl}${endpoint}`;

    try {
      // Get and validate authentication token
      const token = await this.getValidToken();

      // Build request headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...Object.fromEntries(
          Object.entries(options.headers || {}).map(([k, v]) => [k, String(v)])
        ),
      };

      if (token) {
        headers['Authorization'] = `Token ${token}`;
      }

      // Create timeout controller with enhanced timeout handling
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => {
        timeoutController.abort();
      }, this.timeout);

      const requestOptions: RequestInit = {
        ...options,
        headers,
        signal: timeoutController.signal,
      };

      if (this.enableLogging) {
        console.log(`[SchemaService] Attempt ${attempt}/${this.retryConfig.maxAttempts}: ${options.method || 'GET'} ${url}`);
      }

      const response = await fetch(url, requestOptions);
      clearTimeout(timeoutId);

      const endTime = performance.now();
      const duration = endTime - startTime;

      if (this.enableLogging) {
        console.log(`[SchemaService] Request completed in ${duration.toFixed(2)}ms`);
      }

      // Handle response based on status
      if (!response.ok) {
        return this.handleErrorResponse(response, url, endpoint, options, attempt, duration);
      }

      // Successful response
      const data = await response.json();
      return data;

    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;

      if (this.enableLogging) {
        console.error(`[SchemaService] Request failed after ${duration.toFixed(2)}ms:`, error);
      }

      return this.handleRequestError(error, url, endpoint, options, attempt, duration);
    }
  }

  /**
   * Get a valid authentication token, refreshing if necessary
   */
  private async getValidToken(): Promise<string | null> {
    let token = this.tokenManager.getToken();

    if (!token) {
      return null;
    }

    if (this.tokenManager.isTokenExpired()) {
      // Handle token refresh with concurrency protection
      if (!this.refreshingToken) {
        this.refreshingToken = this.tokenManager.refreshToken()
          .then(newToken => {
            this.tokenManager.setToken(newToken);
            this.refreshingToken = null;
            return newToken;
          })
          .catch(error => {
            this.refreshingToken = null;
            throw error;
          });
      }

      try {
        token = await this.refreshingToken;
      } catch (error) {
        this.tokenManager.clearToken();
        throw new SchemaServiceError(
          'Authentication required - please log in again',
          'AUTHENTICATION_REQUIRED',
          { originalError: error },
          false,
          'Token has expired and automatic refresh failed. User needs to re-authenticate.'
        );
      }
    }

    return token;
  }

  /**
   * Handle HTTP error responses with detailed error analysis
   */
  private async handleErrorResponse<T>(
    response: Response,
    url: string,
    endpoint: string,
    options: RequestInit,
    attempt: number,
    duration: number
  ): Promise<T> {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: response.statusText };
    }

    const status = response.status;

    // Handle authentication errors
    if (status === 401 || status === 403) {
      this.tokenManager.clearToken();

      const isExpired = status === 401;
      const message = isExpired
        ? 'Authentication token has expired - please log in again'
        : 'Access forbidden - insufficient permissions';

      const guidance = isExpired
        ? 'Clear browser storage and re-authenticate, or check if your API token is still valid'
        : 'Verify that your API token has the required permissions for this operation';

      throw new SchemaServiceError(
        message,
        isExpired ? 'TOKEN_EXPIRED' : 'ACCESS_FORBIDDEN',
        {
          status,
          endpoint,
          originalError: errorData,
          requestDuration: duration
        },
        false,
        guidance
      );
    }

    // Handle CORS errors
    if (status === 0 || (status >= 400 && status < 500 && response.type === 'opaque')) {
      throw new SchemaServiceError(
        'CORS error - unable to access the API due to cross-origin restrictions',
        'CORS_ERROR',
        {
          status,
          url,
          requestDuration: duration
        },
        false,
        `Check that the API server at ${this.baseUrl} is configured to allow requests from ${window.location.origin}. Verify CORS headers: Access-Control-Allow-Origin, Access-Control-Allow-Methods, and Access-Control-Allow-Headers.`
      );
    }

    // Handle rate limiting
    if (status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : this.calculateRetryDelay(attempt);

      if (attempt < this.retryConfig.maxAttempts) {
        await this.sleep(delay);
        return this.request<T>(endpoint, options, attempt + 1);
      }

      throw new SchemaServiceError(
        `Rate limit exceeded - too many requests`,
        'RATE_LIMITED',
        {
          status,
          retryAfter,
          requestDuration: duration
        },
        true,
        'Reduce the frequency of API calls or implement request queuing'
      );
    }

    // Handle server errors that might be retryable
    if (this.retryConfig.retryableStatusCodes.includes(status) && attempt < this.retryConfig.maxAttempts) {
      const delay = this.calculateRetryDelay(attempt);
      await this.sleep(delay);
      return this.request<T>(endpoint, options, attempt + 1);
    }

    // Handle other HTTP errors
    const message = errorData.message || `HTTP ${status}: ${response.statusText}`;
    const guidance = this.getErrorGuidance(status);

    throw new SchemaServiceError(
      message,
      errorData.code || `HTTP_${status}`,
      {
        status,
        endpoint,
        originalError: errorData,
        requestDuration: duration
      },
      this.retryConfig.retryableStatusCodes.includes(status),
      guidance
    );
  }

  /**
   * Handle request errors (network, timeout, etc.)
   */
  private async handleRequestError<T>(
    error: any,
    url: string,
    endpoint: string,
    options: RequestInit,
    attempt: number,
    duration: number
  ): Promise<T> {
    if (error instanceof SchemaServiceError) {
      throw error;
    }

    // Handle timeout errors
    if (error instanceof DOMException && error.name === 'AbortError') {
      const message = duration >= this.timeout
        ? `Request timeout after ${(this.timeout / 1000).toFixed(1)}s`
        : 'Request was aborted';

      const guidance = duration >= this.timeout
        ? `The request took longer than ${(this.timeout / 1000).toFixed(1)}s. Try increasing the timeout in environment variables (VITE_REQUEST_TIMEOUT) or check if the server is overloaded.`
        : 'Request was cancelled before completion';

      if (attempt < this.retryConfig.maxAttempts && duration >= this.timeout) {
        const delay = this.calculateRetryDelay(attempt);
        await this.sleep(delay);
        return this.request<T>(endpoint, options, attempt + 1);
      }

      throw new SchemaServiceError(
        message,
        'TIMEOUT',
        {
          timeout: this.timeout,
          actualDuration: duration,
          url
        },
        true,
        guidance
      );
    }

    // Handle network errors
    if (error instanceof TypeError && (error.message.includes('fetch') || error.message.includes('network'))) {
      if (attempt < this.retryConfig.maxAttempts) {
        const delay = this.calculateRetryDelay(attempt);
        await this.sleep(delay);
        return this.request<T>(endpoint, options, attempt + 1);
      }

      throw new SchemaServiceError(
        'Network error - unable to connect to the server',
        'NETWORK_ERROR',
        {
          url,
          originalError: error.message,
          requestDuration: duration
        },
        true,
        `Check your internet connection and verify that the API server is running at ${this.baseUrl}. If using localhost, ensure the server is started and listening on the correct port.`
      );
    }

    // Handle unknown errors
    throw new SchemaServiceError(
      error instanceof Error ? error.message : 'Unknown error occurred',
      'UNKNOWN_ERROR',
      {
        url,
        originalError: error,
        requestDuration: duration
      },
      false,
      'An unexpected error occurred. Check the browser console for more details and ensure the API server is properly configured.'
    );
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateRetryDelay(attempt: number): number {
    const delay = this.retryConfig.baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * delay; // Add 10% jitter
    return Math.min(delay + jitter, this.retryConfig.maxDelay);
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get helpful error guidance based on HTTP status code
   */
  private getErrorGuidance(status: number): string {
    switch (status) {
      case 400:
        return 'Check the request parameters and ensure all required fields are provided with valid values.';
      case 404:
        return 'The requested resource was not found. Verify the endpoint URL and ensure the resource exists.';
      case 409:
        return 'Conflict with current state. Check for duplicate resources or concurrent modifications.';
      case 422:
        return 'Validation error. Review the request data format and field requirements.';
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
   * Discover complete schema from backend
   */
  async discoverSchema(): Promise<SchemaResponse> {
    return this.request<SchemaResponse>('/api/v1/schema/discover');
  }

  /**
   * Get filtered schema based on app filters
   */
  async getFilteredSchema(filters: FilteredSchemaRequest): Promise<SchemaResponse> {
    const searchParams = new URLSearchParams();

    if (filters.apps?.length) {
      searchParams.set('apps', filters.apps.join(','));
    }

    if (filters.includeAbstract !== undefined) {
      searchParams.set('include_abstract', filters.includeAbstract.toString());
    }

    if (filters.maxDepth !== undefined) {
      searchParams.set('max_depth', filters.maxDepth.toString());
    }

    const query = searchParams.toString();
    const endpoint = `/api/v1/schema/filtered${query ? `?${query}` : ''}`;

    return this.request<SchemaResponse>(endpoint);
  }

  /**
   * Get schema statistics
   */
  async getSchemaStatistics(): Promise<SchemaStatistics> {
    return this.request<SchemaStatistics>('/api/v1/schema/statistics');
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.request<{ status: string; timestamp: string }>('/api/v1/health');
  }

  /**
   * Update base URL (useful for testing or environment changes)
   */
  setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl;
  }

  /**
   * Get current base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Manual token management methods
   */
  setAuthToken(token: string): void {
    this.tokenManager.setToken(token);
  }

  clearAuthToken(): void {
    this.tokenManager.clearToken();
  }

  isAuthenticated(): boolean {
    return this.tokenManager.getToken() !== null && !this.tokenManager.isTokenExpired();
  }

  /**
   * Configure retry behavior
   */
  setRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
  }

  getRetryConfig(): RetryConfig {
    return { ...this.retryConfig };
  }

  /**
   * Test connectivity to the API server
   */
  async testConnection(): Promise<{
    success: boolean;
    responseTime: number;
    error?: SchemaServiceError;
  }> {
    const startTime = performance.now();

    try {
      await this.healthCheck();
      const endTime = performance.now();

      return {
        success: true,
        responseTime: endTime - startTime
      };
    } catch (error) {
      const endTime = performance.now();

      return {
        success: false,
        responseTime: endTime - startTime,
        error: error instanceof SchemaServiceError ? error : new SchemaServiceError(
          'Connection test failed',
          'CONNECTION_TEST_FAILED',
          { originalError: error }
        )
      };
    }
  }

  /**
   * Get service diagnostics for debugging
   */
  getDiagnostics(): {
    baseUrl: string;
    timeout: number;
    isAuthenticated: boolean;
    tokenExpired: boolean;
    retryConfig: RetryConfig;
    loggingEnabled: boolean;
  } {
    return {
      baseUrl: this.baseUrl,
      timeout: this.timeout,
      isAuthenticated: this.isAuthenticated(),
      tokenExpired: this.tokenManager.isTokenExpired(),
      retryConfig: this.getRetryConfig(),
      loggingEnabled: this.enableLogging
    };
  }

}

// Default instance
export const schemaService = new SchemaService();