import type {
  SchemaResponse,
  SchemaStatistics,
  FilteredSchemaRequest,
} from '../types/schema';

export class SchemaServiceError extends Error {
  public code?: string | undefined;
  public details?: Record<string, any> | undefined;

  constructor(
    message: string,
    code?: string | undefined,
    details?: Record<string, any> | undefined
  ) {
    super(message);
    this.name = 'SchemaServiceError';
    this.code = code;
    this.details = details;
  }
}

export class SchemaService {
  private baseUrl: string;
  private timeout: number;
  private enableLogging: boolean;

  constructor(baseUrl?: string, timeout?: number) {
    this.baseUrl = baseUrl || import.meta.env['VITE_API_BASE_URL'] || 'http://localhost:8000';
    this.timeout = timeout || Number(import.meta.env['VITE_REQUEST_TIMEOUT']) || 30000;
    this.enableLogging = import.meta.env['VITE_ENABLE_REQUEST_LOGGING'] === 'true';
  }

  /**
   * Generic HTTP request method with interceptors
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const startTime = performance.now();
    const url = `${this.baseUrl}${endpoint}`;

    // Request interceptor
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...Object.fromEntries(
        Object.entries(options.headers || {}).map(([k, v]) => [k, String(v)])
      ),
    };

    // Add authentication headers if available
    const token = localStorage.getItem('authToken');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const requestOptions: RequestInit = {
      ...options,
      headers,
      signal: AbortSignal.timeout(this.timeout),
    };

    try {
      if (this.enableLogging) {
        console.log(`[SchemaService] ${options.method || 'GET'} ${url}`);
      }

      const response = await fetch(url, requestOptions);
      const endTime = performance.now();

      if (this.enableLogging) {
        console.log(`[SchemaService] Request completed in ${(endTime - startTime).toFixed(2)}ms`);
      }

      if (!response.ok) {
        let errorData: any;
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: response.statusText };
        }

        throw new SchemaServiceError(
          errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          errorData.code || `HTTP_${response.status}`,
          errorData.details
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      const endTime = performance.now();
      if (this.enableLogging) {
        console.error(`[SchemaService] Request failed after ${(endTime - startTime).toFixed(2)}ms:`, error);
      }

      if (error instanceof SchemaServiceError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw new SchemaServiceError(
          `Request timeout after ${this.timeout}ms`,
          'TIMEOUT'
        );
      }

      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new SchemaServiceError(
          'Network error - unable to connect to server',
          'NETWORK_ERROR'
        );
      }

      throw new SchemaServiceError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        'UNKNOWN_ERROR'
      );
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
}

// Default instance
export const schemaService = new SchemaService();