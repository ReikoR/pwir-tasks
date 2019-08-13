const config = require('./conf/config');
const express = require('express');
const serveStatic = require('serve-static');
const app = express();
const http = require('http');
const https = require('https');
const server = config.useHttps ? https.createServer(config.httpsOptions, app) : http.createServer(app);
const apiRouter = require('./api');
const path = require('path');
const webFolder = path.join(__dirname, '../web/');

app.use(serveStatic(webFolder));

app.use('/api', apiRouter);

app.get('/team-tasks', (req, res) => {
    res.sendFile(path.join(webFolder, 'team-tasks.html'));
});

app.get('/participants', (req, res) => {
    res.sendFile(path.join(webFolder, 'participants.html'));
});

app.get('/participant-tasks', (req, res) => {
    res.sendFile(path.join(webFolder, 'participant-tasks.html'));
});

server.listen(config.port);