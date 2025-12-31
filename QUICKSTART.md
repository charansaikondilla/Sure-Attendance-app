# 🚀 Quick Start Guide - Sure Trust Attendance App

## ⚡ 5-Minute Setup

### Step 1: Start Backend Server
Open a terminal and run:
```powershell
cd "d:\charan g -downloads\suretrust attendance\attendance-app"
npm start
```

You should see:
```
================================
🚀 Sure Trust Attendance Server
================================
📡 Server running on port: 3000
```

### Step 2: Start Frontend Server
Open a NEW terminal and run:
```powershell
cd "d:\charan g -downloads\suretrust attendance\attendance-app\frontend"
npm run dev
```

You should see:
```
VITE v7.1.4  ready in 333 ms
➜  Local:   http://localhost:5173/
```

### Step 3: Open Application
Visit: **http://localhost:5173**

## ✅ Verify Everything is Working

### Test 1: Backend Health Check
Visit: **http://localhost:3000/health**

Expected response:
```json
{
  "status": "ok",
  "timestamp": "...",
  "googleScriptConfigured": true
}
```

### Test 2: Frontend Loading
Visit: **http://localhost:5173**

You should see the attendance app interface.

## 🎯 Usage

### Upload Attendance File
1. Click "Choose File" or drag & drop
2. Select a PDF or CSV file
3. Wait for processing
4. Review matched students
5. Click "Submit Attendance"

### Mark Individual Attendance
1. Select student from dropdown
2. Choose date
3. Click "Mark Attendance"

## 🛑 Troubleshooting

### Backend won't start
```powershell
# Kill existing Node processes
Get-Process | Where-Object {$_.ProcessName -eq "node"} | Stop-Process -Force

# Try again
npm start
```

### Frontend won't start
```powershell
# Frontend will use next available port automatically
# Check the terminal output for the actual port number
```

### Can't connect to Google Sheets
- Verify GOOGLE_SCRIPT_URL is correct
- Check Google Apps Script is deployed
- Test with: http://localhost:3000/api/test

## 📞 Need Help?

Check these files:
- Full Documentation: [README.md](README.md)
- Testing Guide: [TESTING.md](TESTING.md)
- Configuration: [.env.example](.env.example)

## 🎉 You're Ready!

Both servers are running error-free:
- ✅ Backend: http://localhost:3000
- ✅ Frontend: http://localhost:5173
- ✅ No compilation errors
- ✅ No runtime errors
- ✅ Ready to use!

---

**Current Status:** ✅ RUNNING  
**Last Updated:** December 30, 2025
