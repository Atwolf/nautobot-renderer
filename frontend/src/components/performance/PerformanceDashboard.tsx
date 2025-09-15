/**
 * Performance Dashboard Component
 * 
 * Provides real-time performance monitoring and optimization recommendations
 * for schema transformations and layout calculations.
 * 
 * Features:
 * - Live performance metrics display
 * - Algorithm complexity visualization
 * - Optimization recommendations
 * - Memory usage tracking
 * - Debug console integration
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  LinearProgress,
  Chip,
  Alert,
  AlertTitle,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  IconButton,
  Tooltip,
  useTheme
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  Clear as ClearIcon,
  Download as DownloadIcon,
  Timeline as TimelineIcon,
  Memory as MemoryIcon,
  Speed as SpeedIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { performanceMonitor, type PerformanceReport, type PerformanceMetric } from '../../utils/performance/PerformanceMonitor';

interface PerformanceDashboardProps {
  isVisible?: boolean;
  onClose?: () => void;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function PerformanceDashboard({
  isVisible = true,
  onClose,
  autoRefresh = true,
  refreshInterval = 2000
}: PerformanceDashboardProps) {
  const theme = useTheme();
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string>('overview');

  // Refresh performance data
  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const newReport = performanceMonitor.generateReport();
      const allMetrics = performanceMonitor.getMetrics ? performanceMonitor.getMetrics() : [];
      
      setReport(newReport);
      setMetrics(allMetrics);
    } catch (error) {
      console.error('Failed to refresh performance data:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh && isVisible) {
      const interval = setInterval(refreshData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, isVisible, refreshInterval, refreshData]);

  // Initial data load
  useEffect(() => {
    if (isVisible) {
      refreshData();
    }
  }, [isVisible, refreshData]);

  // Clear metrics
  const handleClearMetrics = useCallback(() => {
    performanceMonitor.clearMetrics();
    refreshData();
  }, [refreshData]);

  // Export metrics
  const handleExportMetrics = useCallback(() => {
    if (report) {
      const dataStr = JSON.stringify(report, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `performance-report-${new Date().toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    }
  }, [report]);

  // Format duration
  const formatDuration = (ms: number): string => {
    if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
    if (ms < 1000) return `${ms.toFixed(1)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // Format memory
  const formatMemory = (mb: number): string => {
    if (mb < 1) return `${(mb * 1024).toFixed(1)}KB`;
    if (mb < 1024) return `${mb.toFixed(1)}MB`;
    return `${(mb / 1024).toFixed(2)}GB`;
  };

  // Get performance color
  const getPerformanceColor = (value: number, thresholds: { warning: number; error: number }): string => {
    if (value > thresholds.error) return theme.palette.error.main;
    if (value > thresholds.warning) return theme.palette.warning.main;
    return theme.palette.success.main;
  };

  // Get complexity color
  const getComplexityColor = (complexity: string): string => {
    if (complexity.includes('O(1)')) return theme.palette.success.main;
    if (complexity.includes('O(n)') && !complexity.includes('²')) return theme.palette.info.main;
    if (complexity.includes('O(n log n)')) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  if (!isVisible || !report) {
    return null;
  }

  return (
    <Box sx={{ p: 2, maxHeight: '80vh', overflow: 'auto' }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" component="h2" display="flex" alignItems="center" gap={1}>
          <TimelineIcon />
          Performance Dashboard
        </Typography>
        <Box display="flex" gap={1}>
          <Tooltip title="Refresh Data">
            <IconButton onClick={refreshData} disabled={isRefreshing}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Clear Metrics">
            <IconButton onClick={handleClearMetrics}>
              <ClearIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export Report">
            <IconButton onClick={handleExportMetrics}>
              <DownloadIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Overview Cards */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Duration
              </Typography>
              <Typography variant="h6" component="div">
                {formatDuration(report.totalDuration)}
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={Math.min(100, (report.totalDuration / 10000) * 100)}
                sx={{ mt: 1 }}
                color={report.totalDuration > 5000 ? 'error' : report.totalDuration > 1000 ? 'warning' : 'success'}
              />
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Memory Usage
              </Typography>
              <Typography variant="h6" component="div">
                {formatMemory(report.memoryUsage.peak)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Peak: {formatMemory(report.memoryUsage.peak)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Operations
              </Typography>
              <Typography variant="h6" component="div">
                {metrics.length}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {metrics.filter(m => m.duration && m.duration > 100).length} slow
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Warnings
              </Typography>
              <Typography variant="h6" component="div" color={report.warnings.length > 0 ? 'error' : 'success'}>
                {report.warnings.length}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Performance issues
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Warnings */}
      {report.warnings.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>Performance Warnings</AlertTitle>
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            {report.warnings.slice(0, 3).map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
            {report.warnings.length > 3 && (
              <li>...and {report.warnings.length - 3} more</li>
            )}
          </Box>
        </Alert>
      )}

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <AlertTitle>Optimization Recommendations</AlertTitle>
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            {report.recommendations.slice(0, 3).map((rec, index) => (
              <li key={index}>{rec}</li>
            ))}
            {report.recommendations.length > 3 && (
              <li>...and {report.recommendations.length - 3} more</li>
            )}
          </Box>
        </Alert>
      )}

      {/* Detailed Sections */}
      <Box>
        {/* Slowest Operations */}
        <Accordion 
          expanded={expandedSection === 'operations'} 
          onChange={() => setExpandedSection(expandedSection === 'operations' ? '' : 'operations')}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6" display="flex" alignItems="center" gap={1}>
              <SpeedIcon />
              Slowest Operations ({report.slowestOperations.length})
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Operation</TableCell>
                    <TableCell align="right">Duration</TableCell>
                    <TableCell align="right">Data Size</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Complexity</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {report.slowestOperations.slice(0, 10).map((metric, index) => (
                    <TableRow key={index}>
                      <TableCell component="th" scope="row">
                        {metric.name}
                      </TableCell>
                      <TableCell align="right">
                        <Typography 
                          color={getPerformanceColor(metric.duration || 0, { warning: 100, error: 1000 })}
                          fontWeight="bold"
                        >
                          {formatDuration(metric.duration || 0)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {metric.dataSize || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={metric.category} 
                          size="small" 
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        {metric.complexity && (
                          <Chip 
                            label={metric.complexity}
                            size="small"
                            sx={{ 
                              color: getComplexityColor(metric.complexity),
                              borderColor: getComplexityColor(metric.complexity)
                            }}
                            variant="outlined"
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>

        {/* Complexity Analysis */}
        <Accordion 
          expanded={expandedSection === 'complexity'} 
          onChange={() => setExpandedSection(expandedSection === 'complexity' ? '' : 'complexity')}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6" display="flex" alignItems="center" gap={1}>
              <WarningIcon />
              Algorithm Complexity Analysis
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              {Object.entries(report.complexityAnalysis).map(([operation, complexity]) => (
                <Grid item xs={12} md={6} key={operation}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" gutterBottom>
                        {operation}
                      </Typography>
                      <Chip 
                        label={complexity}
                        sx={{ 
                          color: getComplexityColor(complexity),
                          borderColor: getComplexityColor(complexity)
                        }}
                        variant="outlined"
                      />
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </AccordionDetails>
        </Accordion>

        {/* Memory Usage */}
        <Accordion 
          expanded={expandedSection === 'memory'} 
          onChange={() => setExpandedSection(expandedSection === 'memory' ? '' : 'memory')}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6" display="flex" alignItems="center" gap={1}>
              <MemoryIcon />
              Memory Usage Analysis
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Peak Usage
                    </Typography>
                    <Typography variant="h6">
                      {formatMemory(report.memoryUsage.peak)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Average Usage
                    </Typography>
                    <Typography variant="h6">
                      {formatMemory(report.memoryUsage.average)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Total Allocated
                    </Typography>
                    <Typography variant="h6">
                      {formatMemory(report.memoryUsage.total)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      </Box>

      {/* Debug Console Integration */}
      <Box mt={3} p={2} bgcolor="grey.50" borderRadius={1}>
        <Typography variant="subtitle2" gutterBottom>
          Debug Console Commands
        </Typography>
        <Typography variant="body2" component="div" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
          <div>• <code>window.performanceMonitor.getReport()</code> - Get full performance report</div>
          <div>• <code>window.performanceMonitor.clearMetrics()</code> - Clear all metrics</div>
          <div>• <code>window.performanceMonitor.setDebugMode(true)</code> - Enable debug logging</div>
          <div>• <code>window.performanceMonitor.exportMetrics()</code> - Export metrics as JSON</div>
        </Typography>
      </Box>
    </Box>
  );
}

export default PerformanceDashboard;