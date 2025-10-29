const express = require('express');
const router = express.Router();

// Set Puppeteer environment variables for Railway/Docker environments
// Let Puppeteer download its own Chromium - more reliable than system Chromium
if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT) {
  process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = 'false';
  process.env.PUPPETEER_ARGS = '--no-sandbox,--disable-setuid-sandbox';
}

// Load downdetector API
const { downdetector } = require('downdetector-api');

// Simple in-memory counter for API usage tracking
const apiUsageStats = {
  downdetectorApi: 0,
  totalRequests: 0
};

// Log usage statistics every 10 requests
function logUsageStats() {
  if (apiUsageStats.totalRequests > 0 && apiUsageStats.totalRequests % 10 === 0) {
    const successRate = ((apiUsageStats.downdetectorApi / apiUsageStats.totalRequests) * 100).toFixed(1);
    console.log(`[API] 📊 Usage Statistics (${apiUsageStats.totalRequests} total requests):`);
    console.log(`[API] 📊 Downdetector API: ${apiUsageStats.downdetectorApi} (${successRate}%)`);
  }
}

// GET /api/downdetector - Check service status
router.get('/', async (req, res) => {
  const { service } = req.query;

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
    
    // Try the main downdetector.com domain first
    let response;
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
        // Try .nl domain
        try {
          console.log(`[Downdetector] 🔍 Attempting ${service} on .nl domain`);
          response = await downdetector(service, 'nl');
          console.log(`[Downdetector] ✅ Success for ${service} on .nl domain`);
        } catch (nlError) {
          console.log(`[Downdetector] ❌ .nl domain failed for ${service}:`, nlError.message);
          // All domains failed
          throw new Error(`Failed to fetch downdetector data for ${service} from all domains`);
        }
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
    console.log(`[Downdetector] ❌ Error for ${service}:`, error.message);
    apiUsageStats.totalRequests--;
    
    res.status(500).json({
      error: 'Failed to fetch service status from downdetector',
      message: error.message,
      serviceName: service,
      timestamp: new Date().toISOString(),
    });
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

// GET /api/downdetector/stats - Get API usage statistics
router.get('/stats', (req, res) => {
  const successRate = apiUsageStats.totalRequests > 0 
    ? ((apiUsageStats.downdetectorApi / apiUsageStats.totalRequests) * 100).toFixed(1)
    : 0;

  res.json({
    totalRequests: apiUsageStats.totalRequests,
    downdetectorApi: apiUsageStats.downdetectorApi,
    successRate: parseFloat(successRate),
    timestamp: new Date().toISOString()
  });
});

module.exports = router;