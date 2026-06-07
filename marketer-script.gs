// =====================================================================
// eLab Work Analytics - Google Apps Script (Marketer Sheet Version)
// =====================================================================
// এই স্ক্রিপ্টটি আপনার Marketers / সেলস ট্র্যাকিং স্প্রেডশিটে বসবে।
// এটি কলাম F এ "done" লেখা হলে সরাসরি Master Database শিটে 'Marketed' অ্যাকশন রেকর্ড করবে।

// ১. আপনার প্রধান Master Database গুগল শিটের ID:
const MASTER_SPREADSHEET_ID = '1xJyuu0HcY235mmOX8J860A5fCQS11KQDk4SMuLS4N0'; 

// ২. এই শিটের মেইন মার্কেটারের নাম এখানে লিখুন (যেমন: 'Jubayer', 'Maruf', বা 'Selim'):
// (শিটের ওনার অনুযায়ী শুধুমাত্র এই নামটি পরিবর্তন করলেই হবে, অন্য কোথাও হাত দিতে হবে না!)
const SPREADSHEET_OWNER_NAME = 'Jubayer'; 

// ৩. এখানে মার্কেটারদের Gmail আর নাম (সঠিক নাম ট্র্যাকিং এর জন্য):
const USER_EMAIL_MAP = {
  'jubayer_email@gmail.com' : 'Jubayer',    // Marketer 1
  'maruf_email@gmail.com'   : 'Maruf',      // Marketer 2
  'selim_email@gmail.com'   : 'Selim',      // Marketer 3
};

// ৪. যেসব শিট/ট্যাবের ডাটা আমরা ড্যাশবোর্ডে নেব না (ইগনোর লিস্ট):
const IGNORED_SHEET_NAMES = ['Log', 'Summary', 'Dashboard', 'Instructions', 'Readme'];

// ৫. কলাম নম্বর কনফিগারেশন (1 = A, 2 = B, 3 = C, ...)
const SCHOOL_NAME_COL = 2; // Column B (School Name)
const STATUS_COL      = 6; // Column F (Status - যেখানে "done" লেখা হবে)

// =====================================================================
// onEdit — যেকোনো ট্যাবে এডিট হলে অটোমেটিক রিয়েল-টাইমে ডাটা মাস্টার শিটে পাঠাবে
// =====================================================================
function onEditInstallable(e) {
  try {
    if (!e || !e.range) return;
    const sheet = e.source.getActiveSheet();
    const sheetName = sheet.getName();
    
    // ইগনোর লিস্টে থাকা শিট হলে বাদ দাও
    if (IGNORED_SHEET_NAMES.includes(sheetName)) return;
    
    const col = e.range.getColumn();
    const row = e.range.getRow();
    
    // হেডার রো বাদ দিন
    if (row <= 1) return;
    
    // range থেকে সরাসরি বর্তমান ভ্যালু নেয়া (যাতে কপি-পেস্ট করলেও কাজ করে)
    const rangeValue = e.range.getValue();
    const newValue = String(rangeValue === undefined || rangeValue === null ? '' : rangeValue).trim();
    const oldValue = String(e.oldValue === undefined || e.oldValue === null ? '' : e.oldValue).trim();
    
    // ইউজার ইমেইল থেকে নাম বের করা
    const email = (e.user && e.user.email) ? e.user.email.toLowerCase() : '';
    let userName = USER_EMAIL_MAP[email] || email || '';
    
    // =====================================================================
    // Column F (Status) এডিট হলে "done" লিখেছে কি না চেক করো
    // =====================================================================
    if (col === STATUS_COL) {
      // স্কুলের নাম বের করো (একই সারির Column B থেকে)
      const schoolName = sheet.getRange(row, SCHOOL_NAME_COL).getValue().toString().trim() || 'Unknown School';
      
      // কলাম F এ "done" লিখলে তা Marketed অ্যাকশন হিসেবে রেকর্ড করো
      if (newValue.toLowerCase() === 'done') {
        if (!userName) userName = SPREADSHEET_OWNER_NAME;
        logToMasterSheet('Marketed', userName, schoolName, sheet);
      }
    }
  } catch(err) {
    console.error('onEditInstallable error:', err);
  }
}

// =====================================================================
// Helper: Master Database শিটে সরাসরি ডাটা রাইট করো (রিয়েল-টাইম এডিটের জন্য)
// =====================================================================
function logToMasterSheet(actionType, userName, detail, sourceSheet) {
  try {
    if (!MASTER_SPREADSHEET_ID || MASTER_SPREADSHEET_ID === 'YOUR_MASTER_SPREADSHEET_ID_HERE') {
      console.error('Master Spreadsheet ID সেট করা হয়নি!');
      return;
    }
    
    const masterSs = SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
    const targetTabName = userName.trim();
    const targetSheet = masterSs.getSheetByName(targetTabName) || masterSs.insertSheet(targetTabName);
    
    if (targetSheet.getLastRow() === 0) {
      targetSheet.appendRow(['Timestamp', 'Action Type', 'User', 'Detail', 'Sheet URL']);
    } else {
      // রিয়েল-টাইম ডুপ্লিকেট এন্ট্রি প্রতিরোধ
      const existingData = targetSheet.getDataRange().getValues();
      const newKey = (actionType + '|' + detail).toLowerCase().trim();
      for (let r = 1; r < existingData.length; r++) {
        const rowKey = (existingData[r][1].toString() + '|' + existingData[r][3].toString()).toLowerCase().trim();
        if (rowKey === newKey) {
          Logger.log(`⚠️ Duplicate log prevented: ${actionType} - "${detail}" already exists in Master Sheet.`);
          return;
        }
      }
    }
    
    const sourceSs = SpreadsheetApp.getActiveSpreadsheet();
    const sheetUrl = sourceSheet ? 
      `https://docs.google.com/spreadsheets/d/${sourceSs.getId()}/edit#gid=${sourceSheet.getSheetId()}` : '';
    
    targetSheet.appendRow([
      new Date().toISOString(),
      actionType,
      userName,
      detail,
      sheetUrl
    ]);
    
    Logger.log(`✅ Logged ${actionType} for ${userName} in Master Sheet`);
  } catch(err) {
    console.error('logToMasterSheet error:', err);
  }
}

// =====================================================================
// SYNC EXISTING DATA — সবগুলো ট্যাব থেকে একবারে মার্কেটারের ডাটা সিঙ্ক করার ফাংশন
// =====================================================================
function syncExistingData() {
  try {
    if (!MASTER_SPREADSHEET_ID || MASTER_SPREADSHEET_ID === 'YOUR_MASTER_SPREADSHEET_ID_HERE') {
      SpreadsheetApp.getUi().alert('❌ আগে সঠিক MASTER_SPREADSHEET_ID বসান!');
      return;
    }
    
    const masterSs = SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
    const sourceSs = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = sourceSs.getSheets();
    
    // ১. মাস্টার শিটের বর্তমান ডাটা লোড করা (ডুপ্লিকেট এড়ানোর জন্য)
    const existingLogs = {};
    const workerSheet = masterSs.getSheetByName(SPREADSHEET_OWNER_NAME);
    if (workerSheet) {
      const rows = workerSheet.getDataRange().getValues();
      for (let r = 1; r < rows.length; r++) {
        const actionType = String(rows[r][1]).trim();
        const detail = String(rows[r][3]).trim().toLowerCase();
        existingLogs[`${actionType}|${detail}`] = true;
      }
    }
    
    const rowsToAppend = [];
    let marketedCount = 0;
    let processedSheets = [];
    
    // ২. সোর্স স্প্রেডশিটের প্রতিটি ট্যাবের ডাটা চেক করা
    for (let s = 0; s < sheets.length; s++) {
      const sheet = sheets[s];
      const sheetName = sheet.getName();
      
      if (IGNORED_SHEET_NAMES.includes(sheetName)) continue;
      
      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) continue;
      
      processedSheets.push(sheetName);
      const sheetUrl = `https://docs.google.com/spreadsheets/d/${sourceSs.getId()}/edit#gid=${sheet.getSheetId()}`;
      
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const schoolName = String(row[SCHOOL_NAME_COL - 1] || '').trim();
        const statusVal = String(row[STATUS_COL - 1] || '').trim();
        
        if (schoolName === '') continue; // স্কুল নাম খালি হলে স্কিপ করো
        
        // কলাম F এ "done" থাকলে তা Marketed অ্যাকশন হিসেবে সিঙ্ক করো
        if (statusVal.toLowerCase() === 'done') {
          const key = `Marketed|${schoolName.toLowerCase()}`;
          if (!existingLogs[key]) {
            rowsToAppend.push([new Date().toISOString(), 'Marketed', SPREADSHEET_OWNER_NAME, schoolName, sheetUrl]);
            existingLogs[key] = true;
            marketedCount++;
          }
        }
      }
    }
    
    // ৩. ডাটাগুলো একবারে সিঙ্গেল রিকোয়েস্টে মাস্টার শিটে রাইট করা (Batch write)
    if (rowsToAppend.length > 0) {
      appendRowsInBatch(masterSs, SPREADSHEET_OWNER_NAME, rowsToAppend);
    }
    
    SpreadsheetApp.getUi().alert(
      `✅ সিঙ্ক সম্পন্ন হয়েছে!\n\n` +
      `স্ক্যান করা ট্যাবসমূহ: ${processedSheets.join(', ')}\n\n` +
      `📝 নতুন অ্যাড হওয়া রেকর্ড:\n` +
      `• Marketer (${SPREADSHEET_OWNER_NAME}) - ${marketedCount} টি`
    );
    
  } catch(err) {
    SpreadsheetApp.getUi().alert('❌ সিঙ্ক করতে ভুল হয়েছে: ' + err.message);
  }
}

// ব্যাচে ডাটা রাইট করার জন্য হেল্পার ফাংশন
function appendRowsInBatch(masterSs, tabName, rows) {
  const sheet = masterSs.getSheetByName(tabName) || masterSs.insertSheet(tabName);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Timestamp', 'Action Type', 'User', 'Detail', 'Sheet URL']);
  }
  const startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rows.length, 5).setValues(rows);
}

// =====================================================================
// SETUP TRIGGER — স্ক্রিপ্ট একবার রান করে ট্রিগার সেটআপ করুন
// =====================================================================
function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'onEditInstallable') {
      ScriptApp.deleteTrigger(t);
    }
  });
  
  ScriptApp.newTrigger('onEditInstallable')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();
    
  Logger.log('✅ Trigger setup completed successfully!');
}

// =====================================================================
// ON OPEN - স্প্রেডশিট ওপেন হলে কাস্টম মেনু তৈরি করবে
// =====================================================================
function onOpen() {
  SpreadsheetApp.getUi().createMenu('🔄 eLab Analytics')
    .addItem('Sync Data Now', 'syncExistingData')
    .addItem('Open Sync Sidebar', 'showSyncSidebar')
    .addToUi();
}

// সাইডবার প্যানেল ওপেন করার ফাংশন
function showSyncSidebar() {
  const html = HtmlService.createHtmlOutput(
    `<!DOCTYPE html>
    <html>
      <head>
        <base target="_top">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; background-color: #f8f9fa; color: #333; }
          .btn { background-color: #1a73e8; color: white; border: none; padding: 12px 20px; font-size: 16px; font-weight: bold; border-radius: 4px; cursor: pointer; width: 100%; box-shadow: 0 1px 3px rgba(0,0,0,0.2); transition: background-color 0.2s; }
          .btn:hover { background-color: #1557b0; }
          .btn:disabled { background-color: #ccc; cursor: not-allowed; }
          .status { margin-top: 15px; font-size: 14px; text-align: center; color: #666; font-weight: 500; }
        </style>
      </head>
      <body>
        <h3>eLab Work Analytics</h3>
        <p style="font-size: 13px; color: #555;">ক্লিক করে আপনার কাজের ডাটা ড্যাশবোর্ডে সিঙ্ক করুন।</p>
        <button class="btn" onclick="runSync()">🔄 Sync Data Now</button>
        <div id="status" class="status"></div>

        <script>
          function runSync() {
            const btn = document.querySelector('.btn');
            const statusDiv = document.getElementById('status');
            btn.disabled = true;
            btn.innerText = 'Syncing...';
            statusDiv.innerHTML = '⏳ সিঙ্ক হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...';
            
            google.script.run
              .withSuccessHandler(function() {
                btn.disabled = false;
                btn.innerText = '🔄 Sync Data Now';
                statusDiv.innerHTML = '✅ সিঙ্ক সফলভাবে সম্পন্ন হয়েছে!';
              })
              .withFailureHandler(function(err) {
                btn.disabled = false;
                btn.innerText = '🔄 Sync Data Now';
                statusDiv.innerHTML = '❌ সিঙ্ক ব্যর্থ হয়েছে: <br>' + err.message;
              })
              .syncExistingData();
          }
        </script>
      </body>
    </html>`
  )
  .setTitle('eLab Sync Panel')
  .setWidth(300);
  SpreadsheetApp.getUi().showSidebar(html);
}
