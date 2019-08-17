import {html, render} from './lib/heresy.mjs';
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

    render(mainElement, html`
        <PageHeader session=${session} title="Tasks table" links=${[['/participants', 'Participants']]}/>
        <div class="page-content">
        <TasksTable mode=${tasksTableMode} tasks=${tasks} teams=${teams}/>
        </div>`);
})();
