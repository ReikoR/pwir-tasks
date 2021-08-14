import {html, render} from "./lib/lit.mjs";
import {getParticipantsAndPoints, getSession} from "./services/api.js";
import './components/page-header.js';
import {classNames} from "./util.js";

const mainElement = document.getElementById('main');

(async function () {
    const participantsAndPoints = await getParticipantsAndPoints();
    let session = null;

    try {
        session = await getSession();
    } catch (e) {}

    participantsAndPoints.sort((a, b) => b.total_points - a.total_points);

    const columns = [
        {name: 'Name', id: 'name'},
        {name: 'Team', id: 'team_name'},
        {name: 'Points', id: 'total_points', type: 'number'}
    ];
    let sortColumn = null;
    let sortAscending = false;

    sortBy(columns[2], false);

    function sortBy(column, isAscending) {
        sortColumn = column.id;
        sortAscending = isAscending;

        if (column.type === 'number') {
            participantsAndPoints.sort((a, b) => isAscending
                ? a[sortColumn] - b[sortColumn]
                : b[sortColumn] - a[sortColumn]);
        } else {
            participantsAndPoints.sort((a, b) => isAscending
                ? a[sortColumn].localeCompare(b[sortColumn])
                : b[sortColumn].localeCompare(a[sortColumn])
            );
        }

        renderMain();
    }

    function handleHeaderCellClick(column) {
        sortBy(column, column.id === sortColumn ? !sortAscending : true)
    }

    function renderMain() {
        render(html`
            <page-header .session=${session} title="Participants" .links=${[['/', 'Tasks table']]}></page-header>
            <div class="page-content">
            <table>
            <thead><tr>${columns.map(c => renderHeaderCell(c))}</tr></thead>
            <tbody>
            ${participantsAndPoints.map(renderRow)}
            </tbody>
            </table>
            </div>`,
            mainElement);
    }

    function renderHeaderCell(column) {
        const classValue = classNames({
            asc: sortColumn === column.id && sortAscending,
            desc: sortColumn === column.id && !sortAscending
        });

        return html`<th class=${classValue} @click=${handleHeaderCellClick.bind(this, column)}>${column.name}</th>`;
    }

    function renderRow(participant) {
        const link = `/participant-tasks?p=${participant.participant_id}`;
        return html`<tr>
            <td><a href=${link}>${participant.name}</a></td>
            <td>${participant.team_name}</td>
            <td>${participant.total_points}</td>
            </tr>`;
    }
})();
