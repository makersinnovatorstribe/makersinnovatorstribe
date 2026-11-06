// Paste the published Google Sheets CSV link here once, then deploy this setup.
// Future spreadsheet edits need no code changes or redeployment.
const GOOGLE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTH3VpdsaIrQHpc6jxVwnHKufbCEV7pnKl-I-VjY5N_e6QW6iITIFXetm3flv_qhuaZPD9t18msMlhK/pub?gid=162672760&single=true&output=csv";
window.MIT_SHEET_CMS_CONFIG = Object.freeze({ url: GOOGLE_SHEET_CSV_URL, refreshMs: 60000 });
