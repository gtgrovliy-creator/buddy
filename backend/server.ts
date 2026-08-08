import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const io = new Server(server, { cors: { origin: '*' }, transports: ['websocket'] });

const rooms = new Map<string, {
  host: string | null;
  video: string;
  paused: boolean;
  videoTS: number;
  playbackRate: number;
  roster: Map<string, { username: string }>;
  chat: { id: string; user: string; text: string; ts: number; system?: boolean }[];
}>();

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';

app.get('/health', (_req, res) => res.json({ ok: true }));
app.post('/createRoom', (req, res) => {
  const id = Math.random().toString(36).slice(2, 8);
  rooms.set(id, {
    host: null,
    video: '',
    paused: true,
    videoTS: 0,
    playbackRate: 1,
    roster: new Map(),
    chat: [],
  });
  res.json({ id });
});

app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));
app.get('/{*any}', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
});

io.on('connection', (socket) => {
  socket.on('tma:join', ({ roomId, username, isHost }: { roomId: string; username: string; isHost: boolean }) => {
    socket.join(roomId);
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }
    room.roster.set(socket.id, { username });
    if (isHost || !room.host) {
      room.host = socket.id;
    }
    socket.to(roomId).emit('tma:roster', Array.from(room.roster.values()).map((r) => r.username));
    socket.emit('tma:host', {
      video: room.video,
      paused: room.paused,
      videoTS: room.videoTS,
      playbackRate: room.playbackRate,
    });
    socket.emit('tma:chat', { id: 's1', user: 'System', text: `${username} joined the room`, ts: Date.now(), system: true });
  });

  socket.on('tma:setVideo', ({ video, paused, videoTS }: { video: string; paused: boolean; videoTS: number }) => {
    const room = [...socket.rooms].find((r) => r !== socket.id && rooms.has(r));
    if (!room) return;
    const r = rooms.get(room)!;
    r.video = video;
    r.paused = paused;
    r.videoTS = videoTS;
    io.to(room).emit('tma:host', { video, paused, videoTS, playbackRate: r.playbackRate });
  });

  socket.on('tma:play', () => {
    const room = [...socket.rooms].find((r) => r !== socket.id && rooms.has(r));
    if (!room) return;
    const r = rooms.get(room)!;
    r.paused = false;
    io.to(room).emit('tma:play');
  });

  socket.on('tma:pause', () => {
    const room = [...socket.rooms].find((r) => r !== socket.id && rooms.has(r));
    if (!room) return;
    const r = rooms.get(room)!;
    r.paused = true;
    io.to(room).emit('tma:pause');
  });

  socket.on('tma:seek', (t: number) => {
    const room = [...socket.rooms].find((r) => r !== socket.id && rooms.has(r));
    if (!room) return;
    const r = rooms.get(room)!;
    r.videoTS = t;
    io.to(room).emit('tma:seek', t);
  });

  socket.on('tma:rate', (rate: number) => {
    const room = [...socket.rooms].find((r) => r !== socket.id && rooms.has(r));
    if (!room) return;
    const r = rooms.get(room)!;
    r.playbackRate = rate;
    io.to(room).emit('tma:rate', rate);
  });

  socket.on('tma:chat', (data: { text: string }) => {
    const room = [...socket.rooms].find((r) => r !== socket.id && rooms.has(r));
    if (!room) return;
    const r = rooms.get(room)!;
    const user = r.roster.get(socket.id)?.username || 'Guest';
    const msg = { id: generateId(), user, text: data.text, ts: Date.now() };
    r.chat.push(msg);
    if (r.chat.length > 200) r.chat.shift();
    io.to(room).emit('tma:chat', msg);
  });

  socket.on('disconnect', () => {
    for (const roomId of socket.rooms) {
      if (roomId === socket.id) continue;
      const room = rooms.get(roomId);
      if (!room) continue;
      const username = room.roster.get(socket.id)?.username;
      room.roster.delete(socket.id);
      socket.to(roomId).emit('tma:roster', Array.from(room.roster.values()).map((r) => r.username));
      if (username) {
        room.chat.push({ id: generateId(), user: 'System', text: `${username} left`, ts: Date.now(), system: true });
        io.to(roomId).emit('tma:chat', { id: generateId(), user: 'System', text: `${username} left`, ts: Date.now(), system: true });
      }
    }
  });
});

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

server.listen(PORT, HOST, () => {
  console.log(`TMA backend listening on http://${HOST}:${PORT}`);
});
