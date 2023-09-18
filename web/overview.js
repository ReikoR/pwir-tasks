import {html, render} from './lib/lit.mjs';
import {getSession, getTeamsAndPoints} from "./services/api.js";
import './components/default-page-header.js';

const mainElement = document.getElementById('main');

(async function () {
    let teams = null;
    let session = null;

    async function fetchSession() {
        try {
            session = await getSession();
            teams = await getTeamsAndPoints();

            teams.sort((a, b) => (b.team_points || 0) - (a.team_points || 0));
        } catch (e) {
            session = null;
            teams = null;
        }
    }



    async function handleLoginChanged() {
        await fetchSession();
        renderContent();
    }

    function renderContent() {
        if (!session) {
            render(html`
                <default-page-header 
                        title="Home"
                        .session=${session}
                        @login-changed=${handleLoginChanged}
                ></default-page-header>
                <div class="page-content"></div>`,
                mainElement);
        } else {
            render(html`
                <default-page-header 
                        title="Home"
                        .session=${session}
                        @login-changed=${handleLoginChanged}
                ></default-page-header>
                <div class="page-content">
                <table>
                    <thead><th>Team</th><th>Points</th></thead>
                    <tbody>
                    ${teams.map(t => html`<tr><td>${t.name}</td><td>${t.team_points || 0}</td></tr>`)}
                    </tbody>
                </table>        
                </div>`,
                mainElement);
        }
    }

    await fetchSession();

    renderContent();
})();
