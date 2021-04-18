const TOKEN = process.env.TELEGRAM_TOKEN;
const TelegramBot = require('node-telegram-bot-api');
const db = require("./db");
const {
    checkAdmin,
    checkAccess,
    setLesson,
    getFilesForLesson,
    getCurrentLesson,
    uploadFileFromUser,
    checkUserExists
} = require("./data.controller");

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

/**
 * Uploading lesson files via chat
 */
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    if ((await checkAdmin(chatId)) && (msg.audio || msg.document)) {
        try {
            await uploadFileFromUser(msg.audio || msg.document);
        } catch (e) {
            await bot.sendMessage(chatId, 'Something went wrong', { disable_notification: true });
            console.error(e.stack);
        }
    }
});

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;

    if (await checkUserExists(chatId)) {
        return
    }
    const user = msg.from;
    console.log('New user', { username: user.username, first_name: user.first_name, last_name: user.last_name });
    let admin = false;
    if (process.env.ADMIN_USERNAMES) {
        const admins = process.env.ADMIN_USERNAMES.split(',');
        admin = admins.some(a => a === msg.from.username);
    }
    const username = msg.from.username
        ? '@' + msg.from.username
        : msg.from.first_name + ' ' + msg.from.last_name
     await db.query(`
            INSERT INTO chats (id, user_id, username, admin)
            VALUES ($1, $2, $3, $4)
            `, [
        chatId, msg.from.id, msg.from.username, admin
    ]);
    if (!admin) {
        const {rows: admins} = await db.query('SELECT id FROM chats WHERE admin = true');
        await admins.reduce(
            (p, admin) =>
                p.then(_ => bot.sendMessage(
                    admin.id,
                    `New user id=${msg.from.id} ${username} requested an access. /allow_${msg.chat.id}`,

                )),
            Promise.resolve()
        );
        await bot.sendMessage(msg.chat.id, 'The access request has been sent. Please wait for approval', {
            reply_markup: {
                remove_keyboard: true
            }
        });
    }
});

bot.onText(/\/allow_(\d+)/, async (msg, match) => {
    if (!(await checkAdmin(msg.chat.id))) {
        return;
    }
    const chatIdToAllow = parseInt(match[1]);
    const {rows} = await db.query(`
        UPDATE chats
        SET allow_access = true
        WHERE id = $1
        RETURNING username, id
`, [chatIdToAllow]);
    if (rows && rows[0]) {
        const userId = rows[0].id;
        await bot.sendMessage(msg.chat.id, `User with id=${userId} is  allowed`);
        await bot.sendMessage(userId, `You are allowed to use bot`, {
            reply_markup: {
                keyboard: [[{text: 'Next lesson'}]],
                resize_keyboard: true,
                one_time_keyboard: false,
            }
        });
    }
})

bot.onText(/Next lesson/, async (msg) => {
    if (!(await checkAccess(msg.chat.id))) {
        return;
    }

    const chatId = msg.chat.id;
    await bot.deleteMessage(chatId, msg.message_id.toString())

    const user = msg.from
    const currentLesson = await getCurrentLesson(chatId);
    console.log(`Next lesson ${currentLesson} for user`, { username: user.username, first_name: user.first_name, last_name: user.last_name });
    const files = await getFilesForLesson(currentLesson);
    if (files.length > 0) {
        const options = {
            disable_notification: true
        }
        await files.reduce(
            (p, file) =>
                p.then(_ => sendFile(chatId, file.file_id, file.mime_type, options, currentLesson)),
            Promise.resolve()
        );
        await setLesson(chatId, currentLesson + 1);

    } else {
        await bot.sendMessage(chatId, 'No more lessons available');
    }
})

async function sendFile(chatId, file_id, mime_type, options, currentLesson) {
    if (mime_type.includes('pdf')) {
        return bot.sendDocument(chatId, file_id, {...options, caption: `Lesson ${currentLesson}`})
    }
    if (mime_type.includes('audio')) {
        return bot.sendAudio(chatId, file_id, options)
    }
}

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
