import * as mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { InternshipSchema } from '../src/models/schemas/internship.schema';

interface InternshipData {
  _id?: string;
  mentorName: string;
  profession: string;
  specialization?: string;
  programs: Array<{
    _id?: string;
    title: string;
    duration: string;
    fees: number;
    mode?: string;
    description?: string;
  }>;
  includes?: string[];
  city: string;
  cityNote?: string;
  additionalInfo?: string;
  isActive?: boolean;
  is_active?: boolean;
  sortOrder?: number;
  isMultipleCity?: boolean;
}

async function importInternships() {
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
    console.log('✅ Connected to MongoDB');

    // Read the JSON file
    const dataPath = path.join(__dirname, '..', 'data', 'internships.json');
    console.log(`📁 Reading internships from: ${dataPath}`);

    if (!fs.existsSync(dataPath)) {
      console.error(`❌ File not found: ${dataPath}`);
      process.exit(1);
    }

    const fileContent = fs.readFileSync(dataPath, 'utf-8');
    const internshipsData: InternshipData[] = JSON.parse(fileContent);

    console.log(`📊 Found ${internshipsData.length} internships to import\n`);

    // Create model
    const InternshipModel = mongoose.model('Internship', InternshipSchema);

    // Drop existing collection (optional - comment out if you want to keep existing data)
    console.log('🗑️  Dropping existing internships collection...');
    await InternshipModel.collection.drop().catch(() => {
      console.log('   (Collection did not exist, continuing...)');
    });

    // Insert internships
    let inserted = 0;
    let skipped = 0;

    for (let i = 0; i < internshipsData.length; i++) {
      const data = internshipsData[i];
      try {
        console.log(`[${i + 1}/${internshipsData.length}] Processing: ${data.mentorName}`);
        console.log(`   Profession: ${data.profession}`);
        console.log(`   City: ${data.city}`);
        console.log(`   Programs: ${data.programs.length}`);

        // Clean up the data - remove _id fields and map isActive to is_active
        const { _id, isActive, isMultipleCity, sortOrder, programs, ...restData } = data;
        
        // Clean programs - remove _id from each program
        const cleanedPrograms = programs.map(({ _id: programId, ...program }) => program);

        const internship = new InternshipModel({
          ...restData,
          programs: cleanedPrograms,
          is_active: isActive !== undefined ? isActive : (data.is_active !== undefined ? data.is_active : true),
          view_count: 0,
          application_count: 0,
        });

        await internship.save();
        inserted++;
        console.log(`   ✅ Inserted successfully\n`);
      } catch (error: any) {
        console.error(`   ❌ Error: ${error.message}\n`);
        skipped++;
      }
    }

    console.log('\n✅ Import complete!');
    console.log(`   📥 Inserted: ${inserted} internships`);
    if (skipped > 0) {
      console.log(`   ⚠️  Skipped: ${skipped} internships`);
    }

    // Verify count
    const totalCount = await InternshipModel.countDocuments();
    console.log(`   📊 Total internships in database: ${totalCount}`);

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error: any) {
    console.error('❌ Error importing internships:', error);
    process.exit(1);
  }
}

// Run the import
importInternships();

