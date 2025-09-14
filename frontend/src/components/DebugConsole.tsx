import { useState } from 'react';
// import consoleLogger from '../utils/console-logger'; // Temporarily disabled due to TS errors

interface DebugConsoleProps {
  className?: string;
}

export function DebugConsole({ className = '' }: DebugConsoleProps) {
  const [networkRequestUrl, setNetworkRequestUrl] = useState('https://jsonplaceholder.typicode.com/posts/1');
  const [customMessage, setCustomMessage] = useState('Test custom message');

  const testConsoleLog = () => {
    console.log('🔵 Test console.log:', { timestamp: new Date(), data: [1, 2, 3] });
  };

  const testConsoleInfo = () => {
    console.info('ℹ️ Test console.info:', { status: 'active', user: 'developer' });
  };

  const testConsoleWarn = () => {
    console.warn('⚠️ Test console.warn:', { deprecated: true, feature: 'legacy API' });
  };

  const testConsoleError = () => {
    console.error('❌ Test console.error:', new Error('Simulated error for testing'));
  };

  const testConsoleDebug = () => {
    console.debug('🐛 Test console.debug:', { debugInfo: 'verbose debugging data', stack: 'component stack' });
  };

  const testReactWarning = () => {
    // Simulate a React warning
    console.warn('Warning: React component received an invalid prop');
  };

  const testComplexObject = () => {
    const complexObj = {
      id: 1,
      name: 'Complex Object',
      nested: {
        level1: {
          level2: {
            data: 'deep nested data',
            array: [1, 2, 3, { nested: 'value' }]
          }
        }
      },
      circular: null as any
    };
    // Create circular reference
    complexObj.circular = complexObj;

    console.log('📦 Complex object with circular reference:', complexObj);
  };

  const testGlobalError = () => {
    // Trigger a global error
    setTimeout(() => {
      throw new Error('Test global error - this should be caught by the error handler');
    }, 100);
  };

  const testPromiseRejection = () => {
    // Trigger an unhandled promise rejection
    Promise.reject(new Error('Test unhandled promise rejection'));
  };

  const testNetworkRequest = async () => {
    try {
      console.log('🌐 Making network request to:', networkRequestUrl);
      const response = await fetch(networkRequestUrl);
      const data = await response.json();
      console.log('✅ Network request successful:', { status: response.status, data });
    } catch (error) {
      console.error('❌ Network request failed:', error);
    }
  };

  const testXHRRequest = () => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', networkRequestUrl);
    xhr.onload = () => {
      console.log('📡 XHR request completed:', { status: xhr.status, response: xhr.responseText.substring(0, 100) + '...' });
    };
    xhr.onerror = () => {
      console.error('❌ XHR request failed');
    };
    xhr.send();
  };

  const testCustomLogger = () => {
    // consoleLogger?.logCustom('info', customMessage, {
    //   timestamp: new Date(),
    //   source: 'DebugConsole',
    //   metadata: { test: true }
    // });
    console.log('Custom logger test:', customMessage, {
      timestamp: new Date(),
      source: 'DebugConsole',
      metadata: { test: true }
    });
  };

  return (
    <div className={`p-6 bg-white rounded-lg shadow-lg ${className}`}>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        🔧 Console Logger Debug Panel
      </h2>

      <div className="space-y-4">
        {/* Console Methods */}
        <div>
          <h3 className="font-medium text-gray-800 mb-2">Console Methods</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <button
              onClick={testConsoleLog}
              className="px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              console.log
            </button>
            <button
              onClick={testConsoleInfo}
              className="px-3 py-2 text-sm bg-cyan-500 text-white rounded hover:bg-cyan-600"
            >
              console.info
            </button>
            <button
              onClick={testConsoleWarn}
              className="px-3 py-2 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600"
            >
              console.warn
            </button>
            <button
              onClick={testConsoleError}
              className="px-3 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600"
            >
              console.error
            </button>
            <button
              onClick={testConsoleDebug}
              className="px-3 py-2 text-sm bg-purple-500 text-white rounded hover:bg-purple-600"
            >
              console.debug
            </button>
            <button
              onClick={testReactWarning}
              className="px-3 py-2 text-sm bg-orange-500 text-white rounded hover:bg-orange-600"
            >
              React Warning
            </button>
          </div>
        </div>

        {/* Complex Data */}
        <div>
          <h3 className="font-medium text-gray-800 mb-2">Complex Data</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <button
              onClick={testComplexObject}
              className="px-3 py-2 text-sm bg-indigo-500 text-white rounded hover:bg-indigo-600"
            >
              Complex Object (Circular Ref)
            </button>
          </div>
        </div>

        {/* Error Handling */}
        <div>
          <h3 className="font-medium text-gray-800 mb-2">Error Handling</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <button
              onClick={testGlobalError}
              className="px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700"
            >
              Trigger Global Error
            </button>
            <button
              onClick={testPromiseRejection}
              className="px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700"
            >
              Unhandled Promise Rejection
            </button>
          </div>
        </div>

        {/* Network Monitoring */}
        <div>
          <h3 className="font-medium text-gray-800 mb-2">Network Monitoring</h3>
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={networkRequestUrl}
                onChange={(e) => setNetworkRequestUrl(e.target.value)}
                placeholder="Network request URL"
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <button
                onClick={testNetworkRequest}
                className="px-3 py-2 text-sm bg-green-500 text-white rounded hover:bg-green-600"
              >
                Test Fetch Request
              </button>
              <button
                onClick={testXHRRequest}
                className="px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
              >
                Test XHR Request
              </button>
            </div>
          </div>
        </div>

        {/* Custom Logger */}
        <div>
          <h3 className="font-medium text-gray-800 mb-2">Custom Logger</h3>
          <div className="space-y-2">
            <input
              type="text"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Custom log message"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
            <button
              onClick={testCustomLogger}
              className="px-3 py-2 text-sm bg-violet-500 text-white rounded hover:bg-violet-600"
            >
              Send Custom Log
            </button>
          </div>
        </div>

        {/* Status */}
        <div className="mt-6 p-4 bg-gray-50 rounded">
          <h4 className="font-medium text-gray-800 mb-2">Connection Status</h4>
          <p className="text-sm text-gray-600">
            Check the terminal running the dev server to see captured console output.
            {/* {consoleLogger ? (
              <span className="text-green-600 ml-2">✅ Console logger active</span>
            ) : (
              <span className="text-yellow-600 ml-2">⚠️ Console logger not active (production mode?)</span>
            )} */}
            <span className="text-yellow-600 ml-2">⚠️ Console logger temporarily disabled</span>
          </p>
        </div>
      </div>
    </div>
  );
}