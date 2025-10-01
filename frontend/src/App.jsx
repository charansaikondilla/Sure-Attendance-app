import { useState, useEffect } from 'react'
import Papa from 'papaparse'
import * as pdfjsLib from 'pdfjs-dist'
import { submitAttendance, testConnection, getStudentList, markIndividualAttendance, saveAttendance } from './api.js'

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

function App() {
  const [attendanceData, setAttendanceData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [fileName, setFileName] = useState('')
  const [connectionStatus, setConnectionStatus] = useState(null)
  const [uploadedStudents, setUploadedStudents] = useState([])
  const [_comparisonResults, setComparisonResults] = useState(null)
  const [progress, setProgress] = useState(0)
  const [masterData, setMasterData] = useState(null)
  const [processingStats, setProcessingStats] = useState(null)
  const [selectedStudent, setSelectedStudent] = useState('')
  const [individualAttendanceStatus, setIndividualAttendanceStatus] = useState(null)

  // Load master data on app start
  useEffect(() => {
    loadMasterData()
  }, [])

  const loadMasterData = async () => {
    try {
      // Check cache first (1 hour expiry)
      const cached = localStorage.getItem('masterData')
      const cacheTime = localStorage.getItem('masterDataTime')

      if (cached && cacheTime && (Date.now() - parseInt(cacheTime)) < 3600000) {
        setMasterData(JSON.parse(cached))
        return
      }

      // Fetch from API if not cached or expired
      const result = await getStudentList()
      if (result && result.studentNames) {
        setMasterData(result.studentNames)
        localStorage.setItem('masterData', JSON.stringify(result.studentNames))
        localStorage.setItem('masterDataTime', Date.now().toString())
      }
    } catch (error) {
      console.error('Failed to load master data:', error)
      // Continue without master data - will use basic processing
    }
  }

  const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    setFileName(file.name)
    setLoading(true)

    try {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        // Handle PDF files
        await processPDFFile(file)
      } else {
        // Handle CSV/Excel files
        Papa.parse(file, {
          complete: (results) => {
            processUploadedFile(results.data)
          },
          header: false,
          skipEmptyLines: true
        })
      }
    } catch (error) {
      console.error('File processing error:', error)
      setLoading(false)
      alert('Error processing file. Please try again.')
    }
  }

  const processPDFFile = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

      let extractedText = ''

      // Extract text from all pages
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum)
        const textContent = await page.getTextContent()
        const pageText = textContent.items.map(item => item.str).join(' ')
        extractedText += pageText + '\n'
      }

      console.log('Extracted PDF text:', extractedText)

      // Process the extracted text to find student names
      const studentNames = extractStudentNamesFromText(extractedText)
      console.log('Extracted student names:', studentNames)

      // Process as if it were CSV data
      processUploadedFile([studentNames])

    } catch (error) {
      console.error('PDF processing error:', error)
      setLoading(false)
      alert('Error processing PDF file. Please ensure it contains readable text.')
    }
  }

  const extractStudentNamesFromText = (text) => {
    // Split by newlines and clean up
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)

    // Look for lines that might contain student names
    // This is a simple pattern - you might need to adjust based on your PDF format
    const studentNames = []

    lines.forEach(line => {
      // Remove extra spaces and common PDF artifacts
      const cleanLine = line.replace(/\s+/g, ' ').trim()

      // Skip very short lines or lines that look like headers/page numbers
      if (cleanLine.length > 3 && !/^\d+$/.test(cleanLine) && !cleanLine.toLowerCase().includes('page')) {
        // Check if line contains patterns that look like student names
        // Look for lines with names and group/course info
        if (cleanLine.includes('-G') || cleanLine.includes(' G') || cleanLine.includes('Group') ||
            /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(cleanLine)) {
          studentNames.push(cleanLine)
        }
      }
    })

    return studentNames
  }

  const processUploadedFile = (data) => {
    // Flatten all data and filter out empty values
    const rawStudents = data
      .flat()
      .filter(student => student && student.trim() !== '')
      .map(student => student.trim())

    // Remove duplicates
    const uniqueStudents = [...new Set(rawStudents)]

    // Store uploaded students for comparison (keep original format for display)
    setUploadedStudents(uniqueStudents)
    setLoading(false)
    setComparisonResults(null)
  }

  const compareAttendance = async () => {
    if (uploadedStudents.length === 0) {
      alert('Please upload an attendance file first.')
      return
    }

    console.log('Starting optimized attendance comparison with students:', uploadedStudents)
    setLoading(true)
    setProgress(0)

    const startTime = Date.now()

    try {
      let result

      // Use optimized local processing if master data is available
      if (masterData && masterData.length > 0) {
        console.log('Using optimized local processing with cached master data')
        result = await processLocallyOptimized(uploadedStudents, masterData)
        setProgress(100)
      } else {
        console.log('Master data not available, using API processing')
        result = await submitAttendance(uploadedStudents)
      }

      const processingTime = Date.now() - startTime
      result.processingTime = processingTime
      result.apiCallsUsed = masterData ? 0 : 1 // Track API usage

      console.log('Comparison result:', result)
      setComparisonResults(result)
      setAttendanceData(result)
      setProcessingStats({
        processingTime,
        apiCallsUsed: result.apiCallsUsed,
        accuracy: calculateAccuracy(result),
        totalProcessed: uploadedStudents.length
      })

    } catch (error) {
      console.error('Comparison error:', error)
      alert('Error comparing attendance. Please try again.')

      // Fallback to basic processing
      const fallbackResult = {
        present: uploadedStudents,
        absentees: [],
        unknowns: [],
        totalProcessed: uploadedStudents.length,
        error: 'Failed to connect to Google Sheets. Using basic processing.',
        success: false,
        processingTime: Date.now() - startTime,
        apiCallsUsed: 1
      }

      setAttendanceData(fallbackResult)
      setProcessingStats({
        processingTime: fallbackResult.processingTime,
        apiCallsUsed: 1,
        accuracy: 0,
        totalProcessed: uploadedStudents.length
      })
    } finally {
      setLoading(false)
      setProgress(0)
    }
  }

  // Optimized local processing function
  const processLocallyOptimized = async (attendanceList, masterList) => {
    return new Promise((resolve) => {
      setProgress(10)

      // Create hash map for O(1) lookups
      const masterMap = new Map()
      masterList.forEach((student, index) => {
        const normalized = normalizeStudentName(student)
        masterMap.set(normalized, { original: student, index })
        setProgress(20 + (index / masterList.length) * 20)
      })

      setProgress(40)

      const present = []
      const unknowns = []
      const processingDetails = []

      // Process attendance list with fuzzy matching
      attendanceList.forEach((student, index) => {
        const normalized = normalizeStudentName(student)
        const match = findBestMatch(normalized, masterMap)

        if (match.confidence > 0.8) { // High confidence match
          present.push(match.original)
          processingDetails.push({
            input: student,
            match: match.original,
            confidence: match.confidence,
            method: 'exact'
          })
        } else if (match.confidence > 0.6) { // Medium confidence - fuzzy match
          present.push(match.original)
          processingDetails.push({
            input: student,
            match: match.original,
            confidence: match.confidence,
            method: 'fuzzy'
          })
        } else { // No good match found
          unknowns.push(student)
          processingDetails.push({
            input: student,
            match: null,
            confidence: 0,
            method: 'unknown'
          })
        }

        setProgress(60 + (index / attendanceList.length) * 30)
      })

      setProgress(90)

      // Calculate absentees (students in master list but not in attendance)
      const presentNormalized = new Set(present.map(normalizeStudentName))
      const absentees = masterList.filter(student =>
        !presentNormalized.has(normalizeStudentName(student))
      )

      const result = {
        present,
        absentees,
        unknowns,
        totalProcessed: attendanceList.length,
        success: true,
        processingDetails,
        masterDataUsed: masterList.length,
        localProcessing: true
      }

      setProgress(100)
      resolve(result)
    })
  }

  // Helper function to normalize student names
  const normalizeStudentName = (name) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '') // Remove all spaces
      .replace(/[^a-z0-9]/g, '') // Remove special characters
  }

  // Fuzzy matching algorithm
  const findBestMatch = (input, masterMap) => {
    // Exact match first
    if (masterMap.has(input)) {
      return {
        original: masterMap.get(input).original,
        confidence: 1.0,
        method: 'exact'
      }
    }

    // Fuzzy matching with Levenshtein distance
    let bestMatch = { original: null, confidence: 0, method: 'fuzzy' }

    for (const [key, value] of masterMap) {
      const distance = levenshteinDistance(input, key)
      const maxLength = Math.max(input.length, key.length)
      const confidence = 1 - (distance / maxLength)

      if (confidence > bestMatch.confidence && confidence > 0.6) {
        bestMatch = {
          original: value.original,
          confidence,
          method: 'fuzzy'
        }
      }
    }

    return bestMatch
  }

  // Levenshtein distance calculation
  const levenshteinDistance = (str1, str2) => {
    const matrix = []

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          )
        }
      }
    }

    return matrix[str2.length][str1.length]
  }

  // Calculate accuracy of matching
  const calculateAccuracy = (result) => {
    if (!result.processingDetails) return 0

    const highConfidence = result.processingDetails.filter(d => d.confidence > 0.8).length
    return Math.round((highConfidence / result.totalProcessed) * 100)
  }

  const clearData = () => {
    setAttendanceData(null)
    setFileName('')
    // Clear file input
    const fileInput = document.getElementById('file-input')
    if (fileInput) fileInput.value = ''
  }

  const testGoogleSheetsConnection = async () => {
    setLoading(true)
    try {
      const result = await testConnection()
      setConnectionStatus(result)
      console.log('Connection test result:', result)
    } catch (error) {
      setConnectionStatus({ error: error.message })
      console.error('Connection test failed:', error)
    }
    setLoading(false)
  }

  const handleIndividualAttendance = async (status) => {
    if (!selectedStudent) {
      alert('Please select a student first.')
      return
    }

    setLoading(true)
    setIndividualAttendanceStatus(null)

    try {
      const result = await markIndividualAttendance(selectedStudent, status)
      setIndividualAttendanceStatus(result)

      if (result.success) {
        console.log('Individual attendance marked successfully:', result)
        // Clear selection after successful marking
        setSelectedStudent('')
      } else {
        console.error('Failed to mark individual attendance:', result.error)
      }
    } catch (error) {
      console.error('Error marking individual attendance:', error)
      setIndividualAttendanceStatus({
        success: false,
        error: error.message,
        student: selectedStudent,
        status: status
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>📊 Student Attendance Tracker</h1>
        <p>Upload your attendance file to track student presence</p>
      </header>

      <div className="main-content">
        {/* Upload Section */}
        <div className="card upload-section">
          <h3>📤 Upload Attendance File</h3>
          <input
            id="file-input"
            type="file"
            accept=".csv,.xlsx,.xls,.pdf"
            onChange={handleFileUpload}
            className="file-input"
            disabled={loading}
          />
          {fileName && (
            <p style={{ marginTop: '1rem', color: 'rgba(255, 255, 255, 0.8)' }}>
              Selected: {fileName}
            </p>
          )}

          {uploadedStudents.length > 0 && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px' }}>
              <p style={{ color: 'rgba(255, 255, 255, 0.9)', margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>
                📄 Uploaded Students ({uploadedStudents.length}):
              </p>
              <div style={{
                maxHeight: '100px',
                overflowY: 'auto',
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '0.5rem',
                borderRadius: '4px'
              }}>
                {uploadedStudents.map((student, index) => (
                  <div key={index} style={{
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontSize: '0.9rem',
                    padding: '0.25rem 0',
                    borderBottom: index < uploadedStudents.length - 1 ? '1px solid rgba(255, 255, 255, 0.1)' : 'none'
                  }}>
                    {index + 1}. {student}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button
              onClick={testGoogleSheetsConnection}
              className="btn"
              disabled={loading}
              style={{ background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)' }}
            >
              🔗 Test Google Sheets
            </button>

            {uploadedStudents.length > 0 && (
              <button
                onClick={compareAttendance}
                className="btn"
                disabled={loading}
                style={{ background: 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)' }}
              >
                🔍 Compare Attendance
              </button>
            )}

            {attendanceData && (
              <button onClick={clearData} className="btn">
                Clear Data
              </button>
            )}
          </div>
          {connectionStatus && (
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              borderRadius: '8px',
              background: connectionStatus.error ? 'rgba(244, 67, 54, 0.1)' : 'rgba(76, 175, 80, 0.1)',
              border: `1px solid ${connectionStatus.error ? '#f44336' : '#4CAF50'}`
            }}>
              <p style={{ color: connectionStatus.error ? '#f44336' : '#4CAF50', margin: '0 0 1rem 0', fontWeight: 'bold' }}>
                {connectionStatus.error ? `❌ ${connectionStatus.error}` : `✅ ${connectionStatus.message || 'Connected Successfully!'}`}
              </p>

              {connectionStatus.totalStudents && (
                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ color: 'rgba(255, 255, 255, 0.9)', margin: '0.5rem 0', fontWeight: 'bold' }}>
                    📊 Database Status:
                  </p>
                  <p style={{ color: 'rgba(255, 255, 255, 0.8)', margin: '0.25rem 0' }}>
                    • Total Students: {connectionStatus.totalStudents}
                  </p>
                  <p style={{ color: 'rgba(255, 255, 255, 0.8)', margin: '0.25rem 0' }}>
                    • Connection Type: {connectionStatus.connectionType === 'local' ? 'Local Database' : 'Google Sheets'}
                  </p>
                  <p style={{ color: 'rgba(255, 255, 255, 0.8)', margin: '0.25rem 0' }}>
                    • Sheet: {connectionStatus.sheetName}
                  </p>
                </div>
              )}

              {connectionStatus.studentNames && connectionStatus.studentNames.length > 0 && (
                <div>
                  <p style={{ color: 'rgba(255, 255, 255, 0.9)', margin: '0.5rem 0', fontWeight: 'bold' }}>
                    👥 Student Names from Google Sheets ({connectionStatus.studentNames.length}):
                  </p>
                  <div style={{
                    maxHeight: '200px',
                    overflowY: 'auto',
                    background: 'rgba(255, 255, 255, 0.05)',
                    padding: '0.5rem',
                    borderRadius: '4px',
                    marginTop: '0.5rem'
                  }}>
                    {connectionStatus.studentNames.map((studentName, index) => (
                      <div key={index} style={{
                        color: 'rgba(255, 255, 255, 0.8)',
                        fontSize: '0.9rem',
                        padding: '0.25rem 0',
                        borderBottom: index < connectionStatus.studentNames.length - 1 ? '1px solid rgba(255, 255, 255, 0.1)' : 'none'
                      }}>
                        {index + 1}. {studentName}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Individual Attendance Section */}
        <div className="card" style={{ marginTop: '2rem' }}>
          <h3>👤 Individual Attendance Marking</h3>
          <p style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '1rem' }}>
            Students can mark their own attendance for today
          </p>

          {/* Today's Date Display */}
          <div style={{
            background: 'rgba(33, 150, 243, 0.1)',
            border: '1px solid rgba(33, 150, 243, 0.3)',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem',
            textAlign: 'center'
          }}>
            <p style={{ color: 'rgba(33, 150, 243, 0.9)', margin: '0', fontWeight: 'bold' }}>
              📅 Today's Date: {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>

          {/* Student Selection */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              color: 'rgba(255, 255, 255, 0.9)',
              marginBottom: '0.5rem',
              fontWeight: 'bold'
            }}>
              Select Your Name:
            </label>
            <select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                color: 'white',
                fontSize: '1rem'
              }}
              disabled={loading || !masterData}
            >
              <option value="">-- Choose your name --</option>
              {masterData && masterData.map((student, index) => (
                <option key={index} value={student}>
                  {student}
                </option>
              ))}
            </select>
          </div>

          {/* Attendance Buttons */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <button
              onClick={() => handleIndividualAttendance('Present')}
              className="btn"
              disabled={loading || !selectedStudent}
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
                padding: '1rem'
              }}
            >
              ✅ Mark Present
            </button>

            <button
              onClick={() => handleIndividualAttendance('Absent')}
              className="btn"
              disabled={loading || !selectedStudent}
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)',
                padding: '1rem'
              }}
            >
              ❌ Mark Absent
            </button>
          </div>

          {/* Status Display */}
          {individualAttendanceStatus && (
            <div style={{
              padding: '1rem',
              borderRadius: '8px',
              background: individualAttendanceStatus.success
                ? 'rgba(76, 175, 80, 0.1)'
                : 'rgba(244, 67, 54, 0.1)',
              border: `1px solid ${individualAttendanceStatus.success ? '#4CAF50' : '#f44336'}`
            }}>
              <p style={{
                color: individualAttendanceStatus.success ? '#4CAF50' : '#f44336',
                margin: '0 0 0.5rem 0',
                fontWeight: 'bold'
              }}>
                {individualAttendanceStatus.success ? '✅ Success!' : '❌ Error'}
              </p>

              {individualAttendanceStatus.success ? (
                <div>
                  <p style={{ color: 'rgba(255, 255, 255, 0.9)', margin: '0.25rem 0' }}>
                    • Student: <strong>{individualAttendanceStatus.student}</strong>
                  </p>
                  <p style={{ color: 'rgba(255, 255, 255, 0.9)', margin: '0.25rem 0' }}>
                    • Status: <strong>{individualAttendanceStatus.status}</strong>
                  </p>
                  <p style={{ color: 'rgba(255, 255, 255, 0.9)', margin: '0.25rem 0' }}>
                    • Date: <strong>{individualAttendanceStatus.date}</strong>
                  </p>
                  <p style={{ color: 'rgba(255, 255, 255, 0.8)', margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
                    {individualAttendanceStatus.message}
                  </p>
                </div>
              ) : (
                <p style={{ color: 'rgba(244, 67, 54, 0.9)', margin: '0' }}>
                  {individualAttendanceStatus.error}
                </p>
              )}
            </div>
          )}

          {/* Instructions */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            padding: '1rem',
            marginTop: '1rem'
          }}>
            <h4 style={{ color: 'rgba(255, 255, 255, 0.9)', margin: '0 0 0.5rem 0' }}>
              📋 Instructions:
            </h4>
            <ul style={{ color: 'rgba(255, 255, 255, 0.8)', margin: '0', paddingLeft: '1.5rem' }}>
              <li style={{ marginBottom: '0.25rem' }}>Select your name from the dropdown</li>
              <li style={{ marginBottom: '0.25rem' }}>Click "Mark Present" if you're attending today</li>
              <li style={{ marginBottom: '0.25rem' }}>Click "Mark Absent" if you're not attending today</li>
              <li>Your attendance will be recorded in the Google Sheet immediately</li>
            </ul>
          </div>
        </div>

        {/* Stats Section */}
        {attendanceData && (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-number">{attendanceData.present?.length || 0}</div>
              <div className="stat-label">Present Today</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{attendanceData.absentees?.length || 0}</div>
              <div className="stat-label">Absent Today</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{attendanceData.unknowns?.length || 0}</div>
              <div className="stat-label">Unknown Status</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{attendanceData.totalProcessed || 0}</div>
              <div className="stat-label">Total Students</div>
            </div>
          </div>
        )}

        {/* Results Section */}
        <div className="card results-section">
          <h3>📊 Attendance Results</h3>

          {loading && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div className="loader"></div>
              <p style={{ marginTop: '1rem', color: 'rgba(255, 255, 255, 0.8)' }}>
                Processing attendance data...
              </p>

              {/* Progress Bar */}
              <div style={{ marginTop: '1.5rem', width: '100%', maxWidth: '300px', margin: '1.5rem auto 0' }}>
                <div style={{
                  width: '100%',
                  height: '8px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${progress}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #2196F3 0%, #21CBF3 100%)',
                    borderRadius: '4px',
                    transition: 'width 0.3s ease-in-out'
                  }}></div>
                </div>
                <p style={{
                  marginTop: '0.5rem',
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontSize: '0.9rem'
                }}>
                  {progress}% Complete
                </p>
              </div>

              {/* Processing Stats */}
              {processingStats && (
                <div style={{
                  marginTop: '1rem',
                  padding: '1rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px',
                  fontSize: '0.9rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'rgba(255, 255, 255, 0.8)' }}>Processing Time:</span>
                    <span style={{ color: 'rgba(255, 255, 255, 0.9)' }}>{processingStats.processingTime}ms</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'rgba(255, 255, 255, 0.8)' }}>API Calls Used:</span>
                    <span style={{ color: processingStats.apiCallsUsed === 0 ? '#4CAF50' : '#FF9800' }}>
                      {processingStats.apiCallsUsed}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(255, 255, 255, 0.8)' }}>Match Accuracy:</span>
                    <span style={{ color: processingStats.accuracy > 80 ? '#4CAF50' : '#FF9800' }}>
                      {processingStats.accuracy}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {attendanceData && !loading && (
            <div>
              {/* Copy-friendly Attended/Not Attended Lists */}
              <div className="copy-lists" style={{ marginBottom: '2rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                {/* Attended Students List */}
                <div style={{ flex: 1, minWidth: 250 }}>
                  <h4 style={{ marginBottom: '0.5rem' }}>✅ Attended Students List</h4>
                  <textarea
                    readOnly
                    value={attendanceData.present && attendanceData.present.length > 0
                      ? attendanceData.present.map((student, idx) => `${idx + 1}. ${student}`).join('\n')
                      : 'No attended students.'}
                    style={{ width: '100%', minHeight: 120, fontSize: '1rem', padding: '0.5rem', borderRadius: 6, marginBottom: 8 }}
                  />
                  <button
                    className="btn"
                    style={{ fontSize: '0.95rem', padding: '0.5rem 1.2rem', marginBottom: 8 }}
                    onClick={() => {
                      if (attendanceData.present && attendanceData.present.length > 0) {
                        navigator.clipboard.writeText(
                          attendanceData.present.map((student, idx) => `${idx + 1}. ${student}`).join('\n')
                        );
                        alert('Attended students list copied!');
                      }
                    }}
                    disabled={!attendanceData.present || attendanceData.present.length === 0}
                  >
                    Copy Attended List
                  </button>
                </div>
                {/* Not Attended Students List */}
                <div style={{ flex: 1, minWidth: 250 }}>
                  <h4 style={{ marginBottom: '0.5rem' }}>❌ Not Attended Students List</h4>
                  <textarea
                    readOnly
                    value={attendanceData.absentees && attendanceData.absentees.length > 0
                      ? attendanceData.absentees.map((student, idx) => `${idx + 1}. ${student}`).join('\n')
                      : 'No not attended students.'}
                    style={{ width: '100%', minHeight: 120, fontSize: '1rem', padding: '0.5rem', borderRadius: 6, marginBottom: 8 }}
                  />
                  <button
                    className="btn"
                    style={{ fontSize: '0.95rem', padding: '0.5rem 1.2rem', marginBottom: 8 }}
                    onClick={() => {
                      if (attendanceData.absentees && attendanceData.absentees.length > 0) {
                        navigator.clipboard.writeText(
                          attendanceData.absentees.map((student, idx) => `${idx + 1}. ${student}`).join('\n')
                        );
                        alert('Not attended students list copied!');
                      }
                    }}
                    disabled={!attendanceData.absentees || attendanceData.absentees.length === 0}
                  >
                    Copy Not Attended List
                  </button>
                </div>
              </div>
              {/* Save to Google Sheets Button */}
              <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
                <button
                  onClick={async () => {
                    if (!uploadedStudents.length) {
                      alert('No attendance data to save. Please upload and compare first.');
                      return;
                    }

                    console.log('Starting save to Google Sheets...');
                    console.log('API URL:', import.meta.env.VITE_API_URL);
                    console.log('Students to save:', uploadedStudents);

                    setLoading(true);
                    try {
                      // Use the new saveAttendance helper to POST with action=saveAttendance
                      const today = new Date().toISOString().split('T')[0];
                      const result = await saveAttendance(uploadedStudents, today);
                      console.log('Save result:', result);

                      if (result && result.success !== false) {
                        alert(`✅ Attendance saved successfully!\nPresent: ${result.present?.length || 0}\nAbsent: ${result.absentees?.length || 0}\nDate: ${today}`);
                      } else {
                        alert(`⚠️ Partial success or warning:\n${result?.error || 'Unknown response'}\nPresent: ${result?.present?.length || 0}\nAbsent: ${result?.absentees?.length || 0}`);
                      }
                    } catch (error) {
                      console.error('Detailed error saving to Google Sheets:', error);
                      console.error('Error message:', error.message);
                      console.error('Error stack:', error.stack);

                      let errorMessage = '❌ Failed to save attendance to Google Sheets.\n\n';

                      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                        errorMessage += 'Network Error: Check your internet connection and Google Apps Script deployment.';
                      } else if (error.message.includes('CORS')) {
                        errorMessage += 'CORS Error: Google Apps Script may not be properly deployed or accessible.';
                      } else if (error.message.includes('404') || error.message.includes('Not Found')) {
                        errorMessage += '404 Error: Google Apps Script URL may be incorrect or expired.';
                      } else if (error.message.includes('500')) {
                        errorMessage += 'Server Error: Check your Google Apps Script code for issues.';
                      } else {
                        errorMessage += `Error: ${error.message}`;
                      }

                      errorMessage += '\n\nCheck browser console (F12) for detailed error logs.';
                      alert(errorMessage);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="btn"
                  disabled={loading}
                  style={{
                    background: 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)',
                    padding: '1rem 2rem',
                    fontSize: '1.1rem',
                    fontWeight: 'bold'
                  }}
                >
                  💾 Save to Google Sheets
                </button>
                <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                  Save the attendance results to Google Sheets for today's date
                </p>
              </div>

              {/* Database Info */}
              <div className="student-list" style={{ marginBottom: '2rem', background: 'rgba(255, 255, 255, 0.05)' }}>
                <h4>📚 Student Database Status</h4>
                <p style={{ color: 'rgba(255, 255, 255, 0.8)', margin: '0.5rem 0' }}>
                  Total students in database: {attendanceData.present?.length + attendanceData.absentees?.length || 'Unknown'}
                </p>
                <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem', margin: '0.5rem 0' }}>
                  Students processed: {attendanceData.totalProcessed || 0}
                </p>
              </div>

              {/* Present Students */}
              {attendanceData.present?.length > 0 && (
                <div className="student-list">
                  <h4>✅ Present Students ({attendanceData.present.length})</h4>
                  <div className="student-grid">
                    {attendanceData.present.map((student, index) => (
                      <div key={index} className="student-item" style={{ background: 'rgba(76, 175, 80, 0.2)', border: '1px solid rgba(76, 175, 80, 0.3)' }}>
                        {student}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Absent Students */}
              {attendanceData.absentees?.length > 0 && (
                <div className="student-list">
                  <h4>❌ Absent Students ({attendanceData.absentees.length})</h4>
                  <div className="student-grid">
                    {attendanceData.absentees.map((student, index) => (
                      <div key={index} className="student-item" style={{ background: 'rgba(244, 67, 54, 0.2)', border: '1px solid rgba(244, 67, 54, 0.3)' }}>
                        {student}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unknown Students (filtered) */}
              {attendanceData.unknowns?.length > 0 && (() => {
                // Filter out entries that are just numbers, times, or too short
                const filteredUnknowns = attendanceData.unknowns.filter(student => {
                  const s = student.trim();
                  // Remove if only numbers or comma/period/colon separated numbers
                  if (/^\d+[.,:]?\d*$/.test(s)) return false;
                  // Remove if looks like a time (e.g. 8:30, 12:01:22, 8:03:18 PM)
                  if (/^\d{1,2}:\d{1,2}(:\d{1,2})?(\s?[AP]M)?$/i.test(s)) return false;
                  // Remove if looks like a duration (e.g. 1 hr 7 min 11s, 56 min 8s)
                  if (/^(\d+\s*hr)?\s*\d+\s*min(\s*\d+s)?$/i.test(s)) return false;
                  if (/^\d+\s*min(\s*\d+s)?$/i.test(s)) return false;
                  // Remove if too short
                  if (s.length < 3) return false;
                  // Remove if starts with 'time:' or similar
                  if (/^time[:：]/i.test(s)) return false;
                  // Remove if matches known meeting export headers
                  const headers = [
                    'SNo', 'Participant Name', 'Attendance Started at', 'Joined at(beta)',
                    'Attendance Stopped at', 'Attended Duration', 'Meeting code', 'Not captured', 'MERGED AUDIO'
                  ];
                  if (headers.some(h => s.toLowerCase() === h.toLowerCase())) return false;
                  // Remove if looks like a meeting code (e.g. fjn-uckn-rju)
                  if (/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i.test(s)) return false;
                  return true;
                });
                if (filteredUnknowns.length === 0) return null;
                return (
                  <div className="student-list">
                    <h4>❓ Unknown Students ({filteredUnknowns.length})</h4>
                    <div className="student-grid">
                      {filteredUnknowns.map((student, index) => (
                        <div key={index} className="student-item" style={{ background: 'rgba(255, 152, 0, 0.2)', border: '1px solid rgba(255, 152, 0, 0.3)' }}>
                          {student}
                        </div>
                      ))}
                    </div>
                    <p style={{ color: 'rgba(255, 152, 0, 0.8)', fontSize: '0.9rem', marginTop: '1rem' }}>
                      These students are not found in the database and will be marked as unknown.
                    </p>
                  </div>
                );
              })()}

              {/* Error Display */}
              {attendanceData.error && (
                <div className="student-list" style={{ background: 'rgba(244, 67, 54, 0.1)', border: '1px solid rgba(244, 67, 54, 0.3)' }}>
                  <h4>⚠️ Connection Status</h4>
                  <p style={{ color: 'rgba(244, 67, 54, 0.8)', margin: '0.5rem 0' }}>
                    {attendanceData.error}
                  </p>
                  <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem', margin: '0.5rem 0' }}>
                    Using local processing mode. Deploy Google Apps Script for full functionality.
                  </p>
                </div>
              )}
            </div>
          )}

          {!attendanceData && !loading && (
            <div className="empty-state">
              <h3>📋 No Data Available</h3>
              <p>Upload a CSV file containing student names to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
