const fs = require('fs');
const path = require('path');

let config = {};

config.host = 'localhost';
config.port = 8111;
config.useHttps = false;
config.httpsOptions = {};

config.db = {
    vendor: 'postgres',
    name: 'pwir',
    host: 'localhost',
    port: '5432',
    username: '',
    password: '',
    pool: {
        min: 0,
        max: 5
    }
};

config.db.connectionParams = {
    user: config.db.username,
    database: config.db.name,
    password: config.db.password,
    port: config.db.port,
    host: config.db.host,
    dateStrings: true
};

config.session = {};
config.session.secret = '';

config.mailgun = {
    apiKey: '',
    apiUrl: '',
    domain: '',
    from: '',
    loginLinkHostname: '',
};

module.exports = config;