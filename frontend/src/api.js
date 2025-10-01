// =============================
// API.js - Vercel + Google Apps Script Integration
// CORS handled by Vercel serverless functions
// =============================

// API base URL - works for both local development and Vercel production
const API_BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:5173';

// Use Vercel API routes for production, direct Google Apps Script for local dev
const API_URL = `${API_BASE_URL}/api`;

// ----------------------------
// Helper function: POST request
// ----------------------------
async function postRequest(endpoint, payload) {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
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
async function getRequest(endpoint, params = {}) {
  const query = new URLSearchParams(params).toString();
  const url = `${API_URL}${endpoint}${query ? '?' + query : ''}`;

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
    return await getRequest('');
  } catch (error) {
    return { error: error.message, connectionType: 'error', students: [], totalStudents: 0, success: false };
  }
};

// Get list of students
export const getStudentList = async () => {
  try {
    return await getRequest('/students');
  } catch (error) {
    return { error: error.message, students: [], totalStudents: 0, success: false };
  }
};

// Save bulk attendance
export const saveAttendance = async (students, date = new Date().toISOString().split('T')[0]) => {
  return await postRequest('/attendance', { action: 'saveAttendance', students, date });
};

// Mark individual student attendance
export const markIndividualAttendance = async (studentName, status, date = new Date().toISOString().split('T')[0]) => {
  return await postRequest('/individual', { action: 'saveAttendance', students: status === 'Present' ? [studentName] : [], date });
};

// Submit attendance (same as saveAttendance)
export const submitAttendance = async (students, date = new Date().toISOString().split('T')[0]) => {
  return await saveAttendance(students, date);
};
