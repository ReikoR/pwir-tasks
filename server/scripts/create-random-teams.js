const config = require('../conf/config');
const knex = require('knex')({
    client: 'pg',
    connection: config.db.connectionParams,
    pool: config.db.pool
});

const minTeamSize = 2;
const maxTeamSize = 6;


(async function () {
    const students = shuffle((await knex.raw(`select * from participant where role = 'student'`)).rows);
    const teams = shuffle((await knex.raw(`select * from team`)).rows);
    const studentsWithoutTeams = students.slice();
    const groups = [];

    console.log(students.length);
    console.log(teams.length);

    let i = 0;

    while (studentsWithoutTeams.length > 0) {
        const index = i % teams.length;
        const round = Math.floor(i / teams.length);

        if (round === 0) {
            groups.push(studentsWithoutTeams.splice(0, minTeamSize));
        } else {
            const max = maxTeamSize - groups[index].length;

            if (max !== 0) {
                const memberCount = Math.round(randn_bm(0, max, 1));
                const newMembers = studentsWithoutTeams.splice(0, memberCount);

                groups[index] = groups[index].concat(newMembers);
            }
        }

        i++;
    }

    console.log(groups.map(g => g.length));

    groups.forEach((group, index) => {
        for (const member of group) {
            knex('team_member').insert({
                participant_id: member.participant_id,
                team_id: teams[index].team_id,
                start_time: knex.fn.now()
            }).then(() => {
                console.log(member.participant_id, '->', teams[index].team_id)
            }).catch(error => {
                console.error(error);
            });
        }
    });
})();

//https://stackoverflow.com/questions/25582882/javascript-math-random-normal-distribution-gaussian-bell-curve
function randn_bm(min, max, skew) {
    var u = 0, v = 0;
    while(u === 0) u = Math.random(); //Converting [0,1) to (0,1)
    while(v === 0) v = Math.random();
    let num = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );

    num = num / 10.0 + 0.5; // Translate to 0 -> 1
    if (num > 1 || num < 0) num = randn_bm(min, max, skew); // resample between 0 and 1 if out of range
    num = Math.pow(num, skew); // Skew
    num *= max - min; // Stretch to fill range
    num += min; // offset to min
    return num;
}

//https://stackoverflow.com/questions/6274339/how-can-i-shuffle-an-array
function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}