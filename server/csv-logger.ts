import fs from 'fs';
import path from 'path';

interface UserRegistration {
  username: string;
  email: string;
  timestamp: string;
  ipAddress?: string;
}

export class CSVLogger {
  private csvPath: string;

  constructor() {
    this.csvPath = path.join(process.cwd(), 'user_registrations.csv');
    this.initializeCSV();
  }

  private initializeCSV(): void {
    // Check if CSV file exists, if not create it with headers
    if (!fs.existsSync(this.csvPath)) {
      const headers = 'Username,Email,Timestamp,IP Address\n';
      fs.writeFileSync(this.csvPath, headers);
    }
  }

  async logUserRegistration(userData: UserRegistration): Promise<void> {
    try {
      // Escape any commas or quotes in the data
      const escapedUsername = this.escapeCSVField(userData.username);
      const escapedEmail = this.escapeCSVField(userData.email);
      const timestamp = userData.timestamp;
      const ipAddress = userData.ipAddress || 'Unknown';

      const csvLine = `${escapedUsername},${escapedEmail},${timestamp},${ipAddress}\n`;
      
      // Append to CSV file
      fs.appendFileSync(this.csvPath, csvLine);
      
      console.log(`User registration logged to CSV: ${userData.username} (${userData.email})`);
    } catch (error) {
      console.error('Failed to log user registration to CSV:', error);
    }
  }

  private escapeCSVField(field: string): string {
    // If field contains comma, newline, or quote, wrap in quotes and escape internal quotes
    if (field.includes(',') || field.includes('\n') || field.includes('"')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }

  getCSVPath(): string {
    return this.csvPath;
  }
}

export const csvLogger = new CSVLogger();