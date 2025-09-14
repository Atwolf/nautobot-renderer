export * from './schema';

export interface AppConfig {
  apiBaseUrl: string;
  wsBaseUrl: string;
  version: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  defaultLayout: 'hierarchical' | 'force' | 'circular';
  showMinimap: boolean;
  showControls: boolean;
  autoSaveLayout: boolean;
  filterPresets: Array<{
    name: string;
    apps: string[];
    includeAbstract: boolean;
  }>;
}

export interface LayoutState {
  zoom: number;
  center: { x: number; y: number };
  fitView: boolean;
}

export interface ErrorState {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}