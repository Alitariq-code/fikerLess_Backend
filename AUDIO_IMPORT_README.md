# Audio Import Script

This script extracts metadata from audio files in the `Audio_Files/` directory and stores them in MongoDB.

## What it does:

1. **Scans** all `.mp3` files in `Audio_Files/` directory
2. **Extracts metadata** from each file:
   - Duration (in seconds)
   - File size (in bytes)
   - Bitrate (in kbps)
   - Sample rate (in Hz)
   - Format
3. **Parses filename** to extract:
   - Title (from filename)
   - Language (Urdu/English)
   - Category (Breathing/Meditation/Sleep/etc.)
4. **Stores** everything in MongoDB `audios` collection

## How to run:

```bash
npm run import:audios
```

## Prerequisites:

1. MongoDB must be running
2. Environment variables set (or using defaults):
   - `MONGODB_HOST` (default: localhost)
   - `MONGODB_PORT` (default: 27017)
   - `MONGODB_DB` (default: fikrless)
   - `MONGODB_USERNAME` (optional)
   - `MONGODB_PASSWORD` (optional)

## What gets stored:

Each audio document contains:
- `filename` - Original filename
- `title` - Extracted title (e.g., "Sukoon Bhari Saans")
- `language` - Urdu or English
- `category` - Breathing, Meditation, Sleep, etc.
- `duration` - Duration in seconds
- `file_size` - File size in bytes
- `stream_url` - URL path for streaming
- `description` - Auto-generated description
- `bitrate` - Audio bitrate in kbps
- `sample_rate` - Sample rate in Hz
- `format` - Audio format (mp3)
- `is_active` - Whether audio is active (default: true)
- `play_count` - Number of times played (default: 0)
- `order` - Custom ordering (default: 0)

## Example output:

```
Connecting to MongoDB: mongodb://localhost:27017/fikrless
✅ Connected to MongoDB
📁 Reading audio files from: /path/to/Audio_Files
📊 Found 14 audio files

[1/14] Processing: Audio1_"Sukoon Bhari Saans"_Urdu.mp3
  📥 Extracting metadata...
  ✅ Extracted: Sukoon Bhari Saans (300s, 3.24MB)

[2/14] Processing: Audio11_"Grounding Breath"_English.mp3
  📥 Extracting metadata...
  ✅ Extracted: Grounding Breath (420s, 1.57MB)

...

✅ Import complete!
   📥 Inserted: 14 new audios
   🔄 Updated: 0 existing audios
🔌 Database connection closed
```

## Notes:

- The script uses **upsert** - it will update existing audios if filename matches, or insert new ones
- If you want to clear existing audios first, uncomment the `deleteMany` line in the script
- The script handles filenames with quotes and special characters
- Duration extraction may take a few seconds per file

## Troubleshooting:

**Error: "Audio directory not found"**
- Make sure `Audio_Files/` directory exists in project root

**Error: "Could not extract duration"**
- Some MP3 files may not have proper metadata
- The script will continue with duration=0 (you can manually update later)

**Error: MongoDB connection failed**
- Check MongoDB is running
- Verify connection credentials in `.env` file

