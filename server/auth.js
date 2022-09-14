const config = require('./conf/config');
const database = require('./database');
const router = require('express').Router();
const bodyParser = require('body-parser');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const jsonParser = bodyParser.json();

router.use(jsonParser);

router.use(session({
    secret: config.session.secret,
    store: new FileStore(),
    resave: false,
    saveUninitialized: true,
    cookie: {secure: config.useHttps},
}));

router.post('/cafi', async (req, res) => {
    const {token, username, password} = req.body;

    console.log('/cafi', token, username, password);

    try {
        await database.createAccount(token, username, password);
        res.sendStatus(200);
    } catch (e) {
        console.error(e);
        res.sendStatus(400);
    }
});

router.post('/login', async (req, res) => {
    const {username, password} = req.body;
    const isValid = await database.isValidAccount(username, password);

    if (!isValid) {
        res.sendStatus(400);
        return;
    }

    const participant = await database.getParticipantByAccountName(username);

    if (!participant) {
        res.sendStatus(400);
        return;
    }

    req.session.user = participant;

    res.send('OK');
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.send('OK');
});

router.get('/session', (req, res) => {
    if (req.session && req.session.user) {
        res.send(req.session.user);
    } else {
        res.sendStatus(401);
    }
});

module.exports = router;