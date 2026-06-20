import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { LayoutDashboard, Users, Activity, CheckCircle, FileText, UserPlus, Settings, Hash, Bell, Plus, Clock, Trash2, Globe, Camera, Menu, X, RefreshCw, BarChart2 } from 'lucide-react';
import { format, subDays, parseISO, isToday, isYesterday, isThisWeek, isThisMonth, subMonths, isSameDay } from 'date-fns';
import './index.css';

// Safe string conversion - prevents crashes from non-string types
const safeStr = (val) => (val == null ? '' : String(val));
const safeLower = (val) => safeStr(val).toLowerCase().trim();

// Safe date parse - handles ISO format AND Google Sheets local timestamp format (M/D/YYYY H:MM:SS)
const safeParse = (dateStr) => {
  try {
    if (!dateStr) return null;
    const s = String(dateStr).trim();
    // Try ISO first (e.g. 2026-06-07T10:30:00.000Z or 2026-06-07T10:30:00)
    const iso = parseISO(s);
    if (!isNaN(iso.getTime())) return iso;
    // Try Google Sheets format: M/D/YYYY H:MM:SS or M/D/YYYY H:MM:SS AM/PM
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
    return null;
  } catch { return null; }
};

// Safe JSON parse - prevents crashes
const safeJsonParse = (str) => {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
};

// Convert image file to compressed base64 data URL (max 150x150)
const fileToBase64 = (file, maxSize = 150) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
      else { w = Math.round(w * maxSize / h); h = maxSize; }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = reject;
    img.src = e.target.result;
  };
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

// Error Boundary to catch rendering crashes
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('🔴 ErrorBoundary caught:', error, errorInfo);
    this.setState({ errorInfo });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ background: '#0f172a', color: '#fff', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '2rem', maxWidth: '600px', width: '100%' }}>
            <h2 style={{ color: '#ef4444', marginBottom: '1rem' }}>⚠️ Something went wrong</h2>
            <p style={{ color: '#fca5a5', marginBottom: '1rem', fontSize: '0.9rem' }}>{this.state.error?.message}</p>
            <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', fontSize: '0.75rem', color: '#94a3b8', overflowX: 'auto', maxHeight: '200px' }}>
              {this.state.error?.stack}
            </pre>
            <button onClick={() => this.setState({ hasError: false, error: null })} style={{ marginTop: '1rem', padding: '0.5rem 1.5rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Default mock data with Unsplash avatars
const initialMockUsers = [
  { id: '1', name: 'Ullash', role: 'Researcher', avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=150&q=80', active: true },
  { id: '2', name: 'Jubayer', role: 'Marketer', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80', active: true },
  { id: '3', name: 'Robin', role: 'Designer', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80', active: true },
  { id: '4', name: 'Dipto', role: 'Uploader', avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80', active: true },
];

// Reusable Avatar component with fallback to initials
function Avatar({ user, size = 32 }) {
  const [imgFailed, setImgFailed] = useState(false);
  
  if (!user) return null;
  
  const initials = user.name ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '?';
  
  let bg = 'linear-gradient(135deg, #6366f1, #4f46e5)';
  if (user.role === 'Researcher') bg = 'linear-gradient(135deg, #60a5fa, #2563eb)';
  else if (user.role === 'Marketer') bg = 'linear-gradient(135deg, #c084fc, #9333ea)';
  else if (user.role === 'Designer') bg = 'linear-gradient(135deg, #fb923c, #ea580c)';
  else if (user.role === 'Uploader') bg = 'linear-gradient(135deg, #22d3ee, #0891b2)';
  
  if (user.avatarUrl && !imgFailed) {
    return (
      <img 
        src={user.avatarUrl} 
        alt={user.name} 
        onError={() => setImgFailed(true)}
        style={{ 
          width: `${size}px`, 
          height: `${size}px`, 
          borderRadius: '50%', 
          objectFit: 'cover',
          border: '1.5px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
          display: 'block',
          flexShrink: 0
        }}
      />
    );
  }
  
  return (
    <div style={{
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      background: bg,
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 600,
      fontSize: size > 40 ? '1.1rem' : size < 24 ? '0.65rem' : '0.8rem',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      flexShrink: 0
    }}>
      {initials}
    </div>
  );
}

const formatPoints = (val) => {
  if (val === 0) return '0';
  if (val % 1 === 0) return val.toString();
  return val.toFixed(2);
};

const MOTIVATIONAL_QUOTES = [
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Productivity is never an accident. It is always the result of a commitment to excellence, intelligent planning, and focused effort.", author: "Paul J. Meyer" },
  { text: "It is not that I am so smart, it is just that I stay with problems longer.", author: "Albert Einstein" },
  { text: "Your talent determines what you can do. Your motivation determines how much you are willing to do. Your attitude determines how well you do it.", author: "Lou Holtz" },
  { text: "Quality is not an act, it is a habit.", author: "Aristotle" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" }
];

const APP_COLORS = {
  chrome: '#3b82f6',
  firefox: '#fb923c',
  msedge: '#22d3ee',
  code: '#a5b4fc', // VS Code
  cmd: '#10b981',
  powershell: '#10b981',
  discord: '#818cf8',
  slack: '#ec4899',
  spotify: '#1db954',
  excel: '#107c41',
  winword: '#2b579a',
  explorer: '#f59e0b',
  electron: '#61dafb'
};

const getAppColor = (appName) => {
  const lower = appName.toLowerCase();
  for (const key of Object.keys(APP_COLORS)) {
    if (lower.includes(key)) return APP_COLORS[key];
  }
  let hash = 0;
  for (let i = 0; i < appName.length; i++) {
    hash = appName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
};

// Component to dynamically fetch and display raw images from Github (handles private repos via headers)
function GithubImage({ downloadUrl, token, alt, style, className }) {
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!downloadUrl) return;
    let isMounted = true;
    setLoading(true);
    setError(false);

    // Convert raw.githubusercontent.com to api.github.com for private repo CORS support
    let fetchUrl = downloadUrl;
    const headers = {};
    if (downloadUrl.includes('raw.githubusercontent.com')) {
      try {
        const parts = downloadUrl.replace('https://raw.githubusercontent.com/', '').split('/');
        const owner = parts[0];
        const repo = parts[1];
        let branchIndex = 2;
        if (parts[2] === 'refs' && parts[3] === 'heads') {
          branchIndex = 4;
        }
        const path = parts.slice(branchIndex + 1).join('/');
        fetchUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
        headers['Accept'] = 'application/vnd.github.v3.raw';
      } catch (e) {
        // fallback
      }
    }

    const fetchImage = async () => {
      try {
        if (token) {
          headers['Authorization'] = `token ${token}`;
        }
        const res = await fetch(fetchUrl, { headers });
        if (!res.ok) throw new Error("Failed to load image");
        const blob = await res.blob();
        if (isMounted) {
          const url = URL.createObjectURL(blob);
          setSrc(url);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load github image:", err);
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      }
    };

    fetchImage();

    return () => {
      isMounted = false;
      if (src) {
        URL.revokeObjectURL(src);
      }
    };
  }, [downloadUrl, token]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', ...style }} className={className}>
        <div className="spinner" style={{ width: '20px', height: '20px' }}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5', borderRadius: '8px', fontSize: '0.8rem', padding: '10px', textAlign: 'center', ...style }} className={className}>
        Failed to load
      </div>
    );
  }

  return <img src={src} alt={alt} style={style} className={className} />;
}

function App() {
  const isElectron = typeof window !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron');

  // Auto-detect GitHub repo from GitHub Pages URL (e.g. abasdipto.github.io/elab-work-analytics)
  const autoGithubRepo = (() => {
    if (typeof window === 'undefined') return '';
    const host = window.location.hostname;
    const path = window.location.pathname; // e.g. /elab-work-analytics/
    if (host.endsWith('.github.io')) {
      const user = host.replace('.github.io', '');
      const repo = path.split('/').filter(Boolean)[0] || '';
      if (user && repo) return `${user}/${repo}`;
    }
    return '';
  })();
  
  // App modes: 'select' (Electron selection), 'dashboard_auth' (Passcode screen), 'dashboard' (Dashboard view), 'worker_portal' (Worker view)
  const [appMode, setAppMode] = useState(() => {
    if (isElectron) {
      return sessionStorage.getItem('elab_app_mode') || 'select';
    }
    return sessionStorage.getItem('elab_authenticated') === 'true' ? 'dashboard' : 'dashboard_auth';
  });

  const [userRole, setUserRole] = useState(() => {
    return sessionStorage.getItem('elab_user_role') || null;
  });

  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState(false);

  const [data, setData] = useState([]);
  const [users, setUsers] = useState(() => {
    const saved = localStorage.getItem('elab_users');
    return saved ? JSON.parse(saved) : initialMockUsers;
  });
  const [feed, setFeed] = useState([]);
  const [salesFeed, setSalesFeed] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  
  const isUserMarketer = (userName) => {
    const u = users.find(usr => safeLower(usr.name) === safeLower(userName));
    return u?.role === 'Marketer';
  };
  
  // Set default tab to 'global'
  const [activeTabId, setActiveTabId] = useState('global');
  const [timeFilter, setTimeFilter] = useState('Today'); // 'Today', 'Yesterday', 'This Week'
  
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState('config'); // 'config' or 'evaluation'
  const [evalUser, setEvalUser] = useState('');
  const [evalPeriod, setEvalPeriod] = useState('2026');
  const [evalTeamwork, setEvalTeamwork] = useState(4);
  const [evalRules, setEvalRules] = useState(4);
  const [evalHelping, setEvalHelping] = useState(4);
  const [evalNotes, setEvalNotes] = useState('');
  const [evalSubmitting, setEvalSubmitting] = useState(false);
  const [evalMsg, setEvalMsg] = useState('');

  const DEFAULT_API_URL = 'https://script.google.com/macros/s/AKfycbyOpsMJHJdyFkHUbUuXW5QmG_TOes47pnM2Vk5yw58pPHzY_6XEVLqSE9sPucz3nCcm/exec';
  const [apiUrl, setApiUrl] = useState(() => localStorage.getItem('elab_api_url') || DEFAULT_API_URL);
  const [salesApiUrl, setSalesApiUrl] = useState(() => localStorage.getItem('elab_sales_api_url') || '');
  const [useMock, setUseMock] = useState(() => {
    const savedMock = localStorage.getItem('elab_use_mock');
    if (savedMock === 'true') return true;
    if (savedMock === 'false') return false;
    return false; // Default to live data if not configured
  });

  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('Researcher');
  const [newUserAvatar, setNewUserAvatar] = useState('');
  const [newUserSheetUrl, setNewUserSheetUrl] = useState('');
  const [newUserTelegramId, setNewUserTelegramId] = useState('');
  const [onboardStatus, setOnboardStatus] = useState([]);
  const fileInputRef = useRef(null);
  const editFileInputRef = useRef(null);
  const [editingPhotoUserId, setEditingPhotoUserId] = useState(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileFeedOpen, setMobileFeedOpen] = useState(false);
  const hasSyncedUsersRef = useRef(false);
  const [countdown, setCountdown] = useState(30);

  // Direct Sheets API config (replaces Apps Script)
  const [saPath, setSaPath] = useState(() => localStorage.getItem('elab_sa_path') || '');
  const [masterDbId, setMasterDbId] = useState(() => localStorage.getItem('elab_master_db_id') || '1xJyuu0HcY235mmOX8J860A5fCQS11KQDk4SMuLS4N0');
  // Sales sheet (direct SA — revenue/profit hidden)
  const [salesSheetId, setSalesSheetId] = useState(() => localStorage.getItem('elab_sales_sheet_id') || '1WjYBpkxwOEKbLXppXnK211cEyc-UgsmXfB8Avu7zEUo');
  const [salesData, setSalesData] = useState([]);

  // Multi-researcher sheet config
  const [researcherSheets, setResearcherSheets] = useState(() => {
    try { return JSON.parse(localStorage.getItem('elab_researcher_sheets') || '[]'); } catch { return []; }
  });
  const [designerName, setDesignerName] = useState(() => localStorage.getItem('elab_designer_name') || 'Robin');
  const [uploaderName, setUploaderName] = useState(() => localStorage.getItem('elab_uploader_name') || 'Dipto');
  const [syncingSheets, setSyncingSheets] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [autoSyncMinutes, setAutoSyncMinutes] = useState(() => Number(localStorage.getItem('elab_auto_sync_minutes') || 5));
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);

  // Worker Tracking states
  const [selectedWorkerId, setSelectedWorkerId] = useState(() => localStorage.getItem('elab_worker_id') || '');
  const [isTracking, setIsTracking] = useState(() => localStorage.getItem('elab_is_tracking') === 'true');
  const [trackingSeconds, setTrackingSeconds] = useState(() => Number(localStorage.getItem('elab_tracking_seconds') || 0));
  const [currentQuote, setCurrentQuote] = useState(() => {
    const saved = localStorage.getItem('elab_current_quote');
    return saved ? JSON.parse(saved) : MOTIVATIONAL_QUOTES[0];
  });
  const [lastTrackedWindow, setLastTrackedWindow] = useState('');
  
  // GitHub config states
  const [githubToken, setGithubToken] = useState(() => localStorage.getItem('elab_github_token') || '');
  const [githubRepo, setGithubRepo] = useState(() => localStorage.getItem('elab_github_repo') || '');

  // Admin Dashboard tracking visualization states
  const [trackerDate, setTrackerDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [screenshots, setScreenshots] = useState([]);
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [activeScreenshot, setActiveScreenshot] = useState(null);
  const [activityLogs, setActivityLogs] = useState([]);
  const [githubActivityLog, setGithubActivityLog] = useState(null);
  const [loadingActivity, setLoadingActivity] = useState(false);

  // 1. Timer ticking effect
  useEffect(() => {
    let interval = null;
    if (isTracking) {
      interval = setInterval(() => {
        setTrackingSeconds(prev => {
          const next = prev + 1;
          localStorage.setItem('elab_tracking_seconds', String(next));
          return next;
        });
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isTracking]);

  // 2. Real-time active window title checks in UI
  useEffect(() => {
    if (!isTracking || !isElectron) return;
    
    const statusInterval = setInterval(async () => {
      try {
        const { lastActiveWindow } = await window.require('electron').ipcRenderer.invoke('get-current-activity');
        if (lastActiveWindow) {
          setLastTrackedWindow(`${lastActiveWindow.app} - ${lastActiveWindow.title}`);
        }
      } catch (err) {
        // ignore
      }
    }, 5000);
    
    return () => clearInterval(statusInterval);
  }, [isTracking]);

  // 3. Fetch screenshots and activity logs when selected user or date changes
  const activeUser = activeTabId === 'global' ? null : users.find(u => u.id === activeTabId);
  useEffect(() => {
    if (activeUser && activeTabId !== 'global' && githubToken && githubRepo) {
      fetchScreenshots(activeUser.name, trackerDate);
      fetchGithubActivity(activeUser.name, trackerDate);
    }
  }, [activeTabId, trackerDate, githubToken, githubRepo]);

  const fetchGithubActivity = async (workerName, dateStr) => {
    if (!githubToken || !githubRepo || !workerName) return;
    setLoadingActivity(true);
    setGithubActivityLog(null);
    try {
      const filePath = `activity_logs/${workerName}/${dateStr}.json`;
      const url = `https://api.github.com/repos/${githubRepo}/contents/${filePath}`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3.raw',
          'User-Agent': 'eLab-Work-Analytics-App'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setGithubActivityLog(data);
      } else {
        setGithubActivityLog(null);
      }
    } catch (err) {
      console.error("Failed to fetch activity log from GitHub:", err);
      setGithubActivityLog(null);
    } finally {
      setLoadingActivity(false);
    }
  };

  const fetchScreenshots = async (workerName, dateStr) => {
    if (!githubToken || !githubRepo || !workerName) return;
    setScreenshotLoading(true);
    try {
      const url = `https://api.github.com/repos/${githubRepo}/contents/screenshots/${workerName}/${dateStr}`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': `application/vnd.github.v3+json`
        }
      });
      if (res.ok) {
        const files = await res.json();
        if (Array.isArray(files)) {
          const mapped = files
            .filter(f => f.name.endsWith('.jpg') || f.name.endsWith('.png'))
            .map(f => {
              const timePart = f.name.replace('.jpg', '').replace('.png', '').replace(/-/g, ':');
              return {
                name: f.name,
                timeStr: timePart,
                path: f.path,
                downloadUrl: f.download_url
              };
            });
          setScreenshots(mapped);
        } else {
          setScreenshots([]);
        }
      } else {
        setScreenshots([]);
      }
    } catch (err) {
      console.error("Error fetching screenshots:", err);
      setScreenshots([]);
    } finally {
      setScreenshotLoading(false);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('elab_api_url');
    const oldPlaceholder = 'https://script.google.com/macros/s/AKfycbzQpsKJUdyFc4UbUUW85Mg_TOexl7gsM2VkSyq58pKzY_aJEVLqSEGsqFuzr3nCcn/exec';
    if (!saved || saved === oldPlaceholder) {
      localStorage.setItem('elab_api_url', DEFAULT_API_URL);
      setApiUrl(DEFAULT_API_URL);
      localStorage.setItem('elab_use_mock', 'false');
      setUseMock(false);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('elab_users', JSON.stringify(users));
    localStorage.setItem('elab_api_url', apiUrl);
    localStorage.setItem('elab_sales_api_url', salesApiUrl);
    localStorage.setItem('elab_use_mock', String(useMock));
  }, [users, apiUrl, salesApiUrl, useMock]);

  useEffect(() => {
    if (users.length > 0 && !evalUser) {
      setEvalUser(users[0].name);
    }
  }, [users, evalUser]);

  const fetchData = async () => {
    if (useMock || (!apiUrl && !(isElectron && saPath && masterDbId))) {
      // Mock chart
      const mockChartData = Array.from({ length: 7 }).map((_, i) => ({
        date: format(subDays(new Date(), 6 - i), 'MMM dd'),
        addedNames: Math.floor(Math.random() * 20) + 50,
        marketedLinks: Math.floor(Math.random() * 15) + 30,
      }));
      setData(mockChartData);
      
      // Mock feed spanning today and yesterday
      setFeed([
        { id: 1, type: 'Name Added', user: 'Demo Researcher', time: new Date().toISOString(), detail: 'Added a new name' },
        { id: 2, type: 'Marketed', user: 'Demo Marketer', time: new Date().toISOString(), detail: 'Done' },
        { id: 3, type: 'Name Added', user: 'Demo Researcher', time: subDays(new Date(), 1).toISOString(), detail: 'Added yesterday' },
        { id: 4, type: 'Marketed', user: 'Demo Marketer', time: subDays(new Date(), 1).toISOString(), detail: 'Done yesterday' },
        { id: 5, type: 'Marketed', user: 'Demo Marketer', time: subDays(new Date(), 3).toISOString(), detail: 'Done last week' }
      ]);

      setEvaluations([
        { id: 101, user: 'Demo Researcher', evaluator: 'Admin', period: '2026', teamwork: 4.5, rules: 4.2, helping: 4.8, notes: 'Very helpful team member, always follows the office rules.', time: new Date().toISOString() },
        { id: 102, user: 'Demo Marketer', evaluator: 'Admin', period: '2026', teamwork: 4.0, rules: 4.5, helping: 4.0, notes: 'Good marketing work, communicates well with team members.', time: new Date().toISOString() }
      ]);
      setActivityLogs([
        {
          id: 991,
          time: new Date().toISOString(),
          type: 'ActivityLog',
          user: 'Demo Researcher',
          detail: JSON.stringify({
            "VS Code": 7200,
            "Google Chrome": 3600,
            "Slack": 1800,
            "Zoom": 1200
          })
        },
        {
          id: 992,
          time: new Date().toISOString(),
          type: 'ActivityLog',
          user: 'Demo Marketer',
          detail: JSON.stringify({
            "Google Chrome": 9000,
            "WhatsApp": 2400,
            "Excel": 1800
          })
        }
      ]);
      return;
    }

    setLoading(true);
    try {
      let rawData = [];
      let rawSales = [];

      // Prefer direct SA read when running in Electron with SA configured
      if (isElectron && saPath && masterDbId) {
        const { ipcRenderer } = window.require('electron');
        const result = await ipcRenderer.invoke('analytics-get-data', { saPath, masterDbId });
        if (result.success) {
          rawData = result.data;
        } else {
          console.error('analytics-get-data error:', result.error);
        }
      } else if (githubRepo || autoGithubRepo) {
        // GitHub Actions synced JSON — primary web source
        try {
          const repo = githubRepo || autoGithubRepo;
          const base = `https://raw.githubusercontent.com/${repo}/main/public`;
          const cacheBust = `?t=${Date.now()}`;
          const masterRes = await fetch(`${base}/master-data.json${cacheBust}`);
          if (masterRes.ok) rawData = await masterRes.json();
        } catch (e) { console.error('GitHub master-data fetch error:', e); }
      } else if (apiUrl) {
        // Legacy: Apps Script web app endpoint
        const cacheBust = `?t=${Date.now()}`;
        const masterRes = await fetch(apiUrl + cacheBust);
        rawData = await masterRes.json();
      }

      // Sales data: prefer direct SA → GitHub JSON → Apps Script URL
      if (isElectron && saPath && salesSheetId) {
        const { ipcRenderer } = window.require('electron');
        const sr = await ipcRenderer.invoke('analytics-get-sales-data', { saPath, salesSheetId });
        if (sr.success) {
          rawSales = sr.data;
          setSalesData(sr.data);
        } else {
          console.error('analytics-get-sales-data error:', sr.error);
        }
      } else if (githubRepo || autoGithubRepo) {
        // GitHub Actions synced JSON (no revenue/profit)
        try {
          const repo = githubRepo || autoGithubRepo;
          const base = `https://raw.githubusercontent.com/${repo}/main/public`;
          const cacheBust = `?t=${Date.now()}`;
          const salesRes = await fetch(`${base}/sales-data.json${cacheBust}`);
          if (salesRes.ok) {
            rawSales = await salesRes.json();
            setSalesData(rawSales);
          }
        } catch (e) { console.error('GitHub sales-data fetch error:', e); }
      } else if (salesApiUrl) {
        const cacheBust = `?t=${Date.now()}`;
        const salesRes = await fetch(salesApiUrl + cacheBust);
        rawSales = await salesRes.json();
      }
      setSalesFeed(rawSales);
      
      const formattedFeed = rawData.map((row, index) => ({
        id: index,
        time: row['Timestamp'],
        type: row['Action Type'],
        user: row['User'],
        detail: row['Detail'],
        sheetUrl: row['Sheet URL']
      })).filter(f => f.time) // Ensure valid time
       .sort((a, b) => {
         const tA = safeParse(a.time)?.getTime() || 0;
         const tB = safeParse(b.time)?.getTime() || 0;
         return tB - tA; // Newest first
       });

      const allEvaluations = formattedFeed
        .filter(f => safeLower(f.type).trim() === 'evaluation')
        .map(e => {
          const parsed = safeJsonParse(e.detail) || {};
          return {
            ...e,
            evaluator: parsed.evaluator || 'Admin',
            period: parsed.period || 'All',
            teamwork: Number(parsed.teamwork) || 0,
            rules: Number(parsed.rules) || 0,
            helping: Number(parsed.helping) || 0,
            notes: parsed.notes || ''
          };
        });
      setEvaluations(allEvaluations);

      // Find latest MemberUpdate to sync users list from cloud
      const memberUpdateRecord = formattedFeed.find(f => safeLower(f.type).trim() === 'memberupdate');
      if (memberUpdateRecord) {
        const parsedUsers = safeJsonParse(memberUpdateRecord.detail);
        if (Array.isArray(parsedUsers) && parsedUsers.length > 0) {
          setUsers(parsedUsers);
          localStorage.setItem('elab_users', JSON.stringify(parsedUsers));
        }
      } else {
        // If there's no MemberUpdate record on the cloud yet, and we are running inside the desktop app (Electron),
        // let's upload our current local users list (with photos) to the cloud so all other devices can sync!
        const isElectron = navigator.userAgent.toLowerCase().includes('electron');
        if (isElectron && users.length > 0 && !hasSyncedUsersRef.current) {
          hasSyncedUsersRef.current = true;
          console.log("No cloud users list found. Uploading local users list from desktop...");
          saveUsersToCloud(users);
        }
      }

      // Find latest ConfigUpdate to sync settings from cloud
      const configUpdateRecord = formattedFeed.find(f => safeLower(f.type).trim() === 'configupdate');
      if (configUpdateRecord) {
        const parsedConfig = safeJsonParse(configUpdateRecord.detail);
        if (parsedConfig) {
          if (parsedConfig.githubToken) {
            setGithubToken(parsedConfig.githubToken);
            localStorage.setItem('elab_github_token', parsedConfig.githubToken);
          }
          if (parsedConfig.githubRepo) {
            setGithubRepo(parsedConfig.githubRepo);
            localStorage.setItem('elab_github_repo', parsedConfig.githubRepo);
          }
        }
      }

      const normalFeed = formattedFeed.filter(f => {
        const type = safeLower(f.type).trim();
        return type !== 'evaluation' && type !== 'memberupdate' && type !== 'configupdate' && type !== 'activitylog';
      });
      setFeed(normalFeed);

      const logs = formattedFeed.filter(f => safeLower(f.type).trim() === 'activitylog');
      setActivityLogs(logs);

      const chartData = Array.from({ length: 7 }).map((_, i) => {
        const date = subDays(new Date(), 6 - i);
        const dayData = normalFeed.filter(f => { const d = safeParse(f.time); return d && isSameDay(d, date); });
        const daySales = rawSales.filter(s => { const d = safeParse(s.date); return d && isSameDay(d, date); });
        let addedNames = 0;
        let marketedLinks = 0;
        let totalDesigns = 0;
        let totalUploads = 0;
        let totalSales = 0;

        if (activeTabId === 'global') {
          addedNames = dayData.filter(d => safeLower(d.type).trim() === 'name added' && !isUserMarketer(d.user)).length;
          marketedLinks = dayData.filter(d => safeLower(d.type).trim() === 'marketed' || (safeLower(d.type).trim() === 'name added' && isUserMarketer(d.user))).length;
          totalDesigns = dayData.filter(d => safeLower(d.type).includes('design')).length;
          totalUploads = dayData.filter(d => safeLower(d.type).includes('upload')).length;
          totalSales = daySales.length;
        } else {
          const activeUser = users.find(u => u.id === activeTabId);
          if (activeUser) {
            addedNames = dayData.filter(d => safeLower(d.user) === safeLower(activeUser.name) && safeLower(d.type).trim() === 'name added' && activeUser.role !== 'Marketer').length;
            marketedLinks = dayData.filter(d => safeLower(d.user) === safeLower(activeUser.name) && (safeLower(d.type).trim() === 'marketed' || (safeLower(d.type).trim() === 'name added' && activeUser.role === 'Marketer'))).length;
            totalDesigns = dayData.filter(d => safeLower(d.user) === safeLower(activeUser.name) && safeLower(d.type).includes('design')).length;
            totalUploads = dayData.filter(d => safeLower(d.user) === safeLower(activeUser.name) && safeLower(d.type).includes('upload')).length;
            
            const userSchools = normalFeed
              .filter(d => safeLower(d.user) === safeLower(activeUser.name))
              .map(d => safeLower(d.detail).trim())
              .filter(Boolean);
              
            totalSales = daySales.filter(s => {
              const saleSchool = safeLower(s.school || s.schoolName).trim();
              return userSchools.some(userSchool => 
                userSchool && saleSchool && (saleSchool.includes(userSchool) || userSchool.includes(saleSchool))
              );
            }).length;
          }
        }

        return {
          date: format(date, 'MMM dd'),
          addedNames,
          marketedLinks,
          totalDesigns,
          totalUploads,
          totalSales
        };
      });
      setData(chartData);
      
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    setCountdown(30); // Reset countdown on manual switch
  }, [useMock, apiUrl, salesApiUrl, activeTabId, saPath, masterDbId]);

  useEffect(() => {
    if (useMock || (!apiUrl && !(isElectron && saPath && masterDbId))) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchData();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [useMock, apiUrl, salesApiUrl, activeTabId, saPath, masterDbId]);

  // ── Auto-sync: auto-detect researcher sheets from Drive, then start sync ──────
  useEffect(() => {
    if (!isElectron || !saPath || !masterDbId) return;
    const { ipcRenderer } = window.require('electron');

    const researcherNames = users.filter(u => u.role === 'Researcher').map(u => u.name);
    const _designerName   = users.find(u => u.role === 'Designer')?.name  || designerName;
    const _uploaderName   = users.find(u => u.role === 'Uploader')?.name  || uploaderName;

    if (!researcherNames.length) return;

    ipcRenderer.invoke('analytics-auto-detect-sheets', { saPath, researcherNames })
      .then(res => {
        if (!res?.success) return;
        const configs = Object.entries(res.matches).map(([name, { sheetId }]) => ({
          sheetId, ownerName: name, designerName: _designerName, uploaderName: _uploaderName,
        }));
        if (!configs.length) return;
        return ipcRenderer.invoke('analytics-configure-auto-sync', {
          saPath, masterDbId, configs, intervalMinutes: autoSyncMinutes,
        });
      })
      .then(r => { if (r?.success) setAutoSyncEnabled(true); })
      .catch(console.error);
  }, [saPath, masterDbId, users, designerName, uploaderName, autoSyncMinutes]);

  // ── Auto-sync: listen for background sync results emitted by main process ────
  useEffect(() => {
    if (!isElectron) return;
    const { ipcRenderer } = window.require('electron');
    const handler = (_event, result) => {
      if (result.success) {
        const parts = [];
        if (result.added)      parts.push(`+${result.added} names`);
        if (result.designDone) parts.push(`+${result.designDone} designs`);
        if (result.uploadDone) parts.push(`+${result.uploadDone} uploads`);
        const summary = parts.length ? parts.join(', ') : 'up-to-date';
        setSyncMsg(`🔄 Auto-synced (${new Date(result.time || Date.now()).toLocaleTimeString()}): ${summary}`);
        fetchData();
      } else {
        setSyncMsg(`⚠️ Auto-sync error: ${result.error || 'Unknown'}`);
      }
    };
    ipcRenderer.on('analytics-sync-result', handler);
    return () => ipcRenderer.removeListener('analytics-sync-result', handler);
  }, []);

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await fileToBase64(file);
      setNewUserAvatar(base64);
    } catch (err) {
      console.error('Failed to process image:', err);
    }
    e.target.value = ''; // Reset input so same file can be re-selected
  };

  const saveUsersToCloud = async (updatedUsers) => {
    if (useMock) return;
    try {
      if (isElectron && saPath && masterDbId) {
        const { ipcRenderer } = window.require('electron');
        await ipcRenderer.invoke('analytics-post-row', {
          saPath, masterDbId,
          userName: 'System', actionType: 'MemberUpdate',
          detail: JSON.stringify(updatedUsers), sheetUrl: ''
        });
        return;
      }
      if (!apiUrl) return;
      const payload = {
        type: 'MemberUpdate',
        user: 'System',
        time: new Date().toISOString(),
        detail: JSON.stringify(updatedUsers),
        sheetUrl: ''
      };
      await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error('Failed to sync users list to cloud:', err);
    }
  };

  const saveConfigToCloud = async (token, repo) => {
    localStorage.setItem('elab_github_token', token);
    localStorage.setItem('elab_github_repo', repo);
    setGithubToken(token);
    setGithubRepo(repo);

    if (useMock) return;
    try {
      if (isElectron && saPath && masterDbId) {
        const { ipcRenderer } = window.require('electron');
        await ipcRenderer.invoke('analytics-post-row', {
          saPath, masterDbId,
          userName: 'System', actionType: 'ConfigUpdate',
          detail: JSON.stringify({ githubToken: token, githubRepo: repo }), sheetUrl: ''
        });
        return;
      }
      if (!apiUrl) return;
      const payload = {
        type: 'ConfigUpdate',
        user: 'System',
        time: new Date().toISOString(),
        detail: JSON.stringify({ githubToken: token, githubRepo: repo }),
        sheetUrl: ''
      };
      await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error('Failed to sync config to cloud:', err);
    }
  };

  // Sync researcher sheets → Master DB (replaces Apps Script trigger)
  const handleSyncSheets = async () => {
    if (!isElectron || !saPath || !masterDbId) return;
    setSyncingSheets(true);
    setSyncMsg('');
    try {
      const { ipcRenderer } = window.require('electron');
      const researcherNames = users.filter(u => u.role === 'Researcher').map(u => u.name);
      const _designerName  = users.find(u => u.role === 'Designer')?.name  || designerName;
      const _uploaderName  = users.find(u => u.role === 'Uploader')?.name  || uploaderName;
      setSyncMsg('🔍 Detecting sheets...');
      const detected = await ipcRenderer.invoke('analytics-auto-detect-sheets', { saPath, researcherNames });
      if (!detected.success) { setSyncMsg(`❌ Drive error: ${detected.error}`); return; }
      const configs = Object.entries(detected.matches).map(([name, { sheetId }]) => ({
        sheetId, ownerName: name, designerName: _designerName, uploaderName: _uploaderName,
      }));
      if (!configs.length) { setSyncMsg('⚠️ No matching sheets found in Drive. Make sure sheets are shared with the service account and named after each researcher.'); return; }
      const result = await ipcRenderer.invoke('analytics-sync-sheets', { saPath, masterDbId, configs });
      if (result.success) {
        setSyncMsg(`✅ Synced: ${result.added} names, ${result.designDone} designs, ${result.uploadDone} uploads`);
        fetchData();
      } else {
        setSyncMsg(`❌ Sync failed: ${result.error}`);
      }
    } catch (err) {
      setSyncMsg(`❌ Error: ${err.message}`);
    } finally {
      setSyncingSheets(false);
    }
  };

  const handleEditPhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !editingPhotoUserId) return;
    try {
      const base64 = await fileToBase64(file);
      const updated = users.map(u => u.id === editingPhotoUserId ? { ...u, avatarUrl: base64 } : u);
      setUsers(updated);
      await saveUsersToCloud(updated);
    } catch (err) {
      console.error('Failed to process image:', err);
    }
    setEditingPhotoUserId(null);
    e.target.value = '';
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUserName) return;
    const name = newUserName.trim();
    const newUser = { id: Date.now().toString(), name, role: newUserRole, avatarUrl: newUserAvatar, active: true };
    const updated = [...users, newUser];
    setUsers(updated);
    setNewUserName('');
    setNewUserAvatar('');
    setNewUserSheetUrl('');
    setNewUserTelegramId('');
    setOnboardStatus(['⏳ Adding member…']);
    await saveUsersToCloud(updated);

    // Ecosystem onboarding
    if (isElectron && (newUserRole === 'Researcher' || newUserRole === 'Marketer')) {
      try {
        const { ipcRenderer } = window.require('electron');
        const res = await ipcRenderer.invoke('onboard-member', {
          name,
          role: newUserRole,
          sheetUrl: newUserSheetUrl || undefined,
          telegramId: newUserTelegramId || undefined,
          saPath,
          masterDbId,
        });
        setOnboardStatus(res.results?.length ? res.results : [res.success ? '✅ Done' : `⚠️ ${res.error}`]);
      } catch (err) {
        setOnboardStatus([`⚠️ Onboarding error: ${err.message}`]);
      }
    } else {
      setOnboardStatus([]);
    }
  };

  const handleDeleteUser = async (id) => {
    const updated = users.filter(u => u.id !== id);
    setUsers(updated);
    if (activeTabId === id) setActiveTabId('global');
    await saveUsersToCloud(updated);
  };

  const submitEvaluation = async (userName, teamwork, rules, helping, period, notes) => {
    if (useMock) {
      const mockEval = {
        id: Date.now(),
        time: new Date().toISOString(),
        type: 'Evaluation',
        user: userName,
        evaluator: 'Admin',
        period,
        teamwork: Number(teamwork),
        rules: Number(rules),
        helping: Number(helping),
        notes
      };
      setEvaluations(prev => [mockEval, ...prev]);
      return true;
    }
    
    const detail = JSON.stringify({
      evaluator: 'Admin',
      period,
      teamwork: Number(teamwork),
      rules: Number(rules),
      helping: Number(helping),
      notes
    });

    // Direct SA path (preferred in Electron)
    if (isElectron && saPath && masterDbId) {
      try {
        const { ipcRenderer } = window.require('electron');
        const result = await ipcRenderer.invoke('analytics-post-row', {
          saPath, masterDbId,
          userName, actionType: 'Evaluation', detail, sheetUrl: 'Manual Entry'
        });
        if (result.success) {
          setTimeout(fetchData, 1000);
          return true;
        }
        return false;
      } catch (err) {
        console.error("Error submitting evaluation via IPC:", err);
        return false;
      }
    }

    if (!apiUrl) return false;

    const payload = {
      time: new Date().toISOString(),
      type: 'Evaluation',
      user: userName,
      detail,
      sheetUrl: 'Manual Entry'
    };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        setTimeout(fetchData, 1000);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error submitting evaluation:", error);
      return false;
    }
  };

  const calculateLeaderboard = () => {
    return users.map(user => {
      let basePoints = 0;
      let bonusPoints = 0;
      
      // 1. Get user actions from the filtered feed (respects the active timeFilter)
      const userActions = filteredFeed.filter(f => safeLower(f.user) === safeLower(user.name));
      
      let researchCount = 0;
      let marketingCount = 0;
      let designCount = 0;
      let uploadCount = 0;
      
      userActions.forEach(action => {
        const type = safeLower(action.type).trim();
        const isMarketing = type === 'marketed' || (user.role === 'Marketer' && type === 'name added');
        const isResearch = type === 'name added' && user.role !== 'Marketer';
        
        if (isResearch) {
          basePoints += 2;
          researchCount++;
        } else if (isMarketing) {
          basePoints += 2.5;
          marketingCount++;
        } else if (type.includes('design')) {
          basePoints += 0.84;
          designCount++;
        } else if (type.includes('upload')) {
          basePoints += 0.84;
          uploadCount++;
        }
      });
      
      // 2. Designer Daily Target Bonus (+10 points for each day with >= 120 designs)
      let designerDailyBonus = 0;
      if (user.role === 'Designer') {
        const designsByDay = {};
        userActions.forEach(action => {
          const type = safeLower(action.type);
          if (type.includes('design') && action.time) {
            try {
              const parsedDate = safeParse(action.time);
              if (parsedDate) {
                const dateStr = format(parsedDate, 'yyyy-MM-dd');
                designsByDay[dateStr] = (designsByDay[dateStr] || 0) + 1;
              }
            } catch (e) {
              console.error("Error formatting date:", e);
            }
          }
        });
        
        Object.keys(designsByDay).forEach(dateStr => {
          if (designsByDay[dateStr] >= 120) {
            designerDailyBonus += 10;
          }
        });
        bonusPoints += designerDailyBonus;
      }

      // 3. Sales bonus (+2 points per sale for researcher and marketer)
      let salesCount = 0;
      if (user.role === 'Researcher' || user.role === 'Marketer') {
         const userSchools = feed
          .filter(f => {
            if (safeLower(f.user) !== safeLower(user.name)) return false;
            const t = safeLower(f.type).trim();
            if (user.role === 'Researcher') return t === 'name added';
            if (user.role === 'Marketer') return t === 'marketed';
            return false;
          })
          .map(f => safeLower(f.detail).trim())
          .filter(Boolean);
          
        const userSales = filteredSalesFeed.filter(s => {
          const saleSchool = safeLower(s.school || s.schoolName).trim();
          return userSchools.some(userSchool =>
            userSchool && saleSchool && (saleSchool.includes(userSchool) || userSchool.includes(saleSchool))
          );
        });
        
        salesCount = userSales.length;
        bonusPoints += salesCount * 2;
      }
      
      const points = basePoints + bonusPoints;
      
      return {
        ...user,
        points,
        basePoints,
        bonusPoints,
        breakdown: {
          research: researchCount,
          marketing: marketingCount,
          design: designCount,
          upload: uploadCount,
          sales: salesCount,
          dailyBonus: designerDailyBonus
        }
      };
    }).sort((a, b) => b.points - a.points);
  };


  // --- FILTER LOGIC ---
  // If global, we filter feed based on timeFilter to calculate stats
  const getFilteredFeed = () => {
    return feed.filter(item => {
      if (!item.time) return false;
      try {
        const date = safeParse(item.time);
        if (!date) return timeFilter === 'All Time';
        if (timeFilter === 'Today') return isToday(date);
        if (timeFilter === 'Yesterday') return isYesterday(date);
        if (timeFilter === 'This Week') return isThisWeek(date);
        if (timeFilter === 'This Month') return isThisMonth(date);
        
        if (timeFilter === 'Last Month') {
          const lastMonthDate = subMonths(new Date(), 1);
          return date.getMonth() === lastMonthDate.getMonth() && date.getFullYear() === lastMonthDate.getFullYear();
        }
        
        if (timeFilter === 'All Time') return true;
        return true;
      } catch (e) {
        console.warn('Date filter error:', e, item.time);
        return timeFilter === 'All Time';
      }
    });
  };

  const filteredFeed = activeTabId === 'global' 
    ? getFilteredFeed() 
    : getFilteredFeed().filter(f => safeLower(f.user) === safeLower(activeUser?.name));
  
  // Calculate Global Stats
  const globalNamesAdded = filteredFeed.filter(f => safeLower(f.type).trim() === 'name added' && !isUserMarketer(f.user)).length;
  const globalMarketed = filteredFeed.filter(f => safeLower(f.type).trim() === 'marketed' || (safeLower(f.type).trim() === 'name added' && isUserMarketer(f.user))).length;
  const globalDesigns = filteredFeed.filter(f => safeLower(f.type).includes('design')).length;
  const globalUploads = filteredFeed.filter(f => safeLower(f.type).includes('upload')).length;
  
  const getFilteredSales = () => {
    return salesFeed.filter(item => {
      if (!item.date) return false;
      try {
        const date = safeParse(item.date);
        if (!date) return timeFilter === 'All Time';
        if (timeFilter === 'Today') return isToday(date);
        if (timeFilter === 'Yesterday') return isYesterday(date);
        if (timeFilter === 'This Week') return isThisWeek(date);
        if (timeFilter === 'This Month') return isThisMonth(date);
        if (timeFilter === 'Last Month') {
          const lastMonthDate = subMonths(new Date(), 1);
          return date.getMonth() === lastMonthDate.getMonth() && date.getFullYear() === lastMonthDate.getFullYear();
        }
        return true;
      } catch (e) {
        console.warn('Sales date filter error:', e, item.date);
        return timeFilter === 'All Time';
      }
    });
  };
  
  const filteredSalesFeed = getFilteredSales();
  let globalTotalSales = filteredSalesFeed.length;
  let userTotalSales = 0;
  
  if (activeTabId !== 'global' && activeUser) {
    try {
      const userAssociatedSchools = feed
        .filter(f => safeLower(f.user) === safeLower(activeUser.name) && (safeLower(f.type).trim() === 'name added' || safeLower(f.type).trim() === 'marketed'))
        .map(f => safeLower(f.detail).trim())
        .filter(Boolean);
        
      userTotalSales = filteredSalesFeed.filter(s => {
        const saleSchool = safeLower(s.school || s.schoolName).trim();
        return userAssociatedSchools.some(userSchool =>
          userSchool && saleSchool && (saleSchool.includes(userSchool) || userSchool.includes(saleSchool))
        );
      }).length;
    } catch (e) {
      console.error('Error calculating userTotalSales:', e);
      userTotalSales = 0;
    }
  }

  // --- Passcode handler (supports admin + viewer) ---
  const handlePasscodeSubmit = (e) => {
    e.preventDefault();
    if (passcode === 'admin2026') {
      setUserRole('admin');
      setAppMode('dashboard');
      sessionStorage.setItem('elab_authenticated', 'true');
      sessionStorage.setItem('elab_user_role', 'admin');
      sessionStorage.setItem('elab_app_mode', 'dashboard');
      setPasscodeError(false);
    } else if (passcode === 'elab2026') {
      setUserRole('viewer');
      setAppMode('dashboard');
      sessionStorage.setItem('elab_authenticated', 'true');
      sessionStorage.setItem('elab_user_role', 'viewer');
      sessionStorage.setItem('elab_app_mode', 'dashboard');
      setPasscodeError(false);
    } else {
      setPasscodeError(true);
      setPasscode('');
    }
  };

  // --- Worker tracking handlers ---
  const handleStartTracking = async () => {
    if (!isElectron) return;
    const selectedWorker = users.find(u => u.id === selectedWorkerId);
    if (!selectedWorker) return;
    try {
      await window.require('electron').ipcRenderer.invoke('start-tracker', {
        workerName: selectedWorker.name,
        token: githubToken,
        repo: githubRepo
      });
      setIsTracking(true);
      localStorage.setItem('elab_is_tracking', 'true');
      // Minimize window
      await window.require('electron').ipcRenderer.invoke('minimize-window');
    } catch (err) {
      console.error('Failed to start tracker:', err);
    }
  };

  const handleStopTracking = async () => {
    if (!isElectron) return;
    try {
      await window.require('electron').ipcRenderer.invoke('stop-tracker');
      setIsTracking(false);
      localStorage.setItem('elab_is_tracking', 'false');
    } catch (err) {
      console.error('Failed to stop tracker:', err);
    }
  };

  const handleWorkerLogin = () => {
    if (!selectedWorkerId) return;
    const quote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
    setCurrentQuote(quote);
    localStorage.setItem('elab_current_quote', JSON.stringify(quote));
    setTrackingSeconds(0);
    localStorage.setItem('elab_tracking_seconds', '0');
    setAppMode('worker_portal');
    sessionStorage.setItem('elab_app_mode', 'worker_portal');
  };

  const handleWorkerLogout = async () => {
    if (isTracking) {
      await handleStopTracking();
    }
    setAppMode('select');
    sessionStorage.setItem('elab_app_mode', 'select');
    setSelectedWorkerId('');
    localStorage.removeItem('elab_worker_id');
    setTrackingSeconds(0);
    localStorage.setItem('elab_tracking_seconds', '0');
  };

  const formatTimer = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  // ==========================================
  // RENDER: Mode Selection Screen (Electron only)
  // ==========================================
  if (appMode === 'select') {
    return (
      <div className="select-mode-container">
        <div className="select-mode-content">
          <div className="select-mode-header">
            <h1 className="select-mode-title">
              <span className="pulse-dot"></span>
              eLab Work Analytics
            </h1>
            <p style={{ color: '#94a3b8', marginTop: '0.75rem', fontSize: '1rem' }}>Choose how you'd like to use the app today</p>
          </div>

          <div className="select-mode-cards">
            {/* Dashboard Card */}
            <div className="glass-panel mode-card" onClick={() => { setAppMode('dashboard_auth'); sessionStorage.setItem('elab_app_mode', 'dashboard_auth'); }}>
              <div className="mode-icon-wrapper blue">
                <LayoutDashboard size={32} />
              </div>
              <h3 className="mode-title">View Dashboard</h3>
              <p className="mode-desc">Access team analytics, leaderboards, performance reports and live activity feeds.</p>
              <button className="mode-btn blue">Open Dashboard →</button>
            </div>

            {/* Worker Card */}
            <div className="glass-panel mode-card">
              <div className="mode-icon-wrapper green">
                <Clock size={32} />
              </div>
              <h3 className="mode-title">Start Working</h3>
              <p className="mode-desc">Clock in, track your work hours, and let the system capture your activity automatically.</p>
              <div style={{ width: '100%' }}>
                <select
                  value={selectedWorkerId}
                  onChange={(e) => { setSelectedWorkerId(e.target.value); localStorage.setItem('elab_worker_id', e.target.value); }}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '8px',
                    border: '1px solid var(--glass-border)',
                    background: '#0f172a',
                    color: '#fff',
                    marginBottom: '0.75rem',
                    fontSize: '0.9rem'
                  }}
                >
                  <option value="">-- Select your name --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
                <button
                  className="mode-btn green"
                  disabled={!selectedWorkerId}
                  style={{ opacity: selectedWorkerId ? 1 : 0.5, cursor: selectedWorkerId ? 'pointer' : 'not-allowed' }}
                  onClick={handleWorkerLogin}
                >
                  Clock In →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: Passcode Auth Screen
  // ==========================================
  if (appMode === 'dashboard_auth') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#0f172a',
        color: '#fff',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{
          background: 'rgba(30, 41, 59, 0.7)',
          border: '1.5px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '2.5rem',
          width: '100%',
          maxWidth: '400px',
          textAlign: 'center',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
          backdropFilter: 'blur(12px)'
        }}>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', color: '#a5b4fc', fontWeight: 600 }}>eLab Analytics</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '2rem' }}>Enter passcode to access the workspace dashboard.</p>
          
          <form onSubmit={handlePasscodeSubmit}>
            <input 
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter Passcode"
              autoFocus
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: passcodeError ? '1.5px solid #ef4444' : '1.5px solid rgba(255, 255, 255, 0.1)',
                background: '#090d16',
                color: '#fff',
                fontSize: '1.1rem',
                textAlign: 'center',
                letterSpacing: '0.1rem',
                marginBottom: '1rem',
                outline: 'none',
                transition: 'all 0.2s'
              }}
            />
            {passcodeError && (
              <p style={{ color: '#fca5a5', fontSize: '0.85rem', marginBottom: '1rem' }}>Incorrect passcode. Please try again.</p>
            )}
            <button 
              type="submit" 
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
              }}
              onMouseEnter={(e) => e.target.style.opacity = '0.9'}
              onMouseLeave={(e) => e.target.style.opacity = '1'}
            >
              Access Dashboard
            </button>
          </form>

          {isElectron && (
            <button
              onClick={() => { setAppMode('select'); sessionStorage.setItem('elab_app_mode', 'select'); setPasscodeError(false); setPasscode(''); }}
              style={{ marginTop: '1.5rem', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              ← Back to Mode Selection
            </button>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: Worker Portal
  // ==========================================
  if (appMode === 'worker_portal') {
    const selectedWorker = users.find(u => u.id === selectedWorkerId);
    return (
      <div className="worker-portal-container">
        <div className="glass-panel worker-portal-card">
          <div className="worker-portal-header">
            <div className="worker-title-area">
              {selectedWorker && <Avatar user={selectedWorker} size={48} />}
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>
                  Welcome, {selectedWorker?.name || 'Worker'}!
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {selectedWorker?.role} • {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </div>
          </div>

          {/* Quote of the Day */}
          <div className="quote-card">
            <div style={{ position: 'absolute', top: '-12px', left: '16px', background: 'var(--primary)', color: '#fff', padding: '2px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>💡 Quote of the Day</div>
            <p className="quote-text">"{currentQuote.text}"</p>
            <p className="quote-author">— {currentQuote.author}</p>
          </div>

          {/* Timer */}
          <div className="timer-section">
            <div className={`timer-digits ${isTracking ? 'active' : ''}`}>
              {formatTimer(trackingSeconds)}
            </div>
            <div className={`timer-status ${isTracking ? 'active' : ''}`}>
              {isTracking && <span className="pulse-dot" style={{ width: '8px', height: '8px' }}></span>}
              {isTracking ? 'Tracking Active' : 'Ready to Start'}
            </div>

            {isTracking && lastTrackedWindow && (
              <div className="active-window-indicator">
                🖥️ {lastTrackedWindow}
              </div>
            )}
          </div>

          {/* Control Buttons */}
          <div className="worker-control-buttons">
            {!isTracking ? (
              <button
                className="mode-btn green"
                style={{ gridColumn: 'span 2' }}
                onClick={handleStartTracking}
              >
                ▶ Start Tracking
              </button>
            ) : (
              <button
                className="mode-btn"
                style={{ gridColumn: 'span 2', background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 4px 12px rgba(245,158,11,0.3)' }}
                onClick={handleStopTracking}
              >
                ⏸ Pause Tracking
              </button>
            )}
            <button
              className="mode-btn worker-logout-btn"
              onClick={handleWorkerLogout}
            >
              ← Log Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {(mobileSidebarOpen || mobileFeedOpen) && (
        <div className="mobile-overlay" onClick={() => { setMobileSidebarOpen(false); setMobileFeedOpen(false); }}></div>
      )}
      
      {/* 1. SIDEBAR */}
      <div className={`sidebar ${mobileSidebarOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>eLab Analytics</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>Workspace</p>
          </div>
          <button className="mobile-close-btn" onClick={() => setMobileSidebarOpen(false)} style={{ display: 'none' }}>
            <X size={18} />
          </button>
        </div>

        <div className="sidebar-group" style={{ marginTop: 0 }} onClick={() => setMobileSidebarOpen(false)}>
          <div 
            className={`sidebar-item ${activeTabId === 'global' ? 'active' : ''}`}
            onClick={() => setActiveTabId('global')}
            style={{ fontWeight: 600 }}
          >
            <Globe size={18} />
            <span>Global Analytics</span>
          </div>
        </div>

        <div className="sidebar-group">
          <div className="sidebar-group-title">
            <span>Researchers</span>
            {userRole === 'admin' && <Plus size={14} style={{ cursor: 'pointer' }} onClick={() => setShowSettings(true)} />}
          </div>
          {users.filter(u => u.role === 'Researcher').map(user => (
            <div 
              key={user.id} 
              className={`sidebar-item ${activeTabId === user.id ? 'active' : ''}`}
              onClick={() => setActiveTabId(user.id)}
              style={{ gap: '0.5rem' }}
            >
              <Avatar user={user} size={20} />
              <span>{user.name}</span>
            </div>
          ))}
        </div>

        <div className="sidebar-group">
          <div className="sidebar-group-title">
            <span>Marketers</span>
            {userRole === 'admin' && <Plus size={14} style={{ cursor: 'pointer' }} onClick={() => setShowSettings(true)} />}
          </div>
          {users.filter(u => u.role === 'Marketer').map(user => (
            <div 
              key={user.id} 
              className={`sidebar-item ${activeTabId === user.id ? 'active' : ''}`}
              onClick={() => setActiveTabId(user.id)}
              style={{ gap: '0.5rem' }}
            >
              <Avatar user={user} size={20} />
              <span>{user.name}</span>
            </div>
          ))}
        </div>

        <div className="sidebar-group">
          <div className="sidebar-group-title">
            <span>Designers</span>
            {userRole === 'admin' && <Plus size={14} style={{ cursor: 'pointer' }} onClick={() => setShowSettings(true)} />}
          </div>
          {users.filter(u => u.role === 'Designer').map(user => (
            <div 
              key={user.id} 
              className={`sidebar-item ${activeTabId === user.id ? 'active' : ''}`}
              onClick={() => setActiveTabId(user.id)}
              style={{ gap: '0.5rem' }}
            >
              <Avatar user={user} size={20} />
              <span>{user.name}</span>
            </div>
          ))}
        </div>

        <div className="sidebar-group" onClick={() => setMobileSidebarOpen(false)}>
          <div className="sidebar-group-title">
            <span>Uploaders</span>
            {userRole === 'admin' && <Plus size={14} style={{ cursor: 'pointer' }} onClick={() => setShowSettings(true)} />}
          </div>
          {users.filter(u => u.role === 'Uploader').map(user => (
            <div 
              key={user.id} 
              className={`sidebar-item ${activeTabId === user.id ? 'active' : ''}`}
              onClick={() => setActiveTabId(user.id)}
              style={{ gap: '0.5rem' }}
            >
              <Avatar user={user} size={20} />
              <span>{user.name}</span>
            </div>
          ))}
        </div>

        {userRole === 'admin' && (
          <div style={{ marginTop: 'auto', padding: '1rem 1.5rem' }} onClick={() => setMobileSidebarOpen(false)}>
            <div className="sidebar-item" onClick={() => setShowSettings(true)} style={{ background: 'rgba(255,255,255,0.05)' }}>
              <Settings size={18} />
              <span>Settings & Setup</span>
            </div>
          </div>
        )}
      </div>

      {/* 2. MAIN DASHBOARD CONTENT */}
      <div className="main-content" style={{ position: 'relative' }}>
        {/* Mobile Top Navigation */}
        <div className="mobile-top-bar">
          <button onClick={() => setMobileSidebarOpen(true)} className="mobile-toggle-btn">
            <Menu size={20} />
          </button>
          <span style={{ fontWeight: 600, fontSize: '1.1rem', color: '#fff' }}>eLab Analytics</span>
          <button onClick={() => setMobileFeedOpen(true)} className="mobile-toggle-btn">
            <Bell size={20} />
          </button>
        </div>

        {loading && <div className="top-loading-bar"></div>}
        <div className="content-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {activeTabId !== 'global' && activeUser && (
              <Avatar user={activeUser} size={48} />
            )}
            <div>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {activeTabId === 'global' ? (
                  <><Globe size={24} style={{ opacity: 0.5 }} /> Team Global Analytics</>
                ) : (
                  activeUser?.name
                )}
              </h2>
              <p style={{ color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {activeTabId === 'global' ? 'Viewing combined team data' : `Role: ${activeUser?.role}`} 
                <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
                {useMock ? (
                  <span>Using Demo Data</span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span className={`status-dot ${loading ? 'syncing' : 'live'}`}></span>
                    {loading ? 'Syncing...' : `Live Mode (Sync in ${countdown}s)`}
                  </span>
                )}
              </p>
            </div>
          </div>
          
          {/* Time Filter Toggle */}
          <div style={{ display: 'flex', background: 'rgba(15,23,42,0.6)', borderRadius: '8px', padding: '4px', border: '1px solid var(--glass-border)', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
            {['Today', 'Yesterday', 'This Week', 'This Month', 'Last Month', 'All Time'].map(filter => (
              <button
                key={filter}
                onClick={() => setTimeFilter(filter)}
                style={{
                  background: timeFilter === filter ? 'var(--primary)' : 'transparent',
                  color: timeFilter === filter ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 500,
                  transition: 'all 0.2s'
                }}
              >
                {filter}
              </button>
            ))}
            <button
              onClick={() => { fetchData(); setCountdown(30); }}
              disabled={loading}
              style={{
                background: 'rgba(255,255,255,0.05)',
                color: '#fff',
                border: 'none',
                padding: '0.5rem',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                marginLeft: '4px',
                height: '34px',
                width: '34px'
              }}
              title="Refresh Data"
            >
              <RefreshCw size={14} className={loading ? 'spinning' : ''} />
            </button>
          </div>
        </div>

        {loading && feed.length === 0 ? (
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading live data...</p>
          </div>
        ) : (
          <>
            <div className="dashboard-grid" style={{ marginBottom: '2rem' }}>
              {activeTabId === 'global' ? (
                <>
                  {/* GLOBAL STATS */}
                  <div className="stat-card col-span-4">
                    <div className="stat-icon-wrapper blue">
                      <Users size={24} color="#60a5fa" />
                    </div>
                    <div className="stat-details">
                      <span className="stat-title">Total Research ({timeFilter})</span>
                      <span className="stat-value">{globalNamesAdded}</span>
                    </div>
                  </div>
                  <div className="stat-card col-span-4">
                    <div className="stat-icon-wrapper purple">
                      <Activity size={24} color="#c084fc" />
                    </div>
                    <div className="stat-details">
                      <span className="stat-title">Total Marketing ({timeFilter})</span>
                      <span className="stat-value">{globalMarketed}</span>
                    </div>
                  </div>
                  <div className="stat-card col-span-4">
                    <div className="stat-icon-wrapper green" style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(21,128,61,0.05))', border: '1px solid rgba(34,197,94,0.25)' }}>
                      <CheckCircle size={24} color="#22c55e" />
                    </div>
                    <div className="stat-details">
                      <span className="stat-title">Total Sales ({timeFilter})</span>
                      <span className="stat-value">{globalTotalSales}</span>
                    </div>
                  </div>
                  <div className="stat-card col-span-6">
                    <div className="stat-icon-wrapper orange" style={{ background: 'rgba(251, 146, 60, 0.12)', border: '1px solid rgba(251, 146, 60, 0.22)' }}>
                      <FileText size={24} color="#fb923c" />
                    </div>
                    <div className="stat-details">
                      <span className="stat-title">Total Designs ({timeFilter})</span>
                      <span className="stat-value">{globalDesigns}</span>
                    </div>
                  </div>
                  <div className="stat-card col-span-6">
                    <div className="stat-icon-wrapper cyan" style={{ background: 'rgba(34, 211, 238, 0.12)', border: '1px solid rgba(34, 211, 238, 0.22)' }}>
                      <Globe size={24} color="#22d3ee" />
                    </div>
                    <div className="stat-details">
                      <span className="stat-title">Total Uploads ({timeFilter})</span>
                      <span className="stat-value">{globalUploads}</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* INDIVIDUAL STATS */}
                  {(() => {
                    let title = "Tasks Done";
                    let iconColor = "#c084fc";
                    let wrapperClass = "purple";
                    let IconComponent = Activity;
                    let count = 0;

                    if (activeUser?.role === 'Researcher') {
                      title = "Names Collected";
                      iconColor = "#60a5fa";
                      wrapperClass = "blue";
                      IconComponent = Users;
                      count = filteredFeed.filter(f => safeLower(f.type).trim() === 'name added').length;
                    } else if (activeUser?.role === 'Marketer') {
                      title = "Schools Marketed";
                      iconColor = "#c084fc";
                      wrapperClass = "purple";
                      IconComponent = Activity;
                      count = filteredFeed.filter(f => safeLower(f.type).trim() === 'marketed' || safeLower(f.type).trim() === 'name added').length;
                    } else if (activeUser?.role === 'Designer') {
                      title = "Designs Created";
                      iconColor = "#fb923c";
                      wrapperClass = "orange";
                      IconComponent = FileText;
                      count = filteredFeed.filter(f => safeLower(f.type).includes('design')).length;
                    } else if (activeUser?.role === 'Uploader') {
                      title = "Uploads Completed";
                      iconColor = "#22d3ee";
                      wrapperClass = "cyan";
                      IconComponent = UserPlus;
                      count = filteredFeed.filter(f => safeLower(f.type).includes('upload')).length;
                    } else {
                      count = filteredFeed.length;
                    }

                    return (
                      <div className="stat-card col-span-6">
                        <div className={`stat-icon-wrapper ${wrapperClass}`} style={{ 
                          background: wrapperClass === 'orange' ? 'rgba(251, 146, 60, 0.12)' : wrapperClass === 'cyan' ? 'rgba(34, 211, 238, 0.12)' : undefined,
                          border: wrapperClass === 'orange' ? '1px solid rgba(251, 146, 60, 0.22)' : wrapperClass === 'cyan' ? '1px solid rgba(34, 211, 238, 0.22)' : undefined
                        }}>
                          <IconComponent size={24} color={iconColor} />
                        </div>
                        <div className="stat-details">
                          <span className="stat-title">{title} ({timeFilter})</span>
                          <span className="stat-value">{count}</span>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="stat-card col-span-6">
                    <div className="stat-icon-wrapper green" style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(21,128,61,0.05))', border: '1px solid rgba(34,197,94,0.25)' }}>
                      <CheckCircle size={24} color="#22c55e" />
                    </div>
                    <div className="stat-details">
                      <span className="stat-title">Sales Attributed ({timeFilter})</span>
                      <span className="stat-value">{userTotalSales}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Area Chart for Progress */}
            <div className="dashboard-grid">
              <div className="chart-container col-span-12">
                <h3 className="chart-title">
                  {activeTabId === 'global' ? 'Team Progress Over Time' : `${activeUser?.name}'s Progress Over Time`} (Last 7 Days)
                </h3>
                <div style={{ height: '350px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorAdded" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorMarketed" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#c084fc" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#c084fc" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorDesigns" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#fb923c" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#fb923c" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorUploads" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="date" stroke="#64748b" tick={{fill: '#64748b'}} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" tick={{fill: '#64748b'}} tickLine={false} axisLine={false} />
                      <RechartsTooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }} itemStyle={{ color: '#fff' }} />
                      
                      {activeTabId === 'global' ? (
                        <>
                          <Area type="monotone" dataKey="addedNames" name="Research" stroke="#60a5fa" strokeWidth={3} fillOpacity={1} fill="url(#colorAdded)" />
                          <Area type="monotone" dataKey="marketedLinks" name="Marketing" stroke="#c084fc" strokeWidth={3} fillOpacity={1} fill="url(#colorMarketed)" />
                          <Area type="monotone" dataKey="totalDesigns" name="Design" stroke="#fb923c" strokeWidth={3} fillOpacity={1} fill="url(#colorDesigns)" />
                          <Area type="monotone" dataKey="totalUploads" name="Upload" stroke="#22d3ee" strokeWidth={3} fillOpacity={1} fill="url(#colorUploads)" />
                          <Area type="monotone" dataKey="totalSales" name="Sales" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                        </>
                      ) : activeUser?.role === 'Researcher' ? (
                        <>
                          <Area type="monotone" dataKey="addedNames" name="Names Collected" stroke="#60a5fa" strokeWidth={3} fillOpacity={1} fill="url(#colorAdded)" />
                          <Area type="monotone" dataKey="totalSales" name="Sales from Research" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                        </>
                      ) : activeUser?.role === 'Marketer' ? (
                        <>
                          <Area type="monotone" dataKey="marketedLinks" name="Links Marketed" stroke="#c084fc" strokeWidth={3} fillOpacity={1} fill="url(#colorMarketed)" />
                          <Area type="monotone" dataKey="totalSales" name="Sales from Marketing" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                        </>
                      ) : activeUser?.role === 'Designer' ? (
                        <>
                          <Area type="monotone" dataKey="totalDesigns" name="Designs Created" stroke="#fb923c" strokeWidth={3} fillOpacity={1} fill="url(#colorDesigns)" />
                          <Area type="monotone" dataKey="totalSales" name="Sales from Designs" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                        </>
                      ) : (
                        <>
                          <Area type="monotone" dataKey="totalUploads" name="Uploads Completed" stroke="#22d3ee" strokeWidth={3} fillOpacity={1} fill="url(#colorUploads)" />
                          <Area type="monotone" dataKey="totalSales" name="Sales from Uploads" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                        </>
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Team Leaderboard & Contribution */}
            {activeTabId === 'global' && (
              <div className="dashboard-grid" style={{ marginTop: '2rem' }}>
                {/* 🏆 Leaderboard Section */}
                <div className="chart-container col-span-8" style={{ height: 'auto', minHeight: '400px' }}>
                  <h3 className="chart-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>🏆 Performance Leaderboard ({timeFilter})</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                      Sorted by total points
                    </span>
                  </h3>
                  
                  <div className="leaderboard-list">
                    {calculateLeaderboard().map((member, index) => {
                      let medal = '';
                      if (index === 0) medal = '🥇';
                      else if (index === 1) medal = '🥈';
                      else if (index === 2) medal = '🥉';
                      
                      return (
                        <div key={member.id} className="leaderboard-item" style={{ gap: '0.75rem' }}>
                          <div className="leaderboard-rank-wrapper" style={{ marginRight: '0.25rem' }}>
                            <span className="leaderboard-rank">{medal || `#${index + 1}`}</span>
                          </div>
                          
                          <Avatar user={member} size={36} />
                          
                          <div className="leaderboard-member-info">
                            <div className="leaderboard-member-name">
                              {member.name}
                              <span className={`role-badge ${member.role.toLowerCase()}`}>{member.role}</span>
                            </div>
                            <div className="leaderboard-member-breakdown">
                              {[
                                member.role === 'Researcher' && `${member.breakdown.research} Research`,
                                member.role === 'Marketer' && `${member.breakdown.marketing} Marketing`,
                                member.role === 'Designer' && `${member.breakdown.design} Designs`,
                                member.role === 'Uploader' && `${member.breakdown.upload} Uploads`,
                                (member.role === 'Researcher' || member.role === 'Marketer') && `${member.breakdown.sales} Sales`,
                                member.role === 'Designer' && member.breakdown.dailyBonus > 0 && `+${member.breakdown.dailyBonus} Target Bonus`
                              ].filter(Boolean).join(' • ')}
                            </div>
                          </div>
                          
                          <div className="leaderboard-stats-row">
                            <div className="leaderboard-stat-col">
                              <span className="leaderboard-stat-val">{formatPoints(member.basePoints)}</span>
                              <span className="leaderboard-stat-lbl">BASE</span>
                            </div>
                            <div className="leaderboard-stat-col">
                              <span className="leaderboard-stat-val" style={{ color: member.bonusPoints > 0 ? 'var(--success-color)' : 'var(--text-muted)' }}>
                                {member.bonusPoints > 0 ? `+${formatPoints(member.bonusPoints)}` : '0'}
                              </span>
                              <span className="leaderboard-stat-lbl">BONUS</span>
                            </div>
                            <div className="leaderboard-stat-col total">
                              <span className="leaderboard-stat-val">{formatPoints(member.points)}</span>
                              <span className="leaderboard-stat-lbl">TOTAL</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 📊 Contribution Share Section */}
                <div className="chart-container col-span-4" style={{ height: 'auto', minHeight: '400px' }}>
                  <h3 className="chart-title">📊 Team Contribution Share ({timeFilter})</h3>
                  
                  <div className="contribution-list">
                    {(() => {
                      const leaderboardData = calculateLeaderboard();
                      const totalTeamPoints = leaderboardData.reduce((sum, m) => sum + m.points, 0);
                      
                      if (totalTeamPoints === 0) {
                        return (
                          <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '4rem' }}>
                            No contributions recorded for this period.
                          </div>
                        );
                      }
                      
                      return leaderboardData.map(member => {
                        const share = totalTeamPoints > 0 ? Math.round((member.points / totalTeamPoints) * 100) : 0;
                        let roleColor = 'var(--primary)';
                        if (member.role === 'Researcher') roleColor = '#60a5fa';
                        else if (member.role === 'Marketer') roleColor = '#c084fc';
                        else if (member.role === 'Designer') roleColor = '#fb923c';
                        else if (member.role === 'Uploader') roleColor = '#22d3ee';
                        
                        return (
                          <div key={member.id} className="contribution-item">
                            <div className="contribution-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Avatar user={member} size={18} />
                              <span className="contribution-name" style={{ flex: 1 }}>{member.name}</span>
                              <span className="contribution-percent">{share}%</span>
                            </div>
                            <div className="contribution-bar-bg">
                              <div 
                                className="contribution-bar-fill" 
                                style={{ 
                                  width: `${share}%`, 
                                  backgroundColor: roleColor,
                                  boxShadow: `0 0 8px ${roleColor}80`
                                }}
                              ></div>
                            </div>
                            <div className="contribution-details">
                              {formatPoints(member.points)} of {formatPoints(totalTeamPoints)} pts
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* ── Sale Attribution Table (Global view, when salesData available) ── */}
            {activeTabId === 'global' && (salesData.length > 0 || salesFeed.length > 0) && (
              <div className="dashboard-grid" style={{ marginTop: '2rem' }}>
                <div className="chart-container col-span-12" style={{ height: 'auto' }}>
                  <h3 className="chart-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>🏆 Sale Attribution — Who Researched & Marketed Each Order</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                      {filteredSalesFeed.length} orders · {timeFilter}
                    </span>
                  </h3>
                  <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', color: '#fff' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'left' }}>
                          <th style={{ padding: '10px 12px', color: '#94a3b8' }}>School</th>
                          <th style={{ padding: '10px 12px', color: '#94a3b8' }}>Date</th>
                          <th style={{ padding: '10px 12px', color: '#94a3b8' }}>Qty</th>
                          <th style={{ padding: '10px 12px', color: '#94a3b8' }}>🔬 Researcher</th>
                          <th style={{ padding: '10px 12px', color: '#94a3b8' }}>📣 Marketer</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const researchMap = {};
                          const marketMap  = {};
                          for (const f of feed) {
                            const type   = safeLower(f.type).trim();
                            const school = safeLower(f.detail).trim();
                            if (!school) continue;
                            if (type === 'name added' && !isUserMarketer(f.user)) {
                              if (!researchMap[school]) researchMap[school] = f.user;
                            }
                            if (type === 'marketed' || (type === 'name added' && isUserMarketer(f.user))) {
                              if (!marketMap[school]) marketMap[school] = f.user;
                            }
                          }
                          const findAttrib = (map, schoolName) => {
                            const sl = safeLower(schoolName).trim();
                            if (!sl) return null;
                            if (map[sl]) return map[sl];
                            const key = Object.keys(map).find(k => k && (sl.includes(k) || k.includes(sl)));
                            return key ? map[key] : null;
                          };
                          const displayRows = salesData.filter(s => {
                            if (!s.date) return false;
                            const d = safeParse(s.date);
                            if (!d) return timeFilter === 'All Time';
                            if (timeFilter === 'Today')      return isToday(d);
                            if (timeFilter === 'Yesterday')  return isYesterday(d);
                            if (timeFilter === 'This Week')  return isThisWeek(d);
                            if (timeFilter === 'This Month') return isThisMonth(d);
                            if (timeFilter === 'Last Month') {
                              const lm = subMonths(new Date(), 1);
                              return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
                            }
                            return true;
                          });
                          if (!displayRows.length) return (
                            <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>No orders for this period</td></tr>
                          );
                          return displayRows.map((s, i) => {
                            const researcher = findAttrib(researchMap, s.school);
                            const marketer   = findAttrib(marketMap,   s.school);
                            return (
                              <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <td style={{ padding: '10px 12px', fontWeight: 500 }}>{s.school}</td>
                                <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: '0.8rem' }}>
                                  {s.date ? (() => { const d = safeParse(s.date); return d ? format(d, 'MMM d, yyyy') : s.date; })() : '—'}
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>{s.quantity || 1}</td>
                                <td style={{ padding: '10px 12px' }}>
                                  {researcher
                                    ? <span style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', padding: '2px 8px', borderRadius: '999px', fontSize: '0.78rem' }}>👤 {researcher}</span>
                                    : <span style={{ color: '#475569', fontSize: '0.78rem' }}>—</span>}
                                </td>
                                <td style={{ padding: '10px 12px' }}>
                                  {marketer
                                    ? <span style={{ background: 'rgba(34,197,94,0.12)', color: '#86efac', padding: '2px 8px', borderRadius: '999px', fontSize: '0.78rem' }}>📣 {marketer}</span>
                                    : <span style={{ color: '#475569', fontSize: '0.78rem' }}>—</span>}
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 📊 Team Performance & Increment Report for Global Dashboard */}
            {activeTabId === 'global' && (
              <div className="dashboard-grid" style={{ marginTop: '2rem' }}>
                <div className="chart-container col-span-12" style={{ height: 'auto' }}>
                  <h3 className="chart-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>📊 Team Performance & Increment Recommendation ({timeFilter})</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                      Based on points (50%) & behavior ratings (50%)
                    </span>
                  </h3>
                  
                  <div style={{ overflowX: 'auto', marginTop: '1.25rem' }}>
                    <table className="evaluations-table" style={{ width: '100%', borderCollapse: 'collapse', color: '#fff', fontSize: '0.9rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                          <th style={{ padding: '12px', color: '#94a3b8' }}>Member Name</th>
                          <th style={{ padding: '12px', color: '#94a3b8' }}>Role</th>
                          <th style={{ padding: '12px', color: '#94a3b8' }}>Points Score (50%)</th>
                          <th style={{ padding: '12px', color: '#94a3b8' }}>Teamwork & Behavior</th>
                          <th style={{ padding: '12px', color: '#94a3b8' }}>Rules & Culture</th>
                          <th style={{ padding: '12px', color: '#94a3b8' }}>Helping Others</th>
                          <th style={{ padding: '12px', color: '#94a3b8' }}>Behavior Score (50%)</th>
                          <th style={{ padding: '12px', color: '#94a3b8' }}>Combined Index</th>
                          <th style={{ padding: '12px', color: '#94a3b8' }}>Increment Recommendation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(user => {
                          const leaderboard = calculateLeaderboard();
                          const userPoints = leaderboard.find(l => safeLower(l.name) === safeLower(user.name))?.points || 0;
                          
                          // Points normalization: target points is 150 points for 100% score
                          const pointsScore = Math.min(100, (userPoints / 150) * 100);
                          
                          const userEvals = evaluations.filter(e => safeLower(e.user) === safeLower(user.name));
                          let avgTeamwork = 0;
                          let avgRules = 0;
                          let avgHelping = 0;
                          let behaviorScore = 0;
                          
                          if (userEvals.length > 0) {
                            avgTeamwork = userEvals.reduce((sum, e) => sum + e.teamwork, 0) / userEvals.length;
                            avgRules = userEvals.reduce((sum, e) => sum + e.rules, 0) / userEvals.length;
                            avgHelping = userEvals.reduce((sum, e) => sum + e.helping, 0) / userEvals.length;
                            behaviorScore = ((avgTeamwork + avgRules + avgHelping) / 3) * 20; // scale 1-5 to 0-100
                          } else {
                            avgTeamwork = 4.0;
                            avgRules = 4.0;
                            avgHelping = 4.0;
                            behaviorScore = 80;
                          }
                          
                          const combinedIndex = (pointsScore * 0.5) + (behaviorScore * 0.5);
                          
                          let recommendation = "🥉 Standard Increment";
                          let recommendationClass = "recom-standard";
                          if (combinedIndex >= 90) {
                            recommendation = "🥇 High Increment";
                            recommendationClass = "recom-high";
                          } else if (combinedIndex >= 75) {
                            recommendation = "🥈 Medium Increment";
                            recommendationClass = "recom-medium";
                          } else if (combinedIndex < 50) {
                            recommendation = "⚠️ Review Required";
                            recommendationClass = "recom-review";
                          }
                          
                          return (
                            <tr key={user.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }} className="table-row-hover">
                              <td style={{ padding: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
                                  <Avatar user={user} size={28} />
                                  <span>{user.name}</span>
                                </div>
                              </td>
                              <td style={{ padding: '12px' }}><span className={`role-badge ${user.role.toLowerCase()}`}>{user.role}</span></td>
                              <td style={{ padding: '12px' }}>{formatPoints(userPoints)} pts ({pointsScore.toFixed(0)}%)</td>
                              <td style={{ padding: '12px' }}>⭐ {avgTeamwork.toFixed(1)}</td>
                              <td style={{ padding: '12px' }}>⭐ {avgRules.toFixed(1)}</td>
                              <td style={{ padding: '12px' }}>⭐ {avgHelping.toFixed(1)}</td>
                              <td style={{ padding: '12px' }}>{behaviorScore.toFixed(0)}%</td>
                              <td style={{ padding: '12px', fontWeight: 700, color: 'var(--primary-glow)' }}>{combinedIndex.toFixed(0)}%</td>
                              <td style={{ padding: '12px' }}><span className={`recom-badge ${recommendationClass}`}>{recommendation}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Behavior & Feedback History for Individual Dashboard */}
            {activeTabId !== 'global' && activeUser && (
              <div className="dashboard-grid" style={{ marginTop: '2rem' }}>
                {/* 📊 Behavior & Culture Ratings */}
                <div className="chart-container col-span-4" style={{ height: 'auto' }}>
                  <h3 className="chart-title">📊 Behavior & Culture Ratings</h3>
                  {(() => {
                    const userEvals = evaluations.filter(e => safeLower(e.user) === safeLower(activeUser.name));
                    let avgTeamwork = 4.0;
                    let avgRules = 4.0;
                    let avgHelping = 4.0;
                    if (userEvals.length > 0) {
                      avgTeamwork = userEvals.reduce((sum, e) => sum + e.teamwork, 0) / userEvals.length;
                      avgRules = userEvals.reduce((sum, e) => sum + e.rules, 0) / userEvals.length;
                      avgHelping = userEvals.reduce((sum, e) => sum + e.helping, 0) / userEvals.length;
                    }
                    
                    const ratings = [
                      { label: 'Teamwork & Behavior', val: avgTeamwork, color: '#60a5fa' },
                      { label: 'Rules & Office Culture', val: avgRules, color: '#c084fc' },
                      { label: 'Helping Others', val: avgHelping, color: '#22d3ee' }
                    ];
                    
                    return (
                      <div className="behavior-ratings-list" style={{ marginTop: '1.5rem' }}>
                        {ratings.map((r, idx) => {
                          const percent = (r.val / 5) * 100;
                          return (
                            <div key={idx} style={{ marginBottom: '1.5rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
                                <span style={{ color: '#94a3b8' }}>{r.label}</span>
                                <span style={{ fontWeight: 600, color: '#fff' }}>⭐ {r.val.toFixed(1)} / 5.0</span>
                              </div>
                              <div className="contribution-bar-bg" style={{ height: '10px' }}>
                                <div 
                                  className="contribution-bar-fill" 
                                  style={{ 
                                    width: `${percent}%`, 
                                    backgroundColor: r.color,
                                    boxShadow: `0 0 8px ${r.color}80`,
                                    height: '10px'
                                  }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* 💬 Admin Feedback & Remarks Timeline */}
                <div className="chart-container col-span-8" style={{ height: 'auto', minHeight: '300px' }}>
                  <h3 className="chart-title">💬 Performance & Culture Feedback History</h3>
                  <div className="feedback-timeline" style={{ marginTop: '1.5rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '8px' }}>
                    {(() => {
                      const userEvals = evaluations.filter(e => safeLower(e.user) === safeLower(activeUser.name));
                      if (userEvals.length === 0) {
                        return (
                          <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '3rem' }}>
                            No feedback or behavior evaluations recorded yet.
                          </div>
                        );
                      }
                      
                      return userEvals.map((item, idx) => (
                        <div key={item.id || idx} style={{ 
                          borderLeft: '2px solid var(--primary)', 
                          paddingLeft: '1.5rem', 
                          position: 'relative', 
                          marginBottom: '1.5rem' 
                        }}>
                          <div style={{ 
                            position: 'absolute', 
                            left: '-6px', 
                            top: '4px', 
                            width: '10px', 
                            height: '10px', 
                            borderRadius: '50%', 
                            backgroundColor: 'var(--primary)',
                            boxShadow: '0 0 8px var(--primary)'
                          }}></div>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.95rem' }}>
                              Evaluated for Period: {item.period}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {(() => { const d = safeParse(item.time); return d ? format(d, 'MMM dd, yyyy') : ''; })()}
                            </span>
                          </div>
                          
                          <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                            <span>Teamwork: ⭐ {item.teamwork.toFixed(1)}</span>
                            <span>Rules: ⭐ {item.rules.toFixed(1)}</span>
                            <span>Helping: ⭐ {item.helping.toFixed(1)}</span>
                          </div>
                          
                          {item.notes && (
                            <p style={{ 
                              background: 'rgba(255,255,255,0.03)', 
                              padding: '10px 14px', 
                              borderRadius: '8px', 
                              border: '1px solid rgba(255,255,255,0.05)',
                              color: '#cbd5e1',
                              fontSize: '0.9rem',
                              lineHeight: '1.4'
                            }}>
                              {item.notes}
                            </p>
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* 📸 Activity Screenshots & App/Website Usage Breakdown */}
            {activeTabId !== 'global' && activeUser && (
              <div className="dashboard-grid" style={{ marginTop: '2rem' }}>
                {/* Screenshot Gallery */}
                <div className="chart-container col-span-8" style={{ height: 'auto', minHeight: '350px' }}>
                  <h3 className="chart-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Camera size={18} color="#a5b4fc" />
                      📸 Work Screenshot Timeline
                    </span>
                    <input 
                      type="date" 
                      value={trackerDate}
                      onChange={(e) => setTrackerDate(e.target.value)}
                      style={{
                        padding: '0.4rem 0.75rem',
                        borderRadius: '6px',
                        border: '1px solid var(--glass-border)',
                        background: '#0f172a',
                        color: '#fff',
                        fontSize: '0.85rem'
                      }}
                    />
                  </h3>

                  {screenshotLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
                      <div className="spinner"></div>
                    </div>
                  ) : screenshots.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '220px', color: 'var(--text-muted)' }}>
                      <Camera size={40} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                      <p>No screenshots uploaded for this worker on {trackerDate}.</p>
                    </div>
                  ) : (
                    <div className="screenshot-timeline" style={{ marginTop: '1.25rem' }}>
                      <div className="screenshot-grid">
                        {screenshots.map((s, idx) => (
                          <div 
                            key={idx} 
                            className="screenshot-thumb-wrapper"
                            onClick={() => {
                              setActiveScreenshot(s);
                              setIsLightboxOpen(true);
                            }}
                          >
                            <GithubImage 
                              downloadUrl={s.downloadUrl} 
                              token={githubToken} 
                              alt={`Screenshot at ${s.timeStr}`}
                              className="screenshot-thumbnail"
                              style={{ width: '100%', height: '100px', objectFit: 'cover' }}
                            />
                            <div className="screenshot-time-badge">
                              {s.timeStr}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* App/Website Usage Breakdown */}
                <div className="chart-container col-span-4" style={{ height: 'auto', minHeight: '350px' }}>
                  <h3 className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <BarChart2 size={18} color="#a5b4fc" />
                    📊 App & Website Usage
                  </h3>

                  {(() => {
                    if (loadingActivity) {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '220px', color: 'var(--text-muted)' }}>
                          <BarChart2 size={40} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                          <p style={{ fontSize: '0.9rem' }}>Loading activity logs from GitHub...</p>
                        </div>
                      );
                    }

                    const logData = githubActivityLog || {};
                    const appSeconds = {};
                    let totalSeconds = 0;

                    Object.keys(logData).forEach(appName => {
                      const seconds = Number(logData[appName]) || 0;
                      appSeconds[appName] = (appSeconds[appName] || 0) + seconds;
                      totalSeconds += seconds;
                    });

                    const apps = Object.keys(appSeconds).map(appName => ({
                      name: appName,
                      seconds: appSeconds[appName],
                      color: getAppColor(appName)
                    })).sort((a, b) => b.seconds - a.seconds);

                    if (apps.length === 0) {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '220px', color: 'var(--text-muted)' }}>
                          <BarChart2 size={40} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                          <p>No activity logs recorded for this worker on this date.</p>
                        </div>
                      );
                    }

                    return (
                      <div className="app-usage-container" style={{ marginTop: '1.25rem' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem', textAlign: 'right' }}>
                          Total Active Time: {formatTimer(totalSeconds)}
                        </div>
                        {apps.map((app, idx) => {
                          const percent = totalSeconds > 0 ? (app.seconds / totalSeconds) * 100 : 0;
                          return (
                            <div key={idx} className="app-usage-row" style={{ marginBottom: '1.25rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                                <span style={{ color: '#fff', fontWeight: 500 }}>{app.name}</span>
                                <span style={{ color: 'var(--text-muted)' }}>
                                  {formatTimer(app.seconds)} ({percent.toFixed(0)}%)
                                </span>
                              </div>
                              <div className="contribution-bar-bg" style={{ height: '8px' }}>
                                <div 
                                  className="contribution-bar-fill" 
                                  style={{ 
                                    width: `${percent}%`, 
                                    backgroundColor: app.color,
                                    boxShadow: `0 0 8px ${app.color}80`,
                                    height: '8px'
                                  }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 3. LIVE ACTIVITY FEED */}
      <div className={`feed-panel ${mobileFeedOpen ? 'mobile-open' : ''}`}>
        <div className="feed-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell size={20} color="#a5b4fc" />
            Live Activity Feed
          </span>
          <button className="mobile-close-btn" onClick={() => setMobileFeedOpen(false)} style={{ display: 'none' }}>
            <X size={18} />
          </button>
        </div>
        <div className="feed-list">
          {(activeTabId === 'global' ? filteredFeed : filteredFeed.filter(f => safeLower(f.user) === safeLower(activeUser?.name))).slice(0, 50).map(item => (
            <div key={item.id} className="feed-item">
              <div className="feed-time">
                <Clock size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-top' }} />
                {(() => { const d = safeParse(item.time); return d ? format(d, 'hh:mm a - MMM dd') : 'Just now'; })()}
              </div>
              <div className="feed-text">
                <strong>{item.user}</strong>{' '}
                {(() => {
                  const type = item.type?.toLowerCase() || '';
                  const detail = item.detail && item.detail !== 'Done' ? item.detail : 'a school';
                  
                  if (type === 'marketed') return `marketed to ${detail}`;
                  if (type === 'name added') return `researched school: ${item.detail || 'Unknown school'}`;
                  if (type.includes('design')) return `designed mockup for ${item.detail || 'Unknown school'}`;
                  if (type.includes('upload')) return `uploaded files for ${item.detail || 'Unknown school'}`;
                  
                  return `added entry: ${item.detail || 'No details'}`;
                })()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1e293b', padding: '2rem', borderRadius: '12px', width: '500px', border: '1px solid var(--glass-border)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ color: '#fff', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between' }}>
              Settings & Setup
              <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </h2>

            {/* Sub Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '1.5rem', gap: '1.25rem' }}>
              <button 
                onClick={() => { setSettingsTab('config'); setEvalMsg(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: settingsTab === 'config' ? 'var(--primary)' : 'var(--text-muted)',
                  borderBottom: settingsTab === 'config' ? '2px solid var(--primary)' : '2px solid transparent',
                  paddingBottom: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.95rem'
                }}
              >
                ⚙️ API & Team
              </button>
              {userRole === 'admin' && (
                <button 
                  onClick={() => { 
                    setSettingsTab('evaluation'); 
                    setEvalMsg(''); 
                    if (users.length > 0 && !evalUser) {
                      setEvalUser(users[0].name);
                    }
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: settingsTab === 'evaluation' ? 'var(--primary)' : 'var(--text-muted)',
                    borderBottom: settingsTab === 'evaluation' ? '2px solid var(--primary)' : '2px solid transparent',
                    paddingBottom: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.95rem'
                  }}
                >
                  ⭐ Evaluate Member
                </button>
              )}
            </div>
            
            {settingsTab === 'config' || userRole !== 'admin' ? (
              <>
                {/* ── Direct Sheets API (SA) ────────────────────────────── */}
                {isElectron && (
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid rgba(99,102,241,0.3)' }}>
                    <h3 style={{ fontSize: '1rem', color: '#a5b4fc', marginBottom: '0.75rem' }}>🔑 Direct Google Sheets API (Recommended)</h3>

                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Service Account JSON Path</label>
                    <input
                      type="text"
                      value={saPath}
                      onChange={(e) => { setSaPath(e.target.value); localStorage.setItem('elab_sa_path', e.target.value); }}
                      placeholder="D:\Own Build\FBLAB\orchestrator\service-account.json"
                      style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: '#0f172a', color: '#fff', marginBottom: '0.75rem' }}
                    />

                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Master DB Spreadsheet ID</label>
                    <input
                      type="text"
                      value={masterDbId}
                      onChange={(e) => { setMasterDbId(e.target.value); localStorage.setItem('elab_master_db_id', e.target.value); }}
                      placeholder="1xJyuu0HcY235mmOX8J860A5fCQS11KQDk4SMuLS4N0"
                      style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: '#0f172a', color: '#fff', marginBottom: '0.75rem' }}
                    />

                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Sales Record Sheet ID</label>
                    <input
                      type="text"
                      value={salesSheetId}
                      onChange={(e) => { setSalesSheetId(e.target.value); localStorage.setItem('elab_sales_sheet_id', e.target.value); }}
                      placeholder="1WjYBpkxwOEKbLXppXnK211cEyc-UgsmXfB8Avu7zEUo"
                      style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: '#0f172a', color: '#fff', marginBottom: '0.75rem', fontSize: '0.82rem' }}
                    />

                    {/* Auto-detect info — no manual sheet IDs needed */}
                    <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '6px', padding: '0.6rem 0.75rem', marginBottom: '0.75rem', fontSize: '0.8rem', color: '#a5b4fc' }}>
                      🤖 <strong>Fully automatic.</strong> Researcher sheets are detected from Google Drive — no Sheet IDs needed. Just make sure each researcher's sheet is shared with the service account and the sheet name contains their name.
                      <div style={{ marginTop: '6px', color: '#64748b' }}>
                        Researchers: {users.filter(u => u.role === 'Researcher').map(u => u.name).join(', ') || 'None added yet'}
                      </div>
                    </div>

                    {syncMsg && (
                      <div style={{
                        padding: '6px 10px', borderRadius: '6px', marginBottom: '0.75rem', fontSize: '0.82rem',
                        background: syncMsg.startsWith('✅') ? 'rgba(34,197,94,0.1)' : syncMsg.startsWith('⚠️') ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                        color:      syncMsg.startsWith('✅') ? '#bbf7d0'              : syncMsg.startsWith('⚠️') ? '#fde68a'               : '#fca5a5',
                      }}>{syncMsg}</div>
                    )}

                    {/* Auto-sync interval selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        🔄 Auto-sync every:
                      </label>
                      <select
                        value={autoSyncMinutes}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setAutoSyncMinutes(v);
                          localStorage.setItem('elab_auto_sync_minutes', v);
                        }}
                        style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: '#0f172a', color: '#fff', fontSize: '0.85rem' }}
                      >
                        <option value={1}>1 minute</option>
                        <option value={5}>5 minutes</option>
                        <option value={10}>10 minutes</option>
                        <option value={30}>30 minutes</option>
                        <option value={60}>60 minutes</option>
                      </select>
                      {autoSyncEnabled && (
                        <span style={{ fontSize: '0.75rem', color: '#4ade80', marginLeft: '4px' }}>● Active</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button
                        onClick={() => { fetchData(); setSyncMsg(''); }}
                        disabled={!saPath || !masterDbId}
                        style={{ flex: 1, padding: '0.5rem', background: saPath && masterDbId ? 'var(--primary)' : '#475569', color: '#fff', border: 'none', borderRadius: '6px', cursor: saPath && masterDbId ? 'pointer' : 'not-allowed' }}
                      >
                        Connect & Fetch
                      </button>
                      <button
                        onClick={handleSyncSheets}
                        disabled={syncingSheets || !saPath || !masterDbId || !users.some(u => u.role === 'Researcher')}
                        style={{ flex: 1, padding: '0.5rem', background: '#0891b2', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', opacity: syncingSheets ? 0.7 : 1 }}
                      >
                        {syncingSheets ? '⏳ Syncing...' : '🔄 Sync Now'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Legacy Apps Script (fallback) ─────────────────────── */}
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Legacy: Apps Script API URL</h3>
                  <input
                    type="text"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: '#0f172a', color: '#fff', marginBottom: '1rem' }}
                  />
                  <h3 style={{ fontSize: '1rem', color: '#22c55e', marginBottom: '0.5rem' }}>Sales Record API URL (Optional)</h3>
                  <input 
                    type="text" 
                    value={salesApiUrl}
                    onChange={(e) => setSalesApiUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: '#0f172a', color: '#fff', marginBottom: '1rem' }}
                  />
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button 
                      onClick={() => { setUseMock(false); fetchData(); }}
                      style={{ flex: 1, padding: '0.5rem', background: apiUrl ? 'var(--primary)' : '#475569', color: '#fff', border: 'none', borderRadius: '6px', cursor: apiUrl ? 'pointer' : 'not-allowed' }}
                      disabled={!apiUrl}
                    >
                      Save & Connect Live APIs
                    </button>
                    <button 
                      onClick={() => setUseMock(true)}
                      style={{ flex: 1, padding: '0.5rem', background: '#334155', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      Use Demo Data
                    </button>
                  </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', color: '#a5b4fc', marginBottom: '0.5rem' }}>GitHub Screenshot Storage</h3>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>GitHub Storage Token</label>
                    <input 
                      type="password" 
                      value={githubToken}
                      onChange={(e) => setGithubToken(e.target.value)}
                      placeholder="ghp_..."
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: '#0f172a', color: '#fff' }}
                    />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>GitHub Repository</label>
                    <input 
                      type="text" 
                      value={githubRepo}
                      onChange={(e) => setGithubRepo(e.target.value)}
                      placeholder="owner/repo"
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: '#0f172a', color: '#fff' }}
                    />
                  </div>
                  <button 
                    onClick={() => saveConfigToCloud(githubToken, githubRepo)}
                    style={{ width: '100%', padding: '0.5rem', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    Save GitHub Config
                  </button>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
                  <h3 style={{ fontSize: '1rem', color: '#a5b4fc', marginBottom: '1rem' }}>Manage Team</h3>
                  <form onSubmit={handleAddUser} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    <input 
                      type="text" 
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      placeholder="User Name"
                      required
                      style={{ flex: '2 1 200px', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: '#0f172a', color: '#fff' }}
                    />
                    <select 
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value)}
                      style={{ flex: '1 1 120px', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: '#0f172a', color: '#fff' }}
                    >
                      <option value="Researcher">Researcher</option>
                      <option value="Marketer">Marketer</option>
                      <option value="Designer">Designer</option>
                      <option value="Uploader">Uploader</option>
                    </select>
                    {newUserRole === 'Researcher' && (
                      <input
                        type="url"
                        value={newUserSheetUrl}
                        onChange={(e) => setNewUserSheetUrl(e.target.value)}
                        placeholder="Google Sheet URL (researcher's sheet)"
                        style={{ flex: '1 1 100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: '#0f172a', color: '#fff', marginTop: '0.25rem' }}
                      />
                    )}
                    {newUserRole === 'Marketer' && (
                      <input
                        type="text"
                        value={newUserTelegramId}
                        onChange={(e) => setNewUserTelegramId(e.target.value)}
                        placeholder="Telegram Chat ID"
                        style={{ flex: '1 1 100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: '#0f172a', color: '#fff', marginTop: '0.25rem' }}
                      />
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 100%', marginTop: '0.25rem' }}>
                      <input type="file" ref={fileInputRef} accept="image/*" onChange={handlePhotoSelect} style={{ display: 'none' }} />
                      <button type="button" onClick={() => fileInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px dashed rgba(99, 102, 241, 0.5)', background: 'rgba(99, 102, 241, 0.1)', color: '#a5b4fc', cursor: 'pointer', fontSize: '0.85rem', transition: 'all 0.2s' }}>
                        <Camera size={16} />
                        {newUserAvatar ? 'Change Photo' : 'Upload Photo'}
                      </button>
                      {newUserAvatar && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <img src={newUserAvatar} alt="Preview" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }} />
                          <button type="button" onClick={() => setNewUserAvatar('')} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem' }}>✕</button>
                        </div>
                      )}
                    </div>
                    <button type="submit" style={{ width: '100%', padding: '0.5rem 1rem', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', marginTop: '0.5rem' }}>Add Member</button>
                  </form>
                  {onboardStatus.length > 0 && (
                    <div style={{ marginBottom: '1rem', padding: '0.6rem 0.75rem', background: 'rgba(99,102,241,0.1)', borderRadius: '6px', border: '1px solid rgba(99,102,241,0.3)', fontSize: '0.8rem', color: '#c7d2fe' }}>
                      {onboardStatus.map((s, i) => <div key={i}>{s}</div>)}
                    </div>
                  )}
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {users.map(user => (
                      <div key={user.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', marginBottom: '0.5rem', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => { setEditingPhotoUserId(user.id); editFileInputRef.current?.click(); }}>
                            <Avatar user={user} size={28} />
                            <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '14px', height: '14px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #1e293b' }}>
                              <Camera size={8} color="#fff" />
                            </div>
                          </div>
                          <div>
                            <span style={{ color: '#fff', fontWeight: 500 }}>{user.name}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '0.5rem' }}>({user.role})</span>
                          </div>
                        </div>
                        <button onClick={() => handleDeleteUser(user.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <input type="file" ref={editFileInputRef} accept="image/*" onChange={handleEditPhotoSelect} style={{ display: 'none' }} />
                </div>
              </>
            ) : (
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.25rem', borderRadius: '8px' }}>
                <h3 style={{ fontSize: '1.1rem', color: '#a5b4fc', marginBottom: '1rem' }}>Submit Performance Evaluation</h3>
                
                {evalMsg && (
                  <div style={{ 
                    padding: '8px 12px', 
                    borderRadius: '6px', 
                    background: evalMsg.includes('failed') ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                    border: evalMsg.includes('failed') ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(34,197,94,0.3)',
                    color: evalMsg.includes('failed') ? '#fca5a5' : '#bbf7d0',
                    fontSize: '0.85rem',
                    marginBottom: '1rem'
                  }}>
                    {evalMsg}
                  </div>
                )}
                
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.85rem', marginBottom: '6px' }}>Select Team Member</label>
                  <select 
                    value={evalUser}
                    onChange={(e) => setEvalUser(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: '#0f172a', color: '#fff' }}
                  >
                    {users.map(u => (
                      <option key={u.id} value={u.name}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.85rem', marginBottom: '6px' }}>Evaluation Period (Year/Month)</label>
                  <input 
                    type="text" 
                    value={evalPeriod}
                    onChange={(e) => setEvalPeriod(e.target.value)}
                    placeholder="e.g. 2026, or June 2026"
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: '#0f172a', color: '#fff' }}
                  />
                </div>

                {/* Rating Teamwork */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                    <span style={{ color: '#94a3b8' }}>Teamwork & Behavior (১-৫)</span>
                    <span style={{ color: '#a5b4fc', fontWeight: 600 }}>⭐ {evalTeamwork} / 5</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="5" 
                    step="0.1"
                    value={evalTeamwork}
                    onChange={(e) => setEvalTeamwork(Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--primary)' }}
                  />
                </div>

                {/* Rating Rules */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                    <span style={{ color: '#94a3b8' }}>Rules & Office Culture (১-৫)</span>
                    <span style={{ color: '#a5b4fc', fontWeight: 600 }}>⭐ {evalRules} / 5</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="5" 
                    step="0.1"
                    value={evalRules}
                    onChange={(e) => setEvalRules(Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--primary)' }}
                  />
                </div>

                {/* Rating Helping */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                    <span style={{ color: '#94a3b8' }}>Helping Others (১-৫)</span>
                    <span style={{ color: '#a5b4fc', fontWeight: 600 }}>⭐ {evalHelping} / 5</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="5" 
                    step="0.1"
                    value={evalHelping}
                    onChange={(e) => setEvalHelping(Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--primary)' }}
                  />
                </div>

                {/* Feedback notes */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.85rem', marginBottom: '6px' }}>Remarks / Feedback (ফিডব্যক/মন্তব্য)</label>
                  <textarea 
                    value={evalNotes}
                    onChange={(e) => setEvalNotes(e.target.value)}
                    placeholder="Enter employee performance review notes..."
                    rows="3"
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: '#0f172a', color: '#fff', resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>

                <button 
                  onClick={async () => {
                    const finalUser = evalUser || (users.length > 0 ? users[0].name : '');
                    if (!finalUser) {
                      setEvalMsg('Please select a member first.');
                      return;
                    }
                    setEvalSubmitting(true);
                    setEvalMsg('');
                    const success = await submitEvaluation(finalUser, evalTeamwork, evalRules, evalHelping, evalPeriod, evalNotes);
                    setEvalSubmitting(false);
                    if (success) {
                      setEvalMsg('✅ Evaluation submitted successfully!');
                      setEvalNotes('');
                    } else {
                      setEvalMsg('❌ Submission failed. Check Master API connection.');
                    }
                  }}
                  disabled={evalSubmitting}
                  style={{ width: '100%', padding: '0.75rem', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  {evalSubmitting ? 'Submitting...' : 'Submit Rating'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {isLightboxOpen && activeScreenshot && (
        <div className="lightbox-overlay" onClick={() => setIsLightboxOpen(false)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => setIsLightboxOpen(false)}>✕</button>
            <GithubImage 
              downloadUrl={activeScreenshot.downloadUrl} 
              token={githubToken} 
              alt={`Screenshot at ${activeScreenshot.timeStr}`}
              className="lightbox-image"
            />
            <div className="lightbox-caption">
              Captured at {activeScreenshot.timeStr} on {trackerDate}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Wrap App with ErrorBoundary for export
function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

export default AppWithErrorBoundary;
