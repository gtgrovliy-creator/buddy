import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const tg = window.Telegram?.WebApp;
const theme = tg?.themeParams || {};
const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:8080';

type Message = {
  id: string;
  user: string;
  text: string;
  ts: number;
  system?: boolean;
};

type HostState = {
  video: string;
  paused: boolean;
  videoTS: number;
  playbackRate: number;
};

function getTgUser() {
  const u = tg?.initDataUnsafe?.user;
  return u ? { id: String(u.id), name: u.first_name || u.username || 'User' } : { id: 'anon', name: 'Guest' };
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function App() {
  const [screen, setScreen] = useState<'home' | 'room'>('home');
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState(() => getTgUser().name);
  const [videoUrl, setVideoUrl] = useState('');
  const [chat, setChat] = useState<Message[]>([]);
  const [msg, setMsg] = useState('');
  const [hostState, setHostState] = useState<HostState | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [paused, setPaused] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);

  const socketRef = useRef<Socket | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ytRef = useRef<YT.Player | null>(null);
  const ytContainerRef = useRef<HTMLDivElement>(null);
  const tsIntervalRef = useRef<number | null>(null);

  const isYoutube = (url: string) => url.includes('youtube.com') || url.includes('youtu.be');
  const getYtId = (url: string) => {
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s]+)/);
    return m?.[1];
  };

  const joinRoom = useCallback((rid: string, makeHost = false) => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    const socket = io(serverUrl, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('tma:join', { roomId: rid, username, isHost: makeHost });
      if (makeHost) setIsHost(true);
      setRoomId(rid);
      setScreen('room');
      setError('');
      setLoading(false);
    });

    socket.on('tma:chat', (data: Message) => {
      setChat((c) => [...c, data]);
    });

    socket.on('tma:host', (state: HostState) => {
      setHostState(state);
      setPaused(state.paused);
      setPlaybackRate(state.playbackRate || 1);
      if (videoRef.current && !isYoutube(state.video)) {
        videoRef.current.src = state.video;
        videoRef.current.currentTime = state.videoTS;
        if (!state.paused) videoRef.current.play().catch(() => {});
      }
      if (isYoutube(state.video) && ytRef.current && ytRef.current.loadVideoById) {
        const vid = getYtId(state.video);
        if (vid) {
          ytRef.current.loadVideoById(vid, state.videoTS);
          if (state.paused) ytRef.current.pauseVideo();
        }
      }
    });

    socket.on('tma:play', () => {
      setPaused(false);
      videoRef.current?.play().catch(() => {});
      ytRef.current?.playVideo();
    });

    socket.on('tma:pause', () => {
      setPaused(true);
      videoRef.current?.pause();
      ytRef.current?.pauseVideo();
    });

    socket.on('tma:seek', (t: number) => {
      setCurrentTime(t);
      if (videoRef.current && !isYoutube(hostState?.video || '')) {
        videoRef.current.currentTime = t;
      }
      if (ytRef.current && isYoutube(hostState?.video || '')) {
        ytRef.current.seekTo(t, true);
      }
    });

    socket.on('tma:rate', (r: number) => {
      setPlaybackRate(r);
      if (videoRef.current) videoRef.current.playbackRate = r;
    });

    socket.on('tma:roster', (users: string[]) => {
      setParticipants(users);
    });

    socket.on('connect_error', () => {
      setError('Cannot connect to server');
      setLoading(false);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });
  }, [username, hostState?.video]);

  const handleCreate = () => {
    const rid = generateId();
    setLoading(true);
    joinRoom(rid, true);
  };

  const handleJoin = () => {
    if (!roomId.trim()) return;
    setLoading(true);
    joinRoom(roomId.trim(), false);
  };

  const sendCmd = useCallback((cmd: string, payload?: any) => {
    socketRef.current?.emit(cmd, payload);
  }, []);

  const handlePlay = () => {
    sendCmd('tma:play');
    setPaused(false);
  };

  const handlePause = () => {
    sendCmd('tma:pause');
    setPaused(true);
  };

  const handleSeek = (t: number) => {
    sendCmd('tma:seek', t);
    setCurrentTime(t);
  };

  const handleRate = (r: number) => {
    sendCmd('tma:rate', r);
    setPlaybackRate(r);
  };

  const handleSetVideo = () => {
    if (!videoUrl.trim()) return;
    setHostState({ video: videoUrl, paused: true, videoTS: 0, playbackRate: 1 });
    sendCmd('tma:setVideo', { video: videoUrl, paused: true, videoTS: 0 });
    setVideoUrl('');
    tg?.HapticFeedback?.impactOccurred?.('light');
  };

  const handleSendChat = () => {
    if (!msg.trim()) return;
    sendCmd('tma:chat', { text: msg.trim() });
    setMsg('');
  };

  useEffect(() => {
    if (screen !== 'room' || !hostState?.video || isYoutube(hostState.video)) return;

    const v = videoRef.current;
    if (!v) return;

    const onTime = () => setCurrentTime(v.currentTime);
    const onDur = () => setDuration(v.duration || 0);
    const onPlay = () => setPaused(false);
    const onPause = () => setPaused(true);

    v.addEventListener('timeupdate', onTime);
    v.addEventListener('loadedmetadata', onDur);
    v.addEventListener('durationchange', onDur);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);

    if (isHost && tsIntervalRef.current === null) {
      tsIntervalRef.current = window.setInterval(() => {
        if (videoRef.current && !videoRef.current.paused) {
          sendCmd('tma:ts', videoRef.current.currentTime);
        }
      }, 1000);
    }

    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('loadedmetadata', onDur);
      v.removeEventListener('durationchange', onDur);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      if (tsIntervalRef.current) {
        clearInterval(tsIntervalRef.current);
        tsIntervalRef.current = null;
      }
    };
  }, [screen, hostState?.video, isHost, sendCmd]);

  useEffect(() => {
    if (!isYoutube(hostState?.video || '') || !ytContainerRef.current) return;

    const initYT = () => {
      if (!window.YT) return;
      ytRef.current = new window.YT.Player(ytContainerRef.current!, {
        height: '100%',
        width: '100%',
        videoId: getYtId(hostState!.video),
        playerVars: { autoplay: 0, controls: 1, modestbranding: 1, rel: 0 },
        events: {
          onReady: () => {
            ytRef.current?.setPlaybackRate(playbackRate);
            if (hostState!.paused) ytRef.current?.pauseVideo();
          },
          onStateChange: (e: any) => {
            if (e.data === window.YT.PlayerState.PLAYING) {
              setPaused(false);
              setDuration(ytRef.current?.getDuration() || 0);
            }
            if (e.data === window.YT.PlayerState.PAUSED) setPaused(true);
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initYT();
    } else {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
      window.onYouTubeIframeAPIReady = initYT;
    }

    return () => {
      ytRef.current?.destroy();
      ytRef.current = null;
    };
  }, [hostState?.video, playbackRate]);

  useEffect(() => {
    tg?.setHeaderColor?.('bg_color');
    tg?.setBackgroundColor?.('bg_color');
    tg?.MainButton?.setText?.('Watch Together');
    tg?.MainButton?.show?.();
    return () => {
      tg?.MainButton?.hide?.();
      socketRef.current?.disconnect();
    };
  }, []);

  const formatTime = (t: number) => {
    if (!t || isNaN(t)) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (screen === 'home') {
    return (
      <div className="app" style={{ background: theme.bg_color || '#1a1a1a', minHeight: '100vh', color: theme.text_color || '#fff' }}>
        <div className="container">
          <h1 style={{ color: theme.button_color || '#3390ec' }}>WatchParty TMA</h1>
          <p style={{ opacity: 0.7 }}>Watch videos together in Telegram</p>

          {error && <div className="error">{error}</div>}

          <div className="card">
            <label>Your name</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your name"
              style={{ background: theme.secondary_bg_color || '#2c2c2c', color: theme.text_color || '#fff', border: `1px solid ${theme.hint_color || '#555'}` }}
            />

            <button className="primary" onClick={handleCreate} disabled={loading}>
              {loading ? 'Creating...' : 'Create Room'}
            </button>

            <div className="divider">or</div>

            <input
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Enter room code"
              style={{ background: theme.secondary_bg_color || '#2c2c2c', color: theme.text_color || '#fff', border: `1px solid ${theme.hint_color || '#555'}` }}
            />
            <button className="secondary" onClick={handleJoin} disabled={loading || !roomId.trim()}>
              Join Room
            </button>
          </div>

          {!connected && !loading && (
            <p style={{ fontSize: 12, opacity: 0.5, marginTop: 20 }}>
              Connect to a room to start watching together
            </p>
          )}
        </div>
      </div>
    );
  }

  const youtubeVideo = hostState?.video && isYoutube(hostState.video);
  const directVideo = hostState?.video && !isYoutube(hostState.video);

  return (
    <div className="app room" style={{ background: theme.bg_color || '#1a1a1a', minHeight: '100vh', color: theme.text_color || '#fff' }}>
      <div className="room-layout">
        <div className="video-section">
          <div className="room-header">
            <button className="back" onClick={() => { setScreen('home'); socketRef.current?.disconnect(); }}>
              ← Back
            </button>
            <span className="room-code">Room: {roomId}</span>
            <span className="status" style={{ color: connected ? '#4caf50' : '#f44336' }}>
              {connected ? 'Connected' : 'Offline'}
            </span>
          </div>

          <div className="video-wrapper">
            {youtubeVideo && (
              <div ref={ytContainerRef} className="yt-player" />
            )}
            {directVideo && (
              <video
                ref={videoRef}
                controls
                autoPlay
                className="html-player"
                src={hostState.video}
              />
            )}
            {!hostState?.video && (
              <div className="placeholder">
                <p>No video playing</p>
                {isHost && (
                  <div className="set-video">
                    <input
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="Paste YouTube or video URL"
                      style={{ background: theme.secondary_bg_color || '#2c2c2c', color: theme.text_color || '#fff', border: `1px solid ${theme.hint_color || '#555'}` }}
                    />
                    <button className="primary" onClick={handleSetVideo} disabled={!videoUrl.trim()}>
                      Set Video
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {hostState?.video && (
            <div className="controls">
              <button onClick={handlePlay} disabled={!isHost && paused === false}>Play</button>
              <button onClick={handlePause} disabled={!isHost && paused === true}>Pause</button>
              <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={(e) => handleSeek(Number(e.target.value))}
                disabled={!isHost}
              />
              <select value={playbackRate} onChange={(e) => handleRate(Number(e.target.value))} disabled={!isHost}>
                <option value={0.5}>0.5x</option>
                <option value={1}>1x</option>
                <option value={1.5}>1.5x</option>
                <option value={2}>2x</option>
              </select>
            </div>
          )}

          <div className="participants">
            <strong>Watching ({participants.length})</strong>
            <div className="user-list">
              {participants.map((u, i) => (
                <span key={i} className="user-chip">{u}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="chat-section">
          <div className="chat-header">Chat</div>
          <div className="chat-messages">
            {chat.map((m) => (
              <div key={m.id} className={`msg ${m.system ? 'system' : ''}`}>
                <span className="author">{m.user}: </span>
                <span className="text">{m.text}</span>
              </div>
            ))}
          </div>
          <div className="chat-input">
            <input
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder="Type a message..."
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              style={{ background: theme.secondary_bg_color || '#2c2c2c', color: theme.text_color || '#fff', border: `1px solid ${theme.hint_color || '#555'}` }}
            />
            <button className="primary" onClick={handleSendChat} disabled={!msg.trim()}>Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
