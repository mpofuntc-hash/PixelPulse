const Database = require('better-sqlite3');
const db = new Database('./data/pixelpulse.db');

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
  }
];

// Insert quizzes
const insertQuiz = db.prepare(`
  INSERT INTO quizzes (anime_id, title, description, questions, reward_points, difficulty)
  VALUES (?, ?, ?, ?, ?, ?)
`);

quizzes.forEach(quiz => {
  try {
    insertQuiz.run(
      quiz.anime_id,
      quiz.title,
      quiz.description,
      quiz.questions,
      quiz.reward_points,
      quiz.difficulty
    );
    console.log(`Inserted quiz: ${quiz.title}`);
  } catch (error) {
    console.error(`Error inserting quiz ${quiz.title}:`, error.message);
  }
});

console.log('Quiz seeding complete!');
