const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'words.json');

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ words: [], reviewLog: [] }));
}

function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

app.get('/api/words', (req, res) => {
  const data = readData();
  res.json(data.words);
});

app.post('/api/words', (req, res) => {
  const data = readData();
  const newWord = {
    id: Date.now(),
    word: req.body.word,
    ukPhonetic: req.body.ukPhonetic || '',
    usPhonetic: req.body.usPhonetic || '',
    meanings: req.body.meanings || [],
    examples: req.body.examples || [],
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReview: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };
  data.words.push(newWord);
  writeData(data);
  res.json(newWord);
});

app.put('/api/words/:id/review', (req, res) => {
  const data = readData();
  const word = data.words.find(w => w.id === parseInt(req.params.id));
  if (!word) return res.status(404).json({ error: 'Not found' });

  const quality = req.body.quality;

  if (quality < 3) {
    word.repetitions = 0;
    word.interval = 1;
  } else {
    if (word.repetitions === 0) word.interval = 1;
    else if (word.repetitions === 1) word.interval = 6;
    else word.interval = Math.round(word.interval * word.easeFactor);
    word.repetitions++;
  }

  word.easeFactor = Math.max(1.3, word.easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + word.interval);
  word.nextReview = nextDate.toISOString();

  writeData(data);
  res.json(word);
});

app.get('/api/review/today', (req, res) => {
  const data = readData();
  const now = new Date().toISOString();
  const dueWords = data.words.filter(w => w.nextReview <= now);
  res.json(dueWords);
});

app.delete('/api/words/:id', (req, res) => {
  const data = readData();
  data.words = data.words.filter(w => w.id !== parseInt(req.params.id));
  writeData(data);
  res.json({ success: true });
});

app.get('/api/export', (req, res) => {
  const data = readData();
  res.setHeader('Content-Disposition', 'attachment; filename=flashcard-backup.json');
  res.json(data);
});

app.post('/api/import', (req, res) => {
  writeData(req.body);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
