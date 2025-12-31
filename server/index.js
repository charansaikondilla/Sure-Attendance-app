import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

// ============================================
// CONFIGURATION
// ============================================
const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Google Apps Script URL from frontend api.js
const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL || 
  'https://script.google.com/macros/s/AKfycbwbQ71g1cui8qYUbExczx9PSm5z6P5mhpoY2yCJq1q-YXhCh0jFz7-_j8afxdOUj77FAA/exec';

// Request timeout in milliseconds
const REQUEST_TIMEOUT = 30000; // 30 seconds for normal requests
const SAVE_TIMEOUT = 120000; // 120 seconds (2 minutes) for save operations

// ============================================
// MIDDLEWARE
// ============================================

// CORS configuration - allow requests from frontend
app.use(cors({
  origin: NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL || '*'
    : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3001'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Parse JSON bodies with size limit
app.use(express.json({ limit: '10mb' }));

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  
  // Log request body for POST requests (excluding sensitive data)
  if (req.method === 'POST' && req.body) {
    const sanitizedBody = { ...req.body };
    if (sanitizedBody.password) sanitizedBody.password = '***';
    console.log(`[${timestamp}] Body:`, JSON.stringify(sanitizedBody).substring(0, 200));
  }
  
  next();
});

// Error handling middleware for JSON parsing errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('Bad JSON:', err.message);
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid JSON format',
      message: err.message 
    });
  }
  next();
});

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Make HTTP request to Google Apps Script with timeout and retry logic
 * @param {string} url - The URL to fetch
 * @param {object} options - Fetch options
 * @param {number} retries - Number of retry attempts
 * @param {number} customTimeout - Custom timeout in milliseconds (optional)
 * @returns {Promise<object>} Response data
 */
async function fetchWithTimeout(url, options = {}, retries = 3, customTimeout = REQUEST_TIMEOUT) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), customTimeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else {
      const text = await response.text();
      console.warn('Non-JSON response received:', text.substring(0, 200));
      return { success: false, error: 'Invalid response format', rawResponse: text };
    }
  } catch (error) {
    clearTimeout(timeout);
    
    if (error.name === 'AbortError') {
      const timeoutSeconds = Math.floor(customTimeout / 1000);
      console.error('Request timeout after', timeoutSeconds, 'seconds');
      if (retries > 0) {
        console.log(`Retrying... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchWithTimeout(url, options, retries - 1, customTimeout);
      }
      throw new Error(`Request timeout after ${timeoutSeconds} seconds - server took too long to respond`);
    }
    
    if (retries > 0 && error.message.includes('fetch failed')) {
      console.log(`Network error, retrying... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return fetchWithTimeout(url, options, retries - 1, customTimeout);
    }
    
    throw error;
  }
}

/**
 * Validate required fields in request body
 * @param {object} body - Request body
 * @param {string[]} fields - Required field names
 * @returns {object|null} Error object if validation fails, null otherwise
 */
function validateRequiredFields(body, fields) {
  const missing = fields.filter(field => !body[field]);
  if (missing.length > 0) {
    return {
      success: false,
      error: 'Missing required fields',
      missingFields: missing
    };
  }
  return null;
}

// ============================================
// API ENDPOINTS
// ============================================

/**
 * Health check endpoint
 * GET /health
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    googleScriptConfigured: !!GOOGLE_SCRIPT_URL
  });
});

/**
 * Root endpoint
 * GET /
 */
app.get('/', (req, res) => {
  res.json({
    name: 'Sure Trust Attendance API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: 'GET /health',
      test: 'GET /api/test',
      students: 'GET /api/students',
      submitAttendance: 'POST /api/attendance',
      markIndividual: 'POST /api/attendance/individual',
      saveAttendance: 'POST /api/attendance/save'
    }
  });
});

/**
 * Test connection to Google Apps Script
 * GET /api/test
 */
app.get('/api/test', async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('Testing connection to Google Apps Script...');
    
    if (!GOOGLE_SCRIPT_URL) {
      console.error('Google Script URL not configured');
      return res.status(500).json({ 
        success: false, 
        error: 'Configuration error',
        message: 'Google Script URL not configured. Please set GOOGLE_SCRIPT_URL environment variable.' 
      });
    }

    const data = await fetchWithTimeout(`${GOOGLE_SCRIPT_URL}?action=test`);
    const responseTime = Date.now() - startTime;
    
    console.log(`Connection test successful (${responseTime}ms)`);
    
    res.json({ 
      success: true, 
      data,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('Connection test failed:', error.message);
    
    res.status(500).json({ 
      success: false, 
      error: error.message,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString(),
      suggestion: 'Check if Google Apps Script URL is correct and the script is deployed'
    });
  }
});

/**
 * Get student list from Google Sheets
 * GET /api/students
 */
app.get('/api/students', async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('Fetching student list from Google Sheets...');
    
    if (!GOOGLE_SCRIPT_URL) {
      return res.status(500).json({ 
        success: false, 
        error: 'Configuration error',
        message: 'Google Script URL not configured' 
      });
    }

    const data = await fetchWithTimeout(`${GOOGLE_SCRIPT_URL}?action=getStudents`);
    const responseTime = Date.now() - startTime;
    
    console.log(`Student list retrieved successfully (${responseTime}ms)`);
    console.log(`Total students: ${data.studentNames?.length || 0}`);
    
    res.json({
      ...data,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('Failed to fetch student list:', error.message);
    
    res.status(500).json({ 
      success: false, 
      error: error.message,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Submit bulk attendance data
 * POST /api/attendance
 * Body: { students: [...], date: 'YYYY-MM-DD', ... }
 */
app.post('/api/attendance', async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('Submitting attendance data...');
    
    if (!GOOGLE_SCRIPT_URL) {
      return res.status(500).json({ 
        success: false, 
        error: 'Configuration error',
        message: 'Google Script URL not configured' 
      });
    }

    // Validate request body
    const validation = validateRequiredFields(req.body, ['students', 'date']);
    if (validation) {
      console.error('Validation failed:', validation);
      return res.status(400).json(validation);
    }

    const attendanceData = req.body;
    console.log(`Submitting attendance for ${attendanceData.students?.length || 0} students on ${attendanceData.date}`);
    
    const data = await fetchWithTimeout(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(attendanceData)
    });
    
    const responseTime = Date.now() - startTime;
    console.log(`Attendance submitted successfully (${responseTime}ms)`);
    
    res.json({
      ...data,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('Failed to submit attendance:', error.message);
    
    res.status(500).json({ 
      success: false, 
      error: error.message,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Mark individual student attendance
 * POST /api/attendance/individual
 * Body: { studentName: 'John Doe', date: 'YYYY-MM-DD' }
 */
app.post('/api/attendance/individual', async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('Marking individual attendance...');
    
    if (!GOOGLE_SCRIPT_URL) {
      return res.status(500).json({ 
        success: false, 
        error: 'Configuration error',
        message: 'Google Script URL not configured' 
      });
    }

    // Validate request body
    const validation = validateRequiredFields(req.body, ['studentName', 'date']);
    if (validation) {
      console.error('Validation failed:', validation);
      return res.status(400).json(validation);
    }

    const { studentName, date } = req.body;
    console.log(`Marking attendance for ${studentName} on ${date}`);
    
    const data = await fetchWithTimeout(`${GOOGLE_SCRIPT_URL}?action=markIndividual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ studentName, date })
    });
    
    const responseTime = Date.now() - startTime;
    console.log(`Individual attendance marked successfully (${responseTime}ms)`);
    
    res.json({
      ...data,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('Failed to mark individual attendance:', error.message);
    
    res.status(500).json({ 
      success: false, 
      error: error.message,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Save attendance data
 * POST /api/attendance/save
 * Body: { students: [...], date: 'YYYY-MM-DD', action: 'saveAttendance' }
 */
app.post('/api/attendance/save', async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('Saving attendance data...');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    if (!GOOGLE_SCRIPT_URL) {
      return res.status(500).json({ 
        success: false, 
        error: 'Configuration error',
        message: 'Google Script URL not configured' 
      });
    }

    const attendanceData = req.body;
    
    // Validate required fields
    if (!attendanceData.students || !Array.isArray(attendanceData.students) || attendanceData.students.length === 0) {
      console.error('Validation failed: students array is missing or empty');
      return res.status(400).json({
        success: false,
        error: 'Students array is required and must not be empty',
        receivedData: attendanceData
      });
    }
    
    if (!attendanceData.date) {
      console.error('Validation failed: date is missing');
      return res.status(400).json({
        success: false,
        error: 'Date is required',
        receivedData: attendanceData
      });
    }
    
    console.log(`Saving attendance for ${attendanceData.students.length} students on ${attendanceData.date}`);
    console.log('Students:', attendanceData.students.slice(0, 5), attendanceData.students.length > 5 ? '...' : '');
    console.log('Using extended timeout of 120 seconds for Google Sheets operation...');
    
    // Send to Google Apps Script with action parameter and extended timeout
    const data = await fetchWithTimeout(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...attendanceData,
        action: 'saveAttendance'
      })
    }, 3, SAVE_TIMEOUT); // Use 2-minute timeout for save operations
    
    const responseTime = Date.now() - startTime;
    console.log(`Attendance data saved successfully (${responseTime}ms)`);
    console.log('Response from Google Sheets:', JSON.stringify(data, null, 2));
    
    res.json({
      ...data,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('Failed to save attendance:', error.message);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({ 
      success: false, 
      error: error.message,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================
// ERROR HANDLING
// ============================================

/**
 * 404 handler for undefined routes
 */
app.use((req, res) => {
  console.warn(`404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    availableEndpoints: [
      'GET /health',
      'GET /api/test',
      'GET /api/students',
      'POST /api/attendance',
      'POST /api/attendance/individual',
      'POST /api/attendance/save'
    ]
  });
});

/**
 * Global error handler
 */
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
    ...(NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============================================
// SERVER STARTUP
// ============================================

/**
 * Start the Express server
 */
const server = app.listen(PORT, () => {
  console.log('\n================================');
  console.log('🚀 Sure Trust Attendance Server');
  console.log('================================');
  console.log(`📡 Server running on port: ${PORT}`);
  console.log(`🌍 Environment: ${NODE_ENV}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log(`🔗 Local URL: http://localhost:${PORT}`);
  console.log(`📊 Google Script: ${GOOGLE_SCRIPT_URL ? '✅ Configured' : '❌ Not configured'}`);
  
  if (GOOGLE_SCRIPT_URL) {
    console.log(`📝 Script URL: ${GOOGLE_SCRIPT_URL.substring(0, 50)}...`);
  } else {
    console.warn('\n⚠️  WARNING: GOOGLE_SCRIPT_URL environment variable not set!');
    console.warn('   Using default URL from frontend api.js configuration');
  }
  
  console.log('\n📋 Available endpoints:');
  console.log('   GET  /health                      - Health check');
  console.log('   GET  /api/test                    - Test Google Script connection');
  console.log('   GET  /api/students                - Get student list');
  console.log('   POST /api/attendance              - Submit bulk attendance');
  console.log('   POST /api/attendance/individual   - Mark individual attendance');
  console.log('   POST /api/attendance/save         - Save attendance data');
  console.log('================================\n');
});

/**
 * Graceful shutdown handler
 */
process.on('SIGTERM', () => {
  console.log('\n📴 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n📴 SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

/**
 * Handle uncaught exceptions
 */
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

/**
 * Handle unhandled promise rejections
 */
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

export default app;
