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
const picr24App = express();
const picr25App = express();

app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            "object-src": "'self'", // For SVGs embedded with object tag
        },
    }
}));

mainApp.use(serveStatic(webFolder));

picr24App.use(createProxyMiddleware({
    target: 'http://localhost:8024',
    changeOrigin: true,
}));

picr25App.use(createProxyMiddleware({
    target: 'http://localhost:8025',
    changeOrigin: true,
}));

app.use(vhost('picr24.utr.ee', picr24App));
app.use(vhost('picr25.utr.ee', picr25App));
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