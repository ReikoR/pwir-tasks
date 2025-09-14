import database from './database.mjs';
import express from 'express';
import bodyParser from 'body-parser';
import {generateDoneTasksReport} from './tools.mjs';

const jsonParser = bodyParser.json();
const router = express.Router();

export default router;

router.use(jsonParser);

router.get('/tasks', requireUser, async (req, res) => {
    try {
        const rows = await database.getTasks();
        res.send(rows);
    } catch (e) {
        console.error(e);
        res.status(400).send('Internal error');
    }
});

router.get('/teams', requireUser, async (req, res) => {
    try {
        const rows = await database.getTeams();
        res.send(rows);
    } catch (e) {
        console.error(e);
        res.status(400).send('Internal error');
    }
});

router.get('/teams-and-points', requireUser, async (req, res) => {
    try {
        const rows = await database.getTeamsAndPoints();
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

router.get('/completed-tasks-list', requireUser, async (req, res) => {
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
        const editor_id = req.session.user.participant_id;

        const {task_id, team_id, completion_time, participants} = req.body;
        await database.setCompletedTask(task_id, team_id, completion_time, participants, editor_id);
        res.send('OK');

        try {
            await generateDoneTasksReport();
        } catch (e) {
            console.error(e);
        }
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

router.post('/get-completed-task-changes', requireUser, async (req, res) => {
    try {
        const {task_id, team_id} = req.body;
        const result = await database.getCompletedTaskChanges(task_id, team_id);
        res.send(result);
    } catch (e) {
        console.error(e);
        res.status(400).send('Internal error');
    }
});

router.get('/review-input-info', requireUser, async (req, res) => {
    try {
        const rows = await database.getReviewInputInfo();
        res.send(rows);
    } catch (e) {
        console.error(e);
        res.status(400).send('Internal error');
    }
});

router.post('/review-list', requireUser, async (req, res) => {
    try {
        const rows = await database.getReviewList(req.body);
        res.send(rows);
    } catch (e) {
        console.error(e);
        res.status(400).send('Internal error');
    }
});

router.post('/create-review', requireUser, async (req, res) => {
    try {
        const editor_id = req.session.user.participant_id;

        const {team_id, requester_id, type, task_ids, external_link} = req.body;
        const review_id = await database.createReview(team_id, requester_id, type, task_ids, external_link, editor_id);
        res.send({review_id});
    } catch (e) {
        console.error(e);
        res.status(400).send('Internal error');
    }
});

router.post('/update-review', requireEditor, async (req, res) => {
    try {
        const editor_id = req.session.user.participant_id;

        const {review_id, status, external_link, task_ids, reviewers} = req.body;
        await database.updateReview(review_id, status, external_link, task_ids, reviewers, editor_id);
        res.send('OK');
    } catch (e) {
        console.error(e);
        res.status(400).send('Internal error');
    }
});

router.post('/update-review-changes-completed', requireUser, async (req, res) => {
    try {
        const editor_id = req.session.user.participant_id;

        const {review_id} = req.body;
        await database.updateReviewChangesCompleted(review_id, editor_id);
        res.send('OK');
    } catch (e) {
        console.error(e);
        res.status(400).send('Internal error');
    }
});

router.post('/get-review-changes', requireUser, async (req, res) => {
    try {
        const {review_id} = req.body;
        const changes = await database.getReviewChanges(review_id);
        res.send(changes);
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
