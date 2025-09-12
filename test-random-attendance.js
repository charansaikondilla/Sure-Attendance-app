// Automated Attendance Test with Random CSV Names
// Run with: node test-random-attendance.js

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Load .env for API URL
require('dotenv').config({ path: path.join(__dirname, 'frontend/.env') });
const API_URL = process.env.VITE_API_URL;

if (!API_URL) {
  console.error('❌ VITE_API_URL not set in .env');
  process.exit(1);
}

// Generate random student names
function randomName() {
  const first = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Jamie', 'Riley', 'Drew', 'Cameron'];
  const last = ['Smith', 'Lee', 'Patel', 'Kim', 'Garcia', 'Brown', 'Singh', 'Wang', 'Nguyen', 'Martinez'];
  return (
    first[Math.floor(Math.random() * first.length)] + ' ' +
    last[Math.floor(Math.random() * last.length)]
  );
}

// Create random CSV file
function createRandomCSV(filename, count = 10) {
  const names = Array.from({ length: count }, randomName);
  fs.writeFileSync(filename, names.join('\n'));
  return names;
}

// Main test
(async () => {
  const csvFile = 'test-random.csv';
  const studentCount = 10 + Math.floor(Math.random() * 10);
  const students = createRandomCSV(csvFile, studentCount);
  console.log(`📄 Created random CSV: ${csvFile} with ${studentCount} students`);

  // Read students from CSV
  const csvData = fs.readFileSync(csvFile, 'utf8').split('\n').filter(Boolean);

  // Prepare POST payload
  const today = new Date().toISOString().split('T')[0];
  const payload = {
    action: 'saveAttendance',
    students: csvData,
    date: today
  };

  // Send POST request
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.success) {
      console.log('✅ Attendance saved!');
      console.log('Present:', result.present.length);
      console.log('Absent:', result.absentees.length);
      console.log('Unknowns:', result.unknowns.length);
      console.log('Date:', result.date);
    } else {
      console.error('❌ Attendance save failed:', result.error);
    }
  } catch (err) {
    console.error('❌ Error during attendance POST:', err.message);
  }
})();
