const config = require('./conf/config');
const knex = require('knex')({
    client: 'pg',
    connection: config.db.connectionParams,
    pool: config.db.pool,
    debug: true
});

function getTasks() {
    return knex('task').select();
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
function getParticipant() {
    return knex('participant')
        .select('participant.participant_id', 'participant.name')
        .select(
            knex('team_member')
                .select('team_id')
                .whereRaw('team_member.participant_id = participant.participant_id')
                .where('start_time', '<', knex.fn.now())
                .andWhere(function () {
                    this.whereNull('end_time').orWhere('end_time', '>', knex.fn.now());
                })
                .as('team_id')
        );
}

/*
select participant.participant_id, participant.name, sum(completed_task.points) as total_points from participant
join completed_task on participant.participant_id = completed_task.participant_id
group by participant.participant_id;
 */
function getParticipantsAndPoints() {
    return knex('participant')
        .select(
            'participant.participant_id',
            'participant.name',
            knex.raw('sum(completed_task.points) as total_points')
        )
        .join('completed_task', 'participant.participant_id', 'completed_task.participant_id')
        .groupBy('participant.participant_id');
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

/*
select
       task_id,
       team_id,
       completion_time,
       jsonb_agg(jsonb_build_object('participant_id', participant_id, 'points', points))
from completed_task
group by task_id, team_id, completion_time;
 */
function getCompletedTask(task_id, team_id, transaction) {
    const query = knex('completed_task')
        .select('task_id', 'team_id', 'completion_time')
        .select(knex.raw(`jsonb_agg(jsonb_build_object('participant_id', participant_id, 'points', points)) as participants`))
        .where({task_id, team_id})
        .groupBy('task_id', 'team_id', 'completion_time');


    if (transaction) {
        query.transacting(transaction);
    }

    return query;
}

async function setCompletedTask(task_id, team_id, completion_time, participantPoints) {
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
        console.log({currentState});
        const {toAdd, toChange, toDelete} = diffCompletedTask(
            currentState && currentState.participants,
            participantPoints
        );

        if (toDelete.length > 0) {
            const deleteResult = await trx('completed_task')
                .delete()
                .where({task_id, team_id})
                .whereIn('participant_id', toDelete.map(p => p.participant_id));

            console.log('deleteResult', deleteResult);
        }

        if (toAdd.length > 0) {
            const addResult = await trx.batchInsert('completed_task', toAdd.map(p => {
                return {
                    task_id,
                    team_id,
                    participant_id: p.participant_id,
                    points: p.points,
                    completion_time
                }
            }));

            console.log('addResult', addResult);
        }

        if (toChange.length > 0) {
            for (const p of toChange) {
                console.log({points: p.points, completion_time});
                console.log({task_id, team_id, participant_id: p.participant_id});

                const changeResult = await trx('completed_task').update({
                    points: p.points,
                    completion_time
                }).where({task_id, team_id, participant_id: p.participant_id});

                console.log('changeResult', changeResult);
            }
        }

        await trx.commit();
    } catch (e) {
        console.error(e);
        await trx.rollback();
        throw e;
    }
}

function diffCompletedTask(oldParticipants = [], newParticipants = []) {
    console.log('diffCompletedTask', oldParticipants, newParticipants);

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

    console.log('toAdd', toAdd);
    console.log('toChange', toChange);
    console.log('toDelete', toDelete);

    return {toAdd, toChange, toDelete};
}

/*
select sum(completed_task.points) as used from completed_task
where completed_task.task_id = 1 and completed_task.participant_id = 1
group by completed_task.task_id;
 */
async function getPointsUsedByTaskParticipant(task_id, participant_id) {
    const rows = await knex('completed_task')
        .select(knex.raw('sum(completed_task.points)::integer as used'))
        .where('completed_task.task_id', task_id)
        .where('completed_task.participant_id', participant_id);

    if (rows.length === 1) {
        return {task_total: rows[0].task_total, used: rows[0].used || 0};
    }

    throw 'Task not found';
}

module.exports = {
    getTasks,
    getTeams,
    getParticipant,
    setCompletedTask,
    getCompletedTask,
    getCompletedTasksOverview,
    getPointsUsedByTaskParticipant,
    getParticipantsAndPoints,
};