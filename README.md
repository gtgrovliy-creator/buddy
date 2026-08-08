# WatchParty Telegram Mini App

Telegram Mini App для совместного просмотра видео. Основан на идее WatchParty и WatchBuddy.

## Состав

- `frontend/` — React + Vite + Telegram Web App SDK
- `backend/` — Node.js + Socket.IO (синхронизация комнат)
- `bot/` — Telegram-бот (Grammy), открывает Mini App

## Требования

- Node.js >= 18
- npm
- Домен с HTTPS (для Telegram Mini App)
- Бот в @BotFather

## Локальный запуск

### 1. Запустите бэкенд

```bash
cd backend
npm install
npm start
```

Бэкенд запустится на `http://localhost:8080`

### 2. Соберите фронтенд

```bash
cd frontend
npm install
npm run build
```

### 3. Запустите бота

```bash
cd bot
npm install
cp .env.example .env   # если есть
# Отредактируйте .env: укажите BOT_TOKEN и MINI_APP_URL
npm start
```

## Деплой на VPS (Ubuntu)

### 1. Установите Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Запушьте проект

```bash
git clone <your-repo-url>
cd watchparty-tma
```

### 3. Соберите фронтенд

```bash
cd frontend && npm install && npm run build && cd ..
```

### 4. Установите PM2

```bash
sudo npm install -g pm2
```

### 5. Создайте `.env` в `backend/`

```
PORT=8080
HOST=0.0.0.0
```

### 6. Запустите бэкенд через PM2

```bash
cd backend && npm install
pm2 start npm --name "watchparty-backend" -- start
pm2 save
```

### 7. Настройте Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 8. Получите SSL сертификат

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 9. Настройте Telegram бота

1. Создайте бота в @BotFather: `/newbot`
2. Получите токен
3. В @BotFather: `/mybots` → выберите бота → `Bot Settings` → `Menu Button` → `Configure Menu Button`
4. Укажите HTTPS URL: `https://your-domain.com`
5. Запустите бота с переменными окружения:

```bash
cd bot && npm install
BOT_TOKEN=your_token MINI_APP_URL=https://your-domain.com npm start
```

Или через PM2:

```bash
pm2 start npm --name "watchparty-bot" -- start --cwd bot
pm2 save
```

## Использование

1. Откройте бота в Telegram
2. Нажмите кнопку меню → "Watch Together"
3. Создайте комнату или введите код комнаты
4. Хост вставляет ссылку на видео (YouTube или прямой URL)
5. Все участники видят видео синхронно
6. В чате можно общаться

## Возможности

- Создание/присоединение к комнатам
- Синхронизация видео (play/pause/seek)
- Поддержка YouTube через iframe API
- Поддержка прямых видео URL (mp4, m3u8)
- Общий чат
- Адаптивный интерфейс под Telegram
- Темная тема Telegram

## Разработка

### Структура проекта

```
watchparty-tma/
├── frontend/          # React + Vite фронтенд
│   ├── src/
│   │   ├── App.tsx    # Основной компонент
│   │   ├── main.tsx   # Точка входа
│   │   └── index.css  # Стили
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── backend/           # Node.js + Socket.IO бэкенд
│   ├── server.ts      # Express + Socket.IO сервер
│   ├── package.json
│   └── tsconfig.json
└── bot/               # Telegram бот
    ├── bot.ts         # Grammy бот
    ├── package.json
    └── tsconfig.json
```

### Добавление новых источников видео

В `frontend/src/App.tsx` можно расширить поддержку:
- YouTube через iframe API (уже работает)
- Прямые MP4/WebM URL (уже работает)
- Для других источников можно добавить HLS.js, DASH.js и т.д.

## Лицензия

MIT
