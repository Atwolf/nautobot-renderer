# GitHub Pages Deployment

This document explains how the Nautobot Schema Visualization app is configured for automatic deployment to GitHub Pages.

## Overview

The application automatically switches to demo mode when deployed to GitHub Pages since it cannot access a local Nautobot instance. This is achieved through:

1. **Environment Configuration**: Production environment variables that trigger demo mode fallback
2. **Base Path Configuration**: Vite configuration that handles GitHub Pages subdirectory deployment
3. **Automated Deployment**: GitHub Actions workflow that builds and deploys the app
4. **Graceful Fallback**: Built-in error handling that automatically falls back to demo data when API calls fail

## Deployment Configuration

### Environment Variables (.env.production)

The production environment file configures the app to use demo mode:

- `VITE_API_BASE_URL=https://demo-mode-fallback.invalid` - Invalid URL to trigger fallback
- `VITE_ENABLE_MOCK_API=true` - Force demo mode
- Shortened timeouts for faster fallback behavior

### Vite Configuration

The `vite.config.ts` includes:

- Base path set to `/nautobot-renderer/` for GitHub Pages
- Proper asset chunking for optimal loading
- TypeScript checking skipped for faster CI builds

### GitHub Actions Workflow

The `.github/workflows/deploy.yml` workflow:

- Triggers on pushes to `main` branch
- Builds the frontend with production settings
- Deploys to GitHub Pages automatically
- Uses proper permissions and artifact handling

## Manual Deployment

If you need to deploy manually:

```bash
cd frontend
npm run build:gh-pages
npm run deploy:gh-pages  # Requires gh-pages CLI tool
```

## Local Testing

To test the GitHub Pages build locally:

```bash
cd frontend
npm run build:gh-pages
npm run preview:gh-pages
```

This will serve the production build with the correct base path.

## Demo Mode Features

When deployed to GitHub Pages, the app automatically:

- Uses comprehensive demo data with realistic Nautobot models
- Shows relationships between Django models (Device, Location, Interface, etc.)
- Provides interactive visualization with all the same features as the live version
- Displays helpful tooltips and model information
- Supports all layout algorithms and filtering options

## Accessing the Deployed App

Once deployed, the app will be available at:
`https://[your-username].github.io/nautobot-renderer/`

The app will automatically detect that it's running in a GitHub Pages environment and switch to demo mode, providing a fully functional visualization of Nautobot's schema without requiring a backend connection.