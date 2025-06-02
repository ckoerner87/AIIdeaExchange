import { google } from 'googleapis';

export class GoogleSheetsService {
  private sheets: any;
  private spreadsheetId: string;
  private isConfigured: boolean;

  constructor() {
    // Extract spreadsheet ID from the URL
    // https://docs.google.com/spreadsheets/d/1pkysuWrj4G13b0j71cV_S8gRJM0WXB-mT95fQ-7xWpg/edit?usp=sharing
    this.spreadsheetId = '1pkysuWrj4G13b0j71cV_S8gRJM0WXB-mT95fQ-7xWpg';
    
    console.log('Checking Google Sheets credentials...');
    console.log('Service Account Email:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? 'Present' : 'Missing');
    console.log('Private Key:', process.env.GOOGLE_PRIVATE_KEY ? 'Present' : 'Missing');
    
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      console.log('Google Sheets credentials not configured - emails will not be saved to sheets');
      this.isConfigured = false;
      return;
    }

    try {
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      this.sheets = google.sheets({ version: 'v4', auth });
      this.isConfigured = true;
    } catch (error) {
      console.error('Failed to configure Google Sheets:', error);
      this.isConfigured = false;
    }
  }

  async addEmailToSheet(email: string): Promise<void> {
    if (!this.isConfigured) {
      console.log(`Google Sheets not configured - would have saved email: ${email}`);
      return;
    }

    try {
      // First, get the current data to find the next empty row
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'A:A',
      });

      const values = response.data.values || [];
      const nextRow = values.length + 1;

      // Add the email to the next empty row in column A
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `A${nextRow}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[email]],
        },
      });

      console.log(`Email ${email} added to Google Sheet at row ${nextRow}`);
    } catch (error) {
      console.error('Error adding email to Google Sheet:', error);
      throw new Error('Failed to save email to Google Sheet');
    }
  }
}

export const googleSheetsService = new GoogleSheetsService();