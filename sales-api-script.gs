// =====================================================================
// eLab Sales Sheet API - Apps Script Web App
// এই স্ক্রিপ্টটি Sales Sheet এ বসাও, তারপর Web App হিসেবে Deploy করো
// Deploy করার সময়: Execute as = Me, Who has access = Anyone
// =====================================================================

const SALES_SPREADSHEET_ID = '1WjYBpkxwOEKbLXppXnK211cEyc-UgsmXfB8Avu7zEUo';

// Revenue/Profit column গুলো (J, K) পাঠানো হবে না — privacy
const IGNORED_COLS = [9, 10]; // 0-indexed: col 9 = J (Revenue), col 10 = K (Profit)

function doGet(e) {
  try {
    const ss = SpreadsheetApp.openById(SALES_SPREADSHEET_ID);
    const sheets = ss.getSheets();

    const allSales = [];

    for (const sheet of sheets) {
      const name = sheet.getName();
      // ইগনোর লিস্ট
      if (['Log', 'Summary', 'Dashboard', 'Instructions', 'Readme'].includes(name)) continue;

      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) continue;

      // Row 1 = header, skip
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const school = String(row[2] || '').trim(); // Col C
        if (!school) continue;

        allSales.push({
          orderId:  String(row[0] || '').trim(),  // A
          status:   String(row[1] || '').trim(),  // B
          school:   school,                        // C
          color:    String(row[3] || '').trim(),  // D
          contact:  String(row[4] || '').trim(),  // E
          email:    String(row[5] || '').trim(),  // F
          country:  String(row[6] || '').trim(),  // G
          date:     row[7] ? new Date(row[7]).toISOString() : '', // H
          quantity: Number(row[8]) || 0,           // I
          month:    row[7] ? Utilities.formatDate(new Date(row[7]), 'UTC', 'yyyy-MM') : '',
          tab:      name
          // Revenue (J) এবং Profit (K) intentionally excluded
        });
      }
    }

    return ContentService
      .createTextOutput(JSON.stringify(allSales))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
