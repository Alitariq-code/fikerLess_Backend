import * as XLSX from 'xlsx';
import * as path from 'path';
import * as mongoose from 'mongoose';
import { QuoteSchema } from '../src/models/schemas/quote.schema';

async function importQuotes() {
  try {
    // Connect to MongoDB
    const host = process.env.MONGODB_HOST || 'localhost';
    const port = process.env.MONGODB_PORT || 27017;
    const db = process.env.MONGODB_DB || process.env.MONGODB_DATABASE || 'fikrless';
    const username = process.env.MONGODB_USERNAME;
    const password = process.env.MONGODB_PASSWORD;

    let uri = `mongodb://${host}:${port}/${db}`;

    if (username && password) {
      uri = `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${db}?authSource=admin`;
    }

    console.log(`Connecting to MongoDB: ${uri.replace(/:[^:@]+@/, ':****@')}`);
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    // Create Quote model (check if it already exists)
    let QuoteModel;
    try {
      QuoteModel = mongoose.model('Quote');
    } catch {
      QuoteModel = mongoose.model('Quote', QuoteSchema);
    }

    // Read Excel file
    const excelPath = path.join(process.cwd(), 'FikrLess Quote Bank.xlsx');
    console.log(`Reading Excel file: ${excelPath}`);

    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    console.log(`Found ${data.length - 1} rows (excluding header)`);

    // Skip header row and process data
    const quotes = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i] as any[];
      
      if (!row || row.length < 1) {
        console.log(`Skipping row ${i + 1}: insufficient data`);
        continue;
      }

      const quoteEnglish = row[0]?.toString().trim() || '';
      const quoteUrdu = row[1]?.toString().trim() || '';
      const quranicVerse = row[2]?.toString().trim() || '';

      // Only require English quote, Urdu and Quranic verse are optional
      if (!quoteEnglish) {
        console.log(`Skipping row ${i + 1}: missing English quote`);
        continue;
      }

      quotes.push({
        quote_english: quoteEnglish,
        quote_urdu: quoteUrdu || '',
        quranic_verse: quranicVerse || '',
      });
    }

    console.log(`Processing ${quotes.length} quotes...`);

    // Clear existing quotes (optional - comment out if you want to keep existing)
    // await QuoteModel.deleteMany({});
    // console.log('Cleared existing quotes');

    // Insert quotes
    const result = await QuoteModel.insertMany(quotes, { ordered: false });
    console.log(`Successfully imported ${result.length} quotes!`);

    // Close connection
    try {
      await mongoose.disconnect();
      console.log('Database connection closed');
    } catch (disconnectError) {
      // Ignore disconnect errors
      console.log('Connection already closed or error during disconnect');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error importing quotes:', error);
    
    // Ensure connection is closed even on error
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      // Ignore disconnect errors
    }
    
    process.exit(1);
  }
}

// Run the import
importQuotes();

