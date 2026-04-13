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

const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

io.on('connection', socket => {
  console.log('Клиент подключён:', socket.id);

  socket.on('newTask', task => {
    io.emit('taskAdded', task);

    const payload = JSON.stringify({ title: 'Новая задача', body: task.text });
    subscriptions.forEach(sub => {
      webpush.sendNotification(sub, payload)
        .catch(err => console.error('Push error:', err));
    });
  });

  socket.on('disconnect', () => {
    console.log('Клиент отключён:', socket.id);
  });
});

app.post('/subscribe', (req, res) => {
  subscriptions.push(req.body);
  res.status(201).json({ message: 'Подписка сохранена' });
});

app.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  subscriptions = subscriptions.filter(s => s.endpoint !== endpoint);
  res.status(200).json({ message: 'Подписка удалена' });
});

server.listen(3001, () => {
  console.log('Сервер запущен на http://localhost:3001');
});