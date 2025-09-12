// =============================
// API.js - Google Apps Script Integration for GitHub Pages
// Fully working with CORS
// =============================

// Your deployed Google Apps Script Web App URL
const API_URL = "https://script.google.com/macros/s/AKfycbx0NL9Plmn0sm_y49a8CflfDShHmoxwCgqySzGbHX88SJkVLgjY2AKz3fCe81ppzP46jQ/exec";

// Use a proxy only if running locally (optional)
const PROXY_URL = window.location.hostname === "localhost" ? "/api" : API_URL;

// ----------------------------
// Helper function: POST request
// ----------------------------
async function postRequest(payload) {
  try {
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API POST request failed:', error);
    throw error;
  }
}

// ----------------------------
// Helper function: GET request
// ----------------------------
async function getRequest(params = {}) {
  const query = new URLSearchParams(params).toString();
  const url = `${PROXY_URL}?${query}`;

  try {
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('API GET request failed:', error);
    throw error;
  }
}

// ----------------------------
// API Functions
// ----------------------------

// Test connection
export const testConnection = async () => {
  try {
    const testResult = await getRequest({ action: 'test' });
    const studentsResult = await getRequest({ action: 'getStudents' });
    return { ...testResult, ...studentsResult, connectionType: 'google_sheets' };
  } catch (error) {
    return { error: error.message, connectionType: 'error', students: [], totalStudents: 0, success: false };
  }
};

// Get list of students
export const getStudentList = async () => {
  try {
    return await getRequest({ action: 'getStudents' });
  } catch (error) {
    return { error: error.message, students: [], totalStudents: 0, success: false };
  }
};

// Save bulk attendance
export const saveAttendance = async (students, date = new Date().toISOString().split('T')[0]) => {
  return await postRequest({ action: 'saveAttendance', students, date });
};

// Mark individual student attendance
export const markIndividualAttendance = async (studentName, status, date = new Date().toISOString().split('T')[0]) => {
  // For backward compatibility: individual attendance can be handled as single-item bulk
  return await postRequest({ action: 'saveAttendance', students: status === 'Present' ? [studentName] : [], date });
};

// Submit attendance (same as saveAttendance)
export const submitAttendance = async (students, date = new Date().toISOString().split('T')[0]) => {
  return await saveAttendance(students, date);
};
