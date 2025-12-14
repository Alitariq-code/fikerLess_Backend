# Audio Streaming Test Page Guide

## 🚀 Quick Start

1. **Start your NestJS server:**
   ```bash
   npm run start:dev
   ```

2. **Open the test page in your browser:**
   ```
   http://localhost:5002/audio-test.html
   ```

## 📋 Features

### 1. **Audio Library**
- View all audio files from database
- See metadata: title, duration, size, language, category
- Click any audio card to play it

### 2. **Audio Player**
- Full-featured HTML5 audio player
- Supports seeking (click anywhere on progress bar)
- Test buttons for seeking to 25%, 50%, 75%
- Real-time buffering information

### 3. **Streaming Tests**
- **Test Range Request**: Click to test HTTP Range Request (206 Partial Content)
- See streaming headers: Content-Range, Accept-Ranges, etc.
- Verify Spotify/YouTube-style streaming works

### 4. **Filters**
- Filter by Language (Urdu/English)
- Filter by Category (Breathing, Meditation, etc.)
- Search by title or description

### 5. **Statistics**
- Total number of audios
- Count of Urdu audios
- Count of English audios

### 6. **API Testing**
- View all API responses in real-time
- See request/response details
- Test all endpoints

## 🎯 Testing Scenarios

### Test 1: Basic Streaming
1. Click "Load All Audios"
2. Click any audio card
3. Click play button
4. Audio should start streaming

### Test 2: Seeking
1. Play an audio
2. Click "50%" button
3. Audio should jump to middle
4. Try clicking on progress bar

### Test 3: Range Request
1. Play an audio
2. Click "Test Range Request"
3. Check the "Streaming Info" box
4. Should show `206 Partial Content` status
5. Should show `Content-Range` header

### Test 4: Filters
1. Select "Urdu" from Language filter
2. Only Urdu audios should show
3. Try searching for "breath"
4. Filtered results should appear

## 🔍 What to Look For

### ✅ Success Indicators:
- Audio plays smoothly
- Seeking works instantly
- Range Request shows `206 Partial Content`
- Headers show proper `Content-Range` format
- Buffering happens progressively
- No full file download (check Network tab)

### ❌ Issues to Watch:
- Audio doesn't play → Check CORS, file path
- Seeking doesn't work → Check Range Request support
- Full file download → Range Request not working
- 404 errors → Check filename encoding

## 🌐 Browser Compatibility

- ✅ Chrome/Edge (Full support)
- ✅ Firefox (Full support)
- ✅ Safari (Full support)
- ✅ Mobile browsers (Full support)

## 📡 API Endpoints Tested

1. `GET /api/v1/audio/list` - List all audios
2. `GET /api/v1/audio/:id` - Get single audio
3. `GET /api/v1/audio/stream/:filename` - Stream audio (with Range support)
4. `GET /api/v1/audio/categories` - Get categories
5. `GET /api/v1/audio/languages` - Get languages
6. `GET /api/v1/audio/:id/play` - Track play count

## 🐛 Debugging

### Check Browser Console:
- Open DevTools (F12)
- Go to Network tab
- Look for audio requests
- Check if `Range` header is sent
- Check if response is `206 Partial Content`

### Common Issues:

**Issue**: Audio doesn't load
- **Solution**: Check if server is running and API base URL is correct

**Issue**: CORS errors
- **Solution**: CORS is already enabled in main.ts

**Issue**: 404 on stream endpoint
- **Solution**: Check filename encoding, ensure file exists in Audio_Files/

**Issue**: Full file download instead of streaming
- **Solution**: Check if Range header is being sent (should be automatic)

## 🎉 Success!

If everything works:
- ✅ Audio streams smoothly
- ✅ Seeking works instantly
- ✅ Range Request returns 206
- ✅ Only requested chunks are downloaded
- ✅ Works like Spotify/YouTube!

Enjoy testing! 🎵

