const database = require('./database');
const router = require('express').Router();
const bodyParser = require('body-parser');
const jsonParser = bodyParser.json();

router.use(jsonParser);

router.get('/tasks', async (req, res) => {
    try {
        const rows = await database.getTasks();
        res.send(rows);
    } catch (e) {
        console.error(e);
        res.status(400).send('Internal error');
    }
});

router.get('/teams', async (req, res) => {
    try {
        const rows = await database.getTeams();
        res.send(rows);
    } catch (e) {
        console.error(e);
        res.status(400).send('Internal error');
    }
});

router.post('/participants', requireUser, async (req, res) => {
    try {
        const {roles} = req.body;
        const rows = await database.getParticipants(roles);
        res.send(rows);
    } catch (e) {
        console.error(e);
        res.status(400).send('Internal error');
    }
});

router.get('/participants-and-points', requireUser, async (req, res) => {
    try {
        const rows = await database.getParticipantsAndPoints();
        res.send(rows);
    } catch (e) {
        console.error(e);
        res.status(400).send('Internal error');
    }
});

router.get('/completed-tasks-list', async (req, res) => {
    try {
        const rows = await database.getCompletedTasksOverview();
        res.send(rows);
    } catch (e) {
        console.error(e);
        res.status(400).send('Internal error');
    }
});

router.post('/get-completed-task', requireUser, async (req, res) => {
    try {
        const {task_id, team_id} = req.body;
        const rows = await database.getCompletedTask(task_id, team_id);
        res.send(rows);
    } catch (e) {
        console.error(e);
        res.status(400).send('Internal error');
    }
});

router.post('/set-completed-task', requireEditor, async (req, res) => {
    try {
        const {task_id, team_id, completion_time, participants, blog_count} = req.body;
        await database.setCompletedTask(task_id, team_id, completion_time, participants, blog_count);
        res.send('OK');
    } catch (e) {
        console.error(e);
        res.status(400).send('Internal error');
    }
});

router.post('/get-participant-points-used', requireUser, async (req, res) => {
    try {
        const {task_id, participant_id} = req.body;
        const result = await database.getPointsUsedByTaskParticipant(task_id, participant_id);
        res.send(result);
    } catch (e) {
        console.error(e);
        res.status(400).send('Internal error');
    }
});

router.post('/get-participant-task-points', requireUser, async (req, res) => {
    try {
        const {participant_id} = req.body;
        const result = await database.getParticipantTaskPoints(participant_id);
        res.send(result);
    } catch (e) {
        console.error(e);
        res.status(400).send('Internal error');
    }
});

function requireUser(req, res, next) {
    if (req.session && req.session.user && ['student', 'instructor'].includes(req.session.user.role)) {
        next();
    } else {
        res.sendStatus(401);
    }
}

function requireEditor(req, res, next) {
    if (req.session && req.session.user && req.session.user.role === 'instructor') {
        next();
    } else {
        res.sendStatus(403);
    }
}

module.exports = router;
