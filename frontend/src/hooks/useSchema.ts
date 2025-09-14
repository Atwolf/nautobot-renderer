import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult, UseQueryOptions } from '@tanstack/react-query';
import { schemaService, SchemaServiceError } from '../services/schema.service';
import type {
  SchemaResponse,
  SchemaStatistics,
  FilteredSchemaRequest,
  ApiResponse,
} from '../types/schema';

// Query keys for consistent caching
export const schemaQueryKeys = {
  all: ['schema'] as const,
  discover: () => [...schemaQueryKeys.all, 'discover'] as const,
  filtered: (filters: FilteredSchemaRequest) =>
    [...schemaQueryKeys.all, 'filtered', filters] as const,
  statistics: () => [...schemaQueryKeys.all, 'statistics'] as const,
  health: () => [...schemaQueryKeys.all, 'health'] as const,
} as const;

// Base query configuration with retry logic
const baseQueryConfig = {
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 10 * 60 * 1000, // 10 minutes (previously cacheTime)
  retry: (failureCount: number, error: unknown) => {
    // Don't retry on client errors (4xx)
    if (error instanceof SchemaServiceError) {
      const code = error.code;
      if (code?.startsWith('HTTP_4')) {
        return false;
      }
    }

    // Exponential backoff: retry up to 3 times
    return failureCount < 3;
  },
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
};

/**
 * Hook to discover complete schema from backend
 */
export function useDiscoverSchema(
  options?: Omit<UseQueryOptions<SchemaResponse, SchemaServiceError>, 'queryKey' | 'queryFn'>
): UseQueryResult<SchemaResponse, SchemaServiceError> {
  return useQuery({
    queryKey: schemaQueryKeys.discover(),
    queryFn: () => schemaService.discoverSchema(),
    ...baseQueryConfig,
    ...options,
  });
}

/**
 * Hook to fetch schema with app filters applied
 */
export function useFilteredSchema(
  filters: FilteredSchemaRequest,
  options?: Omit<UseQueryOptions<SchemaResponse, SchemaServiceError>, 'queryKey' | 'queryFn'>
): UseQueryResult<SchemaResponse, SchemaServiceError> {
  return useQuery({
    queryKey: schemaQueryKeys.filtered(filters),
    queryFn: () => schemaService.getFilteredSchema(filters),
    ...baseQueryConfig,
    enabled: true, // Always enabled, but can be overridden
    ...options,
  });
}

/**
 * Hook to fetch schema metrics/statistics
 */
export function useSchemaStatistics(
  options?: Omit<UseQueryOptions<SchemaStatistics, SchemaServiceError>, 'queryKey' | 'queryFn'>
): UseQueryResult<SchemaStatistics, SchemaServiceError> {
  return useQuery({
    queryKey: schemaQueryKeys.statistics(),
    queryFn: () => schemaService.getSchemaStatistics(),
    ...baseQueryConfig,
    ...options,
  });
}

/**
 * Hook to check backend health
 */
export function useHealthCheck(
  options?: Omit<UseQueryOptions<{ status: string; timestamp: string }, SchemaServiceError>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: schemaQueryKeys.health(),
    queryFn: () => schemaService.healthCheck(),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 60 * 1000, // 1 minute
    retry: 1, // Only retry once for health checks
    ...options,
  });
}

/**
 * Utility hook that transforms React Query result to ApiResponse format
 */
export function useApiResponse<T>(
  queryResult: UseQueryResult<T, SchemaServiceError>
): ApiResponse<T> {
  return {
    data: queryResult.data,
    error: queryResult.error ? {
      message: queryResult.error.message,
      code: queryResult.error.code || undefined,
      details: queryResult.error.details || undefined,
    } : undefined,
    loading: queryResult.isLoading,
  };
}

/**
 * Hook for schema discovery with enhanced error handling and loading states
 */
export function useSchemaWithState(): ApiResponse<SchemaResponse> {
  const queryResult = useDiscoverSchema({
    retry: (failureCount, error) => {
      console.log(`Schema discovery attempt ${failureCount + 1} failed:`, error);
      return failureCount < 2; // Reduce retries for main hook
    },
  });

  return useApiResponse(queryResult);
}

/**
 * Hook for filtered schema with enhanced error handling and loading states
 */
export function useFilteredSchemaWithState(
  filters: FilteredSchemaRequest
): ApiResponse<SchemaResponse> {
  const queryResult = useFilteredSchema(filters, {
    retry: (failureCount, error) => {
      console.log(`Filtered schema attempt ${failureCount + 1} failed:`, error);
      return failureCount < 2;
    },
  });

  return useApiResponse(queryResult);
}

/**
 * Hook for schema statistics with enhanced error handling and loading states
 */
export function useSchemaStatisticsWithState(): ApiResponse<SchemaStatistics> {
  const queryResult = useSchemaStatistics({
    retry: (failureCount, error) => {
      console.log(`Schema statistics attempt ${failureCount + 1} failed:`, error);
      return failureCount < 2;
    },
  });

  return useApiResponse(queryResult);
}

/**
 * Utility function to get user-friendly error messages
 */
export function getErrorMessage(error?: SchemaServiceError): string {
  if (!error) return 'An unknown error occurred';

  switch (error.code) {
    case 'NETWORK_ERROR':
      return 'Unable to connect to the server. Please check your connection and try again.';
    case 'TIMEOUT':
      return 'Request timed out. The server may be experiencing high load.';
    case 'HTTP_404':
      return 'The requested resource was not found.';
    case 'HTTP_500':
      return 'Server error occurred. Please try again later.';
    case 'HTTP_401':
      return 'Authentication required. Please log in and try again.';
    case 'HTTP_403':
      return 'Access denied. You do not have permission to access this resource.';
    default:
      return error.message || 'An unexpected error occurred';
  }
}