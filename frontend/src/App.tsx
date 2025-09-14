import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ReactFlowProvider } from 'reactflow';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { SchemaVisualizationSimplified as SchemaVisualization } from './components/graph/SchemaVisualizationSimplified';
import SchemaApiDemo from './components/SchemaApiDemo';
import { DebugConsole } from './components/DebugConsole';
import { validateConfig, logger, appConstants } from './utils/config';
import 'reactflow/dist/style.css';

function AppContent() {
  const [showDemo, setShowDemo] = useState(true); // Start with demo for API testing
  const [showDebugConsole, setShowDebugConsole] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Validate configuration on app start
    try {
      validateConfig();
      logger.info(`${appConstants.appName} initialized successfully`);
      logger.debug('Configuration:', {
        version: appConstants.appName,
        logLevel: appConstants.logLevel,
        reactFlow: appConstants.reactFlow,
        performance: appConstants.performance,
      });
    } catch (error) {
      logger.error('Configuration validation failed:', error);
    }
  }, []);

  return (
    <div className="h-screen w-full bg-gradient-to-br from-secondary-50 via-white to-primary-50/30 overflow-hidden">
      {/* Header */}
      <header className="relative bg-white/80 backdrop-blur-md shadow-soft border-b border-secondary-200/50">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-500/5 to-transparent"></div>
        <div className="relative px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-glow">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
                    {appConstants.appName}
                  </h1>
                  <p className="text-sm text-secondary-600 mt-0.5 font-medium">
                    Interactive visualization of Nautobot's data model relationships
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Status indicator */}
              <div className="flex items-center space-x-2 px-3 py-2 bg-white/50 rounded-lg border border-secondary-200/50">
                <div className="status-nautobot status-nautobot-online"></div>
                <span className="text-sm text-secondary-600 font-medium">Ready</span>
              </div>

              {/* Action buttons */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowDebugConsole(!showDebugConsole)}
                  className={`btn-nautobot btn-nautobot-base btn-nautobot-ghost
                    ${showDebugConsole ? 'bg-purple-100 text-purple-700 border-purple-200' : ''}
                  `}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {showDebugConsole ? 'Hide Debug' : 'Debug'}
                </button>

                <button
                  onClick={() => setShowDemo(!showDemo)}
                  className="btn-nautobot btn-nautobot-base btn-nautobot-primary"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {showDemo ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    )}
                  </svg>
                  {showDemo ? 'Visualization' : 'API Demo'}
                </button>
              </div>

              {/* Version badge */}
              <div className="badge-nautobot badge-nautobot-secondary">
                v{queryClient.getQueryData(['app-version']) || '1.0.0'}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden" style={{ height: 'calc(100vh - 88px)' }}>
        <div className="absolute inset-0">
          {showDebugConsole ? (
            <div className="h-full p-6 overflow-y-auto animate-nautobot-fade-in-up">
              <div className="max-w-7xl mx-auto">
                <div className="card-nautobot">
                  <div className="card-nautobot-header">
                    <h2 className="text-lg font-semibold text-secondary-900 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Debug Console
                    </h2>
                  </div>
                  <div className="card-nautobot-body">
                    <DebugConsole />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full animate-nautobot-fade-in">
              {showDemo ? <SchemaApiDemo /> : <SchemaVisualization />}
            </div>
          )}
        </div>

        {/* Subtle background decoration */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-4 -right-4 w-96 h-96 bg-primary-100/20 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-4 -left-4 w-96 h-96 bg-secondary-100/30 rounded-full blur-3xl"></div>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ReactFlowProvider>
        <AppContent />
      </ReactFlowProvider>
    </ErrorBoundary>
  );
}

export default App;
