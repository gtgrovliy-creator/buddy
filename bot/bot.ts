import { Bot } from 'grammy';

const BOT_TOKEN = process.env.BOT_TOKEN!;
const MINI_APP_URL = process.env.MINI_APP_URL!;

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN is required');
  process.exit(1);
}

if (!MINI_APP_URL) {
  console.error('MINI_APP_URL is required (HTTPS URL of your Mini App)');
  process.exit(1);
}

const bot = new Bot(BOT_TOKEN);

bot.start((ctx) => {
  ctx.reply(
    'Welcome to WatchParty TMA!\n\nWatch videos together with friends directly in Telegram.',
    {
      reply_markup: {
        keyboard: [
          [
            {
              text: '🎬 Watch Together',
              web_app: { url: MINI_APP_URL },
            },
          ],
        ],
        resize_keyboard: true,
      },
    }
  );
});

bot.command('watch', (ctx) => {
  ctx.reply('Open WatchParty:', {
    reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🎬 Open WatchParty',
                web_app: { url: MINI_APP_URL },
              },
            ],
          ],
        },
  });
});

bot.on('web_app_data', (ctx) => {
  ctx.reply('Received data from Mini App!');
});

async function main() {
  console.log('Starting bot...');
  await bot.api.setMyCommands([
    { command: 'start', description: 'Start the bot' },
    { command: 'watch', description: 'Open WatchParty Mini App' },
  ]);

  await bot.start();
  console.log('Bot is running...');
}

main().catch((err) => {
  console.error('Bot error:', err);
  process.exit(1);
});
