import config from "./conf/config.js";
import database from "./database.mjs";
import {Router} from "express";
import bodyParser from "body-parser";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import * as client from 'openid-client';

const router = Router();
const pgSessionStore = connectPgSimple(session);
const jsonParser = bodyParser.json();

let openidClientConfig = await client.discovery(
    new URL(config.gitlab.url),
    config.gitlab.appId,
    config.gitlab.appSecret
);

export default router;

router.use(jsonParser);

router.use(session({
    secret: config.session.secret,
    store: new pgSessionStore({
        pool: database.poolPrivate,
        schemaName: 'private',
        tableName: 'session',
    }),
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: config.useHttps,
        maxAge: 2 * 24 * 60 * 60 * 1000, // 2 days
    }
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

router.get('/gitlab/login', async (req, res) => {
    let codeVerifier = client.randomPKCECodeVerifier();
    let codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
    let state = client.randomState();

    req.session.authRequest = {
        codeVerifier,
        codeChallenge,
        state,
        redirect: req.query.redirect,
    };

    req.session.save();

    let redirectTo = client.buildAuthorizationUrl(openidClientConfig, {
        redirect_uri: config.gitlab.redirectUri,
        scope: 'read_user',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state,
    });

    res.redirect(redirectTo.href);
});

router.get('/gitlab/callback', async (req, res) => {
    const {codeVerifier, state, redirect} = req.session.authRequest;

    delete req.session.authRequest;

    let tokens = await client.authorizationCodeGrant(
        openidClientConfig,
        new URL(`${req.protocol}://${req.host}${req.originalUrl ?? req.url}`),
        {
            pkceCodeVerifier: codeVerifier,
            expectedState: state,
        }
    );

    let access_token = tokens.access_token;

    let protectedResource = await client.fetchProtectedResource(
        openidClientConfig,
        access_token,
        new URL('/api/v4/user', config.gitlab.url),
        'GET',
    );

    const userInfo = await protectedResource.json();

    const participant = await database.getParticipantByGitlabId(userInfo.id);

    if (!participant) {
        console.log('Account not found');
    } else {
        req.session.user = participant;
    }

    res.redirect(redirect ?? '/');
});

router.use((err, req, res, next) => {
    console.error(err);

    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        res.status(400).send('Bad JSON');
    } else if (err) {
        res.status(500).send('Internal error');
    }
});