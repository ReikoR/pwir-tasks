const config = require('./conf/config');
const express = require('express');
const serveStatic = require('serve-static');
const app = express();
const http = require('http');
const https = require('https');
const server = config.useHttps ? https.createServer(config.httpsOptions, app) : http.createServer(app);
const apiRouter = require('./api');
const authRouter = require('./auth');
const path = require('path');
const webFolder = path.join(__dirname, '../web/');
const helmet = require('helmet');
const {DateTime} = require('luxon');
const {generateAllSVGs} = require("./tools.js");

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

app.get('/login', (req, res) => {
    if (req.session && req.session.user) {
        res.redirect('/');
    } else {
        res.sendFile(path.join(webFolder, 'login.html'));
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

function requireUser(req, res, next) {
    if (!(req.session && req.session.user)) {
        res.redirect('/login');
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

generateAllSVGs();

const timeZone = 'Europe/Tallinn';
let lastDateTime = DateTime.local({zone: timeZone});

setInterval(() => {
    const currentDateTime = DateTime.local({zone: timeZone});

    if (currentDateTime.day > lastDateTime.day) {
        console.log(currentDateTime.toISO(), 'day has changed');
        generateAllSVGs();
    }

    lastDateTime = currentDateTime;
}, 3600 * 1000);