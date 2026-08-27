const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/pixelpulse.db');

// Sample quizzes for anime engagement
const quizzes = [
  {
    anime_id: 1,
    title: 'One Piece Knowledge',
    description: 'Test your knowledge about the Straw Hat crew!',
    questions: JSON.stringify([
      {
        question: 'What is the name of Luffy\'s ship?',
        options: ['Going Merry', 'Thousand Sunny', 'Red Force', 'Moby Dick'],
        correctAnswer: 1
      },
      {
        question: 'What Devil Fruit did Luffy eat?',
        options: ['Gomu Gomu no Mi', 'Mera Mera no Mi', 'Hie Hie no Mi', 'Ope Ope no Mi'],
        correctAnswer: 0
      },
      {
        question: 'Who is the swordsman of the Straw Hat crew?',
        options: ['Sanji', 'Zoro', 'Usopp', 'Brook'],
        correctAnswer: 1
      }
    ]),
    reward_points: 50,
    difficulty: 'easy'
  },
  {
    anime_id: 2,
    title: 'Attack on Titan Trivia',
    description: 'How well do you know the world of Titans?',
    questions: JSON.stringify([
      {
        question: 'What is the name of the walls protecting humanity?',
        options: ['Maria, Rose, Sheena', 'Alpha, Beta, Gamma', 'North, South, East', 'Inner, Middle, Outer'],
        correctAnswer: 0
      },
      {
        question: 'Who is the main protagonist?',
        options: ['Armin', 'Mikasa', 'Eren', 'Levi'],
        correctAnswer: 2
      },
      {
        question: 'What is Eren\'s Titan form called?',
        options: ['Colossal Titan', 'Armored Titan', 'Attack Titan', 'Beast Titan'],
        correctAnswer: 2
      }
    ]),
    reward_points: 75,
    difficulty: 'medium'
  },
  {
    anime_id: 3,
    title: 'Demon Slayer Quiz',
    description: 'Test your knowledge of demon slayers!',
    questions: JSON.stringify([
      {
        question: 'What breathing style does Tanjiro use?',
        options: ['Water Breathing', 'Fire Breathing', 'Sun Breathing', 'Thunder Breathing'],
        correctAnswer: 0
      },
      {
        question: 'Who turned Nezuko into a demon?',
        options: ['Muzan', 'Rui', 'Akaza', 'Kokushibo'],
        correctAnswer: 0
      },
      {
        question: 'What is the Hashira ranked as?',
        options: ['Low Rank', 'Mid Rank', 'High Rank', 'Highest Rank'],
        correctAnswer: 3
      }
    ]),
    reward_points: 60,
    difficulty: 'easy'
  },
  {
    anime_id: 4,
    title: 'Jujutsu Kaisen Challenge',
    description: 'Cursed energy quiz!',
    questions: JSON.stringify([
      {
        question: 'What is Yuji\'s cursed technique?',
        options: ['Divergent Fist', 'Black Flash', 'Cursed Energy Manipulation', 'Domain Expansion'],
        correctAnswer: 0
      },
      {
        question: 'Who is the King of Curses?',
        options: ['Gojo', 'Sukuna', 'Geto', 'Mahoraga'],
        correctAnswer: 1
      },
      {
        question: 'What is Gojo\'s domain expansion called?',
        options: ['Unlimited Void', 'Coffin of the Iron Mountain', 'Horizon of the Captivating Skandha', 'Chimera Shadow Garden'],
        correctAnswer: 0
      }
    ]),
    reward_points: 100,
    difficulty: 'hard'
  },
  {
    anime_id: 5,
    title: 'My Hero Academia Test',
    description: 'Plus Ultra! Quiz time!',
    questions: JSON.stringify([
      {
        question: 'What is Deku\'s real name?',
        options: ['Katsuki', 'Shoto', 'Izuku', 'Tenya'],
        correctAnswer: 2
      },
      {
        question: 'What is All Might\'s quirk called?',
        options: ['All For One', 'One For All', 'Super Strength', 'Power'],
        correctAnswer: 1
      },
      {
        question: 'What class is Deku in?',
        options: ['Class 1-A', 'Class 1-B', 'Class 2-A', 'Class 2-B'],
        correctAnswer: 0
      }
    ]),
    reward_points: 50,
    difficulty: 'easy'
  },
  {
    anime_id: null,
    title: 'Counter-Strike 2 Trivia',
    description: 'How well do you know CS2?',
    questions: JSON.stringify([
      { question: 'What year was Counter-Strike originally released?', options: ['1998', '1999', '2000', '2001'], correctAnswer: 1 },
      { question: 'Which weapon is known as the "AWP"?', options: ['Assault Rifle', 'Sniper Rifle', 'Shotgun', 'SMG'], correctAnswer: 1 },
      { question: 'What is the max players on one team in standard competitive?', options: ['4', '5', '6', '7'], correctAnswer: 1 },
      { question: 'Which map is the most iconic in CS history?', options: ['Nuke', 'Dust2', 'Inferno', 'Mirage'], correctAnswer: 1 }
    ]),
    reward_points: 75,
    difficulty: 'medium'
  },
  {
    anime_id: null,
    title: 'Roblox Knowledge Quiz',
    description: 'Test your Roblox expertise!',
    questions: JSON.stringify([
      { question: 'What currency is used in Roblox?', options: ['Coins', 'Robux', 'Gems', 'Bux'], correctAnswer: 1 },
      { question: 'What year was Roblox released?', options: ['2004', '2006', '2008', '2010'], correctAnswer: 1 },
      { question: 'What is the name of Roblox\'s creator?', options: ['David Baszucki', 'Mark Zuckerberg', 'Notch', 'Tim Sweeney'], correctAnswer: 0 },
      { question: 'What are tradable items on Roblox called?', options: ['Limiteds', 'Rares', 'Exclusives', 'Specials'], correctAnswer: 0 }
    ]),
    reward_points: 50,
    difficulty: 'easy'
  },
  {
    anime_id: null,
    title: 'Fortnite Battle Royale Quiz',
    description: 'Think you know Fortnite?',
    questions: JSON.stringify([
      { question: 'What currency is used in Fortnite?', options: ['Gems', 'V-Bucks', 'Coins', 'Gold'], correctAnswer: 1 },
      { question: 'What year did Fortnite Battle Royale release?', options: ['2016', '2017', '2018', '2019'], correctAnswer: 1 },
      { question: 'How many players are in a standard squad?', options: ['3', '4', '5', '6'], correctAnswer: 1 },
      { question: 'What is the rarest pickaxe in Fortnite?', options: ['Reaper', 'Raider\'s Revenge', 'AC/DC', 'Rainbow Smash'], correctAnswer: 1 }
    ]),
    reward_points: 50,
    difficulty: 'easy'
  },
  {
    anime_id: null,
    title: 'Valorant Pro Quiz',
    description: 'Test your Valorant knowledge!',
    questions: JSON.stringify([
      { question: 'What currency is used in Valorant?', options: ['VP', 'RP', 'CP', 'GP'], correctAnswer: 0 },
      { question: 'How many agents are on a standard team?', options: ['4', '5', '6', '7'], correctAnswer: 1 },
      { question: 'Which agent has the ability "Showstopper"?', options: ['Jett', 'Raze', 'Sage', 'Phoenix'], correctAnswer: 1 },
      { question: 'What year was Valorant released?', options: ['2019', '2020', '2021', '2022'], correctAnswer: 1 }
    ]),
    reward_points: 75,
    difficulty: 'medium'
  },
  {
    anime_id: null,
    title: 'Free Fire Trivia',
    description: 'How well do you know Free Fire?',
    questions: JSON.stringify([
      { question: 'What currency is used in Free Fire?', options: ['Coins', 'Diamonds', 'Gold', 'Credits'], correctAnswer: 1 },
      { question: 'How many players land on an island in a standard match?', options: ['50', '100', '150', '200'], correctAnswer: 0 },
      { question: 'What company developed Free Fire?', options: ['Tencent', 'Garena', 'PUBG Corp', 'Supercell'], correctAnswer: 1 },
      { question: 'What is the max level character skill in Free Fire?', options: ['5', '6', '7', '8'], correctAnswer: 3 }
    ]),
    reward_points: 50,
    difficulty: 'easy'
  },
  {
    anime_id: null,
    title: 'Call of Duty Challenge',
    description: 'Think you know CoD?',
    questions: JSON.stringify([
      { question: 'What currency is used in Call of Duty?', options: ['CP', 'RP', 'VP', 'GP'], correctAnswer: 0 },
      { question: 'What was the first Call of Duty game?', options: ['CoD 2', 'CoD (2003)', 'Modern Warfare', 'Black Ops'], correctAnswer: 1 },
      { question: 'Which CoD game introduced Warzone?', options: ['Modern Warfare 2019', 'Black Ops Cold War', 'Vanguard', 'MW2'], correctAnswer: 0 },
      { question: 'How many players in a Warzone squad max?', options: ['3', '4', '5', '6'], correctAnswer: 1 }
    ]),
    reward_points: 75,
    difficulty: 'medium'
  },
  {
    anime_id: null,
    title: 'PUBG Mobile Quiz',
    description: 'Test your PUBG Mobile skills!',
    questions: JSON.stringify([
      { question: 'What currency is used in PUBG Mobile?', options: ['UC', 'BP', 'RP', 'Both UC and BP'], correctAnswer: 3 },
      { question: 'How many players land in a classic match?', options: ['50', '75', '100', '120'], correctAnswer: 2 },
      { question: 'What company publishes PUBG Mobile?', options: ['Tencent', 'Krafton', 'Garena', 'EA'], correctAnswer: 0 },
      { question: 'What is the name of the desert map?', options: ['Erangel', 'Miramar', 'Sanhok', 'Vikendi'], correctAnswer: 1 }
    ]),
    reward_points: 50,
    difficulty: 'easy'
  },
  {
    anime_id: null,
    title: 'Genshin Impact Quiz',
    description: 'Test your Teyvat knowledge!',
    questions: JSON.stringify([
      { question: 'What currency is used for wishes in Genshin?', options: ['Primogems', 'Crystals', 'Mora', 'Stardust'], correctAnswer: 0 },
      { question: 'How many elements are in Genshin Impact?', options: ['5', '6', '7', '8'], correctAnswer: 2 },
      { question: 'Who is the main character?', options: ['Aether', 'Lumine', 'Both Aether and Lumine', 'Paimon'], correctAnswer: 2 },
      { question: 'What company developed Genshin Impact?', options: ['miHoYo', 'Tencent', 'NetEase', 'Square Enix'], correctAnswer: 0 }
    ]),
    reward_points: 75,
    difficulty: 'medium'
  },
  {
    anime_id: null,
    title: 'General Gaming Trivia',
    description: 'A mix of gaming questions across all platforms!',
    questions: JSON.stringify([
      { question: 'What is the best-selling video game of all time?', options: ['Tetris', 'Minecraft', 'GTA V', 'Wii Sports'], correctAnswer: 1 },
      { question: 'What year was the PlayStation 1 released?', options: ['1993', '1994', '1995', '1996'], correctAnswer: 1 },
      { question: 'Which company created the Xbox?', options: ['Sony', 'Nintendo', 'Microsoft', 'Sega'], correctAnswer: 2 },
      { question: 'What does "FPS" stand for in gaming?', options: ['First Person Shooter', 'Frames Per Second', 'Both', 'Fast Play Style'], correctAnswer: 2 },
      { question: 'What is the most popular gaming platform?', options: ['PC', 'Mobile', 'Console', 'Handheld'], correctAnswer: 1 }
    ]),
    reward_points: 100,
    difficulty: 'hard'
  }
];

// Insert quizzes
const insertSql = `INSERT INTO quizzes (anime_id, title, description, questions, reward_points, difficulty) VALUES (?, ?, ?, ?, ?, ?)`;

let completed = 0;
quizzes.forEach(quiz => {
  db.run(insertSql, [quiz.anime_id, quiz.title, quiz.description, quiz.questions, quiz.reward_points, quiz.difficulty], function(err) {
    if (err) {
      console.error(`Error inserting quiz ${quiz.title}:`, err.message);
    } else {
      console.log(`Inserted quiz: ${quiz.title}`);
    }
    completed++;
    if (completed === quizzes.length) {
      console.log('Quiz seeding complete!');
      db.close();
    }
  });
});
