// api.js - Google Apps Script API Integration for GitHub Pages

// Replace this with your deployed Apps Script URL
const API_URL = 'https://script.google.com/macros/s/AKfycbwbQ71g1cui8qYUbExczx9PSm5z6P5mhpoY2yCJq1q-YXhCh0jFz7-_j8afxdOUj77FAA/exec';

/**
 * Generic fetch wrapper with error handling
 * @param {string} endpoint - e.g., "?action=getStudents" or ""
 * @param {object} options - fetch options: method, headers, body
 * @returns {Promise<any>}
 */
async function apiFetch(endpoint = '', options = {}) {
  try {
    const response = await fetch(API_URL + endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error('API Fetch Error:', error);
    throw error;
  }
}

/**
 * Fetch student list
 */
export async function getStudents() {
  return apiFetch('?action=getStudents');
}

/**
 * Save attendance
 * @param {Array<string>} students - list of student names
 * @param {string} date - optional, defaults to today
 */
export async function saveAttendance(students, date = new Date().toISOString().split('T')[0]) {
  if (!students || !Array.isArray(students) || students.length === 0) {
    throw new Error('students array must be provided and not empty');
  }

  const payload = {
    action: 'saveAttendance',
    students,
    date
  };

  return apiFetch('', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

/**
 * Fetch attendance report for a specific date
 * @param {string} date - YYYY-MM-DD
 */
export async function getAttendanceReport(date) {
  if (!date) throw new Error('date parameter is required');
  return apiFetch(`?action=getAttendanceReport&date=${encodeURIComponent(date)}`);
}

/**
 * Fetch attendance stats
 */
export async function getAttendanceStats() {
  return apiFetch('?action=getStats');
}

/**
 * Test API connectivity
 */
export async function testConnection() {
  return apiFetch('?action=test');
}
