# Google Apps Script CORS Fix

## The Problem
Google Apps Script's `ContentService.setHeader()` does **NOT** work for CORS headers. This is a known limitation - Google handles CORS internally but doesn't let you set custom headers.

## The Solution
Update your Google Apps Script to support JSONP (JSON with Padding) for GET requests.

## Updated Google Apps Script Code

Copy this entire code and replace your current Apps Script code:

```javascript
// Google Apps Script - Attendance Tracker with JSONP support for CORS
// Version: 3.3 - CORS fix with JSONP support

const CONFIG = {
  SPREADSHEET_ID: '1A3-zdsnciNyDirugJzkEiE3wzQ-6O_M9essgYkrOC2A',
  SHEET_NAME: 'Sheet1',
  CACHE_DURATION: 1800, // 30 min
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000 // 1 sec
};

// -----------------------
// Utility Functions
// -----------------------
function sleep(ms) { 
  Utilities.sleep(ms); // Use Utilities.sleep in Apps Script, not setTimeout
}

function logOperation(operation, details, success = true) {
  const timestamp = new Date().toISOString();
  const status = success ? 'SUCCESS' : 'ERROR';
  Logger.log(`[${timestamp}] ${status} - ${operation}: ${JSON.stringify(details)}`);

  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let logSheet = spreadsheet.getSheetByName('Logs');
    if (!logSheet) {
      spreadsheet.insertSheet('Logs');
      logSheet = spreadsheet.getSheetByName('Logs');
      logSheet.appendRow(['Timestamp','Operation','Details','Status']);
    }
    logSheet.appendRow([timestamp, operation, JSON.stringify(details), status]);
  } catch(e) {
    Logger.log('Failed to write log sheet: ' + e.message);
  }
}

function validateSpreadsheet() {
  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet) throw new Error(`Sheet '${CONFIG.SHEET_NAME}' not found`);
    return { spreadsheet, sheet };
  } catch(e) {
    logOperation('validateSpreadsheet', { error: e.message }, false);
    throw e;
  }
}

/**
 * Create JSONP or JSON response
 * JSONP wraps JSON in a callback function for cross-origin requests
 */
function createResponse(data, callback) {
  const jsonString = JSON.stringify(data);
  
  if (callback) {
    // JSONP response - wrap in callback function
    return ContentService
      .createTextOutput(callback + '(' + jsonString + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  } else {
    // Regular JSON response
    return ContentService
      .createTextOutput(jsonString)
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// -----------------------
// Attendance Functions
// -----------------------
function getOrCreateDateColumn(sheet, date, retryCount) {
  retryCount = retryCount || 0;
  try {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    for (var i = 2; i < headers.length; i++) {
      if (headers[i] && headers[i].toString().trim() === date) return i + 1;
    }
    var newCol = sheet.getLastColumn() + 1;
    var headerCell = sheet.getRange(1, newCol);
    headerCell.setValue(date).setFontWeight('bold').setBackground('#e3f2fd').setHorizontalAlignment('center').setFontSize(11);
    sheet.autoResizeColumn(newCol);
    if (sheet.getColumnWidth(newCol) < 100) sheet.setColumnWidth(newCol, 100);
    return newCol;
  } catch (e) {
    logOperation('getOrCreateDateColumn', { error: e.message, retryCount: retryCount, date: date }, false);
    if (retryCount < CONFIG.MAX_RETRIES) {
      sleep(CONFIG.RETRY_DELAY);
      return getOrCreateDateColumn(sheet, date, retryCount + 1);
    }
    throw new Error('Failed to create date column');
  }
}

function markStudentAttendance(sheet, row, col, status) {
  var cell = sheet.getRange(row, col);
  cell.clearContent();
  cell.setValue(status);
  if (status === 'Present') { 
    cell.setBackground('#e8f5e8'); 
    cell.setFontColor('#2e7d32'); 
  } else if (status === 'Absent') { 
    cell.setBackground('#ffebee'); 
    cell.setFontColor('#c62828'); 
  }
  return true;
}

function getMasterStudentData(sheet) {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('masterStudentData');
  if (cached) return JSON.parse(cached);

  var data = sheet.getDataRange().getValues();
  var students = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] && data[i][0].toString().trim() !== '') {
      students.push({
        name: data[i][0].toString().trim(), 
        group: data[i][1] ? data[i][1].toString().trim() : 'N/A', 
        rowIndex: i + 1
      });
    }
  }
  cache.put('masterStudentData', JSON.stringify(students), CONFIG.CACHE_DURATION);
  return students;
}

function processBulkAttendance(sheet, attendanceList, masterData, date) {
  var startTime = new Date().getTime();
  var present = [], absentees = [], unknowns = [];
  var dateCol = getOrCreateDateColumn(sheet, date);
  var masterMap = {};
  
  masterData.forEach(function(s) {
    masterMap[s.name.toLowerCase().replace(/\s+/g, '')] = s;
  });
  
  attendanceList.forEach(function(name) {
    var norm = name.toString().trim().toLowerCase().replace(/\s+/g, '');
    var student = masterMap[norm];
    if (student) { 
      present.push(student.name); 
      markStudentAttendance(sheet, student.rowIndex, dateCol, 'Present'); 
    } else {
      unknowns.push(name);
    }
  });
  
  masterData.forEach(function(s) { 
    if (present.indexOf(s.name) === -1) { 
      absentees.push(s.name); 
      markStudentAttendance(sheet, s.rowIndex, dateCol, 'Absent'); 
    } 
  });
  
  return {
    present: present, 
    absentees: absentees, 
    unknowns: unknowns, 
    processingTime: new Date().getTime() - startTime
  };
}

// -----------------------
// Main Web App Handlers
// -----------------------
function doGet(e) {
  try {
    var action = e.parameter.action;
    var callback = e.parameter.callback; // JSONP callback parameter
    var result = validateSpreadsheet();
    var sheet = result.sheet;
    var responseData;

    switch (action) {
      case 'getStudents':
        var students = getMasterStudentData(sheet);
        responseData = { 
          students: students, 
          studentNames: students.map(function(s) { return s.name; }),
          success: true 
        };
        break;
      case 'test':
        responseData = { 
          message: 'Connection successful! Google Apps Script is working.', 
          timestamp: new Date().toISOString(),
          success: true 
        };
        break;
      default:
        responseData = { 
          message: 'Google Apps Script is running', 
          availableActions: ['test', 'getStudents'],
          success: true 
        };
    }

    logOperation('doGet', { action: action, success: true });
    return createResponse(responseData, callback);

  } catch (err) {
    logOperation('doGet', { error: err.message }, false);
    var callback = e.parameter ? e.parameter.callback : null;
    return createResponse({ success: false, error: err.message }, callback);
  }
}

function doPost(e) {
  try {
    var postData = e.postData.contents;
    var data;
    
    // Handle both JSON and form data
    try {
      data = JSON.parse(postData);
    } catch (parseError) {
      // Try to parse as form data
      if (e.parameter && e.parameter.data) {
        data = JSON.parse(e.parameter.data);
      } else {
        throw new Error('Invalid request data format');
      }
    }
    
    var action = data.action;
    var result = validateSpreadsheet();
    var sheet = result.sheet;
    var responseData;

    if (action === 'saveAttendance') {
      var masterData = getMasterStudentData(sheet);
      var attendanceResult = processBulkAttendance(sheet, data.students, masterData, data.date);
      responseData = {
        present: attendanceResult.present,
        absentees: attendanceResult.absentees,
        unknowns: attendanceResult.unknowns,
        processingTime: attendanceResult.processingTime,
        totalPresent: attendanceResult.present.length,
        totalAbsent: attendanceResult.absentees.length,
        success: true
      };
      logOperation('saveAttendance', { 
        date: data.date, 
        presentCount: attendanceResult.present.length,
        absentCount: attendanceResult.absentees.length
      });
    } else if (action === 'submitAttendance') {
      var masterData = getMasterStudentData(sheet);
      var attendanceResult = processBulkAttendance(sheet, data.students, masterData, data.date);
      responseData = {
        present: attendanceResult.present,
        absentees: attendanceResult.absentees,
        unknowns: attendanceResult.unknowns,
        processingTime: attendanceResult.processingTime,
        success: true
      };
    } else if (action === 'markIndividual') {
      var masterData = getMasterStudentData(sheet);
      var dateCol = getOrCreateDateColumn(sheet, data.date);
      var found = false;
      
      masterData.forEach(function(s) {
        if (s.name.toLowerCase() === data.studentName.toLowerCase()) {
          markStudentAttendance(sheet, s.rowIndex, dateCol, 'Present');
          found = true;
        }
      });
      
      responseData = {
        success: found,
        message: found ? 'Attendance marked' : 'Student not found',
        studentName: data.studentName
      };
    } else {
      responseData = { success: false, error: 'Unknown action: ' + action };
    }

    return ContentService
      .createTextOutput(JSON.stringify(responseData))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    logOperation('doPost', { error: err.message }, false);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

## Deployment Steps

1. Go to your Google Apps Script project
2. Replace ALL the code with the above
3. Click **Deploy** > **New deployment**
4. Select **Web app**
5. Set:
   - **Execute as**: Me
   - **Who has access**: Anyone
6. Click **Deploy**
7. **IMPORTANT**: Copy the NEW Web App URL and update it in your frontend if it changed

## Why This Works

1. **JSONP for GET requests**: The script now supports a `callback` parameter. When provided, it wraps the JSON response in a JavaScript function call, which bypasses CORS entirely.

2. **Form data support for POST**: The script can now handle both JSON body and form data, making it more flexible.

3. **No custom headers**: We removed the `setCors()` function because Google Apps Script doesn't support custom response headers.

## Testing

After deployment, test the URL directly in your browser:
```
https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?action=test
```

You should see:
```json
{"message":"Connection successful! Google Apps Script is working.","timestamp":"...","success":true}
```
