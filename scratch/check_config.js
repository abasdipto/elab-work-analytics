const fetch = require('node-fetch');

const apiUrl = 'https://script.google.com/macros/s/AKfycbyOpsMJHJdyFkHUbUuXW5QmG_TOes47pnM2Vk5yw58pPHzY_6XEVLqSE9sPucz3nCcm/exec';

async function checkConfig() {
  try {
    const res = await fetch(apiUrl);
    const rawData = await res.json();
    
    // Find latest ConfigUpdate
    const configUpdateRecord = rawData
      .map((row, index) => ({
        time: row['Timestamp'],
        type: row['Action Type'],
        user: row['User'],
        detail: row['Detail']
      }))
      .filter(f => f.time && f.type.toLowerCase().trim() === 'configupdate')
      .reverse()[0];
      
    if (configUpdateRecord) {
      console.log("Found ConfigUpdate record:", JSON.stringify(configUpdateRecord, null, 2));
    } else {
      console.log("No ConfigUpdate record found in the Google Sheet!");
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

checkConfig();
