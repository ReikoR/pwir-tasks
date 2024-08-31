import {promises as fs} from 'node:fs';
import {DateTime} from 'luxon';
import prettier from 'prettier';

const prettierOptions = {
    parser: 'html',
    printWidth: 120
};

const timeZone = 'Europe/Tallinn';
const outputDirectory = 'reports';

function formatTime(isoString) {
    const dateTime = DateTime.fromJSDate(isoString, {zone: timeZone});

    if (!dateTime.isValid) {
        return null;
    }

    return dateTime.toFormat('yyyy-MM-dd T');
}

function renderAll(teams, tasks, completedTasksList) {
    return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Project in Competitive Robotics</title>
            <style>
                body {
                    font-family: sans-serif;
                }
                
                table {
                    border-collapse: collapse;
                }
                
                td, th {
                    padding: 2px 8px;
                }
                
                th {
                    position: sticky;
                    top: 0;
                    background-color: white;
                }
                
                th:nth-child(2n+5) {
                    border-bottom: 1px solid grey;
                }
                
                th:nth-child(2n+6) {
                    border-bottom: 1px dashed grey;
                }
                
                td.done {
                    background-color: limegreen;
                }
                
                td.done-late {
                    background-color: lightgreen;
                }
                
                td.done-after-expiry {
                    background-color: #daee90;
                }
                
                td.overdue {
                    color: #444;
                    background-color: #DDD;
                }
            </style>
        </head>
        <body>
        <div id="main">
            ${renderTable(teams, tasks, completedTasksList)}
        </div>
        </body>
        </html>`
}

function renderTable(teams, tasks, completedTasksList) {
    const columns = ['Task', 'Points', 'Deadline', 'Expires at'].concat(teams.map(t => t.name));

    const nowDateTime = DateTime.local({zone: timeZone});

    console.log('nowDateTime', nowDateTime.toISO());

    const rows = [renderTotalPointsRow(teams)];
    let prevTaskGroup = '';

    for (const task of tasks) {
        if (task.task_group !== prevTaskGroup) {
            rows.push(renderGroupRow(task, teams));
        }

        rows.push(renderRow(task, teams, completedTasksList, nowDateTime));

        prevTaskGroup = task.task_group;
    }

    return `<table>
        <thead>${columns.map(c => `<th>${c}</th>`).join('')}</thead>
        <tbody>${rows.join('')}</tbody>
        </table>`;
}

function renderTotalPointsRow(teams) {
    const cells = Array(4).fill('')

    cells[0] = `<b>Total</b>`;

    for (const team of teams) {
        cells.push(`<b>${team.team_points}</b>`);
    }

    return `<tr class="task-group">${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
}

function renderGroupRow(task, teams) {
    const cells = Array(4 + teams.length).fill('')
    const title = task.task_group.replaceAll('_', ' ').replace(/^(.)| (.)/g, str => str.toUpperCase());

    cells[0] = `<b>${title}</b>`;

    return `<tr class="task-group">${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
}

function renderRow(task, teams, completedTasksList, nowDateTime) {
    const deadlineDateTime = DateTime.fromJSDate(task.deadline, {zone: timeZone});
    const expiresAtDateTime = DateTime.fromJSDate(task.expires_at, {zone: timeZone});
    const endMillis = nowDateTime.plus({weeks: 12}).toMillis(); // Start showing colors 12 weeks before
    const nowToEndInMillis = endMillis - nowDateTime.toMillis();

    const deadlinePercent = Math.max(0, (endMillis - deadlineDateTime.toMillis()) / nowToEndInMillis);
    const expiresAtPercent = Math.max(0, (endMillis - expiresAtDateTime.toMillis()) / nowToEndInMillis);

    const deadlineAttributes = task.deadline !== null
        ? nowDateTime > deadlineDateTime
            ? ' class="overdue"'
            : ` style="background-color:rgba(255,150,0,${Math.pow(deadlinePercent, 3).toFixed(3)})"`
        : '';
    const expiresAtAttributes = nowDateTime > expiresAtDateTime
        ? ' class="overdue"'
        : ` style="background-color:rgba(255,100,0,${Math.pow(expiresAtPercent, 3).toFixed(3)})"`;

    const cells = [
        `<td>${task.name}</td>`,
        `<td>${task.points}</td>`,
        `<td${deadlineAttributes}>${task.deadline ? formatTime(task.deadline) : ''}</td>`,
        `<td${expiresAtAttributes}>${formatTime(task.expires_at)}</td>`,
    ];

    for (const team of teams) {
        const completedTaskInfo = getCompletedTaskInfo(completedTasksList, team, task);

        if (!completedTaskInfo) {
            cells.push('<td></td>');
        } else {
            const deadlineDateTime = DateTime.fromJSDate(task.deadline, {zone: timeZone});
            const expiresAtDateTime = DateTime.fromJSDate(task.expires_at, {zone: timeZone});
            const completedAtDateTime = DateTime.fromJSDate(completedTaskInfo.completion_time, {zone: timeZone});

            if (!completedAtDateTime.isValid ) {
                cells.push('<td></td>');
            } else if (completedAtDateTime > expiresAtDateTime) {
                cells.push('<td class="done-after-expiry">Done after expiry</td>');
            } else if (completedAtDateTime > deadlineDateTime) {
                cells.push('<td class="done-late">Done late</td>');
            } else {
                cells.push('<td class="done">Done</td>');
            }
        }
    }

    return `<tr>${cells.join('')}</tr>`
}

function getCompletedTaskInfo(completedTasksList, team, task) {
    return completedTasksList.find(t => t.task_id === task.task_id && t.team_id === team.team_id) || null;
}

export async function createDoneTasksReport(teams, tasks, completedTasksList) {
    console.log('createDoneTasksReport');

    await fs.mkdir(outputDirectory, {recursive: true});

    const sortedTeams = teams.slice().sort((a, b) => a.task_points - b.task_points);

    const htmlContent = await prettier.format(renderAll(sortedTeams, tasks, completedTasksList), prettierOptions);

    await fs.writeFile(`${outputDirectory}/done-tasks.html`, htmlContent);
}