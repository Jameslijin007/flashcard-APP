const API_BASE = '';

let allWords = [];
let dueWords = [];
let currentCardIndex = 0;
let isFlipped = false;
let pendingWordData = null;

document.addEventListener('DOMContentLoaded', () => {
  loadWords();
  loadDueWords();
});

async function addWord() {
  const input = document.getElementById('wordInput');
  const word = input.value.trim().toLowerCase();
  if (!word) return;

  const status = document.getElementById('fetchStatus');
  status.textContent = '⏳ 正在获取单词数据...';

  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
    if (!res.ok) throw new Error('单词未找到，请检查拼写');
    const data = await res.json();
    const entry = data[0];

    const ukPhonetic = entry.phonetics?.find(p => p.text && (p.audio?.includes('uk') || !p.audio))?.text

                       || entry.phonetic || '';
    const usPhonetic = entry.phonetics?.find(p => p.text && p.audio?.includes('us'))?.text

                       || ukPhonetic;

    const meanings = entry.meanings.map(m => ({
      partOfSpeech: m.partOfSpeech,
      definitions: m.definitions.slice(0, 3).map(d => d.definition)
    }));

    const examples = [];
    entry.meanings.forEach(m => {
      m.definitions.forEach(d => {
        if (d.example) examples.push(d.example);
      });
    });

    pendingWordData = { word, ukPhonetic, usPhonetic, meanings, examples: examples.slice(0, 3) };

    document.getElementById('previewWord').textContent = '📖 ' + word;
    document.getElementById('previewPhonetic').textContent = '🇬🇧 ' + ukPhonetic + '  |  🇺🇸 ' + usPhonetic;
    document.getElementById('previewMeaning').textContent = meanings
      .map(m => m.partOfSpeech + ': ' + m.definitions.join('; ')).join(' | ');
    document.getElementById('previewExample').textContent = examples.length
      ? '💬 ' + examples[0] : '';
    document.getElementById('wordPreview').style.display = 'block';
    status.textContent = '✅ 数据获取成功，请确认添加';

  } catch (e) {
    status.textContent = '❌ 获取失败：' + e.message;
  }
}

async function confirmAdd() {
  if (!pendingWordData) return;

  await fetch(API_BASE + '/api/words', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pendingWordData)
  });

  document.getElementById('wordInput').value = '';
  document.getElementById('wordPreview').style.display = 'none';
  document.getElementById('fetchStatus').textContent = '✅ 添加成功！';
  pendingWordData = null;

  loadWords();
  loadDueWords();
}

function cancelAdd() {
  document.getElementById('wordPreview').style.display = 'none';
  document.getElementById('fetchStatus').textContent = '';
  pendingWordData = null;
}

async function loadWords() {
  const res = await fetch(API_BASE + '/api/words');
  allWords = await res.json();
  document.getElementById('totalCount').textContent = allWords.length;
  renderWordList();
}

async function loadDueWords() {
  const res = await fetch(API_BASE + '/api/review/today');
  dueWords = await res.json();
  document.getElementById('dueCount').textContent = dueWords.length;

  if (dueWords.length > 0) {
    document.getElementById('noCards').style.display = 'none';
    document.getElementById('cardArea').style.display = 'block';
    currentCardIndex = 0;
    showCard();
  } else {
    document.getElementById('noCards').style.display = 'block';
    document.getElementById('cardArea').style.display = 'none';
  }
}

function showCard() {
  if (currentCardIndex >= dueWords.length) {
    document.getElementById('cardArea').style.display = 'none';
    document.getElementById('noCards').style.display = 'block';
    document.getElementById('noCards').innerHTML = '<p>🎉 今日复习全部完成！太棒了！</p>';
    return;
  }

  const card = dueWords[currentCardIndex];
  isFlipped = false;

  document.getElementById('cardFront').style.display = 'block';
  document.getElementById('cardBack').style.display = 'none';
  document.getElementById('reviewBtns').style.display = 'none';
  document.getElementById('frontWord').textContent = card.word;
  document.getElementById('cardProgress').textContent =
    (currentCardIndex + 1) + ' / ' + dueWords.length;
}

function flipCard() {
  if (!isFlipped) {
    const card = dueWords[currentCardIndex];
    isFlipped = true;

    document.getElementById('cardFront').style.display = 'none';
    document.getElementById('cardBack').style.display = 'block';
    document.getElementById('reviewBtns').style.display = 'flex';

    document.getElementById('backUk').textContent = card.ukPhonetic || '-';
    document.getElementById('backUs').textContent = card.usPhonetic || '-';

    document.getElementById('backMeanings').innerHTML = card.meanings
      .map(m => '<p><strong>' + m.partOfSpeech + '.</strong> ' + m.definitions.join('；') + '</p>')
      .join('');

    document.getElementById('backExamples').innerHTML = (card.examples || [])
      .map(e => '<p>💬 ' + e + '</p>').join('');
  }
}

function speakWord() {
  const word = dueWords[currentCardIndex]?.word;
  if (!word) return;
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = 'en-US';
  utterance.rate = 0.8;
  speechSynthesis.speak(utterance);
}

async function rateWord(quality) {
  const card = dueWords[currentCardIndex];

  await fetch(API_BASE + '/api/words/' + card.id + '/review', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quality: quality })
  });

  currentCardIndex++;
  showCard();
  loadDueWords();
}

function renderWordList() {
  const list = document.getElementById('wordList');
  list.innerHTML = allWords.map(w =>
    '<div class="word-item">' +
      '<div><span class="word-name">' + w.word + '</span>' +
      '<span class="word-info">' + (w.ukPhonetic || '') + '</span></div>' +
      '<button class="btn-delete" onclick="deleteWord(' + w.id + ')">🗑️</button>' +
    '</div>'
  ).join('');
}

async function deleteWord(id) {
  if (!confirm('确定删除这个单词吗？')) return;
  await fetch(API_BASE + '/api/words/' + id, { method: 'DELETE' });
  loadWords();
  loadDueWords();
}

async function exportData() {
  const res = await fetch(API_BASE + '/api/export');
  const data = await res.json();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'flashcard-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
}

async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const text = await file.text();
  const data = JSON.parse(text);
  await fetch(API_BASE + '/api/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  loadWords();
  loadDueWords();
  alert('✅ 导入成功！');
}
