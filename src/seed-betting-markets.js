const Database = require('better-sqlite3');

const db = new Database('./data/pixelpulse.db');

const sampleMarkets = [
  {
    title: 'Will One Piece anime continue after manga ends?',
    description: 'The One Piece manga is approaching its finale. Will the anime continue with original storylines?',
    category: 'Anime Predictions',
    options: ['Yes', 'No'],
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    fee_rate: 0.02
  },
  {
    title: 'Who will be the final villain in Jujutsu Kaisen?',
    description: 'As Jujutsu Kaisen approaches its climax, who will be the ultimate antagonist?',
    category: 'Character Predictions',
    options: ['Sukuna', 'Kenjaku', 'Gojo (corrupted)', 'New character'],
    end_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days
    fee_rate: 0.02
  },
  {
    title: 'Will Demon Slayer Season 4 release in 2025?',
    description: 'After the success of Season 3, will we see Season 4 in 2025?',
    category: 'Release Predictions',
    options: ['Yes', 'No'],
    end_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days
    fee_rate: 0.02
  },
  {
    title: 'Which anime will have highest viewership this season?',
    description: 'Bet on which upcoming anime will dominate the viewership charts.',
    category: 'Popularity Contest',
    options: ['Solo Leveling S2', 'One Punch Man S3', 'Chainsaw Man S2', 'Bleach TYBW Part 3'],
    end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
    fee_rate: 0.02
  },
  {
    title: 'Will My Hero Academia have a sequel after current arc?',
    description: 'The current manga arc is nearing its conclusion. Will there be a sequel series?',
    category: 'Future Predictions',
    options: ['Yes', 'No'],
    end_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(), // 45 days
    fee_rate: 0.02
  }
];

sampleMarkets.forEach(market => {
  const result = db.prepare(`
    INSERT INTO betting_markets (title, description, category, options, end_date, fee_rate)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(market.title, market.description, market.category, JSON.stringify(market.options), market.end_date, market.fee_rate);
  
  console.log(`Created market: ${market.title} (ID: ${result.lastInsertRowid})`);
});

console.log('\nBetting markets seeded successfully!');
db.close();
