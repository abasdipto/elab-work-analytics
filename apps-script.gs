// =====================================================================
// eLab Work Analytics - Google Apps Script (All-Tabs Real-Time Version)
// =====================================================================
// এই স্ক্রিপ্টটি আপনার Researchers / কাজের স্প্রেডশিটে বসবে।
// এটি স্প্রেডশিটের যেকোনো ট্যাবে (মাসিক/দৈনিক) নতুন ডাটা এন্ট্রি হলে তা মাস্টার ডেটাবেজে পাঠাবে।

// ১. আপনার প্রধান Master Database গুগল শিটের ID:
const MASTER_SPREADSHEET_ID = '1xJyuu0HcY235mmOX8J860A5fCQS11KQDk4SMuLS4N0'; 

// ২. এই শিটের মেইন রিসার্চারের নাম এখানে লিখুন (যেমন: 'Ullash', 'Shila', বা 'Alim'):
// (শিটের ওনার অনুযায়ী শুধুমাত্র এই নামটি পরিবর্তন করলেই হবে, অন্য কোথাও হাত দিতে হবে না!)
const SPREADSHEET_OWNER_NAME = 'Ullash'; 

// ৩. এখানে সবার Gmail আর নাম (সঠিক নাম ট্র্যাকিং এর জন্য):
const USER_EMAIL_MAP = {
  'ullabdfresearch@gmail.com' : 'Ullash',    // Researcher 1
  // 'shila_email@gmail.com'  : 'Shila',     // Researcher 2 (প্রয়োজন হলে বসাবেন)
  // 'alim_email@gmail.com'   : 'Alim',      // Researcher 3 (প্রয়োজন হলে বসাবেন)
  'robinkhan4139@gmail.com'   : 'Robin',     // Designer
  'absdipto69@gmail.com'      : 'Dipto',     // Uploader
};

// ৪. যেসব শিট/ট্যাবের ডাটা আমরা ড্যাশবোর্ডে নেব না (ইগনোর লিস্ট):
const IGNORED_SHEET_NAMES = ['Log', 'Summary', 'Dashboard', 'Instructions', 'Readme'];

// ৫. কলাম নম্বর কনফিগারেশন (1 = A, 2 = B, 3 = C, ...)
const SCHOOL_NAME_COL = 2; // Column B (School Name)
const STATUS_COL      = 5; // Column E (Status/Note column)

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
    
    const newValue = String(e.value || '').trim();
    const oldValue = String(e.oldValue || '').trim();
    
    // ইউজার ইমেইল থেকে নাম বের করা
    const email = (e.user && e.user.email) ? e.user.email.toLowerCase() : '';
    let userName = USER_EMAIL_MAP[email] || email || '';
    
    // =====================================================================
    // CASE ১: Researcher নতুন স্কুলের নাম যুক্ত করেছেন (Column B এডিট)
    // =====================================================================
    if (col === SCHOOL_NAME_COL) {
      if (newValue !== '' && oldValue === '') {
        if (!userName) userName = SPREADSHEET_OWNER_NAME; // ইমেইল না পেলে শিটের ওনারের নাম যাবে
        logToMasterSheet('Name Added', userName, newValue, sheet);
      }
      return;
    }
    
    // =====================================================================
    // Column E (Status) এডিট হলে Designer অথবা Uploader এর কাজ ডিটেক্ট করো
    // =====================================================================
    if (col === STATUS_COL) {
      // স্কুলের নাম বের করো (একই সারির Column B থেকে)
      const schoolName = sheet.getRange(row, SCHOOL_NAME_COL).getValue().toString().trim() || 'Unknown School';
      
      // ক) Designer "Done" লিখেছেন
      if (newValue.toLowerCase() === 'done') {
        if (!userName) userName = 'Robin'; // ডিফল্ট ডিজাইনার
        logToMasterSheet('Design Done', userName, schoolName, sheet);
        return;
      }
      
      // খ) Uploader "Done" লেখা রিপ্লেস করে লিংক বসিয়েছেন
      const isLink = newValue.startsWith('http') || newValue.includes('drive.google') || newValue.includes('docs.google') || newValue.includes('sheets.google');
      if (newValue !== '' && (isLink || oldValue.toLowerCase() === 'done')) {
        if (!userName) userName = 'Dipto'; // ডিফল্ট আপলোডার
        logToMasterSheet('Upload Done', userName, schoolName + ' | ' + newValue, sheet);
        return;
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
// SYNC EXISTING DATA — সবগুলো ট্যাব থেকে একবারে ব্যাচে ডাটা সিঙ্ক করার ফাংশন
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
    const defaultWorkers = [SPREADSHEET_OWNER_NAME, 'Robin', 'Dipto'];
    
    defaultWorkers.forEach(worker => {
      const sheet = masterSs.getSheetByName(worker);
      if (sheet) {
        const rows = sheet.getDataRange().getValues();
        for (let r = 1; r < rows.length; r++) {
          const actionType = String(rows[r][1]).trim();
          const detail = String(rows[r][3]).trim().toLowerCase();
          existingLogs[`${actionType}|${detail}`] = true;
        }
      }
    });
    
    // প্রতিজন ইউজারের জন্য নতুন ডাটা জমিয়ে রাখার অবজেক্ট
    const rowsToAppend = {};
    rowsToAppend[SPREADSHEET_OWNER_NAME] = [];
    rowsToAppend['Robin'] = [];
    rowsToAppend['Dipto'] = [];
    
    let nameAddedCount = 0;
    let designDoneCount = 0;
    let uploadDoneCount = 0;
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
        
        if (schoolName === '') continue;
        
        // ক) Researcher-এর জন্য (Name Added)
        const resKey = `Name Added|${schoolName.toLowerCase()}`;
        if (!existingLogs[resKey]) {
          rowsToAppend[SPREADSHEET_OWNER_NAME].push([new Date().toISOString(), 'Name Added', SPREADSHEET_OWNER_NAME, schoolName, sheetUrl]);
          existingLogs[resKey] = true;
          nameAddedCount++;
        }
        
        // খ) Designer-এর জন্য (Design Done)
        const isDone = statusVal.toLowerCase() === 'done';
        const isLink = statusVal.startsWith('http') || statusVal.includes('drive.google') || statusVal.includes('docs.google') || statusVal.includes('sheets.google');
        
        if (isDone || isLink) {
          const desKey = `Design Done|${schoolName.toLowerCase()}`;
          if (!existingLogs[desKey]) {
            rowsToAppend['Robin'].push([new Date().toISOString(), 'Design Done', 'Robin', schoolName, sheetUrl]);
            existingLogs[desKey] = true;
            designDoneCount++;
          }
        }
        
        // গ) Uploader-এর জন্য (Upload Done)
        if (isLink) {
          const detailVal = `${schoolName} | ${statusVal}`;
          const uplKey = `Upload Done|${detailVal.toLowerCase()}`;
          if (!existingLogs[uplKey]) {
            rowsToAppend['Dipto'].push([new Date().toISOString(), 'Upload Done', 'Dipto', detailVal, sheetUrl]);
            existingLogs[uplKey] = true;
            uploadDoneCount++;
          }
        }
      }
    }
    
    // ৩. ডাটাগুলো একবারে সিঙ্গেল রিকোয়েস্টে মাস্টার শিটে রাইট করা
    defaultWorkers.forEach(worker => {
      const workerRows = rowsToAppend[worker];
      if (workerRows && workerRows.length > 0) {
        appendRowsInBatch(masterSs, worker, workerRows);
      }
    });
    
    SpreadsheetApp.getUi().alert(
      `✅ সিঙ্ক সম্পন্ন হয়েছে!\n\n` +
      `স্ক্যান করা ট্যাবসমূহ: ${processedSheets.join(', ')}\n\n` +
      `📝 নতুন অ্যাড হওয়া রেকর্ড:\n` +
      `• Researcher (${SPREADSHEET_OWNER_NAME}) - ${nameAddedCount} টি\n` +
      `• Designer (Robin) - ${designDoneCount} টি\n` +
      `• Uploader (Dipto) - ${uploadDoneCount} টি`
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
// SETUP TRIGGER — স্ক্রিপ্ট এডিটরে রান বাটনে ক্লিক করে এটি একবার রান করুন
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
