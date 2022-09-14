const config = require('./conf/config');
const {DateTime} = require('luxon');
const crypto = require('node:crypto');
const util = require('node:util');
const pg = require('pg');

const {Pool} = pg;
const poolPrivate = new Pool(config.db.connectionParamsPrivate);

const pbkdf2Async = util.promisify(crypto.pbkdf2);

const knex = require('knex')({
    client: 'pg',
    connection: config.db.connectionParams,
    pool: config.db.pool
});

const teamTaskDiffer = require('jsondiffpatch').create({
    objectHash: function (obj) {
        return obj.participant_id;
    },
    arrays: {
        detectMove: true,
        includeValueOnMove: true
    }
});

async function getParticipantById(participant_id) {
    try {
        return (await knex('participant')
            .select('participant_id', 'name', 'role')
            .where({participant_id}))[0];
    } catch (e) {
        return null;
    }
}

async function getTasks() {
    const queryString = `select 
               *, 
               task_points_with_time(task, now()) as points_available 
        from task
        order by task_id;`;

    return (await knex.raw(queryString, )).rows;
}

function getTeams() {
    return knex('team').select();
}

async function getTeamsAndPoints() {
    const queryString = `select team.team_id, team.name, coalesce(sum(task.points)::integer, 0) as team_points from team
        left join completed_task on team.team_id = completed_task.team_id
        left join task on completed_task.task_id = task.task_id
        group by team.team_id
        order by team_points desc, team.team_id;`

    return (await knex.raw(queryString)).rows;
}

async function getParticipants(roles) {
    const queryString = `select
            participant.participant_id,
            participant.name,
            participant.role,
            (
               select jsonb_agg(jsonb_build_object(
                   'team_id', team_id,
                   'start_time', start_time,
                   'end_time', end_time
                   )) from team_member
               join team t using(team_id)
               where team_member.participant_id = participant.participant_id
            ) as teams
        from participant
        where participant.role = any(?);`;

    return (await knex.raw(queryString, [roles])).rows;
}

async function getParticipantsAndPoints() {
    const queryString = `select * from (
        select
               participant.participant_id,
               participant.name,
               (
                   select sum(ctp.points)::int
                   from completed_task_participant ctp
                   where ctp.participant_id = participant.participant_id
               ) as total_points,
               (
                   select name from team
                   join team_member tm using (team_id)
                   where tm.start_time <= now() and (end_time is null or end_time >= now())
                   and tm.participant_id = participant.participant_id
               ) as team_name
        from participant
        where participant.role = 'student') as sub
        where sub.team_name is not null;`;

    return (await knex.raw(queryString)).rows;
}

async function getCompletedTasksOverview() {
    const queryString = `select
               task_id,
               team_id,
               completion_time,
               task_points_with_time(task, completion_time) as points_available,
               (
                   select coalesce(sum(ctp.points), 0)::int 
                   from completed_task_participant ctp 
                   where ctp.task_id = ct.task_id and ctp.team_id = ct.team_id
               ) as points_used
        from completed_task ct
        join task using (task_id)
        group by ct.task_id, ct.team_id, task.task_id;`;

    return (await knex.raw(queryString)).rows;
}

async function getCompletedTask(task_id, team_id, transaction) {
    const queryString = `select
               completed_task.task_id,
               completed_task.team_id,
               completion_time,
               (select
                       jsonb_agg(jsonb_build_object('participant_id', participant_id, 'points', points))
               from completed_task_participant ctp
               where ctp.task_id = completed_task.task_id and ctp.team_id = completed_task.team_id) as participants
        from completed_task
        left join completed_task_participant ctp using (task_id, team_id)
        where completed_task.task_id = ? and completed_task.team_id = ?
        group by completed_task.task_id, completed_task.team_id;`;

    const query = knex.raw(queryString, [task_id, team_id]);

    if (transaction) {
        query.transacting(transaction);
    }

    return (await query).rows;
}

async function setCompletedTask(task_id, team_id, completion_time, participantPoints, editor_id) {
    console.log(
        'setCompletedTask',
        'task_id', task_id,
        'team_id', team_id,
        'completion_time', completion_time,
        'participantPoints', participantPoints
    );

    const trx = await knex.transaction();

    try {
        const currentState = (await getCompletedTask(task_id, team_id, trx))[0];

        const {toAdd, toChange, toDelete} = diffCompletedTask(
            currentState && currentState.participants,
            participantPoints
        );

        if (currentState) {
            await trx('completed_task')
                .update({completion_time})
                .where({task_id, team_id});
        } else {
            await trx('completed_task')
                .insert({task_id, team_id, completion_time});
        }

        if (toDelete.length > 0) {
            await trx('completed_task_participant')
                .delete()
                .where({task_id, team_id})
                .whereIn('participant_id', toDelete.map(p => p.participant_id));
        }

        if (toAdd.length > 0) {
            await trx.batchInsert('completed_task_participant', toAdd.map(p => {
                return {
                    task_id,
                    team_id,
                    participant_id: p.participant_id,
                    points: p.points
                }
            }));
        }

        if (toChange.length > 0) {
            for (const p of toChange) {
                await trx('completed_task_participant').update({
                    points: p.points
                }).where({task_id, team_id, participant_id: p.participant_id});
            }
        }

        const newState = (await getCompletedTask(task_id, team_id, trx))[0];

        await trx('completed_task_history').insert({
            task_id,
            team_id,
            editor_id,
            state: newState
        });

        await trx.commit();
    } catch (e) {
        console.error(e);
        await trx.rollback();
        throw e;
    }
}

function diffCompletedTask(oldParticipants = [], newParticipants = []) {
    const toAdd = newParticipants.slice();
    const toChange = [];
    const toDelete = [];

    if (Array.isArray(oldParticipants)) {
        for (const oldParticipant of oldParticipants) {
            const index = toAdd.findIndex(p => p.participant_id === oldParticipant.participant_id);

            if (index !== -1) {
                toChange.push(toAdd.splice(index, 1)[0]);
            } else {
                toDelete.push(oldParticipant);
            }
        }
    }

    return {toAdd, toChange, toDelete};
}

async function getPointsUsedByTaskParticipant(task_id, participant_id) {
    const queryString = `select sum(points)::int as used 
        from completed_task_participant
        where task_id = ? and participant_id = ?
        group by task_id;`;

    const rows = (await knex.raw(queryString, [task_id, participant_id])).rows;

    if (rows.length === 1) {
        return {used: rows[0].used || 0};
    }

    return {used: 0};
}

async function getParticipantTaskPoints(participant_id) {
    const queryString = `select
            task.task_id,
            task.name,
            task.expires_at,
            sum(ctp.points) as points_used,
            task.points as total_task_points
        from task
        left join (select * from completed_task_participant where participant_id = ?) as ctp 
            on ctp.task_id = task.task_id
        group by task.task_id
        order by task.task_id;`;

    return (await knex.raw(queryString, [participant_id])).rows;
}

async function getCompletedTaskChanges(task_id, team_id) {
    const queryString = `select
               edit_time,
               participant.name as editor,
               state
        from completed_task_history
        join task using (task_id)
        join team using (team_id)
        join participant ON completed_task_history.editor_id = participant.participant_id
        where team_id = ? and task_id = ?
        order by edit_time;`;

    const rows = (await knex.raw(queryString, [team_id, task_id])).rows;

    const cleanRows = rows.map(row => {
        const {edit_time, editor, state} = row;
        const participants = (state.participants || []).filter(p => p.participant_id !== null);
        const cleanRow = {edit_time, editor, state: {completion_time: state.completion_time}};

        if (participants.length > 0) {
            const participantsMap = {};

            for (const p of participants) {
                participantsMap[p.participant_id] = p.points;
            }

            cleanRow.state.participants = participantsMap;
        }

        return cleanRow;
    });

    let prevState = {};
    let changes = [];

    for (const row of cleanRows) {
        const {edit_time, editor, state} = row;
        const diff = teamTaskDiffer.diff(prevState, state);

        if (diff) {
            changes.push({edit_time, editor, diff});
        }

        prevState = row.state;
    }

    return changes;
}

async function createAccount(accountInviteToken, accountName, password) {
    const client = await poolPrivate.connect();

    try {
        client.query('begin');

        const invitesResult = await client.query(
            'select * from private.account_invite where uuid = $1',
            [accountInviteToken]
        );

        if (invitesResult.rows.length !== 1) {
            throw `Invite (${accountInviteToken}) not found`;
        }

        const inviteInfo = invitesResult.rows[0];
        const expiresAtDateTime = DateTime.fromISO(inviteInfo.expires_at);
        const currentDateTime = DateTime.now();

        if (currentDateTime > expiresAtDateTime) {
            await client.query(
                'delete from private.account_invite where uuid = $1',
                [accountInviteToken]
            );

            throw `Invite (${accountInviteToken}) has expired`;
        }

        const salt = crypto.randomBytes(32).toString('hex');
        const hash = (await pbkdf2Async(password, salt, 100000, 128, 'sha512')).toString('hex');

        await client.query(
            'insert into private.account (participant_id, account_name, password_hash) values ($1, $2, $3)',
            [inviteInfo.participant_id, accountName, `${salt}.${hash}`]
        );

        await client.query(
            'delete from private.account_invite where participant_id = $1',
            [inviteInfo.participant_id]
        );

        client.query('commit');
    } catch (e) {
        client.query('rollback');
        console.error(e);
        throw e;
    } finally {
        client.release();
    }
}

async function getAccountByName(name) {
    try {
        const result = await poolPrivate.query('select * from private.account where account_name = $1', [name]);

        if (result.rows.length === 1) {
            return result.rows[0];
        }
    } catch (e) {
        return null;
    }

    return null;
}

async function isValidAccount(name, password) {
    const accountInfo = await getAccountByName(name);

    if (!accountInfo) {
        return false;
    }

    const [salt, hash] = accountInfo.password_hash.split('.');

    const passwordHash = (await pbkdf2Async(password, salt, 100000, 128, 'sha512')).toString('hex');

    return passwordHash === hash;
}

async function getParticipantByAccountName(name) {
    try {
        const accountInfo = await getAccountByName(name);

        if (!accountInfo) {
            return null;
        }

        return getParticipantById(accountInfo.participant_id);
    } catch (e) {
        return null;
    }
}

async function close() {
    return knex.destroy();
}

module.exports = {
    getParticipantById,
    getTasks,
    getTeams,
    getTeamsAndPoints,
    getParticipants,
    setCompletedTask,
    getCompletedTask,
    getCompletedTasksOverview,
    getPointsUsedByTaskParticipant,
    getParticipantsAndPoints,
    getParticipantTaskPoints,
    getCompletedTaskChanges,
    createAccount,
    getAccountByName,
    isValidAccount,
    getParticipantByAccountName,
    close,
};