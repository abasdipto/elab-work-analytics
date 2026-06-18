/**
 * sheets_analytics.js
 * Direct Google Sheets API v4 integration for eLab Work Analytics.
 * Replaces Apps Script: reads/writes Master DB and syncs researcher sheets.
 * Supports background auto-sync at a configurable interval.
 */

import { createSign } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { ipcMain, BrowserWindow } from 'electron';

// ─── Service Account Token (RS256 JWT) ───────────────────────────────────────
const _tokenCache = {};

async function getSAToken(saPath, scope = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly') {
  const now = Math.floor(Date.now() / 1000);
  const cacheKey = `${saPath}::${scope}`;
  const cached = _tokenCache[cacheKey];
  if (cached && cached.exp > now + 60) return cached.token;

  const sa = JSON.parse(readFileSync(saPath, 'utf8'));
  const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).toString('base64url');

  const toSign = `${header}.${payload}`;
  const sign = createSign('RSA-SHA256');
  sign.update(toSign);
  const sig = sign.sign(sa.private_key, 'base64url');
  const jwt = `${toSign}.${sig}`;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error('SA token error: ' + JSON.stringify(data));
  _tokenCache[cacheKey] = { token: data.access_token, exp: now + 3600 };
  return data.access_token;
}

// ─── Drive API: list all spreadsheets the SA can access ──────────────────────
async function listAccessibleSheets(saPath) {
  const token = await getSAToken(saPath);
  const sheets = [];
  let pageToken = null;

  do {
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
    url.searchParams.set('fields', 'nextPageToken,files(id,name)');
    url.searchParams.set('pageSize', '100');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`Drive list failed: ${r.status} ${await r.text()}`);
    const d = await r.json();
    sheets.push(...(d.files || []));
    pageToken = d.nextPageToken || null;
  } while (pageToken);

  return sheets; // [{ id, name }]
}

// Match researcher names to sheets: for each name, find the sheet whose title
// contains that name (case-insensitive). Returns { name → { sheetId, sheetTitle } }
async function autoDetectResearcherSheets(saPath, researcherNames) {
  const allSheets = await listAccessibleSheets(saPath);
  const result = {};
  for (const name of researcherNames) {
    const lower = name.toLowerCase();
    const match = allSheets.find(s => s.name.toLowerCase().includes(lower));
    if (match) result[name] = { sheetId: match.id, sheetTitle: match.name };
  }
  return result;
}

// ─── Rate-limit helpers ───────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** Fetch with automatic retry on 429 (exponential backoff). */
async function fetchWithRetry(url, opts, retries = 4) {
  let delay = 2000;
  for (let i = 0; i <= retries; i++) {
    const r = await fetch(url, opts);
    if (r.status !== 429) return r;
    console.warn(`[sheets] 429 rate limit — waiting ${delay}ms before retry ${i + 1}/${retries}`);
    await sleep(delay);
    delay *= 2;
  }
  throw new Error('Sheets API rate limit: too many retries');
}

// ─── Sheets API helpers ───────────────────────────────────────────────────────

/** Get tab names AND all their data in ONE request using spreadsheets.get. */
async function getSheetData(token, sheetId, cols = 'A:F') {
  // First get tab names
  const meta = await fetchWithRetry(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!meta.ok) throw new Error(`getSheetData failed: ${meta.status} ${await meta.text()}`);
  const d = await meta.json();
  const tabs = (d.sheets || []).map(s => s.properties.title);
  if (!tabs.length) return { tabs, data: {} };

  // Batch-read all tabs in ONE request
  const ranges = tabs.map(t => encodeURIComponent(`${t}!${cols}`)).join('&ranges=');
  const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?ranges=${ranges}`;
  const br = await fetchWithRetry(batchUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (!br.ok) { console.warn('batchGet failed, returning tab names only'); return { tabs, data: {} }; }
  const bd = await br.json();

  const data = {};
  for (const vr of (bd.valueRanges || [])) {
    // range looks like "TabName!A1:F100" — extract tab name
    const tabName = vr.range?.split('!')?.[0]?.replace(/^'|'$/g, '') || '';
    data[tabName] = vr.values || [];
  }
  return { tabs, data };
}

async function getTabNames(token, sheetId) {
  const r = await fetchWithRetry(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!r.ok) throw new Error(`getTabNames failed: ${r.status} ${await r.text()}`);
  const d = await r.json();
  return (d.sheets || []).map(s => s.properties.title);
}

async function readRange(token, sheetId, tabName, cols = 'A:E') {
  const enc = encodeURIComponent(`${tabName}!${cols}`);
  const r = await fetchWithRetry(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${enc}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!r.ok) return [];
  const d = await r.json();
  return d.values || [];
}

async function appendRows(token, sheetId, tabName, values) {
  const enc = encodeURIComponent(`${tabName}!A:E`);
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${enc}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    }
  );
  return r.ok;
}

async function createTab(token, sheetId, tabName) {
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tabName } } }] }),
  });
  return r.ok;
}

// ─── Core logic ───────────────────────────────────────────────────────────────
const SKIP_TABS = new Set(['Log', 'Summary', 'Dashboard', 'Instructions', 'Readme', 'Sheet1']);

async function getMasterDBData(saPath, masterDbId) {
  const token          = await getSAToken(saPath);
  const { tabs, data } = await getSheetData(token, masterDbId, 'A:E');
  const result         = [];

  for (const tab of tabs) {
    if (SKIP_TABS.has(tab)) continue;
    const rows = data[tab] || [];
    if (rows.length <= 1) continue;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      result.push({
        'Timestamp':   row[0] || '',
        'Action Type': row[1] || '',
        'User':        row[2] || '',
        'Detail':      row[3] || '',
        'Sheet URL':   row[4] || '',
      });
    }
  }
  return result;
}

async function appendMasterDBRow(saPath, masterDbId, userName, actionType, detail, sheetUrl = '') {
  const token = await getSAToken(saPath);
  const tabs  = await getTabNames(token, masterDbId);

  if (!tabs.includes(userName)) {
    await createTab(token, masterDbId, userName);
    await appendRows(token, masterDbId, userName, [
      ['Timestamp', 'Action Type', 'User', 'Detail', 'Sheet URL']
    ]);
  }

  const timestamp = new Date().toISOString();
  await appendRows(token, masterDbId, userName, [
    [timestamp, actionType, userName, detail, sheetUrl]
  ]);
}

async function syncResearcherSheets(saPath, masterDbId, configs) {
  const token   = await getSAToken(saPath);
  const IGNORED = new Set(['Log', 'Summary', 'Dashboard', 'Instructions', 'Readme']);

  // Load existing Master DB keys — ONE batch request for the entire Master DB
  const existingKeys              = new Set();
  const { tabs: masterTabs, data: masterData } = await getSheetData(token, masterDbId, 'A:E');
  for (const tab of masterTabs) {
    if (IGNORED.has(tab)) continue;
    const rows = masterData[tab] || [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const key = `${String(row[1] || '').trim()}|${String(row[3] || '').trim().toLowerCase()}`;
      existingKeys.add(key);
    }
  }

  let added = 0, designDone = 0, uploadDone = 0;

  for (const cfg of configs) {
    const {
      sheetId,
      ownerName    = 'Ullash',
      designerName = 'Robin',
      uploaderName = 'Dipto',
    } = cfg;

    if (!sheetId) continue;

    // ONE batch request per researcher sheet (all tabs at once)
    const { tabs: srcTabs, data: srcData } = await getSheetData(token, sheetId, 'A:F');

    for (const tabName of srcTabs) {
      if (IGNORED.has(tabName)) continue;
      const rows = srcData[tabName] || [];
      if (rows.length <= 1) continue;

      const tabUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/`;

      for (let i = 1; i < rows.length; i++) {
        const row        = rows[i];
        const schoolName = String(row[1] || '').trim(); // col B
        const statusVal  = String(row[4] || '').trim(); // col E
        if (!schoolName) continue;

        // Name Added (Researcher)
        const nameKey = `Name Added|${schoolName.toLowerCase()}`;
        if (!existingKeys.has(nameKey)) {
          await appendMasterDBRow(saPath, masterDbId, ownerName, 'Name Added', schoolName, tabUrl);
          existingKeys.add(nameKey);
          added++;
        }

        const isDone = statusVal.toLowerCase() === 'done';
        const isLink = statusVal.startsWith('http');

        // Design Done (Designer)
        if (isDone || isLink) {
          const desKey = `Design Done|${schoolName.toLowerCase()}`;
          if (!existingKeys.has(desKey)) {
            await appendMasterDBRow(saPath, masterDbId, designerName, 'Design Done', schoolName, tabUrl);
            existingKeys.add(desKey);
            designDone++;
          }
        }

        // Upload Done (Uploader)
        if (isLink) {
          const detail = `${schoolName} | ${statusVal}`;
          const uplKey = `Upload Done|${detail.toLowerCase()}`;
          if (!existingKeys.has(uplKey)) {
            await appendMasterDBRow(saPath, masterDbId, uploaderName, 'Upload Done', detail, tabUrl);
            existingKeys.add(uplKey);
            uploadDone++;
          }
        }
      }
    }
  }

  return { success: true, added, designDone, uploadDone };
}

// ─── Auto-Sync (background interval) ─────────────────────────────────────────
let _autoSyncTimer    = null;
let _autoSyncConfig   = null;
let _configFilePath   = null;
let _isSyncing        = false; // prevent overlapping runs

/** Broadcast an event to all open BrowserWindows */
function broadcast(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}

/** Save current auto-sync config to disk so it survives restarts */
function persistConfig(cfg) {
  if (!_configFilePath) return;
  try {
    writeFileSync(_configFilePath, JSON.stringify(cfg, null, 2), 'utf8');
  } catch (e) {
    console.error('[auto-sync] Failed to persist config:', e.message);
  }
}

/** Run one sync cycle and broadcast the result */
async function runAutoSync() {
  if (_isSyncing || !_autoSyncConfig) return;
  const { saPath, masterDbId, configs } = _autoSyncConfig;
  if (!saPath || !masterDbId || !configs?.length) return;

  _isSyncing = true;
  console.log('[auto-sync] Running sync…');
  try {
    const result = await syncResearcherSheets(saPath, masterDbId, configs);
    const msg = result.added || result.designDone || result.uploadDone
      ? `✅ Auto-synced: +${result.added} names, +${result.designDone} designs, +${result.uploadDone} uploads`
      : `✅ Auto-sync: up-to-date`;
    console.log('[auto-sync]', msg);
    broadcast('analytics-sync-result', { ...result, msg, time: new Date().toISOString() });
  } catch (err) {
    console.error('[auto-sync] Error:', err.message);
    broadcast('analytics-sync-result', { success: false, error: err.message, time: new Date().toISOString() });
  } finally {
    _isSyncing = false;
  }
}

/** Start (or restart) the background auto-sync interval */
function startAutoSync(cfg) {
  stopAutoSync();
  _autoSyncConfig = cfg;
  const ms = (cfg.intervalMinutes || 5) * 60 * 1000;
  console.log(`[auto-sync] Started — every ${cfg.intervalMinutes || 5} minutes`);

  // Run immediately on first start, then on interval
  runAutoSync();
  _autoSyncTimer = setInterval(runAutoSync, ms);
}

/** Stop the background interval */
function stopAutoSync() {
  if (_autoSyncTimer) {
    clearInterval(_autoSyncTimer);
    _autoSyncTimer = null;
  }
  _autoSyncConfig = null;
  conso