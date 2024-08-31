import config from "./conf/config.js";
import database from "./database.mjs";
import {Router} from "express";
import bodyParser from "body-parser";
import session from "express-session";
import session_file_store from "session-file-store";

const router = Router();
const FileStore = session_file_store(session);
const jsonParser = bodyParser.json();

export default router;

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
