import {html, render} from './lib/heresy.mjs';
import {getParticipantTaskPoints} from "./services/api.js";
import './components/tasks-table.js';

const mainElement = document.getElementById('main');

(async function () {
    const queryUrlMatch = location.search.match(/p=([0-9]+)/);
    let participantTaskPoints = [];

    if (queryUrlMatch && queryUrlMatch.length === 2) {
        const participant_id = parseInt(queryUrlMatch[1]);

        participantTaskPoints = await getParticipantTaskPoints({participant_id});
        console.log(participantTaskPoints);
    }

    const columns = ['Task', 'Points used', 'Total points'];

    render(mainElement, html`<div><table>
        <thead><tr>${columns.map(c => html`<th>${c}</th>`)}</tr></thead>
        <tbody>${participantTaskPoints.map(p => html`<tr>
            <td>${p.name}</td>
            <td>${p.points_used}</td>
            <td>${p.total_task_points}</td>
        </tr>`)}</tbody>
        </table></div>`);
})();
