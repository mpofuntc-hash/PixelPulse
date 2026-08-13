const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const db = new Database('./data/pixelpulse.db');
const animeDir = 'E:\\PixelPulse';

// Parse filename to extract anime info
function parseFilename(filename) {
  // Format: AnimeTitle_English_S01_E001_720p.mp4
  // or: AnimeTitle_English_S1-S2_S01_E001_720p.mp4
  
  const parts = filename.replace('.mp4', '').split('_');
  
  if (parts.length < 4) return null;
  
  const title = parts.slice(0, -3).join('_').replace(/_/g, ' ');
  const seasonPart = parts[parts.length - 3]; // S01 or S1-S2
  const episodePart = parts[parts.length - 2]; // E001
  const quality = parts[parts.length - 1]; // 720p or 480p
  
  // Extract season number
  const seasonMatch = seasonPart.match(/S(\d+)/);
  const season = seasonMatch ? parseInt(seasonMatch[1]) : 1;
  
  // Extract episode number
  const episodeMatch = episodePart.match(/E(\d+)/);
  const episode = episodeMatch ? parseInt(episodeMatch[1]) : 1;
  
  return {
    title: title.replace(/English/g, '').trim(),
    season,
    episode,
    quality,
    originalTitle: parts.slice(0, -3).join('_')
  };
}

// Get all anime files
const files = fs.readdirSync(animeDir).filter(f => f.endsWith('.mp4'));

// Group by anime title
const animeGroups = {};

files.forEach(file => {
  const parsed = parseFilename(file);
  if (!parsed) return;
  
  const key = parsed.originalTitle;
  if (!animeGroups[key]) {
    animeGroups[key] = {
      title: parsed.title,
      episodes: []
    };
  }
  
  animeGroups[key].episodes.push({
    file,
    episode: parsed.episode,
    season: parsed.season,
    quality: parsed.quality,
    path: path.join(animeDir, file)
  });
});

// Import to database
Object.entries(animeGroups).forEach(([key, anime]) => {
  console.log(`Importing: ${anime.title}`);
  
  // Check if anime exists
  const existing = db.prepare('SELECT * FROM anime WHERE title = ?').get(anime.title);
  let animeId;
  
  if (!existing) {
    // Determine if this is a "big 3" anime (free tier)
    const big3 = ['One Piece', 'Naruto', 'Dragon Ball Z'];
    const isFree = big3.some(name => anime.title.toLowerCase().includes(name.toLowerCase()));
    
    const result = db.prepare(`
      INSERT INTO anime (title, description, cover_image, genre, year, rating, free_tier)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      anime.title,
      `Watch ${anime.title} online`,
      'https://via.placeholder.com/400x280?text=' + encodeURIComponent(anime.title),
      'Anime',
      2020,
      'TV-14',
      isFree ? 1 : 0
    );
    animeId = result.lastInsertRowid;
    console.log(`  Created anime ID: ${animeId} (Free: ${isFree})`);
  } else {
    animeId = existing.id;
    console.log(`  Using existing anime ID: ${animeId}`);
  }
  
  // Add episodes
  anime.episodes.forEach(ep => {
    const existingEp = db.prepare(`
      SELECT * FROM episodes 
      WHERE anime_id = ? AND episode_number = ? AND season = ?
    `).get(animeId, ep.episode, ep.season);
    
    if (!existingEp) {
      db.prepare(`
        INSERT INTO episodes (anime_id, episode_number, title, video_url, duration, season)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        animeId,
        ep.episode,
        `Season ${ep.season} Episode ${ep.episode}`,
        ep.path,
        1440, // Default duration (24 minutes)
        ep.season
      );
      console.log(`    Added episode S${ep.season}E${ep.episode}`);
    } else {
      console.log(`    Episode S${ep.season}E${ep.episode} already exists`);
    }
  });
});

console.log('\nImport complete!');
console.log(`Imported ${Object.keys(animeGroups).length} anime series`);
console.log(`Total episodes: ${files.length}`);

db.close();
