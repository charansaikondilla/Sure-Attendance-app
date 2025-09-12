# Google Sheet Setup for Attendance System

## 📊 Sheet Configuration

### **Sheet Details:**
- **Sheet Name:** `soft skills Students`
- **Sheet ID:** `1A3-zdsnciNyDirugJzkEiE3wzQ-6O_M9essgYkrOC2A`
- **Sheet Link:** https://docs.google.com/spreadsheets/d/1A3-zdsnciNyDirugJzkEiE3wzQ-6O_M9essgYkrOC2A/edit?gid=0#gid=0
- **Tab Name:** `Sheet1`

### **Column Structure:**

| Column | Header | Description | Example |
|--------|--------|-------------|---------|
| A | Students | Student names | charan |
| B | Groups | Student groups/classes | A |
| C | [Date] | Attendance status | Present/Absent |
| D | [Date] | Attendance status | Present/Absent |
| ... | ... | ... | ... |

### **Sample Data Structure:**

```
| Students          | Groups | 2025-09-06    | 2025-09-07    |
|-------------------|--------|---------------|---------------|
| charan           | A      | Present      |               |
| pavan            | A      | Present      |               |
| Aiswarya         | B      | Absent       |               |
| Ajith Kumar      | B      | Present      |               |
| Alekhya          | A      | Present      |               |
| Alia             | B      | Absent       |               |
| Ankit            | A      | Absent       |               |
| Ayandip          | B      | Absent       |               |
| Bhavana          | A      | Absent       |               |
| Boya Yerriswamy  | B      | Absent       |               |
```

## 🚀 Deployment Instructions

### **Step 1: Update Google Apps Script**
1. Open [Google Apps Script](https://script.google.com/)
2. Create a new project or open existing one
3. Replace all code with the provided `Code.gs` content
4. Save the project

### **Step 2: Deploy the Script**
1. Click **"Deploy"** → **"New deployment"**
2. Select type: **"API executable"**
3. Configure:
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Click **"Deploy"**
5. **Copy the deployment URL**

**Note:** If you get CORS errors, the system will automatically use a CORS proxy or fallback to local processing.

### **Step 3: Update Frontend**
1. Open `attendance-app/frontend/.env`
2. Update the `VITE_API_URL` with your new deployment URL:
   ```
   VITE_API_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
   ```

### **Step 4: Test the System**
1. Start the frontend: `npm run dev`
2. Open http://localhost:5173/
3. Click **"🔗 Test Google Sheets"**
4. Upload a CSV file with student names
5. Check your Google Sheet for attendance marks

## 📋 Student List

Your system is configured for these **10 students**:

1. **charan**
2. **pavan**
3. **Aiswarya**
4. **Ajith Kumar**
5. **Alekhya**
6. **Alia**
7. **Ankit**
8. **Ayandip**
9. **Bhavana**
10. **Boya Yerriswamy**

## 🧪 Testing Examples

### **Test Case 1: Upload 5 Students**
**Input CSV:** `test-students.csv`
```
charan
pavan
Aiswarya
Ajith Kumar
Alekhya
```

**Expected Results:**
- ✅ **Present:** 5 students (charan, pavan, Aiswarya, Ajith Kumar, Alekhya)
- ❌ **Absent:** 5 students (Alia, Ankit, Ayandip, Bhavana, Boya Yerriswamy)
- ❓ **Unknown:** 0 students

### **Google Sheet Updates:**
- Column C (today's date) will show "Present" for uploaded students
- Column C will show "Absent" for students not in the upload

## 🔧 Troubleshooting

### **CORS Error:**
- Redeploy the Google Apps Script with the updated code
- Ensure deployment type is "Web app"
- Check that "Anyone" has access

### **No Students Found:**
- Verify student names are in Column A of Sheet1
- Ensure the sheet name is exactly "soft skills Students"
- Check that the sheet ID matches

### **Attendance Not Marking:**
- Verify the script has edit access to the Google Sheet
- Check the Logs in Google Apps Script for error messages
- Ensure date format is correct

## 📞 Support

If you encounter any issues:
1. Check the browser console for error messages
2. Check Google Apps Script execution logs
3. Verify your Google Sheet permissions
4. Ensure the deployment URL is correct in `.env`

The system is now fully configured for your specific Google Sheet!
