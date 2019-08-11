import {html, render} from './lib/heresy.mjs';
import {getTeams, getTasks} from "./services/api.js";
import './components/tasks-table.js';

const mainElement = document.getElementById('main');

(async function () {
    const tasks = await getTasks();
    const teams = await getTeams();

    console.log({tasks, teams});

    render(mainElement, html`<div><TasksTable tasks=${tasks} teams=${teams}/></div>`);
})();
