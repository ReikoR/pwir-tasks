import {html, render} from './lib/lit.mjs';
import {getTeamsAndPoints} from "./services/api.js";
import './components/default-page-header.js';

const mainElement = document.getElementById('main');

(async function () {
    const queryUrlMatch = location.search.match(/t=([0-9]+)/);
    let team_id = null;

    if (queryUrlMatch && queryUrlMatch.length === 2) {
        team_id = parseInt(queryUrlMatch[1]);
    }

    const teamsAndPoints = await getTeamsAndPoints();
    const team = teamsAndPoints.find(t => t.team_id === team_id);

    function renderContent(team) {
        if (!team) {
            return null;
        }

        return html`<div class="page-content">
            <div><span>Team name: </span><b>${team.name}</b></div>
            <div><span>Total points: </span><b>${team.team_points || 0}</b></div>
            <table>
                <tbody>
                <tr>
                    <td><img src="img/generated/schedule-dates.svg"></td>
                    <td><object data="img/generated/schedule-tasks-team-${team.team_id}.svg"/></td>
                </tr>
                </tbody>
            </table>
        </div>`;
    }

    render(html`
        <default-page-header title="Team schedule"></default-page-header>
        ${renderContent(team)}`,
        mainElement);
})();
