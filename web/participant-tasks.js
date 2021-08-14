import {html, render} from "./lib/lit.mjs";
import {getParticipantTaskPoints, getSession} from "./services/api.js";
import './components/page-header.js';
import {DateTime} from "./lib/luxon.mjs";

const mainElement = document.getElementById('main');

(async function () {
    const queryUrlMatch = location.search.match(/p=([0-9]+)/);
    let participantTaskPoints = [];
    let session = null;

    try {
        session = await getSession();
    } catch (e) {}

    if (queryUrlMatch && queryUrlMatch.length === 2) {
        const participant_id = parseInt(queryUrlMatch[1]);

        participantTaskPoints = await getParticipantTaskPoints({participant_id});
    }

    const columns = ['Task', 'Deadline', 'Points used', 'Total points'];
    const links = [['/', 'Tasks table']];

    if (session) {
        links.push(['/participants', 'Participants']);
    }

    render(html`
        <page-header .session=${session} title="Participant points" .links=${links}></page-header>
        <div class="page-content">
        <table>
        <thead><tr>${columns.map(c => html`<th>${c}</th>`)}</tr></thead>
        <tbody>${participantTaskPoints.map(tp => html`<tr>
            <td>${tp.name}</td>
            <td>${DateTime.fromISO(tp.deadline).toFormat('yyyy-MM-dd T')}</td>
            <td>${tp.points_used || 0}</td>
            <td>${tp.total_task_points}</td>
        </tr>`)}</tbody>
        </table>
        </div>`,
        mainElement);
})();
