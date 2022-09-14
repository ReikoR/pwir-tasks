import {html, render} from './lib/lit.mjs';
import {getTeamsAndPoints} from "./services/api.js";
import './components/default-page-header.js';

const mainElement = document.getElementById('main');

(async function () {
    const teams = await getTeamsAndPoints();

    teams.sort((a, b) => (b.team_points || 0) - (a.team_points || 0));

    render(html`
        <default-page-header title="Home"></default-page-header>
        <div class="page-content">
        <table>
            <thead><th>Team</th><th>Points</th></thead>
            <tbody>
            ${teams.map(t => html`<tr><td>${t.name}</td><td>${t.team_points || 0}</td></tr>`)}
            </tbody>
        </table>        
        </div>`,
        mainElement);
})();
