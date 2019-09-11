import {html, render} from './lib/heresy.mjs';
import {getParticipantsAndPoints, getSession} from "./services/api.js";
import './components/page-header.js';

const mainElement = document.getElementById('main');

(async function () {
    const participantsAndPoints = await getParticipantsAndPoints();
    let session = null;

    try {
        session = await getSession();
    } catch (e) {}

    participantsAndPoints.sort((a, b) => b.total_points - a.total_points);

    const columns = ['Name', 'Points'];

    render(mainElement, html`
        <PageHeader session=${session} title="Participants" links=${[['/', 'Tasks table']]}/>
        <div class="page-content">
        <table>
        <thead><tr>${columns.map(c => html`<th>${c}</th>`)}</tr></thead>
        <tbody>
        ${participantsAndPoints.map(renderRow)}
        </tbody>
        </table>
        </div>`);

    function renderRow(participant) {
        const link = `/participant-tasks?p=${participant.participant_id}`;
        return html`<tr><td><a href=${link}>${participant.name}</a></td><td>${participant.total_points}</td></tr>`;
    }
})();
