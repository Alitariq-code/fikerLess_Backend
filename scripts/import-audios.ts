import * as mongoose from 'mongoose';
import * as path from 'path';
import * as fs from 'fs';
import { statSync, readdirSync } from 'fs';
import { parseFile } from 'music-metadata';
import { AudioSchema } from '../src/models/schemas/audio.schema';

interface AudioMetadata {
  filename: string;
  title: string;
  language: 'Urdu' | 'English';
  category: string;
  duration: number;
  file_size: number;
  stream_url: string;
  description: string;
  bitrate?: number;
  sample_rate?: number;
  format?: string;
}

async function parseFilename(filename: string): Promise<Partial<AudioMetadata>> {
  // Example: "Audio1_"Sukoon Bhari Saans"_Urdu.mp3" or "Audio11_"Grounding Breath"_English.mp3"
  const withoutExt = filename.replace(/\.mp3$/i, '');
  
  let title = '';
  let language: 'Urdu' | 'English' = 'English';
  let category = 'Breathing'; // Default
  
  // Extract language (check for Urdu or English in filename)
  const filenameLower = filename.toLowerCase();
  if (filenameLower.includes('urdu')) {
    language = 'Urdu';
  } else if (filenameLower.includes('english')) {
    language = 'English';
  }
  
  // Extract title - handle filenames with quotes
  // Pattern: AudioXX_"Title"_Language.mp3 or AudioXX_Title_Language.mp3
  const audioNumberMatch = filename.match(/Audio\d+/i);
  if (audioNumberMatch) {
    // Find the part after Audio number
    let titlePart = withoutExt.substring(audioNumberMatch[0].length);
    
    // Remove language suffix if present
    const langPattern = new RegExp(`_?${language}(?:\\.mp3)?$`, 'i');
    titlePart = titlePart.replace(langPattern, '').trim();
    
    // Remove leading/trailing underscores and quotes
    titlePart = titlePart.replace(/^_+|_+$/g, '').trim();
    titlePart = titlePart.replace(/^["']+|["']+$/g, '').trim();
    
    // Replace underscores with spaces, but preserve quoted sections
    if (titlePart.includes('"') || titlePart.includes("'")) {
      // If there are quotes, extract the quoted part
      const quotedMatch = titlePart.match(/["']([^"']+)["']/);
      if (quotedMatch) {
        title = quotedMatch[1];
      } else {
        title = titlePart.replace(/_/g, ' ').trim();
      }
    } else {
      title = titlePart.replace(/_/g, ' ').trim();
    }
  } else {
    // No Audio number found, use filename without extension and language
    title = withoutExt
      .replace(new RegExp(`_?${language}(?:\\.mp3)?$`, 'i'), '')
      .replace(/^_+|_+$/g, '')
      .replace(/["']/g, '')
      .replace(/_/g, ' ')
      .trim();
  }
  
  // Extract category from title
  const titleLower = title.toLowerCase();
  if (titleLower.includes('breath') || titleLower.includes('saans')) {
    category = 'Breathing';
  } else if (titleLower.includes('meditation') || titleLower.includes('dhyaan')) {
    category = 'Meditation';
  } else if (titleLower.includes('sleep') || titleLower.includes('neend')) {
    category = 'Sleep';
  } else if (titleLower.includes('relax') || titleLower.includes('sukoon')) {
    category = 'Relaxation';
  } else if (titleLower.includes('mindful') || titleLower.includes('mindfulness')) {
    category = 'Mindfulness';
  }
  
  return {
    title: title || filename.replace(/\.mp3$/i, '').replace(/["']/g, ''),
    language,
    category,
  };
}

async function extractAudioMetadata(filePath: string): Promise<{
  duration: number;
  bitrate?: number;
  sample_rate?: number;
  format?: string;
}> {
  try {
    const metadata = await parseFile(filePath);
    const duration = metadata.format.duration || 0;
    const bitrate = metadata.format.bitrate ? Math.round(metadata.format.bitrate / 1000) : undefined; // Convert to kbps
    const sampleRate = metadata.format.sampleRate;
    const format = metadata.format.container;
    
    return {
      duration: Math.round(duration),
      bitrate,
      sample_rate: sampleRate,
      format: format || 'mp3',
    };
  } catch (error) {
    console.error(`Error extracting metadata from ${filePath}:`, error);
    return {
      duration: 0,
    };
  }
}

async function importAudios() {
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

    // Create Audio model
    let AudioModel;
    try {
      AudioModel = mongoose.model('Audio');
    } catch {
      AudioModel = mongoose.model('Audio', AudioSchema);
    }

    // Read audio files directory
    const audioDir = path.join(process.cwd(), 'Audio_Files');
    console.log(`📁 Reading audio files from: ${audioDir}`);

    if (!fs.existsSync(audioDir)) {
      throw new Error(`Audio directory not found: ${audioDir}`);
    }

    const files = readdirSync(audioDir).filter(file => 
      file.toLowerCase().endsWith('.mp3')
    );

    console.log(`📊 Found ${files.length} audio files`);

    if (files.length === 0) {
      console.log('⚠️  No audio files found. Exiting.');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Process each file
    const audioData: AudioMetadata[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const filename = files[i];
      const filePath = path.join(audioDir, filename);
      
      console.log(`\n[${i + 1}/${files.length}] Processing: ${filename}`);
      
      try {
        // Get file stats
        const stats = statSync(filePath);
        const fileSize = stats.size;
        
        // Parse filename to extract metadata
        const parsedData = await parseFilename(filename);
        
        // Extract audio metadata (duration, bitrate, etc.)
        console.log(`  📥 Extracting metadata...`);
        const audioMetadata = await extractAudioMetadata(filePath);
        
        if (audioMetadata.duration === 0) {
          console.log(`  ⚠️  Warning: Could not extract duration for ${filename}`);
        }
        
        // Build description
        const description = `${parsedData.title} - ${parsedData.language} ${parsedData.category.toLowerCase()} exercise`;
        
        const audio: AudioMetadata = {
          filename,
          title: parsedData.title || filename.replace(/\.mp3$/i, ''),
          language: parsedData.language,
          category: parsedData.category,
          duration: audioMetadata.duration,
          file_size: fileSize,
          stream_url: `/api/v1/audio/stream/${encodeURIComponent(filename)}`,
          description,
          bitrate: audioMetadata.bitrate,
          sample_rate: audioMetadata.sample_rate,
          format: audioMetadata.format,
        };
        
        audioData.push(audio);
        
        console.log(`  ✅ Extracted: ${audio.title} (${audio.duration}s, ${(fileSize / 1024 / 1024).toFixed(2)}MB)`);
      } catch (error) {
        console.error(`  ❌ Error processing ${filename}:`, error);
        continue;
      }
    }

    console.log(`\n📝 Processing ${audioData.length} audio files for database...`);

    // Drop existing collection to avoid index conflicts
    try {
      await AudioModel.collection.drop();
      console.log('🗑️  Dropped existing audios collection');
    } catch (error: any) {
      if (error.codeName === 'NamespaceNotFound') {
        console.log('📝 Creating new audios collection');
      } else {
        console.log('⚠️  Could not drop collection (may not exist):', error.message);
      }
    }

    // Insert all audios
    let inserted = 0;
    let errors = 0;

    try {
      const result = await AudioModel.insertMany(audioData, { ordered: false });
      inserted = result.length;
      console.log(`  ✅ Successfully inserted ${inserted} audios`);
    } catch (error: any) {
      // Handle partial success (some inserts may succeed)
      if (error.writeErrors) {
        inserted = error.result?.insertedCount || 0;
        errors = error.writeErrors.length;
        console.error(`  ⚠️  Partial success: ${inserted} inserted, ${errors} errors`);
        error.writeErrors.forEach((err: any) => {
          console.error(`     - ${err.errmsg}`);
        });
      } else {
        console.error(`  ❌ Error inserting audios:`, error.message);
        errors = audioData.length;
      }
    }

    console.log(`\n✅ Import complete!`);
    console.log(`   📥 Inserted: ${inserted} audios`);
    if (errors > 0) {
      console.log(`   ❌ Errors: ${errors}`);
    }

    // Close connection
    try {
      await mongoose.disconnect();
      console.log('🔌 Database connection closed');
    } catch (disconnectError) {
      console.log('⚠️  Connection already closed or error during disconnect');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error importing audios:', error);
    
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
importAudios();

