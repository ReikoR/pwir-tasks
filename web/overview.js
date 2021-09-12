import {html, render} from './lib/lit.mjs';
import {getTeamsAndPoints} from "./services/api.js";
import './components/default-page-header.js';

const mainElement = document.getElementById('main');

(async function () {
    const teams = await getTeamsAndPoints();

    render(html`
        <default-page-header title="Home"></default-page-header>
        <div class="page-content">
        <table>
            <thead><th>Team:</th>${teams.map(t => html`<th>${t.name}</th>`)}</thead>
            <thead><th>Points:</th>${teams.map(t => html`<th>${t.team_points || 0}</th>`)}</thead>
            <tbody>
            <tr>
                <td><img src="img/generated/schedule-dates.svg"></td>                
                ${teams.map(t => html`<td><a href="/team-schedule?t=${t.team_id}" title=${t.name}><img src="img/generated/schedule-tasks-team-${t.team_id}-preview.svg"/></a></td>`)}
            </tr>
            </tbody>
        </table>
        
        </div>`,
        mainElement);
})();
