
import './style.css';

const $ = (selector) => document.querySelector(selector);

const intro = $('#intro');
const app = $('#app');
const canvas = $('#stars');
const ctx = canvas.getContext('2d');
const audio = $('#audio');
const toast = $('#toast');

const DB_NAME = 'only-us-database';
const DB_VERSION = 1;
const STORE = 'media';

let db;
let tracks = [];
let photos = [];
let currentTrackId = null;
let entered = false;
let terminalStarted = false;
let toastTimer;
let lastTrackId = '';
let stars = [];
let animationFrame = 0;
let projectTracks = [];
let projectPhotos = [];
const publicAsset = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;

function notify(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE)) {
        const store = database.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('type', 'type', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllMedia() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function saveMedia(item) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function deleteMedia(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function makeId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createObjectUrl(item) {
  return URL.createObjectURL(item.blob);
}

/* Animated star field */
function resizeStars() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  stars = Array.from(
    { length: Math.min(200, Math.floor((w * h) / 5000)) },
    () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      radius: Math.random() * 1.1 + 0.2,
      speed: Math.random() * 0.27 + 0.035,
      drift: (Math.random() - 0.5) * 0.12,
      alpha: Math.random() * 0.6 + 0.15,
    }),
  );
}

function drawStars() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  ctx.clearRect(0, 0, w, h);

  for (const star of stars) {
    star.y += star.speed;
    star.x += star.drift;

    if (star.y > h + 2) {
      star.y = -2;
      star.x = Math.random() * w;
    }

    if (star.x < 0) star.x = w;
    if (star.x > w) star.x = 0;

    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${star.alpha})`;
    ctx.fill();
  }

  animationFrame = requestAnimationFrame(drawStars);
}

resizeStars();
drawStars();
window.addEventListener('resize', resizeStars);

/* Personal story terminal */
const terminalLines = [
  'запускаем нашу маленькую вселенную...',
  '',
  'const она = "Сонечка";',
  'const я = "Юрочка";',
  '',
  'статус: я нашёл самого дорогого человека',
  'место: где-то между нами',
  'любимое_место: рядом с Сонечкой',
  'любимое_воспоминание: история ещё пишется',
  '',
  'если (Сонечка_счастлива) {',
  '    мир.прекрасен = правда;',
  '}',
  '',
  'миссия: улыбаться вместе каждый день',
  'связь: навсегда ♡',
  '',
  'всё получилось. ♡',
];

function startTerminal() {
  if (terminalStarted) return;
  terminalStarted = true;

  const output = $('#terminal-output');
  let line = 0;
  let character = 0;

  function type() {
    if (line >= terminalLines.length) return;

    const current = terminalLines[line];

    if (character < current.length) {
      output.textContent += current[character];
      character += 1;
      setTimeout(type, 28);
    } else {
      output.textContent += '\n';
      line += 1;
      character = 0;
      setTimeout(type, 180);
    }
  }

  type();
}

/* Music player */
function updateMusicState() {
  const playing = !audio.paused;

  $('#music-toggle span').textContent = playing ? 'МУЗЫКА ВКЛ.' : 'МУЗЫКА ВЫКЛ.';
  $('.hero').classList.toggle('music-on', playing);
  $('.vinyl').closest('.soundtrack-layout').classList.toggle('music-on', playing);
}

function updateTrackName() {
  const track = tracks.find((item) => item.id === currentTrackId);
  $('#track-name').textContent = track?.name || 'НАША ПЕСНЯ';
}

function renderTracks() {
  const list = $('#track-list');
  list.replaceChildren();

  $('#music-status').textContent = `НАШИ ПЕСНИ · ${tracks.length}/10`;

  tracks.forEach((track, index) => {
    const row = document.createElement('div');
    row.className = 'track-row';

    const number = document.createElement('span');
    number.className = 'track-index';
    number.textContent = String(index + 1).padStart(2, '0');

    const name = document.createElement('span');
    name.className = 'track-name';
    name.textContent = track.name;
    name.title = track.name;

    const play = document.createElement('button');
    play.className = 'track-play';
    play.textContent = currentTrackId === track.id && !audio.paused ? 'Ⅱ' : '▶';
    play.setAttribute('aria-label', `Включить ${track.name}`);
    play.addEventListener('click', () => playTrack(track.id));

    const remove = document.createElement('button');
    remove.className = 'track-delete';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Удалить ${track.name}`);
    if (track.source === 'project') remove.hidden = true;
    remove.addEventListener('click', async () => {
      if (track.source === 'project') return;
      if (currentTrackId === track.id) {
        audio.pause();
        audio.removeAttribute('src');
        currentTrackId = null;
        updateMusicState();
      }

      await deleteMedia(track.id);
      await refreshMedia();
      notify('Песня удалена.');
    });

    row.append(number, name, play, remove);
    list.append(row);
  });
}

async function playTrack(id) {
  const track = tracks.find((item) => item.id === id);
  if (!track) return;

  if (currentTrackId === id && !audio.paused) {
    audio.pause();
    return;
  }

  if (currentTrackId !== id) {
    const url = track.url || createObjectUrl(track);
    const previousUrl = audio.dataset.objectUrl;

    audio.src = url;
    audio.dataset.objectUrl = url;
    currentTrackId = id;

    if (previousUrl && previousUrl.startsWith('blob:')) URL.revokeObjectURL(previousUrl);
  }

  try {
    await audio.play();
    updateTrackName();
    renderTracks();
  } catch {
    notify('Не удалось воспроизвести трек. Нажми Play ещё раз.');
  }
}

function pickRandomTrack() {
  if (!tracks.length) {
    notify('Сначала добавь свои песни в разделе The Sound of Us.');
    return;
  }

  let candidates = tracks.filter((track) => track.id !== lastTrackId);

  if (!candidates.length) candidates = tracks;

  const track = candidates[Math.floor(Math.random() * candidates.length)];
  lastTrackId = track.id;

  try {
    localStorage.setItem('only-us-last-track', track.id);
  } catch {
    // Storage can be unavailable in private browsing.
  }

  playTrack(track.id);
}

$('#music-toggle').addEventListener('click', async () => {
  if (!audio.paused) {
    audio.pause();
    return;
  }

  if (currentTrackId) {
    await playTrack(currentTrackId);
  } else {
    pickRandomTrack();
  }
});

audio.addEventListener('play', () => {
  updateMusicState();
  renderTracks();
});

audio.addEventListener('pause', () => {
  updateMusicState();
  renderTracks();
});

audio.addEventListener('ended', () => {
  if (!tracks.length) return;
  pickRandomTrack();
});

/* Upload up to 10 songs; files persist in IndexedDB */
$('#add-music').addEventListener('click', () => $('#music-input').click());

$('#music-input').addEventListener('change', async (event) => {
  const input = event.currentTarget;
  const files = Array.from(input.files || []).filter((file) =>
    file.type.startsWith('audio/'),
  );

  input.value = '';

  if (!files.length) return;

  const available = Math.max(0, 10 - tracks.length);

  if (available === 0) {
    notify('Максимум 10 песен. Удали трек, чтобы добавить другой.');
    return;
  }

  const chosen = files.slice(0, available);

  try {
    for (const file of chosen) {
      await saveMedia({
        id: makeId(),
        type: 'audio',
        name: file.name.replace(/\.[^.]+$/, ''),
        blob: file,
        addedAt: Date.now(),
      });
    }

    await refreshMedia();
    notify(`Добавлено песен: ${chosen.length}. Они сохранены в этом браузере; для всех посетителей добавь файлы в проект GitHub.`);
  } catch (error) {
    console.error(error);
    notify('Не удалось сохранить файлы. Проверь свободное место.');
  }
});

/* Photo gallery */
function renderPhotos() {
  const gallery = $('#gallery');
  gallery.replaceChildren();

  photos.forEach((photo, index) => {
    const card = document.createElement('article');
    card.className = 'photo-card';
    card.style.animationDelay = `${Math.min(index * 70, 500)}ms`;

    const img = document.createElement('img');
    img.src = photo.url || createObjectUrl(photo);
    img.alt = photo.name || 'Наше воспоминание';
    img.loading = 'lazy';

    const remove = document.createElement('button');
    remove.className = 'photo-remove';
    remove.textContent = '×';
    remove.setAttribute('aria-label', 'Удалить фото');
    if (photo.source === 'project') remove.hidden = true;

    remove.addEventListener('click', async () => {
      if (photo.source === 'project') return;
      await deleteMedia(photo.id);
      await refreshMedia();
      notify('Фотография удалена.');
    });

    card.append(img, remove);
    gallery.append(card);
  });

  $('#photo-count').textContent = `${String(photos.length).padStart(2, '0')} ФОТО`;
  $('#gallery-empty').hidden = photos.length > 0;
}

$('#add-photos').addEventListener('click', () => $('#photo-input').click());
$('#open-gallery').addEventListener('click', () => {
  if (!photos.length) {
    $('#photo-input').click();
    return;
  }

  $('#gallery').scrollIntoView({ behavior: 'smooth', block: 'center' });
});

$('#photo-input').addEventListener('change', async (event) => {
  const input = event.currentTarget;
  const files = Array.from(input.files || []).filter((file) =>
    file.type.startsWith('image/'),
  );

  input.value = '';

  if (!files.length) return;

  try {
    for (const file of files) {
      await saveMedia({
        id: makeId(),
        type: 'photo',
        name: file.name,
        blob: file,
        addedAt: Date.now(),
      });
    }

    await refreshMedia();
    $('#gallery').scrollIntoView({ behavior: 'smooth', block: 'center' });
    notify(`Добавлено фотографий: ${files.length}. Они сохранены в этом браузере; для всех посетителей добавь файлы в проект GitHub.`);
  } catch (error) {
    console.error(error);
    notify('Не удалось сохранить фото. Возможно, закончилось место.');
  }
});

async function loadProjectAssets() {
  try {
    const [photoResponse, trackResponse] = await Promise.all([
      fetch(publicAsset('images/gallery.json')),
      fetch(publicAsset('audio/tracks.json')),
    ]);
    const photoNames = photoResponse.ok ? await photoResponse.json() : [];
    const trackNames = trackResponse.ok ? await trackResponse.json() : [];
    projectPhotos = photoNames.filter((name) => typeof name === 'string' && name.trim()).map((name, index) => ({
      id: `project-photo-${index}`, type: 'photo', source: 'project', name,
      url: publicAsset(`images/${name}`), addedAt: index,
    }));
    projectTracks = trackNames.filter((name) => typeof name === 'string' && name.trim()).slice(0, 10).map((name, index) => ({
      id: `project-track-${index}`, type: 'audio', source: 'project', name: name.replace(/\.[^.]+$/, ''),
      url: publicAsset(`audio/${name}`), addedAt: index,
    }));
  } catch (error) {
    console.warn('Не удалось прочитать списки файлов проекта:', error);
    projectPhotos = [];
    projectTracks = [];
  }
}

async function refreshMedia() {
  const items = await getAllMedia();
  const localTracks = items.filter((item) => item.type === 'audio').sort((a, b) => a.addedAt - b.addedAt);
  const localPhotos = items.filter((item) => item.type === 'photo').sort((a, b) => a.addedAt - b.addedAt);

  tracks = [...projectTracks, ...localTracks].slice(0, 10);
  photos = [...projectPhotos, ...localPhotos];

  renderTracks();
  renderPhotos();
  updateTrackName();
}

/* Enter the site */
$('#enter').addEventListener('click', async () => {
  if (entered) return;
  entered = true;

  intro.classList.add('leaving');
  app.classList.remove('is-hidden');
  app.classList.add('is-visible');

  startTerminal();

  if (tracks.length) {
    let previous = '';

    try {
      previous = localStorage.getItem('only-us-last-track') || '';
    } catch {
      // Ignore unavailable localStorage.
    }

    const candidates = tracks.filter((track) => track.id !== previous);
    const pool = candidates.length ? candidates : tracks;
    const track = pool[Math.floor(Math.random() * pool.length)];

    lastTrackId = track.id;

    try {
      localStorage.setItem('only-us-last-track', track.id);
    } catch {
      // Ignore unavailable localStorage.
    }

    await playTrack(track.id);
  } else {
    notify('Добро пожаловать в наше маленькое пространство ♡');
  }
});

async function init() {
  try {
    db = await openDatabase();
    await loadProjectAssets();
    await refreshMedia();
  } catch (error) {
    console.error('Database initialization failed:', error);
    notify('Хранилище недоступно. Проверь настройки браузера.');
  }
}

init();


/* Show the romantic page without navigating away, so the current song keeps playing. */
const herPage = document.querySelector('#her-page');
const backToStory = document.querySelector('#back-to-story');
function showHerPage(show) {
  if (!herPage) return;
  document.body.classList.toggle('her-mode', show);
  herPage.classList.toggle('is-hidden', !show);
  if (show) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    history.replaceState(null, '', '#her');
  } else {
    history.replaceState(null, '', window.location.pathname + window.location.search);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
document.querySelectorAll('a[href="#her"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    showHerPage(true);
  });
});
backToStory?.addEventListener('click', () => showHerPage(false));
if (window.location.hash === '#her') showHerPage(true);


/* Live relationship counter, starting 21 October 2026. */
function updateRelationshipTimer() {
  const start = new Date(2026, 9, 21, 0, 0, 0); // Month is zero-based: October.
  const now = new Date();
  let elapsed = Math.max(0, now.getTime() - start.getTime());
  const second = 1000;
  const minute = 60 * second;
  const hour = 60 * minute;
  const day = 24 * hour;
  const days = Math.floor(elapsed / day);
  elapsed %= day;
  const hours = Math.floor(elapsed / hour);
  elapsed %= hour;
  const minutes = Math.floor(elapsed / minute);
  const seconds = Math.floor((elapsed % minute) / second);
  const set = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = String(value).padStart(2, '0'); };
  set('timer-days', days);
  set('timer-hours', hours);
  set('timer-minutes', minutes);
  set('timer-seconds', seconds);
}
updateRelationshipTimer();
window.setInterval(updateRelationshipTimer, 1000);
