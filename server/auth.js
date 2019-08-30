const config = require('./conf/config');
const database = require('./database');
const router = require('express').Router();
const bodyParser = require('body-parser');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const nanoid = require('nanoid');
const axios = require('axios');
const {URLSearchParams} = require('url');
const jsonParser = bodyParser.json();

const tokenTTLSeconds = 5 * 60;
const loginTokens = {};

router.use(jsonParser);

router.use(session({
    secret: config.session.secret,
    store: new FileStore(),
    resave: false,
    saveUninitialized: true,
    cookie: {secure: config.useHttps},
}));

router.get('/login/x', async (req, res) => {
    const token = req.query.y;

    if (!loginTokens[token]) {
        res.sendStatus(400);
        return;
    }

    const {participant_id, created_hrtime} = loginTokens[token];
    delete loginTokens[token];

    if (process.hrtime(created_hrtime)[0] > tokenTTLSeconds) {
        res.sendStatus(400);
        return;
    }

    const participant = await database.getParticipantById(participant_id);

    if (!participant) {
        res.sendStatus(400);
        return;
    }

    req.session.user = participant;

    res.redirect('/');
});

router.post('/login', async (req, res) => {
    const {email} = req.body;
    const participant = await database.getParticipantByEmail(email);

    if (!participant) {
        res.sendStatus(400);
        return;
    }

    const token = createLoginToken(participant.participant_id);

    try {
        await sendTokenEmail(token, email);
    } catch (e) {
        console.log(e);
        res.sendStatus(400);
        return;
    }

    res.send('OK');
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

router.get('/session', (req, res) => {
    if (req.session && req.session.user) {
        res.send(req.session.user);
    } else {
        res.sendStatus(401);
    }
});

function createLoginToken(participant_id) {
    const token = nanoid();

    if (loginTokens[token]) {
        return createLoginToken(participant_id);
    }

    loginTokens[token] = {
        participant_id,
        created_hrtime: process.hrtime()
    };

    return token;
}

function sendTokenEmail(token, email) {
    const link = `${config.mailgun.loginLinkHostname}/login/x?y=${token}`;

    const data = new URLSearchParams();
    data.append('from', config.mailgun.from);
    data.append('to', email);
    data.append('subject', 'Login link');
    data.append('text', link);
    data.append('html', `<a href="${link}">${link}</a>`);

    return axios({
        method: 'post',
        url: `${config.mailgun.apiUrl}/v3/${config.mailgun.domain}/messages`,
        data,
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        auth: {
            username: 'api',
            password: config.mailgun.apiKey
        }
    });
}

// Token cleaner
setInterval(() => {
    for (const token in loginTokens) {
        const {created_hrtime} = loginTokens[token];

        if (process.hrtime(created_hrtime)[0] > tokenTTLSeconds) {
            delete loginTokens[token];
            console.log('Token expired:', token);
        }
    }
}, 60 * 1000);

module.exports = router;