const config = require('./conf/config');
const knex = require('knex')({
    client: 'pg',
    connection: config.db.connectionParams,
    pool: config.db.pool,
    debug: true
});

async function getParticipantByEmail(email) {
    try {
        return (await knex('participant')
            .select('participant_id', 'name', 'role', 'email')
            .where({email}))[0];
    } catch (e) {
        return null;
    }
}

async function getParticipantById(participant_id) {
    try {
        return (await knex('participant')
            .select('participant_id', 'name', 'role', 'email')
            .where({participant_id}))[0];
    } catch (e) {
        return null;
    }
}

function getTasks() {
    return knex('task').select().orderBy('deadline');
}

function getTeams() {
    return knex('team').select();
}

/*
select
    participant.participant_id,
    participant.name,
    (
       select team_id from team_member
       where start_time < now() and (end_time isnull or end_time > now())
       and team_member.participant_id = participant.participant_id
    ) as team_id
from participant;
 */
function getParticipants(roles) {
    return knex('participant')
        .select('participant.participant_id', 'participant.name', 'participant.role')
        .select(
            knex('team_member')
                .select('team_id')
                .whereRaw('team_member.participant_id = participant.participant_id')
                .where('start_time', '<', knex.fn.now())
                .andWhere(function () {
                    this.whereNull('end_time').orWhere('end_time', '>', knex.fn.now());
                })
                .as('team_id')
        )
        .whereIn('participant.role', roles);
}

async function getParticipantsAndPoints() {
    const queryString = `select
               participant.participant_id,
               participant.name,
               (
                   select sum(ctp.points)
                   from completed_task_participant ctp
                   where ctp.participant_id = participant.participant_id
               ) as total_points
        from participant
        where participant.role = 'student';`;

    return (await knex.raw(queryString)).rows;
}

/*
select task_id, team_id from completed_task
group by task_id, team_id;
 */

function getCompletedTasksOverview() {
    return knex('completed_task')
        .select('task_id', 'team_id')
        .groupBy('task_id', 'team_id');
}

async function getCompletedTask(task_id, team_id, transaction) {
    const queryString = `select
               completed_task.task_id,
               completed_task.team_id,
               completion_time,
               jsonb_agg(jsonb_build_object('participant_id', participant_id, 'points', points)) as participants
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

    for (const oldParticipant of oldParticipants) {
        const index = toAdd.findIndex(p => p.participant_id === oldParticipant.participant_id);

        if (index !== -1) {
            toChange.push(toAdd.splice(index, 1)[0]);
        } else {
            toDelete.push(oldParticipant);
        }
    }

    return {toAdd, toChange, toDelete};
}

/*
select sum(completed_task.points) as used from completed_task
where completed_task.task_id = 1 and completed_task.participant_id = 1
group by completed_task.task_id;
 */
async function getPointsUsedByTaskParticipant(task_id, participant_id) {
    const rows = await knex('completed_task_participant')
        .select(knex.raw('sum(completed_task_participant.points)::integer as used'))
        .where('completed_task_participant.task_id', task_id)
        .where('completed_task_participant.participant_id', participant_id);

    if (rows.length === 1) {
        return {used: rows[0].used || 0};
    }

    throw 'Task not found';
}

async function getParticipantTaskPoints(participant_id) {
    const queryString = `select
            task.task_id,
            task.name,
            sum(ctp.points) as points_used,
            task.task_points_with_bonuses as total_task_points
        from task
        left join (select * from completed_task_participant where participant_id = ?) as ctp 
            on ctp.task_id = task.task_id
        group by task.task_id
        order by task.task_id;`;

    return (await knex.raw(queryString, [participant_id])).rows;
}

module.exports = {
    getParticipantByEmail,
    getParticipantById,
    getTasks,
    getTeams,
    getParticipants,
    setCompletedTask,
    getCompletedTask,
    getCompletedTasksOverview,
    getPointsUsedByTaskParticipant,
    getParticipantsAndPoints,
    getParticipantTaskPoints,
};