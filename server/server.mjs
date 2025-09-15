import config from './conf/config.js';
import express from 'express';
import serveStatic from 'serve-static';
import http from 'http';
import https from 'https';
import apiRouter from './api.mjs';
import authRouter from './auth.mjs';
import path from 'path';
import helmet from 'helmet';
import {generateDoneTasksReport} from './tools.mjs';
import database from "./database.mjs";

const app = express();
const server = config.useHttps ? https.createServer(config.httpsOptions, app) : http.createServer(app);
const webFolder = path.join(import.meta.dirname, '../web/');

app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            "object-src": "'self'", // For SVGs embedded with object tag
        },
    }
}));

app.use(serveStatic(webFolder, {index: false}));

app.use(authRouter);
app.use('/api', apiRouter);

app.get('/', (req, res) => {
    res.sendFile(path.join(webFolder, 'overview.html'));
});

app.get('/cafi/x', (req, res) => {
    if (req.session && req.session.user) {
        res.redirect('/');
    } else {
        res.sendFile(path.join(webFolder, 'create-account.html'));
    }
});

app.get('/tasks-table', (req, res) => {
    res.sendFile(path.join(webFolder, 'team-tasks.html'));
});

app.get('/team-schedule', (req, res) => {
    res.sendFile(path.join(webFolder, 'team-schedule.html'));
});

app.get('/participants', requireUser, (req, res) => {
    res.sendFile(path.join(webFolder, 'participants.html'));
});

app.get('/participant-tasks', requireUser, (req, res) => {
    res.sendFile(path.join(webFolder, 'participant-tasks.html'));
});

app.get('/reports/done-tasks.html', (req, res) => {
    res.sendFile('reports/done-tasks.html', {root: path.join(import.meta.dirname)});
});

app.get('/review/list', (req, res) => {
    res.sendFile(path.join(webFolder, 'review-list.html'));
});

app.get('/review/request', (req, res) => {
    res.sendFile(path.join(webFolder, 'review-request.html'));
});

app.get('/review/:reviewId', (req, res) => {
    res.sendFile(path.join(webFolder, 'review.html'));
});

app.use((req, res) => {
    res.sendStatus(404);
});

function requireUser(req, res, next) {
    if (!(req.session && req.session.user)) {
        res.sendStatus(403);
    } else {
        next();
    }
}

if (config.useHttps) {
    const httpApp = express();
    const httpServer = http.createServer(httpApp);

    httpApp.use(helmet());

    httpApp.use((req, res) => {
        res.redirect('https://' + req.headers.host + req.url);
    });

    httpServer.listen(80);
    server.listen(443);
} else {
    server.listen(config.port);
}

database.listenReviewHistoryInserts();

generateDoneTasksReport();

setInterval(() => {
    generateDoneTasksReport();
}, 3600 * 1000);