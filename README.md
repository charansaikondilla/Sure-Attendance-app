# Sure Attendance App

A React-based student attendance tracking application that integrates with Google Sheets via Google Apps Script, deployed on Vercel.

## Features

- ✅ Upload attendance files (CSV, Excel, PDF)
- ✅ Automatic student matching with fuzzy search
- ✅ Individual attendance marking
- ✅ Google Sheets integration for data storage
- ✅ Responsive web interface
- ✅ Real-time attendance processing
- ✅ CORS handled via Vercel serverless functions

## Architecture

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Google Apps Script (deployed as Web App)
- **Hosting**: Vercel (with serverless functions for CORS proxy)
- **Data Storage**: Google Sheets

## Vercel Deployment Steps

### 1. Prepare Your Google Apps Script

Make sure your Google Apps Script is deployed and accessible. Update the URL in these files:
- `api/index.js`
- `api/students.js`
- `api/attendance.js`
- `api/individual.js`

Replace this URL with your deployed Google Apps Script Web App URL:
```
https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
```

### 2. Deploy to Vercel

#### Option A: GitHub Integration (Recommended)
1. Push your code to GitHub
2. Go to [Vercel](https://vercel.com)
3. Click "Import Project"
4. Connect your GitHub repository
5. Vercel will automatically detect the configuration and deploy

#### Option B: Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow the prompts and select your project settings
```

### 3. Configure Environment Variables (Optional)

In your Vercel project settings, you can add environment variables if needed, but the current setup uses relative URLs.

### 4. Update Google Apps Script CORS (Important!)

To allow requests from your Vercel domain, add this to your Google Apps Script:

```javascript
function doPost(e) {
  // Enable CORS for Vercel domains
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // Or specify your Vercel domain
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle preflight requests
  if (e.parameter.method === 'OPTIONS') {
    return ContentService
      .createTextOutput('')
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders(corsHeaders);
  }

  // Your existing code...
  // Make sure to include corsHeaders in your response
}
```

## Project Structure

```
sure-attendance-app/
├── api/                    # Vercel serverless functions (CORS proxy)
│   ├── index.js           # Test connection endpoint
│   ├── students.js        # Get students endpoint
│   ├── attendance.js      # Save attendance endpoint
│   └── individual.js      # Individual attendance endpoint
├── frontend/              # React frontend
│   ├── src/
│   │   ├── api.js         # API client (calls Vercel functions)
│   │   ├── App.jsx        # Main app component
│   │   └── ...
│   ├── package.json
│   └── vite.config.js
├── vercel.json            # Vercel configuration
└── README.md
```

## API Endpoints

The Vercel serverless functions proxy requests to your Google Apps Script:

- `GET /api` - Test connection and get student count
- `GET /api/students` - Get list of all students
- `POST /api/attendance` - Save bulk attendance
- `POST /api/individual` - Mark individual attendance

## Local Development

```bash
cd frontend
npm install
npm run dev
```

For local development, the app will use the Vercel functions when deployed, but you can test locally with the Vite dev server.

## Troubleshooting

### CORS Issues
- Make sure your Google Apps Script includes CORS headers
- Check that the script URL in the Vercel functions is correct
- Verify your Google Apps Script deployment settings

### Deployment Issues
- Check Vercel build logs for errors
- Ensure `vercel.json` is in the root directory
- Make sure all dependencies are listed in `package.json`

### Google Apps Script Issues
- Verify your script is deployed as a Web App
- Check that "Execute as" is set to "Me"
- Ensure "Who has access" is set to "Anyone"

## License

MIT
