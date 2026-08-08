/// <reference types="vite/client" />

declare namespace Telegram {
  namespace WebApp {
    interface User {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
    }
    interface InitDataUnsafe {
      user?: User;
      language_code?: string;
      [key: string]: any;
    }
    interface WebApp {
      ready(): void;
      expand(): void;
      setHeaderColor(color: string): void;
      setBackgroundColor(color: string): void;
      MainButton?: {
        setText(text: string): void;
        show(): void;
        hide(): void;
      };
      themeParams?: Record<string, string>;
      initDataUnsafe?: InitDataUnsafe;
      HapticFeedback?: {
        impactOccurred(style: string): void;
      };
    }
  }
}

declare namespace YT {
  interface JsApi {
    PlayerState: {
      CUED: number;
      PLAYING: number;
      PAUSED: number;
      ENDED: number;
      BUFFERING: number;
    };
  }
  interface Player {
    playVideo(): void;
    pauseVideo(): void;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    setPlaybackRate(rate: number): void;
    getDuration(): number;
    loadVideoById(videoId: string, startSeconds?: number): void;
    destroy(): void;
  }
  interface PlayerOptions {
    height: string;
    width: string;
    videoId?: string;
    playerVars?: Record<string, any>;
    events?: {
      onReady?(): void;
      onStateChange?(event: { data: number }): void;
    };
  }
  interface PlayerConstructor {
    new (elementId: string, options: PlayerOptions): Player;
  }
  const Player: PlayerConstructor;
  const PlayerState: JsApi['PlayerState'];
}

interface Window {
  Telegram?: {
    WebApp?: Telegram.WebApp.WebApp;
  };
  onYouTubeIframeAPIReady?: () => void;
  YT?: YT;
}
