# Railway Deployment Configuration for Puppeteer

This guide explains how to deploy the backend on Railway with Puppeteer support for the downdetector-api.

## Problem

The `downdetector-api` package uses Puppeteer, which requires Chromium and system libraries. Railway's default environment doesn't include these dependencies, causing errors like:

```
error while loading shared libraries: libgobject-2.0.so.0: cannot open shared object file
```

## Solution

We've provided two configuration options:

### Option 1: Using Nixpacks (Recommended for Railway)

Railway will automatically detect and use the `nixpacks.toml` file. This file installs all necessary system dependencies.

**Already configured:** The `backend/nixpacks.toml` file is already in place and will be used automatically.

### Option 2: Using Dockerfile

If you prefer Docker, Railway can use the `Dockerfile` instead:

1. In Railway dashboard, go to your service settings
2. Under "Build" settings, select "Dockerfile" as the build method
3. Set the Dockerfile path to `backend/Dockerfile`

### Option 3: Railway Environment Variables

Add these environment variables in Railway dashboard:

```
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
```

**Note:** This option requires the system dependencies to be installed (via nixpacks.toml or Dockerfile).

## Verification

After deployment, check your Railway logs. You should see:
- No Puppeteer/Chromium errors
- Downdetector API calls working (or gracefully falling back to HTTP checks)

## Fallback Behavior

The backend is configured to gracefully handle Puppeteer failures:
- If Puppeteer/downdetector-api fails to load, it automatically falls back to HTTP checks
- HTTP fallback checks service status by making HEAD requests to the service URL
- This ensures the API remains functional even if Puppeteer has issues

## Troubleshooting

### If you still see Puppeteer errors:

1. **Check Railway build logs** - Ensure dependencies are being installed
2. **Verify nixpacks.toml is present** - Railway should detect it automatically
3. **Try Dockerfile method** - Switch to Dockerfile in Railway settings
4. **Check environment variables** - Ensure PUPPETEER_* variables are set

### Common Railway Issues:

- **Build timeout**: Railway may timeout installing dependencies. Try splitting the nixpacks phases.
- **Memory limits**: Puppeteer uses significant memory. Ensure Railway plan has enough resources.
- **Chromium path**: If Chromium is installed in a different location, update `PUPPETEER_EXECUTABLE_PATH`

## Testing Locally

To test with Docker locally:

```bash
cd backend
docker build -t frampol-backend .
docker run -p 5000:5000 frampol-backend
```

## Additional Notes

- The HTTP fallback is always available and works without Puppeteer
- Service status checks will work even if downdetector-api fails
- The system gracefully degrades functionality rather than crashing
