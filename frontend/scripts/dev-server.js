#!/usr/bin/env node

import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { WebSocketServer } from 'ws';
import colors from 'colors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const CONFIG = {
  port: 3000, // Match the port in vite.config.ts
  wsPort: 3001,
  enableNetworkLogs: process.argv.includes('--network'),
  enableVerbose: process.argv.includes('--verbose'),
  autoOpenBrowser: !process.argv.includes('--no-open'),
  browserTimeout: 30000
};

// Console color mapping
const LOG_COLORS = {
  log: 'cyan',
  info: 'blue',
  warn: 'yellow',
  error: 'red',
  debug: 'magenta',
  trace: 'gray'
};

// Browser console message formatter
function formatConsoleMessage(msg, source = 'Browser') {
  const timestamp = new Date().toLocaleTimeString();
  const level = msg.type || 'log';
  const color = LOG_COLORS[level] || 'white';

  const prefix = colors.gray(`[${timestamp}]`) +
                colors.green(`[${source}]`) +
                colors[color](`[${level.toUpperCase()}]`);

  let text = '';
  try {
    if (msg.args && msg.args.length > 0) {
      text = msg.args.map(arg => {
        if (typeof arg === 'object') {
          return JSON.stringify(arg, null, 2);
        }
        return String(arg);
      }).join(' ');
    } else if (msg.text) {
      text = msg.text;
    } else {
      text = String(msg);
    }
  } catch (e) {
    text = '[Complex Object - Cannot Stringify]';
  }

  // Handle React error boundaries and warnings
  if (text.includes('Warning:') || text.includes('React')) {
    return prefix + ' ' + colors.yellow(text);
  }

  if (text.includes('Error:') || level === 'error') {
    return prefix + ' ' + colors.red(text);
  }

  return prefix + ' ' + text;
}

// Network request formatter
function formatNetworkRequest(request, response = null) {
  const timestamp = new Date().toLocaleTimeString();
  const method = request.method();
  const url = request.url();

  let status = '';
  if (response) {
    const statusCode = response.status();
    const statusColor = statusCode >= 400 ? 'red' : statusCode >= 300 ? 'yellow' : 'green';
    status = colors[statusColor](`${statusCode}`);
  }

  const prefix = colors.gray(`[${timestamp}]`) +
                colors.blue('[NETWORK]');

  return `${prefix} ${colors.cyan(method)} ${url} ${status}`;
}

// WebSocket server for browser communication
function createWebSocketServer() {
  const wss = new WebSocketServer({ port: CONFIG.wsPort });

  wss.on('connection', (ws) => {
    console.log(colors.green('[DEV-SERVER] Browser console logger connected'));

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'console') {
          console.log(formatConsoleMessage(message.data, 'Browser-Logger'));
        } else if (message.type === 'error' && message.data) {
          console.log(formatConsoleMessage({
            type: 'error',
            text: `${message.data.message}\n${message.data.stack || ''}`
          }, 'Browser-Error'));
        }
      } catch (e) {
        console.log(colors.red('[DEV-SERVER] Failed to parse WebSocket message:'), e.message);
      }
    });

    ws.on('close', () => {
      console.log(colors.yellow('[DEV-SERVER] Browser console logger disconnected'));
    });
  });

  return wss;
}

// Browser automation setup
async function setupBrowserAutomation(url) {
  let browser = null;
  let page = null;

  try {
    console.log(colors.blue('[DEV-SERVER] Starting browser automation...'));

    // Launch browser
    browser = await chromium.launch({
      headless: false,
      devtools: CONFIG.enableVerbose,
      args: [
        '--no-sandbox',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    page = await browser.newPage();

    // Enhanced console logging
    page.on('console', (msg) => {
      console.log(formatConsoleMessage(msg, 'Playwright'));
    });

    // Page errors
    page.on('pageerror', (error) => {
      console.log(formatConsoleMessage({
        type: 'error',
        text: `Page Error: ${error.message}\n${error.stack || ''}`
      }, 'Page-Error'));
    });

    // Request failed events
    page.on('requestfailed', (request) => {
      console.log(formatConsoleMessage({
        type: 'error',
        text: `Request Failed: ${request.method()} ${request.url()} - ${request.failure()?.errorText || 'Unknown error'}`
      }, 'Network-Error'));
    });

    // Network logging (if enabled)
    if (CONFIG.enableNetworkLogs) {
      page.on('request', (request) => {
        console.log(formatNetworkRequest(request));
      });

      page.on('response', (response) => {
        console.log(formatNetworkRequest(response.request(), response));
      });
    }

    // Navigate to the development server
    console.log(colors.blue(`[DEV-SERVER] Opening ${url}`));
    await page.goto(url, { waitUntil: 'networkidle' });

    // Inject enhanced error handling
    await page.addInitScript(() => {
      // Capture unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled Promise Rejection:', event.reason);
      });

      // Capture React error boundary errors
      const originalError = console.error;
      console.error = (...args) => {
        if (args[0] && typeof args[0] === 'string' && args[0].includes('React')) {
          originalError.apply(console, ['🔴 React Error:', ...args]);
        } else {
          originalError.apply(console, args);
        }
      };
    });

    console.log(colors.green('[DEV-SERVER] Browser automation ready'));

  } catch (error) {
    console.error(colors.red('[DEV-SERVER] Browser automation failed:'), error.message);
    if (browser) {
      await browser.close();
    }
    throw error;
  }

  return { browser, page };
}

// Main development server
async function startDevServer() {
  console.log(colors.bold.blue('\n🚀 Starting Enhanced Development Server\n'));

  let viteServer = null;
  let wss = null;
  let browserInstance = null;

  try {
    // Create WebSocket server
    wss = createWebSocketServer();

    // Create Vite server
    viteServer = await createServer({
      configFile: join(__dirname, '..', 'vite.config.ts'),
      server: {
        port: CONFIG.port,
        open: false // We'll open it programmatically
      },
      define: {
        __DEV_SERVER_WS_PORT__: CONFIG.wsPort
      }
    });

    await viteServer.listen();
    const serverUrl = `http://localhost:${CONFIG.port}`;

    console.log(colors.green(`✅ Vite server running on ${serverUrl}`));
    console.log(colors.green(`✅ WebSocket server running on port ${CONFIG.wsPort}`));

    // Setup browser automation
    if (CONFIG.autoOpenBrowser) {
      try {
        browserInstance = await setupBrowserAutomation(serverUrl);
      } catch (error) {
        console.log(colors.yellow('[DEV-SERVER] Browser automation disabled due to error'));
        console.log(colors.yellow(`Please manually open: ${serverUrl}`));
      }
    }

    // Enhanced logging
    console.log(colors.cyan('\n📋 Development Server Features:'));
    console.log(colors.cyan('   • Browser console forwarding'));
    console.log(colors.cyan('   • React error boundary detection'));
    console.log(colors.cyan('   • Network request logging' + (CONFIG.enableNetworkLogs ? ' (enabled)' : ' (use --network to enable)')));
    console.log(colors.cyan('   • Real-time error tracking'));
    console.log(colors.cyan('   • Enhanced debugging output' + (CONFIG.enableVerbose ? ' (enabled)' : ' (use --verbose to enable)')));

    console.log(colors.green('\n✨ Ready for development! Watch the console for browser output.\n'));

    // Graceful shutdown
    const shutdown = async (signal) => {
      console.log(colors.yellow(`\n[DEV-SERVER] Received ${signal}, shutting down gracefully...`));

      if (browserInstance?.browser) {
        await browserInstance.browser.close();
      }

      if (wss) {
        wss.close();
      }

      if (viteServer) {
        await viteServer.close();
      }

      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Keep the process alive
    await new Promise(() => {});

  } catch (error) {
    console.error(colors.red('[DEV-SERVER] Failed to start:'), error.message);

    // Cleanup on error
    if (browserInstance?.browser) {
      await browserInstance.browser.close();
    }
    if (wss) {
      wss.close();
    }
    if (viteServer) {
      await viteServer.close();
    }

    process.exit(1);
  }
}

// Start the server
startDevServer().catch((error) => {
  console.error(colors.red('Fatal error:'), error);
  process.exit(1);
});