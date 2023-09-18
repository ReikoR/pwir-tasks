import {html, render} from './lib/lit.mjs';
import {getTeams, getTasks, getSession} from "./services/api.js";
import './components/tasks-table.js';
import './components/default-page-header.js';

const mainElement = document.getElementById('main');

(async function () {
    let tasks = null;
    let teams = null;
    let session = null;
    let tasksTableMode = null;

    async function fetchSession() {
        try {
            session = await getSession();
            tasksTableMode = session.role === 'instructor' ? 'edit' : 'inspect';
            tasks = await getTasks();
            teams = await getTeams();
        } catch (e) {
            session = null;
            tasksTableMode = null;
            tasks = null;
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
                        title="Tasks table"
                        .session=${session}
                        @login-changed=${handleLoginChanged}
                ></default-page-header>
                <div class="page-content">
                    <tasks-table .mode=${tasksTableMode} .tasks=${tasks} .teams=${teams}></tasks-table>
                </div>`,
                mainElement);
        }
    }

    await fetchSession();

    renderContent();
})();
