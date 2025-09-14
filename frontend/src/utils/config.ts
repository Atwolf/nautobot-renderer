import type { AppConfig } from '../types';

// Environment variable validation and configuration
export const config: AppConfig = {
  apiBaseUrl: import.meta.env['VITE_API_BASE_URL'] || 'http://localhost:8000',
  wsBaseUrl: import.meta.env['VITE_WS_BASE_URL'] || 'ws://localhost:8000',
  version: import.meta.env['VITE_APP_VERSION'] || '1.0.0',
};

// Application constants derived from environment variables
export const appConstants = {
  appName: import.meta.env['VITE_APP_NAME'] || 'Nautobot Schema Visualizer',
  logLevel: import.meta.env['VITE_LOG_LEVEL'] || 'info',
  enableMockApi: import.meta.env['VITE_ENABLE_MOCK_API'] === 'true',
  
  // React Flow configuration
  reactFlow: {
    defaultZoom: parseFloat(import.meta.env['VITE_DEFAULT_ZOOM'] || '1.0'),
    minZoom: parseFloat(import.meta.env['VITE_MIN_ZOOM'] || '0.1'),
    maxZoom: parseFloat(import.meta.env['VITE_MAX_ZOOM'] || '2.0'),
  },
  
  // Performance configuration
  performance: {
    maxNodes: parseInt(import.meta.env['VITE_MAX_NODES'] || '500', 10),
    virtualizationThreshold: parseInt(import.meta.env['VITE_VIRTUALIZATION_THRESHOLD'] || '100', 10),
  },
} as const;

// Validation function to ensure all required environment variables are set
export function validateConfig(): void {
  const requiredVars = [
    'VITE_API_BASE_URL',
    'VITE_WS_BASE_URL',
  ];

  const missingVars = requiredVars.filter(varName => !import.meta.env[varName]);

  if (missingVars.length > 0) {
    console.warn('Missing environment variables:', missingVars);
    console.warn('Please check your .env file. Using defaults where possible.');
  }

  // Validate URLs
  try {
    new URL(config.apiBaseUrl);
    // Note: WebSocket URL validation is trickier, so we'll just check the format
    if (!config.wsBaseUrl.startsWith('ws://') && !config.wsBaseUrl.startsWith('wss://')) {
      throw new Error('Invalid WebSocket URL format');
    }
  } catch (error) {
    console.error('Invalid configuration URLs:', error);
    throw new Error('Please check your environment configuration');
  }
}

// Helper to check if we're in development mode
export const isDevelopment = import.meta.env.DEV;
export const isProduction = import.meta.env.PROD;

// Logger utility that respects log level
export const logger = {
  debug: (...args: any[]) => {
    if (appConstants.logLevel === 'debug' || isDevelopment) {
      console.debug(...args);
    }
  },
  info: (...args: any[]) => {
    if (['debug', 'info'].includes(appConstants.logLevel) || isDevelopment) {
      console.info(...args);
    }
  },
  warn: (...args: any[]) => {
    console.warn(...args);
  },
  error: (...args: any[]) => {
    console.error(...args);
  },
};