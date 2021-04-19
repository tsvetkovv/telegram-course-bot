## Telegram bot for sending lessons files

Bot what send you set of files and track your progress. Useful when you have a lot of files to read/listen to and want to get them one by one.

After start, there is a button _Next lesson_. This button increments the lesson pointer for the user and sends next bulk of files.

### Upload processing
- Admin send files directly to the bot
- Bot parses file name to get lesson number
- It stores file_id in DB among with lesson number. So files itself are stored in Telegram.

### DB tables
- `chats` - users
- `files` - files metadata without data
- `lesson` many to 1 to `files`
- `chats_lesson` 1:1 to `chats` for tracking user's progress

### Env variables:

- `ADMIN_USERNAMES` comma separated list of usernames
- `WEBHOOK` any non-empty string. Otherwise, polling will be used
- `TELEGRAM_TOKEN`
- `DATABASE_URL`
- `HEROKU_APP_NAME`
