'use strict';

// ── WebSocket ────────────────────────────────────────────────────────────────

const socket = io('http://localhost:3001');

socket.on('taskAdded', task => {
  showToast(`Новая заметка: ${task.text}`);
});

// ── Push-уведомления ─────────────────────────────────────────────────────────

const VAPID_PUBLIC_KEY = 'BPyBWJhHuHa8Pv1nqaFICGEN-cow2l5xpap4QoGJ3gO-YK_Hn-2GIhskv38IWnzETjEGCpG-brgvxhb-oQ3XpCA';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const output  = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    await fetch('http://localhost:3001/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub)
    });
    console.log('[Push] Подписка активна');
  } catch (err) {
    console.error('[Push] Ошибка подписки:', err);
  }
}

async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await fetch('http://localhost:3001/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint })
    });
    await sub.unsubscribe();
    console.log('[Push] Отписка выполнена');
  }
}

// ── Всплывашка ───────────────────────────────────────────────────────────────

function showToast(text) {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = `
    position:fixed; top:16px; right:16px;
    background:#4f46e5; color:white;
    padding:12px 16px; border-radius:8px;
    z-index:1000; font-size:14px; max-width:300px;
  `;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ── DOM-элементы ─────────────────────────────────────────────────────────────

const contentDiv  = document.getElementById('app-content');
const homeBtn     = document.getElementById('home-btn');
const aboutBtn    = document.getElementById('about-btn');
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
  const form         = document.getElementById('note-form');
  const input        = document.getElementById('note-input');
  const reminderForm = document.getElementById('reminder-form');
  const reminderText = document.getElementById('reminder-text');
  const reminderTime = document.getElementById('reminder-time');
  const list         = document.getElementById('notes-list');

  function loadNotes() {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    list.innerHTML = notes.map(n => {
      let reminderInfo = '';
      if (n.reminder) {
        const date = new Date(n.reminder);
        reminderInfo = `<br><small style="color:#16a34a;">⏰ Напоминание: ${date.toLocaleString()}</small>`;
      }
      return `
        <li style="display:flex; justify-content:space-between; align-items:flex-start;
                   padding:10px; border-bottom:1px solid #eee;">
          <span>${n.text}${reminderInfo}</span>
          <button onclick="deleteNote(${n.id})"
            style="background:none; border:none; cursor:pointer; color:#999; margin-left:8px;">✕</button>
        </li>
      `;
    }).join('');
  }

  window.deleteNote = function(id) {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]')
      .filter(n => n.id !== id);
    localStorage.setItem('notes', JSON.stringify(notes));
    loadNotes();
  };

  function addNote(text, reminderTimestamp = null) {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    const newNote = { id: Date.now(), text, reminder: reminderTimestamp };
    notes.unshift(newNote);
    localStorage.setItem('notes', JSON.stringify(notes));
    loadNotes();

    if (reminderTimestamp) {
      socket.emit('newReminder', {
        id: newNote.id,
        text: text,
        reminderTime: reminderTimestamp
      });
    } else {
      socket.emit('newTask', { text, timestamp: Date.now() });
    }
  }

  // Обычная заметка
  form.addEventListener('submit', e => {
    e.preventDefault();
    const text = input.value.trim();
    if (text) { addNote(text); input.value = ''; }
  });

  // Заметка с напоминанием
  reminderForm.addEventListener('submit', e => {
    e.preventDefault();
    const text     = reminderText.value.trim();
    const datetime = reminderTime.value;
    if (text && datetime) {
      const timestamp = new Date(datetime).getTime();
      if (timestamp > Date.now()) {
        addNote(text, timestamp);
        reminderText.value = '';
        reminderTime.value = '';
      } else {
        alert('Дата напоминания должна быть в будущем');
      }
    }
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

// ── Service Worker + кнопки уведомлений ──────────────────────────────────────

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      console.log('[SW] Зарегистрирован:', reg.scope);

      const enableBtn  = document.getElementById('enable-push');
      const disableBtn = document.getElementById('disable-push');

      if (enableBtn && disableBtn) {
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          enableBtn.style.display  = 'none';
          disableBtn.style.display = 'inline-block';
        }

        enableBtn.addEventListener('click', async () => {
          if (Notification.permission === 'denied') {
            alert('Уведомления запрещены в настройках браузера.');
            return;
          }
          if (Notification.permission === 'default') {
            const perm = await Notification.requestPermission();
            if (perm !== 'granted') { alert('Нужно разрешить уведомления.'); return; }
          }
          await subscribeToPush();
          enableBtn.style.display  = 'none';
          disableBtn.style.display = 'inline-block';
        });

        disableBtn.addEventListener('click', async () => {
          await unsubscribeFromPush();
          disableBtn.style.display = 'none';
          enableBtn.style.display  = 'inline-block';
        });
      }

    } catch (err) {
      console.error('[SW] Ошибка:', err);
    }
  });
}

// ── Старт ─────────────────────────────────────────────────────────────────────

loadContent('home');