import config from './conf/config.js';
import {createProxyMiddleware} from 'http-proxy-middleware';
import helmet from 'helmet';
import https from 'https';
import http from 'http';
import express from 'express';
import vhost from 'vhost';
import serveStatic from 'serve-static';

const webFolder = './public/';

const app = express();
const server = config.useHttps ? https.createServer(config.httpsOptions, app) : http.createServer(app);

const mainApp = express();
const picr22App = express();
const picr23App = express();

app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            "object-src": "'self'", // For SVGs embedded with object tag
        },
    }
}));

mainApp.use(serveStatic(webFolder));

picr22App.use('**', createProxyMiddleware({
    target: 'http://localhost:8111',
    changeOrigin: true,
}));

picr23App.use('**', createProxyMiddleware({
    target: 'http://localhost:8023',
    changeOrigin: true,
}));

app.use(vhost('picr22.utr.ee', picr22App));
app.use(vhost('picr23.utr.ee', picr23App));
app.use(vhost('utr.ee', mainApp));

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
    server.listen(8100);
}