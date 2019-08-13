import {html, render} from './lib/heresy.mjs';
import {getParticipantsAndPoints} from "./services/api.js";
import './components/tasks-table.js';

const mainElement = document.getElementById('main');

(async function () {
    const participantsAndPoints = await getParticipantsAndPoints();
    console.log(participantsAndPoints);

    participantsAndPoints.sort((a, b) => b.total_points - a.total_points);

    const columns = ['Name', 'Points'];

    render(mainElement, html`<div><table>
        <thead><tr>${columns.map(c => html`<th>${c}</th>`)}</tr></thead>
        <tbody>
        ${participantsAndPoints.map(p => {
            const link = `/participant-tasks?p=${p.participant_id}`;
            return html`<tr><td><a href=${link}>${p.name}</a></td><td>${p.total_points}</td></tr>`;
        })}
        </tbody>
        </table></div>`);
})();
