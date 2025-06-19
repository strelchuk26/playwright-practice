require("dotenv").config();

module.exports = {
    account: {
        login: process.env.INFO_CAR_LOGIN,
        password: process.env.INFO_CAR_PASSWORD,
    },

    maxExamTime: 7, 

    telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID,
    },

    notifyVia: "telegram",
    refreshTime: 60,
};
