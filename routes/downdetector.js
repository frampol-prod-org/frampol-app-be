const express = require('express');
const router = express.Router();

// Set Puppeteer environment variables for Railway/Docker environments
// Let Puppeteer download its own Chromium - more reliable than system Chromium
if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT) {
  process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = 'false';
  process.env.PUPPETEER_ARGS = '--no-sandbox,--disable-setuid-sandbox';
}

let downdetectorModule;
try {
  downdetectorModule = require('downdetector-api');
} catch (error) {
  console.warn('[Downdetector] Failed to load downdetector-api module:', error.message);
}

const { downdetector } = downdetectorModule || {};

// Simple in-memory counter for API usage tracking
const apiUsageStats = {
  downdetectorApi: 0,
  httpFallback: 0,
  totalRequests: 0
};

// Log usage statistics every 10 requests
function logUsageStats() {
  if (apiUsageStats.totalRequests > 0 && apiUsageStats.totalRequests % 10 === 0) {
    const successRate = ((apiUsageStats.downdetectorApi / apiUsageStats.totalRequests) * 100).toFixed(1);
    console.log(`[API] 📊 Usage Statistics (${apiUsageStats.totalRequests} total requests):`);
    console.log(`[API] 📊 Downdetector API: ${apiUsageStats.downdetectorApi} (${successRate}%)`);
    console.log(`[API] 📊 HTTP Fallback: ${apiUsageStats.httpFallback} (${(100 - parseFloat(successRate)).toFixed(1)}%)`);
  }
}

// GET /api/downdetector - Check service status
router.get('/', async (req, res) => {
  const { service, url } = req.query;

  if (!service) {
    return res.status(400).json({
      error: 'Service name parameter is required'
    });
  }

  console.log(`[API] 🔍 Service check requested: ${service}`);
  apiUsageStats.totalRequests++;
  logUsageStats();

  try {
    const startTime = Date.now();
    
    // If URL is provided, use HTTP fallback check
    if (url) {
      console.log(`[API] 🔍 Using HTTP fallback for ${service} with URL: ${url}`);
      return await fallbackHttpCheck(req, res, url, startTime);
    }

    // Try the main downdetector.com domain first
    let response;
    
    // Check if downdetector API is available
    if (!downdetector) {
      console.log(`[Downdetector] API not available, using HTTP fallback for ${service}`);
      return await fallbackHttpCheck(req, res, `https://${service.toLowerCase()}.com`, startTime);
    }
    
    try {
      console.log(`[Downdetector] 🔍 Attempting ${service} on .com domain`);
      response = await downdetector(service);
      console.log(`[Downdetector] ✅ Success for ${service} on .com domain`);
    } catch (comError) {
      console.log(`[Downdetector] ❌ .com domain failed for ${service}:`, comError.message);
      // If .com fails, try other domains (like .it, .nl, etc.)
      try {
        console.log(`[Downdetector] 🔍 Attempting ${service} on .it domain`);
        response = await downdetector(service, 'it');
        console.log(`[Downdetector] ✅ Success for ${service} on .it domain`);
      } catch (itError) {
        console.log(`[Downdetector] ❌ .it domain failed for ${service}:`, itError.message);
        // If all domains fail, fall back to basic HTTP check
        console.log(`[Downdetector] 🔄 All domains failed for ${service}, falling back to HTTP check`);
        return await fallbackHttpCheck(req, res, `https://${service.toLowerCase()}.com`, startTime);
      }
    }

    const responseTime = Date.now() - startTime;

    // Analyze the downdetector data to determine status
    const status = analyzeDowndetectorData(response);
    console.log(`[Downdetector] Analyzed status for ${service}: ${status}`);

    console.log(`[Downdetector] ✅ SUCCESS: ${service} - Status: ${status} - Source: Downdetector API - Response Time: ${responseTime}ms`);
    apiUsageStats.downdetectorApi++;
    
    res.json({
      status,
      responseTime,
      serviceName: service,
      downdetectorData: response,
      dataSource: 'downdetector-api',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    // Fallback to basic HTTP check if downdetector API fails
    console.log(`[Downdetector] Error for ${service}:`, error);
    return await fallbackHttpCheck(req, res, `https://${service.toLowerCase()}.com`, startTime);
  }
});

// Analyze downdetector response to determine status
function analyzeDowndetectorData(data) {
  console.log(`[Downdetector] Analyzing data:`, JSON.stringify(data, null, 2));
  
  if (!data || !data.reports || !Array.isArray(data.reports)) {
    console.log(`[Downdetector] No valid reports data, defaulting to 'up'`);
    return 'up'; // Default to up if no data
  }

  const reports = data.reports;
  const baseline = data.baseline || [];
  
  // Get the most recent reports (last 5 data points)
  const recentReports = reports.slice(-5);
  const recentBaseline = baseline.slice(-5);
  
  console.log(`[Downdetector] Recent reports:`, recentReports);
  console.log(`[Downdetector] Recent baseline:`, recentBaseline);
  
  if (recentReports.length === 0) {
    console.log(`[Downdetector] No recent reports, defaulting to 'up'`);
    return 'up';
  }

  // Calculate average reports vs baseline
  const avgReports = recentReports.reduce((sum, report) => sum + report.value, 0) / recentReports.length;
  const avgBaseline = recentBaseline.length > 0 
    ? recentBaseline.reduce((sum, report) => sum + report.value, 0) / recentBaseline.length 
    : 1;

  console.log(`[Downdetector] Average reports: ${avgReports}, Average baseline: ${avgBaseline}`);

  // Determine status based on reports vs baseline
  const ratio = avgReports / avgBaseline;
  console.log(`[Downdetector] Ratio (reports/baseline): ${ratio}`);
  
  if (ratio > 10) {
    console.log(`[Downdetector] Ratio > 10, status: 'down'`);
    return 'down'; // Significantly more reports than baseline
  } else if (ratio > 3) {
    console.log(`[Downdetector] Ratio > 3, status: 'degraded'`);
    return 'degraded'; // Elevated reports but not critical
  } else {
    console.log(`[Downdetector] Ratio <= 3, status: 'up'`);
    return 'up'; // Normal levels
  }
}

// Fallback HTTP check function
async function fallbackHttpCheck(req, res, url, startTime = Date.now()) {
  console.log(`[Fallback] Starting HTTP check for URL: ${url}`);

  if (!url) {
    console.log(`[Fallback] No URL provided, returning error`);
    return res.status(400).json({
      error: 'URL parameter is required for fallback check'
    });
  }

  try {
    new URL(url); // Validate URL format
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    console.log(`[Fallback] Making HEAD request to ${url}`);
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'DownDetect/1.0 (Service Status Monitor)',
      },
      redirect: 'follow',
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    const isUp = response.status >= 200 && response.status < 300;

    console.log(`[Fallback] ✅ SUCCESS: ${url} - Status: ${isUp ? 'up' : 'down'} - Source: HTTP Fallback - Response Time: ${responseTime}ms - HTTP Status: ${response.status}`);
    apiUsageStats.httpFallback++;

    res.json({
      status: isUp ? 'up' : 'down',
      responseTime,
      httpStatus: response.status,
      url: url,
      fallback: true,
      dataSource: 'http-fallback',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.log(`[Fallback] ❌ FAILED: ${url} - Status: down - Source: HTTP Fallback - Error: ${error.message}`);
    apiUsageStats.httpFallback++;
    
    res.json({
      status: 'down',
      responseTime: 0,
      error: error.message,
      url: url,
      fallback: true,
      dataSource: 'http-fallback',
      timestamp: new Date().toISOString(),
    });
  }
}

// GET /api/downdetector/stats - Get API usage statistics
router.get('/stats', (req, res) => {
  const successRate = apiUsageStats.totalRequests > 0 
    ? ((apiUsageStats.downdetectorApi / apiUsageStats.totalRequests) * 100).toFixed(1)
    : 0;

  res.json({
    totalRequests: apiUsageStats.totalRequests,
    downdetectorApi: apiUsageStats.downdetectorApi,
    httpFallback: apiUsageStats.httpFallback,
    successRate: parseFloat(successRate),
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
