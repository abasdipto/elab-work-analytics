import { desktopCapturer, ipcMain, screen } from 'electron';
import { exec } from 'child_process';

let trackingInterval = null;
let activityInterval = null;
let uploadInterval = null;
let currentWorkerName = '';
let gitHubToken = '';
let gitHubRepo = ''; // Format: owner/repo
let activeWindowLog = {}; // Format: { "AppName - Title": seconds }
let lastActiveWindow = null;

// Helper to run PowerShell command and get active window details
function getActiveWindowWindows(callback) {
  const psScript = `
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class Win32 {
        [DllImport("user32.dll")]
        public static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")]
        public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);
        [DllImport("user32.dll")]
        public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
      }
    "@
    try {
      $hwnd = [Win32]::GetForegroundWindow()
      if ($hwnd -eq [IntPtr]::Zero) { return "{}" }
      $title = New-Object System.Text.StringBuilder 256
      [Win32]::GetWindowText($hwnd, $title, 256) | Out-Null
      $pid = 0
      [Win32]::GetWindowThreadProcessId($hwnd, [ref]$pid) | Out-Null
      if ($pid -gt 0) {
        $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($process) {
          $obj = [PSCustomObject]@{
            app = $process.ProcessName
            title = $title.ToString()
          }
          return $obj | ConvertTo-Json -Compress
        }
      }
    } catch {}
    return "{}"
  `;

  // Escape script for command line
  const escapedScript = psScript.replace(/\n/g, ' ').replace(/"/g, '\\"');
  
  exec(`powershell -NoProfile -Command "${escapedScript}"`, (err, stdout) => {
    if (err) {
      return callback(null);
    }
    try {
      const data = JSON.parse(stdout.trim());
      if (data && data.app) {
        callback(data);
      } else {
        callback(null);
      }
    } catch (e) {
      callback(null);
    }
  });
}

// Function to take screenshot and upload to GitHub
async function captureAndUploadScreen() {
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.min(width, 1280), // Resize to keep it small
        height: Math.min(height, 720)
      }
    });

    if (sources.length === 0) return;

    const thumbnail = sources[0].thumbnail;
    const imageBuffer = thumbnail.toJPEG(75); // 75% quality compression
    const base64Image = imageBuffer.toString('base64');

    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = new Date().toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
    const filePath = `screenshots/${currentWorkerName}/${dateStr}/${timeStr}.jpg`;

    // Upload to GitHub
    const url = `https://api.github.com/repos/${gitHubRepo}/contents/${filePath}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${gitHubToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'eLab-Work-Analytics-App'
      },
      body: JSON.stringify({
        message: `Upload screenshot for ${currentWorkerName} at ${timeStr}`,
        content: base64Image
      })
    });

    if (response.ok) {
      console.log(`Screenshot uploaded successfully: ${filePath}`);
    } else {
      const errText = await response.text();
      console.error(`Failed to upload screenshot:`, errText);
    }
  } catch (err) {
    console.error('Error in captureAndUploadScreen:', err);
  }
}

// Function to upload current activeWindowLog to GitHub and merge with existing daily log
async function uploadActivityLog() {
  const newLog = { ...activeWindowLog };
  if (Object.keys(newLog).length === 0) return;
  activeWindowLog = {}; // Reset immediately to prevent double logging on retry/success

  try {
    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filePath = `activity_logs/${currentWorkerName}/${dateStr}.json`;
    const url = `https://api.github.com/repos/${gitHubRepo}/contents/${filePath}`;

    let existingLog = {};
    let sha = null;

    // Get current log if exists
    const getResponse = await fetch(url, {
      headers: {
        'Authorization': `token ${gitHubToken}`,
        'User-Agent': 'eLab-Work-Analytics-App'
      }
    });

    if (getResponse.ok) {
      const fileData = await getResponse.json();
      sha = fileData.sha;
      const content = Buffer.from(fileData.content, 'base64').toString('utf8');
      try {
        existingLog = JSON.parse(content);
      } catch (e) {
        console.error('Failed to parse existing activity log:', e);
      }
    }

    // Merge logs
    const mergedLog = { ...existingLog };
    for (const key in newLog) {
      mergedLog[key] = (mergedLog[key] || 0) + newLog[key];
    }

    // Upload back to GitHub
    const base64Content = Buffer.from(JSON.stringify(mergedLog, null, 2)).toString('base64');
    const body = {
      message: `Sync activity log for ${currentWorkerName} on ${dateStr}`,
      content: base64Content
    };
    if (sha) {
      body.sha = sha;
    }

    const putResponse = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${gitHubToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'eLab-Work-Analytics-App'
      },
      body: JSON.stringify(body)
    });

    if (putResponse.ok) {
      console.log(`Activity log synced to GitHub successfully: ${filePath}`);
    } else {
      const errText = await putResponse.text();
      console.error(`Failed to upload activity log to GitHub:`, errText);
      // Merge back so we don't lose durations
      for (const key in newLog) {
        activeWindowLog[key] = (activeWindowLog[key] || 0) + newLog[key];
      }
    }
  } catch (err) {
    console.error('Error in uploadActivityLog:', err);
    // Merge back on network error
    for (const key in newLog) {
      activeWindowLog[key] = (activeWindowLog[key] || 0) + newLog[key];
    }
  }
}

// Start tracking timers
function startTracking(workerName, token, repo) {
  stopTracking();
  currentWorkerName = workerName;
  gitHubToken = token;
  gitHubRepo = repo;
  activeWindowLog = {};
  lastActiveWindow = null;

  console.log(`Starting tracker for ${workerName} on repository ${repo}`);

  // Take first screenshot immediately
  captureAndUploadScreen();

  // Take screenshot every 2 minutes
  trackingInterval = setInterval(captureAndUploadScreen, 2 * 60 * 1000);

  // Track active window every 5 seconds
  activityInterval = setInterval(() => {
    getActiveWindowWindows((data) => {
      if (data) {
        const key = `${data.app} - ${data.title}`;
        activeWindowLog[key] = (activeWindowLog[key] || 0) + 5;
        lastActiveWindow = { app: data.app, title: data.title };
      }
    });
  }, 5000);

  // Sync activity logs to GitHub every 5 minutes
  uploadInterval = setInterval(uploadActivityLog, 5 * 60 * 1000);
}

// Stop tracking timers and sync remaining activity log
function stopTracking() {
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }
  if (activityInterval) {
    clearInterval(activityInterval);
    activityInterval = null;
  }
  if (uploadInterval) {
    clearInterval(uploadInterval);
    uploadInterval = null;
  }
  
  // Trigger async upload of final remaining logs
  uploadActivityLog();
}

// IPC Handlers configuration
export function setupWorkerTrackerHandlers() {
  ipcMain.handle('start-tracker', (event, { workerName, token, repo }) => {
    startTracking(workerName, token, repo);
    return { success: true };
  });

  ipcMain.handle('stop-tracker', (event) => {
    stopTracking();
    return { success: true };
  });

  ipcMain.handle('get-current-activity', (event) => {
    return { lastActiveWindow };
  });

  ipcMain.handle('harvest-activity-log', (event) => {
    const log = { ...activeWindowLog };
    activeWindowLog = {};
    return log;
  });

  ipcMain.handle('minimize-window', (event) => {
    const { BrowserWindow } = require('electron');
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.minimize();
    }
    return { success: true };
  });
}
