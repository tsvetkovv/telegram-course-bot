const db = require("./db");
const {
    checkAdmin,
    checkAccess,
    setLesson,
    getFilesForLesson,
    getCurrentLesson,
    uploadFileFromUser,
    checkUserExists
} = require("./data.model");

/**
 * @param {TelegramBot} bot
 */
module.exports = function init(bot) {
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
        // username is optional field so put some identity
        const username = msg.from.username
            ? '@' + msg.from.username
            : msg.from.first_name + ' ' + msg.from.last_name
        await db.query(`
            INSERT INTO chats (id, user_id, username, admin)
            VALUES ($1, $2, $3, $4)
            `, [
            chatId, msg.from.id, username, admin
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

    /**
     * Uploading lesson files via chat
     * admin only
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

    /**
     * new member moderation
     * admin only
     */
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

    /**
     * Sending next lesson
     */
    bot.onText(/next/i, async (msg) => {
        if (!(await checkAccess(msg.chat.id))) {
            return;
        }

        const chatId = msg.chat.id;
        await bot.deleteMessage(chatId, msg.message_id)

        const user = msg.from
        const currentLesson = await getCurrentLesson(chatId);
        console.log(`Next lesson ${currentLesson} for user`, { username: user.username, first_name: user.first_name, last_name: user.last_name });
        const files = await getFilesForLesson(currentLesson);
        if (files.length > 0) {
            await files.reduce(
                (p, file) =>
                    p.then(_ => sendFile(chatId, file.file_id, file.mime_type, currentLesson)),
                Promise.resolve()
            );
            await setLesson(chatId, currentLesson + 1);

        } else {
            await bot.sendMessage(chatId, 'No more lessons available');
        }
    })

    /**
     * @param {number} chatId
     * @param {string} file_id
     * @param {string} mime_type
     * @param {number} currentLesson
     */
    async function sendFile(chatId, file_id, mime_type, currentLesson) {
        const options = {
            disable_notification: true
        };
        if (mime_type.includes('pdf')) {
            return bot.sendDocument(chatId, file_id, {...options, caption: `Lesson ${currentLesson}`})
        }
        if (mime_type.includes('audio')) {
            return bot.sendAudio(chatId, file_id, options)
        }
    }
}
