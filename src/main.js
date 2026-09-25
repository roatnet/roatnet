// =============================================
// ROAT DICTIONARY — Main Application
// =============================================
import { supabase } from './supabaseClient.js';
import './style.css';

// ---- State ----
let currentUser = null;
let isAdmin = false;
let allWords = [];
let currentPage = 'home';
let authMode = 'login'; // 'login' | 'signup'

// ---- Admin emails (only these can add words) ----
const ADMIN_DOMAIN = '@roat'; // emails ending with @roat.* are admins
// You can also whitelist specific emails:
const ADMIN_EMAILS = []; // e.g. ['me@roat.com', 'friend@roat.com']

function checkIsAdmin(email) {
  if (!email) return false;
  // Check domain-based: email contains @roat (e.g. user@roat.com, user@roat.net)
  const atParts = email.split('@');
  if (atParts.length === 2) {
    const domain = atParts[1].toLowerCase();
    if (domain.startsWith('roat')) return true;
  }
  // Check specific email whitelist
  if (ADMIN_EMAILS.length > 0 && ADMIN_EMAILS.includes(email.toLowerCase())) return true;
  return false;
}

// ---- Initialize ----
document.addEventListener('DOMContentLoaded', async () => {
  initStarfield();
  buildAlphabetBar();
  setupSearchListeners();
  await checkSession();
  await loadAllWords();
  renderHome();
});

// =============================================
// STARFIELD BACKGROUND (2000s vibes)
// =============================================
function initStarfield() {
  const canvas = document.getElementById('starfield');
  const ctx = canvas.getContext('2d');
  let stars = [];
  const STAR_COUNT = 120;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2 + 0.5,
      speed: Math.random() * 0.3 + 0.05,
      opacity: Math.random() * 0.6 + 0.2,
      twinkleSpeed: Math.random() * 0.02 + 0.005,
      twinkleOffset: Math.random() * Math.PI * 2,
    });
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const time = Date.now() * 0.001;
    stars.forEach(s => {
      const twinkle = Math.sin(time * s.twinkleSpeed * 10 + s.twinkleOffset) * 0.3 + 0.7;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180, 200, 255, ${s.opacity * twinkle})`;
      ctx.fill();
      s.y -= s.speed;
      if (s.y < -5) {
        s.y = canvas.height + 5;
        s.x = Math.random() * canvas.width;
      }
    });
    requestAnimationFrame(draw);
  }
  draw();
}

// =============================================
// NAVIGATION
// =============================================
window.navigateTo = function(page, data) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  currentPage = page;

  // Show target page
  const target = document.getElementById(`page-${page}`);
  if (target) {
    target.classList.add('active');
  }

  // Update nav active states
  document.querySelectorAll('.nav-pill').forEach(n => n.classList.remove('active'));
  const activeNav = document.getElementById(`nav-${page === 'word' ? 'browse' : page}`);
  if (activeNav) activeNav.classList.add('active');

  // Page-specific actions
  if (page === 'browse') renderBrowse();
  if (page === 'word' && data) renderWordDetail(data);
  if (page === 'login') resetAuthForm();
  if (page === 'add') {
    if (!isAdmin) {
      showToast('Only @roat contributors can add words', 'error');
      navigateTo('home');
      return;
    }
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// =============================================
// AUTH
// =============================================
async function checkSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    isAdmin = checkIsAdmin(currentUser.email);
  }
  renderAuthSection();
}

supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    currentUser = session.user;
    isAdmin = checkIsAdmin(currentUser.email);
  } else {
    currentUser = null;
    isAdmin = false;
  }
  renderAuthSection();
});

function renderAuthSection() {
  const section = document.getElementById('auth-section');
  if (currentUser) {
    const initial = (currentUser.email || '?')[0].toUpperCase();
    const adminBtnHtml = isAdmin
      ? `<button class="btn-glossy btn-primary btn-small" onclick="navigateTo('add')">✏️ Add Word</button>`
      : '';
    section.innerHTML = `
      <div class="auth-btn-group">
        ${adminBtnHtml}
        <div class="user-display">
          <div class="user-avatar">${initial}</div>
          <span class="user-email">${currentUser.email}</span>
        </div>
        <button class="btn-glossy btn-secondary btn-small" onclick="handleLogout()">Logout</button>
      </div>
    `;
  } else {
    section.innerHTML = `
      <div class="auth-btn-group">
        <button class="btn-glossy btn-primary btn-small" onclick="navigateTo('login')">Sign In</button>
      </div>
    `;
  }
}

window.handleAuth = async function(e) {
  e.preventDefault();
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  const errorEl = document.getElementById('auth-error');
  const btn = document.getElementById('auth-submit-btn');

  errorEl.classList.add('hidden');
  btn.textContent = authMode === 'login' ? 'Signing in...' : 'Creating account...';
  btn.disabled = true;

  try {
    let result;
    if (authMode === 'login') {
      result = await supabase.auth.signInWithPassword({ email, password });
    } else {
      result = await supabase.auth.signUp({ email, password });
    }

    if (result.error) throw result.error;

    if (authMode === 'signup') {
      showToast('Account created! Check your email to verify.', 'success');
    } else {
      showToast('Welcome back! 🎉', 'success');
    }
    navigateTo('home');
  } catch (err) {
    errorEl.textContent = err.message || 'Authentication failed';
    errorEl.classList.remove('hidden');
  } finally {
    btn.textContent = authMode === 'login' ? 'Sign In' : 'Sign Up';
    btn.disabled = false;
  }
};

window.handleLogout = async function() {
  await supabase.auth.signOut();
  currentUser = null;
  isAdmin = false;
  renderAuthSection();
  showToast('Logged out', 'success');
  navigateTo('home');
};

window.toggleAuthMode = function() {
  authMode = authMode === 'login' ? 'signup' : 'login';
  document.getElementById('auth-title').textContent = authMode === 'login' ? 'Sign In' : 'Sign Up';
  document.getElementById('auth-submit-btn').textContent = authMode === 'login' ? 'Sign In' : 'Sign Up';
  document.getElementById('auth-toggle-text').textContent =
    authMode === 'login' ? "Don't have an account?" : "Already have an account?";
  document.getElementById('auth-toggle-link').textContent =
    authMode === 'login' ? 'Sign Up' : 'Sign In';
  document.getElementById('auth-error').classList.add('hidden');
};

function resetAuthForm() {
  authMode = 'login';
  document.getElementById('auth-form').reset();
  document.getElementById('auth-error').classList.add('hidden');
  document.getElementById('auth-title').textContent = 'Sign In';
  document.getElementById('auth-submit-btn').textContent = 'Sign In';
}

// =============================================
// WORDS — CRUD
// =============================================
async function loadAllWords() {
  const { data, error } = await supabase
    .from('words')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading words:', error);
    allWords = [];
    return;
  }
  allWords = data || [];
  updateStats();
}

function updateStats() {
  document.getElementById('total-words').textContent = allWords.length;
  const audioCount = allWords.filter(w => w.audio_url).length;
  document.getElementById('total-audio').textContent = audioCount;

  if (allWords.length > 0) {
    const latest = new Date(allWords[0].created_at);
    document.getElementById('latest-date').textContent = latest.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  }
}

// ---- HOME PAGE ----
function renderHome() {
  renderWOTD();
  renderRecent();
}

function renderWOTD() {
  const container = document.getElementById('wotd-card');
  if (allWords.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <p class="empty-state-text">No words yet. The dictionary is waiting!</p>
      </div>
    `;
    return;
  }
  // Deterministic "word of the day" based on date
  const today = new Date();
  const dayIndex = (today.getFullYear() * 1000 + today.getMonth() * 31 + today.getDate()) % allWords.length;
  const word = allWords[dayIndex];
  container.innerHTML = renderWordCardHTML(word);
  container.onclick = () => navigateTo('word', word.id);
}

function renderRecent() {
  const container = document.getElementById('recent-words');
  if (allWords.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <p class="empty-state-text">No words added yet. Check back soon!</p>
      </div>
    `;
    return;
  }
  const recent = allWords.slice(0, 6);
  container.innerHTML = recent.map(w => `
    <div class="word-card" onclick="navigateTo('word', '${w.id}')">
      <div class="card-word">${escapeHTML(w.word)}</div>
      <div class="card-phonetic">${escapeHTML(w.phonetic || '')}</div>
      <span class="card-pos">${escapeHTML(w.part_of_speech || '')}</span>
      <div class="card-definition">${escapeHTML(w.definition || '')}</div>
      <div class="card-date">${formatDate(w.created_at)}</div>
    </div>
  `).join('');
}

// ---- BROWSE PAGE ----
function buildAlphabetBar() {
  const bar = document.getElementById('alphabet-bar');
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  bar.innerHTML = `<button class="alpha-btn active" data-letter="ALL" onclick="filterByLetter('ALL')">ALL</button>`;
  letters.forEach(l => {
    bar.innerHTML += `<button class="alpha-btn" data-letter="${l}" onclick="filterByLetter('${l}')">${l}</button>`;
  });
}

window.filterByLetter = function(letter) {
  document.querySelectorAll('.alpha-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.alpha-btn[data-letter="${letter}"]`).classList.add('active');
  renderBrowse(letter);
};

function renderBrowse(filterLetter = 'ALL') {
  const container = document.getElementById('browse-results');
  let filtered = allWords;
  if (filterLetter !== 'ALL') {
    filtered = allWords.filter(w => w.word && w.word[0].toUpperCase() === filterLetter);
  }

  // Sort alphabetically for browse
  filtered.sort((a, b) => (a.word || '').localeCompare(b.word || ''));

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔎</div>
        <p class="empty-state-text">${filterLetter === 'ALL' ? 'No words in the dictionary yet.' : `No words starting with "${filterLetter}".`}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(w => `
    <div class="word-list-item" onclick="navigateTo('word', '${w.id}')">
      <span class="list-word">${escapeHTML(w.word)}</span>
      <span class="list-pos">${escapeHTML(w.part_of_speech || '')}</span>
      <span class="list-def">${escapeHTML(w.definition || '')}</span>
      ${w.audio_url ? `<span class="list-audio-icon" onclick="event.stopPropagation(); playAudio('${w.audio_url}')" title="Play pronunciation">🔊</span>` : ''}
    </div>
  `).join('');
}

// ---- WORD DETAIL PAGE ----
async function renderWordDetail(wordId) {
  const container = document.getElementById('word-detail');
  container.innerHTML = '<p class="loading-text">Loading word...</p>';

  const word = allWords.find(w => w.id === wordId);
  if (!word) {
    // Try fetching from DB
    const { data, error } = await supabase.from('words').select('*').eq('id', wordId).single();
    if (error || !data) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">❓</div>
          <p class="empty-state-text">Word not found.</p>
        </div>
        <button class="btn-glossy btn-secondary detail-back-btn" onclick="navigateTo('home')">← Back to Home</button>
      `;
      return;
    }
    renderWordDetailContent(container, data);
  } else {
    renderWordDetailContent(container, word);
  }
}

function renderWordDetailContent(container, w) {
  const synonyms = w.synonyms ? (Array.isArray(w.synonyms) ? w.synonyms : w.synonyms.split(',').map(s => s.trim()).filter(Boolean)) : [];
  const antonyms = w.antonyms ? (Array.isArray(w.antonyms) ? w.antonyms : w.antonyms.split(',').map(s => s.trim()).filter(Boolean)) : [];
  const tags = w.tags ? (Array.isArray(w.tags) ? w.tags : w.tags.split(',').map(s => s.trim()).filter(Boolean)) : [];

  container.innerHTML = `
    <button class="btn-glossy btn-secondary btn-small detail-back-btn" onclick="history.back(); navigateTo('browse')">← Back</button>
    
    <div class="word-detail-header">
      <h1 class="detail-word">${escapeHTML(w.word)}</h1>
      <div class="detail-phonetic-row">
        ${w.phonetic ? `<span class="detail-phonetic">${escapeHTML(w.phonetic)}</span>` : ''}
        ${w.syllables ? `<span class="detail-syllables">${escapeHTML(w.syllables)}</span>` : ''}
        ${w.audio_url ? `<button class="detail-audio-btn" onclick="playAudio('${w.audio_url}')">🔊 Listen</button>` : ''}
      </div>
      ${w.part_of_speech ? `<span class="detail-pos">${escapeHTML(w.part_of_speech)}</span>` : ''}
    </div>

    <div class="detail-section">
      <h3 class="detail-section-title">Definition</h3>
      <p class="detail-definition">${escapeHTML(w.definition)}</p>
    </div>

    ${w.example ? `
    <div class="detail-section">
      <h3 class="detail-section-title">Example</h3>
      <blockquote class="detail-example">"${escapeHTML(w.example)}"</blockquote>
    </div>
    ` : ''}

    ${w.etymology ? `
    <div class="detail-section">
      <h3 class="detail-section-title">Etymology / Origin</h3>
      <p class="detail-etymology">${escapeHTML(w.etymology)}</p>
    </div>
    ` : ''}

    ${synonyms.length > 0 ? `
    <div class="detail-section">
      <h3 class="detail-section-title">Synonyms</h3>
      <div class="detail-synonyms">
        ${synonyms.map(s => `<span class="synonym-pill">${escapeHTML(s)}</span>`).join('')}
      </div>
    </div>
    ` : ''}

    ${antonyms.length > 0 ? `
    <div class="detail-section">
      <h3 class="detail-section-title">Antonyms</h3>
      <div class="detail-antonyms">
        ${antonyms.map(s => `<span class="antonym-pill">${escapeHTML(s)}</span>`).join('')}
      </div>
    </div>
    ` : ''}

    ${tags.length > 0 ? `
    <div class="detail-section">
      <h3 class="detail-section-title">Tags</h3>
      <div class="detail-tags">
        ${tags.map(t => `<span class="tag-pill">#${escapeHTML(t)}</span>`).join('')}
      </div>
    </div>
    ` : ''}

    <div class="detail-meta">
      Added on ${formatDate(w.created_at)} · by @roat
    </div>
  `;
}

// ---- SEARCH ----
function setupSearchListeners() {
  const input = document.getElementById('search-input');
  input.addEventListener('input', debounce(handleSearchInput, 200));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      performSearch();
    }
  });
  // Close suggestions when clicking elsewhere
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
      document.getElementById('search-suggestions').classList.add('hidden');
    }
  });
}

function handleSearchInput() {
  const query = document.getElementById('search-input').value.trim().toLowerCase();
  const suggestionsEl = document.getElementById('search-suggestions');

  if (!query || query.length < 1) {
    suggestionsEl.classList.add('hidden');
    return;
  }

  const matches = allWords.filter(w =>
    w.word.toLowerCase().includes(query) ||
    (w.definition && w.definition.toLowerCase().includes(query))
  ).slice(0, 8);

  if (matches.length === 0) {
    suggestionsEl.innerHTML = '<div class="suggestion-item"><span class="suggestion-word">No results found</span></div>';
    suggestionsEl.classList.remove('hidden');
    return;
  }

  suggestionsEl.innerHTML = matches.map(w => `
    <div class="suggestion-item" onclick="navigateTo('word', '${w.id}')">
      <div class="suggestion-word">${escapeHTML(w.word)}</div>
      <div class="suggestion-preview">${escapeHTML((w.definition || '').slice(0, 80))}...</div>
    </div>
  `).join('');
  suggestionsEl.classList.remove('hidden');
}

window.performSearch = function() {
  const query = document.getElementById('search-input').value.trim().toLowerCase();
  document.getElementById('search-suggestions').classList.add('hidden');

  if (!query) return;

  const matches = allWords.filter(w =>
    w.word.toLowerCase().includes(query) ||
    (w.definition && w.definition.toLowerCase().includes(query))
  );

  if (matches.length === 1) {
    navigateTo('word', matches[0].id);
  } else if (matches.length > 1) {
    // Show browse with filtered results
    navigateTo('browse');
    const container = document.getElementById('browse-results');
    container.innerHTML = `<h3 style="color:var(--text-muted);margin-bottom:16px;">Found ${matches.length} results for "${escapeHTML(query)}"</h3>` +
      matches.map(w => `
        <div class="word-list-item" onclick="navigateTo('word', '${w.id}')">
          <span class="list-word">${escapeHTML(w.word)}</span>
          <span class="list-pos">${escapeHTML(w.part_of_speech || '')}</span>
          <span class="list-def">${escapeHTML(w.definition || '')}</span>
        </div>
      `).join('');
  } else {
    showToast(`No results for "${query}"`, 'error');
  }
};

// ---- RANDOM WORD ----
window.loadRandomWord = function() {
  if (allWords.length === 0) {
    showToast('No words in the dictionary yet!', 'error');
    return;
  }
  const randomIndex = Math.floor(Math.random() * allWords.length);
  navigateTo('word', allWords[randomIndex].id);
};

// ---- ADD WORD ----
window.handleAddWord = async function(e) {
  e.preventDefault();
  const errorEl = document.getElementById('add-error');
  const successEl = document.getElementById('add-success');
  const btn = document.getElementById('add-word-btn');

  errorEl.classList.add('hidden');
  successEl.classList.add('hidden');

  if (!currentUser || !isAdmin) {
    errorEl.textContent = 'Only @roat contributors can add words.';
    errorEl.classList.remove('hidden');
    return;
  }

  btn.textContent = '⏳ Adding...';
  btn.disabled = true;

  try {
    const word = document.getElementById('word-input').value.trim();
    const partOfSpeech = document.getElementById('word-pos').value;
    const phonetic = document.getElementById('word-phonetic').value.trim();
    const syllables = document.getElementById('word-syllables').value.trim();
    const definition = document.getElementById('word-definition').value.trim();
    const example = document.getElementById('word-example').value.trim();
    const etymology = document.getElementById('word-etymology').value.trim();
    const synonyms = document.getElementById('word-synonyms').value.trim();
    const antonyms = document.getElementById('word-antonyms').value.trim();
    const tags = document.getElementById('word-tags').value.trim();
    const audioFile = document.getElementById('word-audio').files[0];

    let audioUrl = null;

    // Upload audio if provided
    if (audioFile) {
      const fileName = `${Date.now()}_${audioFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('audio')
        .upload(fileName, audioFile, { contentType: audioFile.type });

      if (uploadError) {
        throw new Error(`Audio upload failed: ${uploadError.message}`);
      }

      const { data: urlData } = supabase.storage.from('audio').getPublicUrl(fileName);
      audioUrl = urlData.publicUrl;
    }

    // Insert word
    const { error: insertError } = await supabase.from('words').insert({
      word,
      part_of_speech: partOfSpeech,
      phonetic,
      syllables: syllables || null,
      definition,
      example: example || null,
      etymology: etymology || null,
      synonyms: synonyms || null,
      antonyms: antonyms || null,
      tags: tags || null,
      audio_url: audioUrl,
      created_by: currentUser.id,
    });

    if (insertError) throw insertError;

    // Refresh words
    await loadAllWords();

    successEl.textContent = `"${word}" has been added to the ROAT dictionary! 🎉`;
    successEl.classList.remove('hidden');
    showToast(`"${word}" added to the dictionary!`, 'success');
    document.getElementById('add-word-form').reset();

  } catch (err) {
    console.error('Add word error:', err);
    errorEl.textContent = err.message || 'Failed to add word.';
    errorEl.classList.remove('hidden');
  } finally {
    btn.textContent = '✨ Add to Dictionary';
    btn.disabled = false;
  }
};

// ---- AUDIO ----
window.playAudio = function(url) {
  const audio = new Audio(url);
  audio.play().catch(err => {
    console.error('Audio playback error:', err);
    showToast('Could not play audio', 'error');
  });
};

// =============================================
// UTILITIES
// =============================================
function renderWordCardHTML(w) {
  return `
    <div class="card-word">${escapeHTML(w.word)}</div>
    <div class="card-phonetic">${escapeHTML(w.phonetic || '')}</div>
    <span class="card-pos">${escapeHTML(w.part_of_speech || '')}</span>
    <div class="card-definition">${escapeHTML(w.definition || '')}</div>
    <div class="card-date">${formatDate(w.created_at)}</div>
  `;
}

function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}
