import React from 'react';
import { useHealthCheck, getErrorMessage } from '../hooks/useSchema';

const SimpleApiDemo: React.FC = () => {
  const healthQuery = useHealthCheck();

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Schema API Service Demo</h1>

      <div className="space-y-4">
        {/* Health Check */}
        <div className="border rounded p-4">
          <h3 className="font-bold text-lg mb-2">Backend Health Check</h3>

          <div className="mb-2">
            <button
              onClick={() => healthQuery.refetch()}
              disabled={healthQuery.isFetching}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              {healthQuery.isFetching ? 'Checking...' : 'Check Health'}
            </button>
          </div>

          <div className="mb-2">
            <span className={`px-2 py-1 rounded text-sm ${
              healthQuery.isLoading
                ? 'bg-yellow-100 text-yellow-800'
                : healthQuery.isError
                ? 'bg-red-100 text-red-800'
                : healthQuery.data
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              Status: {healthQuery.isLoading ? 'Loading...' : healthQuery.isError ? 'Error' : healthQuery.data ? 'Success' : 'Idle'}
            </span>
          </div>

          {healthQuery.isError && (
            <div className="text-red-600 text-sm mb-2">
              Error: {getErrorMessage(healthQuery.error)}
            </div>
          )}

          {healthQuery.data && (
            <div className="text-sm bg-gray-50 p-2 rounded">
              <strong>Response:</strong> {JSON.stringify(healthQuery.data, null, 2)}
            </div>
          )}

          <div className="text-xs text-gray-500 mt-2">
            Last checked: {healthQuery.dataUpdatedAt ? new Date(healthQuery.dataUpdatedAt).toLocaleTimeString() : 'Never'}
          </div>
        </div>

        {/* Connection Info */}
        <div className="p-4 bg-gray-50 rounded">
          <h3 className="font-semibold mb-2">API Configuration</h3>
          <div className="text-sm space-y-1">
            <p><strong>Base URL:</strong> <code className="bg-white px-1 rounded">{import.meta.env['VITE_API_BASE_URL'] || 'http://localhost:8000'}</code></p>
            <p><strong>Timeout:</strong> <code className="bg-white px-1 rounded">{import.meta.env['VITE_REQUEST_TIMEOUT'] || '30000'}ms</code></p>
            <p><strong>Logging:</strong> <code className="bg-white px-1 rounded">{import.meta.env['VITE_ENABLE_REQUEST_LOGGING'] || 'false'}</code></p>
          </div>
        </div>

        {/* Instructions */}
        <div className="p-4 bg-blue-50 rounded">
          <h3 className="font-semibold mb-2">Testing Instructions</h3>
          <ol className="text-sm space-y-1 list-decimal ml-4">
            <li>Start the FastAPI backend server on port 8000</li>
            <li>Click "Check Health" to test the connection</li>
            <li>Check the browser console for request logs (if logging enabled)</li>
            <li>Verify the API endpoints are accessible</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default SimpleApiDemo;