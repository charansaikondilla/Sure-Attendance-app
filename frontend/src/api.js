// =============================
// API.js - Google Apps Script Direct Integration
// Uses JSONP for GET requests to bypass CORS
// =============================

// Google Apps Script Web App URL
const API_URL = 'https://script.google.com/macros/s/AKfycbwW8V1cR5tOWCg-fGLDjWzeEus87XgkwyoBPTSZBAdlfL5vIJpQRHGeH65jER8GHUvSfQ/exec';

// Timeout settings
const API_TIMEOUT = 30000; // 30 seconds
const SAVE_TIMEOUT = 120000; // 2 minutes for save operations

/**
 * JSONP Request - Bypasses CORS by using script injection
 * @param {string} url - Full URL with query params
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<object>} Response data
 */
function jsonpRequest(url, timeout = API_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const callbackName = 'jsonp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('Request timeout'));
    }, timeout);

    const cleanup = () => {
      clearTimeout(timeoutId);
      delete window[callbackName];
      const script = document.getElementById(callbackName);
      if (script) script.remove();
    };

    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };

    const script = document.createElement('script');
    script.id = callbackName;
    script.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + callbackName;
    script.onerror = () => {
      cleanup();
      reject(new Error('Network error'));
    };
    document.head.appendChild(script);
  });
}

/**
 * POST Request using fetch with text/plain to avoid preflight
 * @param {object} data - Data to send
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<object>} Response data
 */
async function postRequest(data, timeout = SAVE_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(data),
      signal: controller.signal,
      redirect: 'follow'
    });

    clearTimeout(timeoutId);
    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - data may have been saved, please check your sheet');
    }
    throw error;
  }
}

// ----------------------------
// API Functions
// ----------------------------

/**
 * Test connection to Google Apps Script
 */
export async function testConnection() {
  try {
    console.log('Testing connection...');
    const result = await jsonpRequest(`${API_URL}?action=test`);
    console.log('Connection test result:', result);
    return result;
  } catch (error) {
    console.error('Connection test failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get list of students from Google Sheets
 */
export async function getStudentList() {
  try {
    console.log('Fetching student list...');
    const result = await jsonpRequest(`${API_URL}?action=getStudents`);
    console.log('Received students:', result.students?.length || 0);
    return result;
  } catch (error) {
    console.error('Failed to fetch students:', error);
    return { success: false, error: error.message, students: [], studentNames: [] };
  }
}

/**
 * Save bulk attendance to Google Sheets
 * @param {string[]} students - Array of present student names
 * @param {string} date - Date in YYYY-MM-DD format
 */
export async function saveAttendance(students, date) {
  try {
    if (!date) date = new Date().toISOString().split('T')[0];
    console.log(`Saving attendance for ${students.length} students on ${date}...`);
    
    const result = await postRequest({
      action: 'saveAttendance',
      students: students,
      date: date
    });
    
    console.log('Save result:', result);
    return result;
  } catch (error) {
    console.error('Failed to save attendance:', error);
    throw error;
  }
}

/**
 * Submit attendance (alias for saveAttendance)
 */
export async function submitAttendance(attendanceData) {
  const students = attendanceData.students || attendanceData;
  const date = attendanceData.date || new Date().toISOString().split('T')[0];
  return saveAttendance(students, date);
}

/**
 * Mark individual student attendance
 */
export async function markIndividualAttendance(studentName, date) {
  if (!date) date = new Date().toISOString().split('T')[0];
  return saveAttendance([studentName], date);
}

// Export API URL for reference
export { API_URL };