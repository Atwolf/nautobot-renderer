import React, { useState } from 'react';
import {
  useDiscoverSchema,
  useFilteredSchema,
  useSchemaStatistics,
  useHealthCheck,
  getErrorMessage,
} from '../hooks/useSchema';
import type { FilteredSchemaRequest } from '../types/schema';

const SchemaApiDemo: React.FC = () => {
  const [filters, setFilters] = useState<FilteredSchemaRequest>({
    apps: ['dcim', 'ipam'],
    includeAbstract: false,
    maxDepth: 3,
  });

  // Use the React Query hooks
  const healthQuery = useHealthCheck();
  const discoverQuery = useDiscoverSchema({ enabled: false }); // Don't auto-fetch
  const filteredQuery = useFilteredSchema(filters, { enabled: false });
  const statisticsQuery = useSchemaStatistics({ enabled: false });

  const handleDiscoverSchema = () => {
    discoverQuery.refetch();
  };

  const handleGetFiltered = () => {
    filteredQuery.refetch();
  };

  const handleGetStatistics = () => {
    statisticsQuery.refetch();
  };

  const renderQueryStatus = (query: any, title: string) => (
    <div className="card-nautobot card-nautobot-hover animate-nautobot-fade-in-up">
      <div className="card-nautobot-header">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg text-secondary-900 flex items-center">
            <svg className="w-5 h-5 mr-2 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {title}
          </h3>

          {query.isLoading ? (
            <div className="spinner-nautobot"></div>
          ) : (
            <div className="flex items-center space-x-2">
              <div className={`status-nautobot ${
                query.isError
                  ? 'status-nautobot-offline'
                  : query.data
                  ? 'status-nautobot-online'
                  : 'status-nautobot-idle'
              }`}></div>
              <span className={`badge-nautobot ${
                query.isLoading
                  ? 'badge-nautobot-warning'
                  : query.isError
                  ? 'badge-nautobot-error'
                  : query.data
                  ? 'badge-nautobot-success'
                  : 'badge-nautobot-secondary'
              }`}>
                {query.isLoading ? 'Loading' : query.isError ? 'Error' : query.data ? 'Success' : 'Idle'}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="card-nautobot-body">
        {query.isError && (
          <div className="alert-nautobot alert-nautobot-error mb-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">Error occurred:</span>
            </div>
            <p className="mt-1 text-sm">{getErrorMessage(query.error)}</p>
          </div>
        )}

        {query.data && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-secondary-700">Response Data</span>
              <button
                onClick={() => navigator.clipboard.writeText(JSON.stringify(query.data, null, 2))}
                className="btn-nautobot btn-nautobot-sm btn-nautobot-ghost"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </button>
            </div>
            <div className="code-nautobot-block max-h-64 overflow-auto">
              <pre className="text-xs">{JSON.stringify(query.data, null, 2)}</pre>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-secondary-500 pt-2 border-t border-secondary-200">
          <span>
            Last fetched: {query.dataUpdatedAt ? new Date(query.dataUpdatedAt).toLocaleTimeString() : 'Never'}
          </span>
          {query.data && (
            <span className="flex items-center">
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {new Date(query.dataUpdatedAt).toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-full bg-gradient-to-br from-secondary-50 to-primary-50 overflow-y-auto">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-nautobot-fade-in-down">
          <h1 className="text-3xl font-bold text-secondary-900 mb-2 flex items-center">
            <svg className="w-8 h-8 mr-3 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Schema API Service Demo
          </h1>
          <p className="text-secondary-600 text-lg">
            Test and interact with the Nautobot schema discovery API endpoints
          </p>
        </div>

        {/* Enhanced Control Panel */}
        <div className="card-nautobot mb-8 animate-nautobot-fade-in-up">
          <div className="card-nautobot-header">
            <h2 className="text-xl font-semibold text-secondary-900 flex items-center">
              <svg className="w-5 h-5 mr-2 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
              </svg>
              API Actions
            </h2>
          </div>

          <div className="card-nautobot-body">
            {/* Action buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <button
                onClick={() => healthQuery.refetch()}
                disabled={healthQuery.isFetching}
                className="btn-nautobot btn-nautobot-base btn-nautobot-secondary hover-lift"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                {healthQuery.isFetching ? 'Checking...' : 'Health Check'}
              </button>

              <button
                onClick={handleDiscoverSchema}
                disabled={discoverQuery.isFetching}
                className="btn-nautobot btn-nautobot-base btn-nautobot-primary hover-lift"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {discoverQuery.isFetching ? 'Discovering...' : 'Discover Schema'}
              </button>

              <button
                onClick={handleGetFiltered}
                disabled={filteredQuery.isFetching}
                className="btn-nautobot btn-nautobot-base btn-nautobot-gradient hover-lift"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                {filteredQuery.isFetching ? 'Filtering...' : 'Get Filtered'}
              </button>

              <button
                onClick={handleGetStatistics}
                disabled={statisticsQuery.isFetching}
                className="btn-nautobot btn-nautobot-base btn-nautobot-secondary hover-lift"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                {statisticsQuery.isFetching ? 'Loading...' : 'Get Statistics'}
              </button>
            </div>

            {/* Enhanced Filter Controls */}
            <div className="divider-nautobot mb-6"></div>
            <div className="space-y-4">
              <div className="flex items-center space-x-2 mb-4">
                <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                </svg>
                <h3 className="text-lg font-semibold text-secondary-900">Filter Settings</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    Django Apps
                  </label>
                  <input
                    type="text"
                    value={filters.apps?.join(',') || ''}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      apps: e.target.value ? e.target.value.split(',').map(s => s.trim()) : []
                    }))}
                    className="input-nautobot"
                    placeholder="dcim,ipam,circuits,tenancy"
                  />
                  <p className="text-xs text-secondary-500 mt-1">Comma-separated list of Django apps</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    Include Abstract Models
                  </label>
                  <select
                    value={filters.includeAbstract?.toString() || 'false'}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      includeAbstract: e.target.value === 'true'
                    }))}
                    className="input-nautobot"
                  >
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                  <p className="text-xs text-secondary-500 mt-1">Whether to include abstract Django models</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    Maximum Relationship Depth
                  </label>
                  <input
                    type="number"
                    value={filters.maxDepth || ''}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      maxDepth: e.target.value ? parseInt(e.target.value) : 1
                    }))}
                    className="input-nautobot"
                    min="1"
                    max="10"
                    placeholder="3"
                  />
                  <p className="text-xs text-secondary-500 mt-1">Maximum depth for relationship traversal</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced API Results */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          <div className="space-y-6">
            {renderQueryStatus(healthQuery, 'Health Check')}
            {renderQueryStatus(statisticsQuery, 'Schema Statistics')}
          </div>
          <div className="space-y-6">
            {renderQueryStatus(discoverQuery, 'Schema Discovery')}
            {renderQueryStatus(filteredQuery, 'Filtered Schema')}
          </div>
        </div>

        {/* Enhanced Connection Info */}
        <div className="card-nautobot animate-nautobot-fade-in-up">
          <div className="card-nautobot-header">
            <h3 className="text-lg font-semibold text-secondary-900 flex items-center">
              <svg className="w-5 h-5 mr-2 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Connection Configuration
            </h3>
          </div>
          <div className="card-nautobot-body">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
                <div>
                  <p className="text-sm font-medium text-secondary-700">API Base URL</p>
                  <code className="code-nautobot">{import.meta.env['VITE_API_BASE_URL'] || 'Not configured'}</code>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-warning-500 rounded-full"></div>
                <div>
                  <p className="text-sm font-medium text-secondary-700">Request Timeout</p>
                  <code className="code-nautobot">{import.meta.env['VITE_REQUEST_TIMEOUT'] || '5000'}ms</code>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-success-500 rounded-full"></div>
                <div>
                  <p className="text-sm font-medium text-secondary-700">Logging</p>
                  <code className="code-nautobot">{import.meta.env['VITE_ENABLE_REQUEST_LOGGING'] || 'false'}</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchemaApiDemo;