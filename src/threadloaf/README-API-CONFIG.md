# API URL Configuration

The Threadloaf extension uses different API URLs for development and production:

- **Development**: `http://localhost:3000`
- **Production**: `https://api.threadloaf.com`

## How it works

The API URL is configured at build time using esbuild's `--define` feature:

1. **Development build**: `npm run build:dev` or `npm run build`
   - Uses `http://localhost:3000`
   
2. **Production build**: `npm run build:prod` 
   - Uses `https://api.threadloaf.com`
   - This is used in the CI pipeline and `release.sh` script

## Implementation

- Files that need the API URL declare: `declare const API_BASE_URL: string;`
- The `API_BASE_URL` constant is replaced at build time with the appropriate URL
- No runtime configuration or environment variable lookup required

## Files using API_BASE_URL

- `popup.ts` - For OAuth configuration endpoint
- `background.ts` - For message fetching endpoint

## Build Scripts

- `bundle:dev` - Defines `API_BASE_URL` as `http://localhost:3000`
- `bundle:prod` - Defines `API_BASE_URL` as `https://api.threadloaf.com` 