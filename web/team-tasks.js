import {html, render} from './lib/lit.mjs';
import {getTeams, getTasks, getSession} from "./services/api.js";
import './components/tasks-table.js';
import './components/default-page-header.js';

const mainElement = document.getElementById('main');

(async function () {
    const tasks = await getTasks();
    const teams = await getTeams();
    let session = null;
    let tasksTableMode = null;

    async function fetchSession() {
        try {
            session = await getSession();
            console.log(session);
            tasksTableMode = session.role === 'instructor' ? 'edit' : 'inspect';
        } catch (e) {
            session = null;
            tasksTableMode = null;
        }
    }

    async function handleLoginChanged() {
        console.log('handleLoginChanged');
        await fetchSession();
        renderContent();
    }

    function renderContent() {
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

    await fetchSession();

    renderContent();
})();
