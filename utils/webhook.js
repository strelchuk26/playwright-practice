const TelegramBot = require("node-telegram-bot-api");
const config = require("../config")

module.exports = {
    telegram: async content => {
        const bot = new TelegramBot(config.telegram.botToken, { polling: false });
        await bot.sendMessage(config.telegram.chatId, content);
    },
}