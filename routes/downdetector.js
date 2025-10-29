const express = require('express');
const router = express.Router();

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

    // Try to simulate downdetector-like behavior with HTTP check
    // In a real implementation, you would use the actual downdetector API
    console.log(`[API] 🔍 Simulating downdetector check for ${service}`);
    
    // For demo purposes, we'll use a simple HTTP check
    // In production, you would integrate with the actual downdetector API
    const response = await simulateDowndetectorCheck(service);
    const responseTime = Date.now() - startTime;

    console.log(`[API] ✅ SUCCESS: ${service} - Status: ${response.status} - Source: Simulated Downdetector - Response Time: ${responseTime}ms`);
    apiUsageStats.downdetectorApi++;
    
    res.json({
      status: response.status,
      responseTime,
      serviceName: service,
      dataSource: 'simulated-downdetector',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.log(`[API] Error for ${service}:`, error);
    // Fallback to basic HTTP check if simulation fails
    return await fallbackHttpCheck(req, res, `https://${service.toLowerCase()}.com`);
  }
});

// Simulate downdetector check (replace with actual API integration)
async function simulateDowndetectorCheck(serviceName) {
  // This is a simulation - in production, integrate with actual downdetector API
  const commonServices = {
    'google': 'https://google.com',
    'facebook': 'https://facebook.com',
    'twitter': 'https://twitter.com',
    'instagram': 'https://instagram.com',
    'github': 'https://github.com',
    'netflix': 'https://netflix.com',
    'youtube': 'https://youtube.com',
    'amazon': 'https://amazon.com'
  };

  const url = commonServices[serviceName.toLowerCase()] || `https://${serviceName.toLowerCase()}.com`;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'DownDetect/1.0 (Service Status Monitor)',
      },
      redirect: 'follow',
    });

    clearTimeout(timeoutId);
    const isUp = response.status >= 200 && response.status < 300;

    // Simulate different statuses based on response
    let status = 'up';
    if (!isUp) {
      status = 'down';
    } else if (response.status >= 300 && response.status < 500) {
      status = 'degraded';
    }

    return { status };
  } catch (error) {
    return { status: 'down' };
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
