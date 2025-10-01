import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    plugins: [react()],

    // Base path for Vercel deployment
    base: '/',

    server: {
      proxy: {
        '/api': {
          target: 'https://script.google.com/macros/s/AKfycbwbQ71g1cui8qYUbExczx9PSm5z6P5mhpoY2yCJq1q-YXhCh0jFz7-_j8afxdOUj77FAA/exec',
          changeOrigin: true,
          rewrite: (path) => {
            // Map endpoints to Google Apps Script actions
            const endpointMap = {
              '/api': '?action=testConnection',
              '/api/students': '?action=getStudents',
              '/api/attendance': '?action=saveAttendance',
              '/api/individual': '?action=saveAttendance'
            };

            // If it's a direct match, use the mapped action
            if (endpointMap[path]) {
              return endpointMap[path];
            }

            // For other paths, just remove /api prefix
            return path.replace(/^\/api/, '');
          },
          secure: true,
          timeout: 30000
        }
      }
    }
  }
})
