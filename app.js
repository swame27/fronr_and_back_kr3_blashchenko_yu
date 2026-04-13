'use strict';

const contentDiv = document.getElementById('app-content');
const homeBtn    = document.getElementById('home-btn');
const aboutBtn   = document.getElementById('about-btn');
const statusBadge = document.getElementById('status-badge');

// ── Навигация ────────────────────────────────────────────────────────────────

function setActiveButton(id) {
  [homeBtn, aboutBtn].forEach(btn => btn.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

async function loadContent(page) {
  try {
    const res  = await fetch(`/content/${page}.html`);
    const html = await res.text();
    contentDiv.innerHTML = html;
    if (page === 'home') initNotes();
  } catch (err) {
    contentDiv.innerHTML = `<p style="color:red; padding:1rem;">Ошибка загрузки страницы.</p>`;
    console.error(err);
  }
}

homeBtn.addEventListener('click', () => {
  setActiveButton('home-btn');
  loadContent('home');
});

aboutBtn.addEventListener('click', () => {
  setActiveButton('about-btn');
  loadContent('about');
});

// ── Заметки ──────────────────────────────────────────────────────────────────

function initNotes() {
  const form  = document.getElementById('note-form');
  const input = document.getElementById('note-input');
  const list  = document.getElementById('notes-list');

  function loadNotes() {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    list.innerHTML = notes.map(n => `
      <li style="display:flex; justify-content:space-between; align-items:center;
                 padding:10px; border-bottom:1px solid #eee;">
        <span>${n.text}</span>
        <button onclick="deleteNote(${n.id})"
          style="background:none; border:none; cursor:pointer; color:#999;">✕</button>
      </li>
    `).join('');
  }

  window.deleteNote = function(id) {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]')
      .filter(n => n.id !== id);
    localStorage.setItem('notes', JSON.stringify(notes));
    loadNotes();
  };

  function addNote(text) {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    notes.unshift({ id: Date.now(), text });
    localStorage.setItem('notes', JSON.stringify(notes));
    loadNotes();
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const text = input.value.trim();
    if (text) { addNote(text); input.value = ''; }
  });

  loadNotes();
}

// ── Онлайн / Офлайн ──────────────────────────────────────────────────────────

function updateStatus() {
  const online = navigator.onLine;
  statusBadge.textContent = online ? 'Онлайн' : 'Офлайн';
  statusBadge.className = 'badge ' + (online ? 'badge--online' : 'badge--offline');
}

window.addEventListener('online', updateStatus);
window.addEventListener('offline', updateStatus);
updateStatus();

// ── Service Worker ────────────────────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      console.log('[SW] Зарегистрирован:', reg.scope);
    } catch (err) {
      console.error('[SW] Ошибка:', err);
    }
  });
}

// ── Старт ─────────────────────────────────────────────────────────────────────

loadContent('home');