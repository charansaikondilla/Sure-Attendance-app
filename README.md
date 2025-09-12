# Attendance App

A full-stack attendance management system using Google Sheets as a backend and a modern React frontend.

## Features
- Upload CSV, Excel, or PDF files with student names
- Compare uploaded names with master list from Google Sheets
- Mark attendance (Present/Absent) in Google Sheets for the current date
- Copy-friendly, numbered lists for Attended and Not Attended students
- Filtered Unknowns list (removes times, numbers, meeting codes, etc)
- Individual attendance marking (Present/Absent)
- Robust error handling and CORS support

## Project Structure
- `backend/Code.gs` — Google Apps Script backend for Google Sheets
- `frontend/` — React frontend (Vite, see below for usage)
- `README-Google-Sheet-Setup.md` — Google Sheet setup and deployment instructions

## Setup
1. **Google Sheet**: Follow `README-Google-Sheet-Setup.md` to configure your sheet and deploy the Apps Script backend.
2. **Frontend**:
   - Go to `frontend/`
   - Run `npm install`
   - Set your Apps Script deployment URL in `frontend/.env` as `VITE_API_URL`
   - Start the dev server: `npm run dev`
   - Open [http://localhost:5173](http://localhost:5173)

## Usage
- Upload a file with student names
- Click **Compare Attendance** to see present, absent, and unknowns
- Use the **Copy** buttons to copy attended/not attended lists
- Click **Save to Google Sheets** to mark attendance for today
- Use the **Individual Attendance** section for self-marking

## Cleaned Up
- All test data files and scripts have been removed for production use
- Only core backend, frontend, and documentation remain

## Troubleshooting
- See `README-Google-Sheet-Setup.md` for common issues (CORS, permissions, etc)
- Check browser console and Apps Script logs for errors

## License
MIT
