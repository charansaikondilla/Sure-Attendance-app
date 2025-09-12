// Save attendance to Google Sheets (action=saveAttendance)
export const saveAttendance = async (students, date = new Date().toISOString().split('T')[0]) => {
  try {
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'saveAttendance',
        students,
        date
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error saving attendance:', error);
    throw error;
  }
};
// Google Apps Script API Integration with CORS Proxy
const API_URL = import.meta.env.VITE_API_URL;
const PROXY_URL = '/api'; // Use Vite proxy

export const submitAttendance = async (students, date = new Date().toISOString().split('T')[0]) => {
  console.log('Request data:', { students, source: 'web-app', date });

  try {
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        students,
        source: 'web-app',
        date
      })
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Response error text:', errorText);
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Parsed response:', result);
    return result;
  } catch (error) {
    console.error('Error submitting attendance:', error);
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    throw error;
  }
};

// Test API connection and get student data
export const testConnection = async () => {
  try {
    // First test basic connectivity with test endpoint
    const testResponse = await fetch(PROXY_URL + '?action=test', {
      method: 'GET',
    });

    if (!testResponse.ok) {
      throw new Error(`HTTP ${testResponse.status}: ${testResponse.statusText}`);
    }

    const testResult = await testResponse.json();
    console.log('Basic test successful:', testResult);

    // If basic test works, try to get students
    const studentsResponse = await fetch(PROXY_URL + '?action=getStudents', {
      method: 'GET',
    });

    if (!studentsResponse.ok) {
      console.warn('Basic connection works but getStudents failed:', studentsResponse.status);
      return {
        ...testResult,
        connectionType: 'google_sheets_basic',
        message: 'Basic connection to Google Apps Script works, but spreadsheet access may have issues',
        students: [],
        totalStudents: 0,
        warning: 'Spreadsheet access failed - check your sheet ID and permissions'
      };
    }

    const studentsResult = await studentsResponse.json();
    return {
      ...studentsResult,
      connectionType: 'google_sheets',
      message: 'Connected to Google Sheets successfully!'
    };
  } catch (error) {
    console.error('Connection test failed:', error);
    return {
      error: error.message,
      connectionType: 'error',
      message: 'Failed to connect to Google Apps Script',
      students: [],
      totalStudents: 0,
      success: false
    };
  }
};

// Get student list from Google Sheets
export const getStudentList = async () => {
  try {
    const response = await fetch(PROXY_URL + '?action=getStudents', {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error getting student list:', error);
    return {
      error: error.message,
      students: [],
      totalStudents: 0,
      success: false
    };
  }
};

// Mark individual student attendance
export const markIndividualAttendance = async (studentName, status, date = new Date().toISOString().split('T')[0]) => {
  try {
    const params = new URLSearchParams({
      action: 'markIndividual',
      student: studentName,
      status: status,
      date: date
    });

    const response = await fetch(`${PROXY_URL}?${params}`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error marking individual attendance:', error);
    throw error;
  }
};
