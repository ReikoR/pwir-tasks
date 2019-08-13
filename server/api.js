const config = require('./conf/config');
const database = require('./database');
const router = require('express').Router();
const bodyParser = require('body-parser');
const session = require('express-session');
var FileStore = require('session-file-store')(session);
const jsonParser = bodyParser.json();

router.use(jsonParser);

router.use(session({
    secret: config.session.secret,
    store: new FileStore(),
    resave: false,
    saveUninitialized: true,
    cookie: {secure: config.useHttps},
}));

router.post('/login', (req, res) => {
    /*login(req.body, (err, result) => {
        if (err) {
            res.status(400).send(err);
        } else {
            req.session.user = result;
            res.send(result);
        }
    });*/

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

router.get('/tasks', async (req, res) => {
    try {
        const rows = await database.getTasks();
        console.log(rows);
        res.send(rows);
    } catch (e) {
        console.error(e);
        res.status(400).send('Internal error');
    }
});

router.get('/teams', async (req, res) => {
    try {
        const rows = await database.getTeams();
        console.log(rows);
        res.send(rows);
    } catch (e) {
        console.error(e);
        res.status(400).send('Internal error');
    }
});

router.post('/participants', async (req, res) => {
    try {
        const {roles} = req.body;
        const rows = await database.getParticipants(roles);
        console.log(rows);
        res.send(rows);
    } catch (e) {
        console.error(e);
        res.status(400).send('Internal error');
    }
});

router.get('/participants-and-points', async (req, res) => {
    try {
        const rows = await database.getParticipantsAndPoints();
        console.log(rows);
        res.send(rows);
    } catch (e) {
        console.error(e);
        res.status(400).send('Internal error');
    }
});

router.get('/completed-tasks-list', async (req, res) => {
    try {
        const rows = await database.getCompletedTasksOverview();
        console.log(rows);
        res.send(rows);
    } catch (e) {
        console.error(e);
        res.status(400).send('Internal error');
    }
});

router.post('/get-completed-task', async (req, res) => {
    try {
        const {task_id, team_id} = req.body;
        const rows = await database.getCompletedTask(task_id, team_id);
        console.log(rows);
        res.send(rows);
    } catch (e) {
        console.error(e);
        res.status(400).send('Internal error');
    }
});

router.post('/set-completed-task', async (req, res) => {
    try {
        const {task_id, team_id, completion_time, participants} = req.body;
        await database.setCompletedTask(task_id, team_id, completion_time, participants);
        res.send('OK');
    } catch (e) {
        console.error(e);
        res.status(400).send('Internal error');
    }
});

router.post('/get-participant-points-used', async (req, res) => {
    try {
        const {task_id, participant_id} = req.body;
        const result = await database.getPointsUsedByTaskParticipant(task_id, participant_id);
        console.log(result);
        res.send(result);
    } catch (e) {
        console.error(e);
        res.status(400).send('Internal error');
    }
});

router.post('/get-participant-task-points', async (req, res) => {
    try {
        const {participant_id} = req.body;
        const result = await database.getParticipantTaskPoints(participant_id);
        console.log(result);
        res.send(result);
    } catch (e) {
        console.error(e);
        res.status(400).send('Internal error');
    }
});

module.exports = router;
