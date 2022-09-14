import config from '../conf/config.js';
import pg from 'pg';
import {nanoid} from 'nanoid';
import {DateTime} from 'luxon';

const participantIdArgument = parseInt(process.argv[2], 10);

const {Pool} = pg;
const pool = new Pool(config.db.connectionParamsPrivate);

if (!participantIdArgument) {
    console.log('participant id argument not specified or incorrect');

    const client = await pool.connect();

    try {
        const result = await client.query('select participant_id, name from participant');

        console.log('Participants:');
        console.log(result.rows);
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
    }

    await pool.end();

    process.exit();
}

const inviteLinkHostname = config.accountInviteLinkHostname;

const client = await pool.connect();

async function createAccountInvite(client, participantId) {
    const token = nanoid();
    const expiresAt = DateTime.now().plus({days: 1}).toISO();

    const values = [token, participantId, expiresAt];

    await client.query(
        'insert into private.account_invite (uuid, participant_id, expires_at) values ($1, $2, $3)',
        values
    );

    console.log(`${inviteLinkHostname}/cafi/x?y=${token}`);
}

try {
    await client.query('BEGIN');

    await createAccountInvite(client, participantIdArgument);

    await client.query('COMMIT');
} catch (e) {
    console.log('ROLLBACK');
    await client.query('ROLLBACK');
    throw e;
} finally {
    client.release();
}

console.log('DONE');

await pool.end();