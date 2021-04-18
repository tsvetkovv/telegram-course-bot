const db = require("./db");
const {parseLesson} = require("./utils");

/**
 *
 * @param {number} chatId
 * @return {Promise<boolean>}
 */
async function checkUserExists(chatId) {
    const {rowCount} = await db.query(`
        SELECT 1 FROM chats
        WHERE id = $1
        LIMIT 1
`, [chatId]);

    return rowCount > 0;
}

/**
 * @param {number} chatId
 * @return {Promise<boolean>}
 */
async function checkAccess(chatId) {
    const {rowCount} = await db.query(`
        SELECT 1 FROM chats
        WHERE id = $1 AND
              (allow_access = true OR admin = true)
        LIMIT 1
`, [chatId]);

    return rowCount > 0;
}

/**
 * @param {number} chatId
 * @return {Promise<boolean>}
 */
async function checkAdmin(chatId) {
    const {rowCount} = await db.query(`
        SELECT id FROM chats
        WHERE admin = true AND
              id = $1 
        LIMIT 1
`, [chatId]);
    return rowCount > 0;
}

/**
 *
 * @param {Message} msg
 * @return {Promise<void>}
 */
async function uploadFileFromUser({file_name, title = null, file_id, mime_type}) {
    const lesson = parseLesson(file_name);
    return await db.query(`
        WITH add_file as (
            INSERT INTO files
            (file_id, file_name, title, mime_type)
            VALUES ($1, $2, $3, $4)
        )
        INSERT INTO lessons (number, file_id)
        VALUES ($5, $1);
`, [file_id, file_name, title, mime_type, lesson])
}

/**
 * @param {number} chatId
 * @return {Promise<number>}
 */
async function getCurrentLesson(chatId) {
    const {rows} = await db.query(`
        SELECT current_lesson
        FROM chats_lesson
        WHERE chat_id = $1
        LIMIT 1
    `, [chatId]);
    if (rows.length === 0) {
        return 1;
    }
    return rows[0].current_lesson;
}

/**
 * @param {number} lesson
 * @return {Promise<{file_id: number, mime_type: string}[]>}
 */
async function getFilesForLesson(lesson) {
    const res = await db.query(`
        SELECT
          files.file_id, files.mime_type
        FROM
          files
          INNER JOIN lessons ON files.file_id = lessons.file_id
        WHERE
          lessons.number = $1
        ORDER BY files.mime_type, files.file_name
    `, [lesson]);

    return res.rows;
}

/**
 * @param {number} chatId
 * @param {number} lesson
 * @return {Promise<boolean>}
 */
async function setLesson(chatId, lesson) {
    await db.query(`
        INSERT INTO
            chats_lesson (chat_id, current_lesson)
        VALUES
            ($1, $2) ON CONFLICT (chat_id) DO
        UPDATE SET
            current_lesson = $2;
    `, [chatId, lesson]);

    return true;
}

module.exports = {
    checkUserExists,
    checkAccess,
    checkAdmin,
    uploadFileFromUser,
    getCurrentLesson,
    getFilesForLesson,
    setLesson
}
