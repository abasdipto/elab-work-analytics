/**
 * sync-sheets.mjs
 * Runs in GitHub Actions — reads Master DB + Sales Sheet via Service Account,
 * writes public/master-data.json and public/sales-data.json (no revenue/profit).
 */

import { createSign } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';

const MASTER_DB_ID   = process.env.MASTER_DB_ID;
const SALES_SHEET_ID = process.env.SALES_SHEET_ID;
const SA             = JSON.parse(process.env.GOOGLE_SA_JSON);

const SKIP_TABS = new Set(['Log', 'Summary', 'Dashboard', 'Instructions', 'Readme', 'Sheet1']);

// ── SA JWT auth ───────────────────────────────────────────────────────────────
async function getSAToken() {
  const now = Math.floor(Date.now() / 1000);
  const scope = 'https://www.googleapis.com/auth/spreadsheets';
  const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: SA.client_email, scope,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  })).toString('base64url');

  const toSign = `${header}.${payload}`;
  const sign = createSign('RSA-SHA256');
  sign.update(toSign);
  const sig  = sign.sign(SA.private_key, 'base64url');
  const jwt  = `${toSign}.${sig}`;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error('SA token error: ' + JSON.stringify(data));
  return data.access_token;
}

// ── Batch-read all tabs of a sheet ───────────────────────────────────────────
async function getSheetData(token, sheetId, cols = 'A:F') {
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const meta = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!meta.ok) throw new Error(`meta failed: ${meta.status} ${await meta.text()}`);
  const d    = await meta.json();
  const tabs = (d.sheets || []).map(s => s.properties.title);
  if (!tabs.length) return { tabs, data: {} };

  // batch-get with retry on 429
  let delay = 2000;
  for (let attempt = 0; attempt <= 4; attempt++) {
    const ranges   = tabs.map(t => encodeURIComponent(`${t}!${cols}`)).join('&ranges=');
    const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?ranges=${ranges}`;
    const br = await fetch(batchUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (br.status === 429) { await sleep(delay); delay *= 2; continue; }
    if (!br.ok) throw new Error(`batchGet failed: ${br.status}`);
    const bd   = await br.json();
    const data = {};
    for (const vr of (bd.valueRanges || [])) {
      const tabName = vr.range?.split('!')?.[0]?.replace(/^'|'$/g, '') || '';
      data[tabName] = vr.values || [];
    }
    return { tabs, data };
  }
  throw new Error('batchGet: too many 429 retries');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Fetching SA token…');
  const token = await getSAToken();

  // 1. Master DB
  console.log('Reading Master DB…');
  const { tabs: masterTabs, data: masterData } = await getSheetData(token, MASTER_DB_ID, 'A:E');
  const masterRows = [];
  for (const tab of masterTabs) {
    if (SKIP_TABS.has(tab)) continue;
    const rows = masterData[tab] || [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r[0]) continue;
      masterRows.push({
        Timestamp:    r[0] || '',
        'Action Type': r[1] || '',
        User:         r[2] || '',
        Detail:       r[3] || '',
        'Sheet URL':  r[4] || '',
      });
    }
  }
  console.log(`Master DB: ${masterRows.length} rows`);

  // 2. Sales (A:I only — skip J=Revenue, K=Profit)
  console.log('Reading Sales sheet…');
  const { tabs: salesTabs, data: salesData } = await getSheetData(token, SALES_SHEET_ID, 'A:I');
  const salesRows = [];
  for (const tab of salesTabs) {
    if (SKIP_TABS.has(tab)) continue;
    const rows = salesData[tab] || [];
    for (const r of rows) {
      if (!r[0]) continue;
      salesRows.push({
        orderId:  r[0] || '',
        status:   r[1] || '',
        school:   r[2] || '',
        color:    r[3] || '',
        contact:  r[4] || '',
        email:    r[5] || '',
        country:  r[6] || '',
        date:     r[7] || '',
        quantity: Number(r[8]) || 0,
        month:    tab,
      });
    }
  }
  console.log(`Sales: ${salesRows.length} rows`);

  // 3. Write JSON files
  mkdirSync('public', { recursive: true });
  writeFileSync('public/master-data.json', JSON.stringify(masterRows, null, 2));
  writeFileSync('public/sales-data.json',  JSON.stringify(salesRows,  null, 2));
  console.log('✅ Written public/master-data.json and public/sales-data.json');
}

main().catch(err => { console.error(err); process.exit(1); });
