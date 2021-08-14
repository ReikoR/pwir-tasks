import {html, render} from './lib/lit.mjs';
import {getTeams, getTasks, getSession} from "./services/api.js";
import './components/tasks-table.js';
import './components/page-header.js';

const mainElement = document.getElementById('main');

(async function () {
    const tasks = await getTasks();
    const teams = await getTeams();
    let session = null;
    let tasksTableMode = null;

    try {
        session = await getSession();
        tasksTableMode = session.role === 'instructor' ? 'edit' : 'inspect';
    } catch (e) {}

    const links = session !== null ? [['/participants', 'Participants']] : [];

    render(html`
        <page-header .session=${session} title="Tasks table" .links=${links}></page-header>
        <div class="page-content">
        <tasks-table mode=${tasksTableMode} .tasks=${tasks} .teams=${teams}></tasks-table>
        </div>`,
        mainElement);
})();
