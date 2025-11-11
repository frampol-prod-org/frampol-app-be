const express = require('express');
const axios = require('axios');
const router = express.Router();

// Simple in-memory counter for API usage tracking
const apiUsageStats = {
  pingRequests: 0,
  downloadRequests: 0,
  uploadRequests: 0,
  totalRequests: 0
};

// Log usage statistics every 10 requests
function logUsageStats() {
  if (apiUsageStats.totalRequests > 0 && apiUsageStats.totalRequests % 10 === 0) {
    console.log(`[Speedtest] 📊 Usage Statistics (${apiUsageStats.totalRequests} total requests):`);
    console.log(`[Speedtest] 📊 Ping: ${apiUsageStats.pingRequests}, Download: ${apiUsageStats.downloadRequests}, Upload: ${apiUsageStats.uploadRequests}`);
  }
}

// GET /api/speedtest/ping - Measure latency to speed test server
router.get('/ping', async (req, res) => {
  const { server } = req.query;

  if (!server) {
    return res.status(400).json({ 
      error: 'Server URL is required' 
    });
  }

  console.log(`[Speedtest] 🔍 Ping requested for server: ${server}`);
  apiUsageStats.totalRequests++;
  apiUsageStats.pingRequests++;
  logUsageStats();

  try {
    // Construct the ping URL (Express server format: /ping)
    const baseURL = server.endsWith('/') ? server.slice(0, -1) : server;
    const pingUrl = `${baseURL}/ping`;
    
    const startTime = Date.now();
    
    // Fetch from the Express speed test server
    const response = await axios.get(pingUrl, {
      headers: {
        'Cache-Control': 'no-store',
      },
      validateStatus: (status) => status === 200 || status === 204,
    });

    const latency = Date.now() - startTime;

    console.log(`[Speedtest] ✅ Ping success: ${latency}ms`);
    
    // Return latency with CORS headers
    res.json({ 
      latency,
      server,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`[Speedtest] ❌ Ping error:`, error.message);
    const statusCode = error.response?.status || 500;
    res.status(statusCode).json({ 
      error: 'Proxy error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/speedtest/download - Download test endpoint
router.get('/download', async (req, res) => {
  const { server, size } = req.query;

  if (!server) {
    return res.status(400).json({ 
      error: 'Server URL is required' 
    });
  }

  const chunkSize = size || '1048576'; // Default 1MB
  console.log(`[Speedtest] 🔍 Download requested: server=${server}, size=${chunkSize}`);
  apiUsageStats.totalRequests++;
  apiUsageStats.downloadRequests++;
  logUsageStats();

  try {
    // Construct the download URL (Express server format: /download?size=...)
    const baseURL = server.endsWith('/') ? server.slice(0, -1) : server;
    const downloadUrl = `${baseURL}/download?size=${chunkSize}`;
    
    // Fetch from the Express speed test server
    const response = await axios.get(downloadUrl, {
      headers: {
        'Cache-Control': 'no-store',
      },
      responseType: 'arraybuffer',
    });

    const data = Buffer.from(response.data);
    console.log(`[Speedtest] ✅ Download success: ${data.length} bytes`);

    // Return the data with appropriate headers
    res.set({
      'Content-Type': 'application/octet-stream',
      'Cache-Control': 'no-store',
      'Content-Length': data.length
    });
    
    res.send(data);

  } catch (error) {
    console.error(`[Speedtest] ❌ Download error:`, error.message);
    const statusCode = error.response?.status || 500;
    res.status(statusCode).json({ 
      error: 'Proxy error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/speedtest/upload - Upload test endpoint
router.post('/upload', express.raw({ type: 'application/octet-stream', limit: '50mb' }), async (req, res) => {
  const { server } = req.query;

  if (!server) {
    return res.status(400).json({ 
      error: 'Server URL is required' 
    });
  }

  console.log(`[Speedtest] 🔍 Upload requested: server=${server}, bodySize=${req.body?.length || 0}`);
  apiUsageStats.totalRequests++;
  apiUsageStats.uploadRequests++;
  logUsageStats();

  try {
    // Get the request body
    const body = req.body;
    
    if (!body || body.length === 0) {
      return res.status(400).json({ 
        error: 'Request body is required' 
      });
    }
    
    // Construct the upload URL (Express server format: /upload)
    const baseURL = server.endsWith('/') ? server.slice(0, -1) : server;
    const uploadUrl = `${baseURL}/upload`;
    
    // Forward the request to the Express speed test server
    const response = await axios.post(uploadUrl, body, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Cache-Control': 'no-store',
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    // Express server returns { bytes: number }
    const result = response.data;

    console.log(`[Speedtest] ✅ Upload success: ${result.bytes || body.length} bytes`);

    // Return success
    res.json({
      bytes: result.bytes || body.length,
      server,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`[Speedtest] ❌ Upload error:`, error.message);
    const statusCode = error.response?.status || 500;
    res.status(statusCode).json({ 
      error: 'Proxy error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/speedtest/stats - Get API usage statistics
router.get('/stats', (req, res) => {
  res.json({
    totalRequests: apiUsageStats.totalRequests,
    pingRequests: apiUsageStats.pingRequests,
    downloadRequests: apiUsageStats.downloadRequests,
    uploadRequests: apiUsageStats.uploadRequests,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;

