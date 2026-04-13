const express    = require('express');
const http       = require('http');
const socketIo   = require('socket.io');
const webpush    = require('web-push');
const bodyParser = require('body-parser');
const cors       = require('cors');
const path       = require('path');

const vapidKeys = {
  publicKey:  'BPyBWJhHuHa8Pv1nqaFICGEN-cow2l5xpap4QoGJ3gO-YK_Hn-2GIhskv38IWnzETjEGCpG-brgvxhb-oQ3XpCA',
  privateKey: 'dGOBwgD76nLKpgLl71SMEGzqO_E2WvI8HbbjCtzc-cU'
};

webpush.setVapidDetails(
  'mailto:swame@mail.ru',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, './')));

let subscriptions = [];
const reminders   = new Map();

const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

io.on('connection', socket => {
  console.log('Клиент подключён:', socket.id);

  // Обычная заметка
  socket.on('newTask', task => {
    io.emit('taskAdded', task);
    const payload = JSON.stringify({ title: 'Новая задача', body: task.text });
    subscriptions.forEach(sub => {
      webpush.sendNotification(sub, payload)
        .catch(err => console.error('Push error:', err));
    });
  });

  // Заметка с напоминанием — планируем таймер
  socket.on('newReminder', reminder => {
    const { id, text, reminderTime } = reminder;
    const delay = reminderTime - Date.now();
    if (delay <= 0) return;

    const timeoutId = setTimeout(() => {
      const payload = JSON.stringify({
        title: '⏰ Напоминание',
        body: text,
        reminderId: id
      });
      subscriptions.forEach(sub => {
        webpush.sendNotification(sub, payload)
          .catch(err => console.error('Push error:', err));
      });
      reminders.delete(id);
    }, delay);

    reminders.set(id, { timeoutId, text, reminderTime });
    console.log(`Напоминание запланировано: "${text}" через ${Math.round(delay / 1000)} сек`);
  });

  socket.on('disconnect', () => {
    console.log('Клиент отключён:', socket.id);
  });
});

// ── Push подписки ─────────────────────────────────────────────────────────────

app.post('/subscribe', (req, res) => {
  subscriptions.push(req.body);
  res.status(201).json({ message: 'Подписка сохранена' });
});

app.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  subscriptions = subscriptions.filter(s => s.endpoint !== endpoint);
  res.status(200).json({ message: 'Подписка удалена' });
});

// ── Отложить на 5 минут ───────────────────────────────────────────────────────

app.post('/snooze', (req, res) => {
  const reminderId = parseInt(req.query.reminderId, 10);

  if (!reminderId || !reminders.has(reminderId)) {
    return res.status(404).json({ error: 'Reminder not found' });
  }

  const reminder = reminders.get(reminderId);
  clearTimeout(reminder.timeoutId);

  const newDelay     = 5 * 60 * 1000;
  const newTimeoutId = setTimeout(() => {
    const payload = JSON.stringify({
      title: '⏰ Напоминание отложено',
      body: reminder.text,
      reminderId: reminderId
    });
    subscriptions.forEach(sub => {
      webpush.sendNotification(sub, payload)
        .catch(err => console.error('Push error:', err));
    });
    reminders.delete(reminderId);
  }, newDelay);

  reminders.set(reminderId, {
    timeoutId: newTimeoutId,
    text: reminder.text,
    reminderTime: Date.now() + newDelay
  });

  console.log(`Напоминание отложено: "${reminder.text}"`);
  res.status(200).json({ message: 'Reminder snoozed for 5 minutes' });
});

server.listen(3001, () => {
  console.log('Сервер запущен на http://localhost:3001');
});