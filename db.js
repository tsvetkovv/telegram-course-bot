const fs = require("fs");
const {Pool} = require('pg');

if (!process.env.DATABASE_URL) {
    throw new Error('Please define DATABASE_URL')
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err)
    process.exit(-1)
})

pool.connect(async (err, client, done) => {
    if (!err) {
        console.log('DB is connected');
    } else {
        console.error('');
    }

    try {
        await init();
        done();
    } catch (e) {
        console.error(e);
    }
});

module.exports = {
    async query(text, params) {
        const res = await pool.query(text, params);
        console.log('executed query', { text, rows: res.rowCount })
        return res
    },
};

async function init() {
    const dataSql = fs.readFileSync('./db_init.sql').toString();
    await pool.query(dataSql);
}
