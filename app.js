'use strict';

// localStorage

function loadNotes() {
  return JSON.parse(localStorage.getItem('notes') || '[]');
}

function saveNotes(notes) {
  localStorage.setItem('notes', JSON.stringify(notes));
}

//Рендер списка заметок 

let notes = loadNotes();
const list = document.getElementById('notes-list');

function render() {
  list.innerHTML = notes.map(n => `
    <li class="note-item" data-id="${n.id}">
      <span>${n.text}</span>
      <button class="delete-btn">✕</button>
    </li>
  `).join('');
}

// Добавление заметки

const form  = document.getElementById('note-form');
const input = document.getElementById('note-input');

form.addEventListener('submit', e => {
  e.preventDefault();
  const text = input.value.trim();
  if (text) {
    notes.unshift({ id: Date.now(), text });
    saveNotes(notes);
    render();
    input.value = '';
  }
});

//Удаление заметки

list.addEventListener('click', e => {
  if (e.target.matches('.delete-btn')) {
    const id = Number(e.target.closest('.note-item').dataset.id);
    notes = notes.filter(n => n.id !== id);
    saveNotes(notes);
    render();
  }
});

// Регистрация Service Worker

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      console.log('[SW] Зарегистрирован, scope:', reg.scope);
    } catch (err) {
      console.error('[SW] Ошибка:', err);
    }
  });
}

render();