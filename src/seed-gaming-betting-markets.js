const Database = require('better-sqlite3');

const db = new Database('./data/pixelpulse.db');

// CS2 Betting Markets
const cs2Markets = [
  {
    title: 'IEM Katowice 2024 Winner',
    description: 'Which team will win IEM Katowice 2024?',
    category: 'CS2',
    options: ['NAVI', 'FaZe', 'G2', 'Vitality', 'Other'],
    end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    fee_rate: 0.02
  },
  {
    title: 'CS2 Major 2024 Champion',
    description: 'Predict the winner of the next CS2 Major',
    category: 'CS2',
    options: ['NAVI', 'FaZe', 'G2', 'Vitality', 'Astralis'],
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    fee_rate: 0.02
  },
  {
    title: 'Top Fraggers - ESL Pro League',
    description: 'Which player will have the highest kill/death ratio?',
    category: 'CS2',
    options: ['s1mple', 'ZywOo', 'NiKo', 'm0NESY', 'donk'],
    end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    fee_rate: 0.02
  },
  {
    title: 'Map Pick - Grand Final',
    description: 'Which map will be decider in the grand final?',
    category: 'CS2',
    options: ['Mirage', 'Inferno', 'Nuke', 'Ancient', 'Anubis'],
    end_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    fee_rate: 0.02
  }
];

// Standoff 2 Betting Markets
const standoff2Markets = [
  {
    title: 'Standoff 2 World Cup Winner',
    description: 'Which team will win the Standoff 2 World Cup?',
    category: 'Standoff2',
    options: ['Team Spirit', 'Navi Junior', 'G2', 'FaZe', 'Other'],
    end_date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
    fee_rate: 0.02
  },
  {
    title: 'Standoff 2 Major Champion',
    description: 'Predict the champion of the upcoming Standoff 2 Major',
    category: 'Standoff2',
    options: ['Team Spirit', 'Navi Junior', 'G2', 'Vitality', 'Astralis'],
    end_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
    fee_rate: 0.02
  },
  {
    title: 'Best Player - Standoff 2',
    description: 'Who will be voted MVP of the tournament?',
    category: 'Standoff2',
    options: ['chopper', 'ked', 'danil', 'kiler', 'other'],
    end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    fee_rate: 0.02
  },
  {
    title: 'First Blood - Grand Final',
    description: 'Which team will get the first kill in the grand final?',
    category: 'Standoff2',
    options: ['Team Spirit', 'Navi Junior', 'G2', 'FaZe'],
    end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    fee_rate: 0.02
  }
];

// Insert CS2 markets
console.log('Seeding CS2 betting markets...');
cs2Markets.forEach(market => {
  const result = db.prepare(`
    INSERT INTO betting_markets (title, description, category, options, end_date, fee_rate)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    market.title,
    market.description,
    market.category,
    JSON.stringify(market.options),
    market.end_date,
    market.fee_rate
  );
  console.log(`  Created: ${market.title} (ID: ${result.lastInsertRowid})`);
});

// Insert Standoff 2 markets
console.log('\nSeeding Standoff 2 betting markets...');
standoff2Markets.forEach(market => {
  const result = db.prepare(`
    INSERT INTO betting_markets (title, description, category, options, end_date, fee_rate)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    market.title,
    market.description,
    market.category,
    JSON.stringify(market.options),
    market.end_date,
    market.fee_rate
  );
  console.log(`  Created: ${market.title} (ID: ${result.lastInsertRowid})`);
});

console.log('\nBetting markets seeded successfully!');
console.log(`Total CS2 markets: ${cs2Markets.length}`);
console.log(`Total Standoff 2 markets: ${standoff2Markets.length}`);

db.close();
