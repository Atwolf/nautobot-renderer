import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Component, ErrorInfo, ReactNode, useState, createElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createTestQueryClient } from './test-utils'

// Mock Error Boundary Component for testing
interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: Error, errorInfo: ErrorInfo) => ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

class TestErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo })
    this.props.onError?.(error, errorInfo)
  }

  render() {
    if (this.state.hasError && this.state.error && this.state.errorInfo) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.state.errorInfo)
      }
      
      return createElement('div', { 'data-testid': 'error-fallback' },
        createElement('h2', null, 'Something went wrong'),
        createElement('p', { 'data-testid': 'error-message' }, this.state.error.message),
        createElement('details', { 'data-testid': 'error-details' },
          createElement('summary', null, 'Error Details'),
          createElement('pre', null, this.state.error.stack),
          createElement('pre', null, this.state.errorInfo.componentStack)
        )
      )
    }

    return this.props.children
  }
}

// Test components that throw errors
const ThrowingComponent = ({ shouldThrow = true, errorMessage = 'Test error' }) => {
  if (shouldThrow) {
    throw new Error(errorMessage)
  }
  return createElement('div', { 'data-testid': 'success' }, 'Component rendered successfully')
}

const AsyncThrowingComponent = ({ shouldThrow = true, delay = 0 }) => {
  if (shouldThrow) {
    setTimeout(() => {
      throw new Error('Async error')
    }, delay)
  }
  return createElement('div', { 'data-testid': 'async-success' }, 'Async component rendered')
}

const NetworkErrorComponent = () => {
  // Simulate a network error during component rendering
  const error = new Error('Network request failed')
  error.name = 'NetworkError'
  throw error
}

const ChunkLoadErrorComponent = () => {
  // Simulate a chunk loading error
  const error = new Error('Loading chunk 2 failed')
  error.name = 'ChunkLoadError'
  throw error
}

describe('Error Boundary and Fallback Mechanisms', () => {
  let queryClient: QueryClient
  let consoleError: ReturnType<typeof vi.fn>

  beforeEach(() => {
    queryClient = createTestQueryClient()
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleError.mockRestore()
  })

  describe('Basic Error Boundary Functionality', () => {
    it('should catch and display component errors', () => {
      render(
        createElement(QueryClientProvider, { client: queryClient },
          createElement(TestErrorBoundary, null,
            createElement(ThrowingComponent, { shouldThrow: true, errorMessage: "Component crash" })
          )
        )
      )

      expect(screen.getByTestId('error-fallback')).toBeInTheDocument()
      expect(screen.getByTestId('error-message')).toHaveTextContent('Component crash')
      expect(screen.getByTestId('error-details')).toBeInTheDocument()
    })

    it('should render children when no error occurs', () => {
      render(
        createElement(QueryClientProvider, { client: queryClient },
          createElement(TestErrorBoundary, null,
            createElement(ThrowingComponent, { shouldThrow: false })
          )
        )
      )

      expect(screen.getByTestId('success')).toBeInTheDocument()
      expect(screen.queryByTestId('error-fallback')).not.toBeInTheDocument()
    })

    it('should call onError callback when error occurs', () => {
      const onError = vi.fn()

      render(
        <QueryClientProvider client={queryClient}>
          <TestErrorBoundary onError={onError}>
            <ThrowingComponent shouldThrow={true} errorMessage="Callback test" />
          </TestErrorBoundary>
        </QueryClientProvider>
      )

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Callback test' }),
        expect.objectContaining({ componentStack: expect.any(String) })
      )
    })

    it('should use custom fallback when provided', () => {
      const customFallback = (error: Error) => (
        <div data-testid="custom-fallback">
          Custom error: {error.message}
        </div>
      )

      render(
        <QueryClientProvider client={queryClient}>
          <TestErrorBoundary fallback={customFallback}>
            <ThrowingComponent shouldThrow={true} errorMessage="Custom fallback test" />
          </TestErrorBoundary>
        </QueryClientProvider>
      )

      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument()
      expect(screen.getByTestId('custom-fallback')).toHaveTextContent('Custom error: Custom fallback test')
    })
  })

  describe('Network Error Handling', () => {
    it('should handle network errors gracefully', () => {
      const onError = vi.fn()

      render(
        <QueryClientProvider client={queryClient}>
          <TestErrorBoundary onError={onError}>
            <NetworkErrorComponent />
          </TestErrorBoundary>
        </QueryClientProvider>
      )

      expect(screen.getByTestId('error-fallback')).toBeInTheDocument()
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ 
          message: 'Network request failed',
          name: 'NetworkError'
        }),
        expect.any(Object)
      )
    })

    it('should provide network-specific error messaging', () => {
      const networkFallback = (error: Error) => {
        if (error.name === 'NetworkError') {
          return (
            <div data-testid="network-error-fallback">
              <p>Network connection failed. Please check your internet connection.</p>
              <button data-testid="retry-button">Retry</button>
            </div>
          )
        }
        return <div data-testid="generic-error">Generic error occurred</div>
      }

      render(
        <QueryClientProvider client={queryClient}>
          <TestErrorBoundary fallback={networkFallback}>
            <NetworkErrorComponent />
          </TestErrorBoundary>
        </QueryClientProvider>
      )

      expect(screen.getByTestId('network-error-fallback')).toBeInTheDocument()
      expect(screen.getByTestId('retry-button')).toBeInTheDocument()
    })
  })

  describe('Chunk Loading Error Handling', () => {
    it('should handle chunk loading errors', () => {
      const chunkFallback = (error: Error) => {
        if (error.name === 'ChunkLoadError' || error.message.includes('Loading chunk')) {
          return (
            <div data-testid="chunk-error-fallback">
              <p>Failed to load application resources. Please refresh the page.</p>
              <button data-testid="refresh-button" onClick={() => window.location.reload()}>
                Refresh Page
              </button>
            </div>
          )
        }
        return <div data-testid="generic-error">Generic error occurred</div>
      }

      render(
        <QueryClientProvider client={queryClient}>
          <TestErrorBoundary fallback={chunkFallback}>
            <ChunkLoadErrorComponent />
          </TestErrorBoundary>
        </QueryClientProvider>
      )

      expect(screen.getByTestId('chunk-error-fallback')).toBeInTheDocument()
      expect(screen.getByTestId('refresh-button')).toBeInTheDocument()
    })
  })

  describe('React Query Error Integration', () => {
    it('should handle React Query errors in error boundary', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            throwOnError: true, // This will cause errors to be thrown and caught by error boundaries
          },
        },
      })

      const QueryErrorComponent = () => {
        // This would normally be handled by useQuery error handling,
        // but we're testing the case where it bubbles up to error boundary
        throw new Error('Query failed: Network error')
      }

      render(
        <QueryClientProvider client={queryClient}>
          <TestErrorBoundary>
            <QueryErrorComponent />
          </TestErrorBoundary>
        </QueryClientProvider>
      )

      expect(screen.getByTestId('error-fallback')).toBeInTheDocument()
      expect(screen.getByTestId('error-message')).toHaveTextContent('Query failed: Network error')
    })
  })

  describe('Nested Error Boundaries', () => {
    it('should handle errors in nested components', () => {
      const outerOnError = vi.fn()
      const innerOnError = vi.fn()

      const NestedComponent = () => (
        <div>
          <div>Outer content</div>
          <TestErrorBoundary onError={innerOnError}>
            <ThrowingComponent shouldThrow={true} errorMessage="Inner error" />
          </TestErrorBoundary>
        </div>
      )

      render(
        <QueryClientProvider client={queryClient}>
          <TestErrorBoundary onError={outerOnError}>
            <NestedComponent />
          </TestErrorBoundary>
        </QueryClientProvider>
      )

      // Inner error boundary should catch the error
      expect(innerOnError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Inner error' }),
        expect.any(Object)
      )

      // Outer error boundary should not be called
      expect(outerOnError).not.toHaveBeenCalled()

      // Should see the inner error boundary's fallback
      expect(screen.getByTestId('error-fallback')).toBeInTheDocument()
    })

    it('should bubble up uncaught errors from inner boundaries', () => {
      const outerOnError = vi.fn()

      // Create an inner error boundary that doesn't catch certain errors
      const SelectiveErrorBoundary = ({ children }: { children: ReactNode }) => {
        return (
          <TestErrorBoundary
            fallback={(error) => {
              // Only catch network errors, let others bubble up
              if (error.name === 'NetworkError') {
                return <div data-testid="inner-caught">Inner caught network error</div>
              }
              throw error // Re-throw to bubble up
            }}
          >
            {children}
          </TestErrorBoundary>
        )
      }

      render(
        <QueryClientProvider client={queryClient}>
          <TestErrorBoundary onError={outerOnError}>
            <SelectiveErrorBoundary>
              <ThrowingComponent shouldThrow={true} errorMessage="Uncaught error" />
            </SelectiveErrorBoundary>
          </TestErrorBoundary>
        </QueryClientProvider>
      )

      // Outer error boundary should catch the bubbled error
      expect(outerOnError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Uncaught error' }),
        expect.any(Object)
      )
    })
  })

  describe('Error Recovery and Reset', () => {
    it('should allow error boundary reset', () => {
      const ErrorBoundaryWithReset = () => {
        const [key, setKey] = useState(0)

        return (
          <TestErrorBoundary
            key={key}
            fallback={(error) => (
              <div data-testid="error-with-reset">
                <p>Error: {error.message}</p>
                <button 
                  data-testid="reset-button"
                  onClick={() => setKey(k => k + 1)}
                >
                  Try Again
                </button>
              </div>
            )}
          >
            <ThrowingComponent shouldThrow={true} errorMessage="Recoverable error" />
          </TestErrorBoundary>
        )
      }

      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <ErrorBoundaryWithReset />
        </QueryClientProvider>
      )

      expect(screen.getByTestId('error-with-reset')).toBeInTheDocument()
      expect(screen.getByTestId('reset-button')).toBeInTheDocument()

      // Simulate reset by changing the component to not throw
      const ErrorBoundaryWithoutError = () => {
        const [key, setKey] = useState(0)

        return (
          <TestErrorBoundary
            key={key}
            fallback={(error) => (
              <div data-testid="error-with-reset">
                <p>Error: {error.message}</p>
                <button 
                  data-testid="reset-button"
                  onClick={() => setKey(k => k + 1)}
                >
                  Try Again
                </button>
              </div>
            )}
          >
            <ThrowingComponent shouldThrow={false} />
          </TestErrorBoundary>
        )
      }

      rerender(
        <QueryClientProvider client={queryClient}>
          <ErrorBoundaryWithoutError />
        </QueryClientProvider>
      )

      expect(screen.getByTestId('success')).toBeInTheDocument()
      expect(screen.queryByTestId('error-with-reset')).not.toBeInTheDocument()
    })
  })

  describe('Error Logging and Reporting', () => {
    it('should log errors for monitoring', () => {
      const mockLogger = vi.fn()
      
      const LoggingErrorBoundary = ({ children }: { children: ReactNode }) => (
        <TestErrorBoundary
          onError={(error, errorInfo) => {
            mockLogger({
              message: error.message,
              stack: error.stack,
              componentStack: errorInfo.componentStack,
              timestamp: new Date().toISOString(),
              userAgent: navigator.userAgent,
              url: window.location.href
            })
          }}
        >
          {children}
        </TestErrorBoundary>
      )

      render(
        <QueryClientProvider client={queryClient}>
          <LoggingErrorBoundary>
            <ThrowingComponent shouldThrow={true} errorMessage="Logged error" />
          </LoggingErrorBoundary>
        </QueryClientProvider>
      )

      expect(mockLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Logged error',
          stack: expect.any(String),
          componentStack: expect.any(String),
          timestamp: expect.any(String),
          userAgent: expect.any(String),
          url: expect.any(String)
        })
      )
    })

    it('should sanitize sensitive information in error reports', () => {
      const mockReporter = vi.fn()
      
      const SanitizingErrorBoundary = ({ children }: { children: ReactNode }) => (
        <TestErrorBoundary
          onError={(error, errorInfo) => {
            // Sanitize error message to remove potential sensitive data
            const sanitizedMessage = error.message
              .replace(/token[=:]\s*[a-zA-Z0-9]+/gi, 'token=***')
              .replace(/password[=:]\s*[^\s]+/gi, 'password=***')
              .replace(/api[_-]?key[=:]\s*[a-zA-Z0-9]+/gi, 'apikey=***')

            mockReporter({
              message: sanitizedMessage,
              type: error.name,
              componentStack: errorInfo.componentStack
            })
          }}
        >
          {children}
        </TestErrorBoundary>
      )

      const SensitiveErrorComponent = () => {
        throw new Error('Authentication failed: token=abc123xyz password=secret123 apikey=mykey456')
      }

      render(
        <QueryClientProvider client={queryClient}>
          <SanitizingErrorBoundary>
            <SensitiveErrorComponent />
          </SanitizingErrorBoundary>
        </QueryClientProvider>
      )

      expect(mockReporter).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Authentication failed: token=*** password=*** apikey=***'
        })
      )
    })
  })
})