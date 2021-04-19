const TOKEN = process.env.TELEGRAM_TOKEN;
const TelegramBot = require('node-telegram-bot-api');
const initCommands = require("./commands");

if (!TOKEN) {
    throw new Error('Please define TELEGRAM_TOKEN')
}

const bot = new TelegramBot(TOKEN, getOptions());

// This informs the Telegram servers of the new webhook.
// Note: we do not need to pass in the cert, as it already provided
if (process.env.WEBHOOK) {
    const url = process.env.APP_URL || `https://${process.env.HEROKU_APP_NAME}.herokuapp.com:443`;
    if (!url) {
        throw new Error('APP_URL is not defined')
    }
    bot.setWebHook(`${url}/bot${TOKEN}`).then(res => console.log('Webhook is set up'))
        .catch(err => console.error(err));
}

initCommands(bot);

bot.on("polling_error", (err) => console.log(err));

function getOptions() {
    if (process.env.WEBHOOK)
        return {
            webHook: {
                // Port to which you should bind is assigned to $PORT variable
                // See: https://devcenter.heroku.com/articles/dynos#local-environment-variables
                port: process.env.PORT
                // you do NOT need to set up certificates since Heroku provides
                // the SSL certs already (https://<app-name>.herokuapp.com)
                // Also no need to pass IP because on Heroku you need to bind to 0.0.0.0
            },
        };
    return {
        polling: true
    }
}
