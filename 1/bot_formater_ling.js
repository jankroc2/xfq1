require('dotenv').config();

  const BOT_TOKEN = process.env.BOT_TOKEN || '8051176356:AAFFlBNNo11Sn2KcF0zMVhfq2eGgUnRi6M8'; //токен с botfather'а
  const TelegramBot = require('node-telegram-bot-api');
 
  class TextLinkBot {
    constructor(token) {
      this.bot = new TelegramBot(token, { polling: true });
      this.userStates = new Map();
      this.setupHandlers();
    }
 
    setupHandlers() {
      this.bot.onText(/\/start/, this.handleStart.bind(this));
      this.bot.on('message', this.handleMessage.bind(this));
      this.bot.on('callback_query', this.handleCallback.bind(this));
      this.bot.on('polling_error', console.error);
    }
 
    async handleStart(msg) {
      const welcomeMsg = this.getWelcomeMessage(msg.from.first_name);
      await this.bot.sendMessage(msg.chat.id, welcomeMsg, { parse_mode: 'Markdown' });
    }
 
    async handleMessage(msg) {
      if (msg.text?.startsWith('/')) return;
 
      const chatId = msg.chat.id;
      const state = this.userStates.get(chatId);
 
      if (state?.waitingForLink) {
        await this.processLink(msg, chatId);
        return;
      }
 
      await this.saveOriginalMessage(msg, chatId);
    }
 
    async handleCallback(query) {
      if (query.data !== 'cancel') return;
 
      const chatId = query.message.chat.id;
      this.userStates.delete(chatId);
 
      await Promise.all([
        this.bot.sendMessage(chatId, 'Операция отменена'),
        this.bot.deleteMessage(chatId, query.message.message_id)
      ]);
    }
 
    async processLink(msg, chatId) {
      try {
        new URL(msg.text);
        const state = this.userStates.get(chatId);
        const result = this.createFinalMessage(state.text, state.entities, msg.text);
 
        if (!result) {
          throw new Error('No text content');
        }
 
        await this.bot.sendMessage(chatId, result, {
          parse_mode: 'Markdown',
          disable_web_page_preview: false
        });
 
        this.userStates.delete(chatId);
      } catch {
        await this.bot.sendMessage(chatId, 'Пожалуйста, отправьте корректную ссылку');
      }
    }
 
    async saveOriginalMessage(msg, chatId) {
      const { text, entities } = this.extractContent(msg);
 
      if (!text) {
        await this.bot.sendMessage(chatId,
          'Пожалуйста, добавьте текст к медиа или отправьте текстовое сообщение'
        );
        return;
      }
 
      this.userStates.set(chatId, { text, entities, waitingForLink: true });
 
      await this.bot.sendMessage(chatId, 'Теперь отправьте ссылку:', {
        reply_markup: {
          inline_keyboard: [[{ text: 'Отмена', callback_data: 'cancel' }]]
        }
      });
    }
 
    extractContent(msg) {
      if (msg.caption) {
        return { text: msg.caption, entities: msg.caption_entities || [] };
      }
      if (msg.text) {
        return { text: msg.text, entities: msg.entities || [] };
      }
      return { text: '', entities: [] };
    }
 
    createFinalMessage(text, entities = [], link) {
      if (!text) return '';
 
      const invisibleChar = '⁠'; // сам "невидимый" символ
      const formattedText = this.applyMarkdown(text, entities);
 
      return `[${invisibleChar}](${link})${formattedText}`;
    }
 
    applyMarkdown(text, entities) {
      if (!entities?.length) return text;
 
      const sorted = [...entities].sort((a, b) => b.offset - a.offset);
      return sorted.reduce((result, entity) => {
        const { offset, length, type, url } = entity;
        const content = text.substring(offset, offset + length);
 
        const formatted = this.formatEntity(content, type, url);
        return result.slice(0, offset) + formatted + result.slice(offset + length);
      }, text);
    }
 
    formatEntity(text, type, url) {
      const formats = {
        bold: `*${text}*`,
        italic: `_${text}_`,
        code: `\`${text}\``,
        pre: `\`\`\`\n${text}\n\`\`\``,
        text_link: `[${text}](${url})`
      };
      return formats[type] || text;
    }
 
    getWelcomeMessage(username) {
      return [
        `👋 Привет, ${username}!`,
        '',
        'Я помогу тебе добавить невидимую ссылку к твоему сообщению.',
        '',
        'Просто отправь мне:',
        '1️⃣ Любое текстовое сообщение.',
        '2️⃣ Ссылку, которую нужно добавить.',
        '',
        'Я сохраню Markdown форматирование оригинального текста! 🎨',
        'Поддерживаются: *жирный*, _курсив_, `код` и [встроенные ссылки](https://t.me/+42777).'
      ].join('\n');
    }
  }
 
  new TextLinkBot(BOT_TOKEN);
