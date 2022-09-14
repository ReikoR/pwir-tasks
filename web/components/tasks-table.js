import {LitElement, html} from "../lib/lit.mjs";
import {
    getParticipants,
    getCompletedTask,
    setCompletedTask,
    getCompletedTasksList,
    getPointsUsedByTaskParticipant,
    getCompletedTaskChanges
} from "../services/api.js";
import {cloneObject, deepFreeze, classNames, shallowCloneObject, divideIntoIntegers} from "../util.js";
import {DateTime} from "../lib/luxon.mjs";

const timeZone = 'Europe/Tallinn';

class TasksTable extends LitElement {
    constructor() {
        super();

        this.teams = [];
        this.tasks = [];

        /**@type {Object.<number, TeamTask>}*/
        this.teamTasks = {};

        this.participantPointsUsedCache = {};
        this.isFetchingParticipantPointsUsed = {};

        this.participants = null;
        this.completedTasksList = [];

        this.nonTeamColumns = ['Task', 'Points', 'Deadline', 'Expires at'];

        this.fetchCompletedTasksList();
    }

    static get properties() {
        return {
            mode: {type: String},
            teams: {type: Array},
            tasks: {type: Array},
            participants: {type: Array},
            completedTasksList: {type: Array},
            teamTasks: {type: Object},
            participantPointsUsedCache: {type: Object},
            isFetchingParticipantPointsUsed: {type: Object},
            highlightedTeamId: {type: Number},
            highlightedTaskId: {type: Number},
        };
    }

    createRenderRoot() {
        return this;
    }

    getTeamById(id) {
        return this.teams.find(team => team.team_id === id);
    }

    getTaskById(id) {
        return this.tasks.find(task => task.task_id === id);
    }

    getTaskPointsByDateTime(task, dateTime) {
        let pointsAvailable = task.points;

        if (dateTime.isValid) {
            const expiresAtDateTime = DateTime.fromISO(task.expires_at);
            const deadlineDateTime = DateTime.fromISO(task.deadline);

            if (dateTime > expiresAtDateTime) {
                pointsAvailable = 0;
            } else if (deadlineDateTime.isValid && dateTime > deadlineDateTime) {
                pointsAvailable /= 2;
            }
        }

        return pointsAvailable;
    }

    getTeamTask(team, task) {
        const id = `${team.team_id}_${task.task_id}`;
        return this.teamTasks[id];
    }

    getParticipantPointsUsed(task_id, participant_id) {
        const id = `${task_id}_${participant_id}`;
        const used = this.participantPointsUsedCache[id];
        return typeof used === 'number' ? used : null;
    }

    getParticipantById(id) {
        return cloneObject(this.participants.find(p => p.participant_id === id) || null);
    }

    getCompletedTaskInfo(team, task) {
        return this.completedTasksList.find(t => t.task_id === task.task_id && t.team_id === team.team_id) || null;
    }

    getTeamParticipantIds(team_id, dateTime) {
        const ids = [];

        for (const participant of this.participants) {
            if (team_id === findParticipantsTeamIdByDateTime(participant, dateTime)) {
                ids.push(participant.participant_id);
            }
        }

        return ids;
    }

    isTeamTaskOpen(team, task) {
        const teamTask = this.getTeamTask(team, task);

        return teamTask && teamTask.isOpen;
    }

    async fetchParticipants() {
        this.participants = await getParticipants({roles: ['student']});
        deepFreeze(this.participants);
    }

    async fetchCompletedTasksList() {
        this.completedTasksList = await getCompletedTasksList();
        deepFreeze(this.completedTasksList);
    }

    async fetchTeamTask(team_id, task_id) {
        const savedTeamTasks = await getCompletedTask(task_id, team_id);

        const id = `${team_id}_${task_id}`;
        let existingTeamTask = this.teamTasks[id];

        if (existingTeamTask) {
            if (savedTeamTasks.length > 0) {
                existingTeamTask.setSavedState(savedTeamTasks[0]);
            } else {
                delete this.teamTasks[id];
                this.teamTasks = shallowCloneObject(this.teamTasks);
            }
        }
    }

    fetchTeamTaskChanges(teamTask) {
        getCompletedTaskChanges({task_id: teamTask.task_id, team_id: teamTask.team_id}).then(changes => {
            teamTask.changes = changes;
            this.teamTasks = shallowCloneObject(this.teamTasks);
        })
    }

    fetchPointsUsedByTaskParticipant(task_id, participant_id, clearCache = false) {
        if (!task_id || !participant_id) {
            return;
        }

        const id = `${task_id}_${participant_id}`;

        if (clearCache) {
            delete this.participantPointsUsedCache[id];
            this.isFetchingParticipantPointsUsed = shallowCloneObject(this.isFetchingParticipantPointsUsed);
        }

        if (this.isFetchingParticipantPointsUsed[id] || this.participantPointsUsedCache[id] !== undefined) {
            return;
        }

        this.isFetchingParticipantPointsUsed[id] = true;

        getPointsUsedByTaskParticipant({task_id, participant_id}).then(info => {
            this.isFetchingParticipantPointsUsed[id] = false;
            this.participantPointsUsedCache[id] = info.used;
            this.isFetchingParticipantPointsUsed = shallowCloneObject(this.isFetchingParticipantPointsUsed);
            this.participantPointsUsedCache = shallowCloneObject(this.participantPointsUsedCache);
        });
    }

    calcTaskMaxPoints(task) {
        return task.points;
    }

    async handleTeamTask(team, task) {
        const id = `${team.team_id}_${task.task_id}`;
        let teamTask = this.teamTasks[id];

        if (!teamTask) {
            const savedTeamTasks = await getCompletedTask(task.task_id, team.team_id);

            if (savedTeamTasks.length > 0) {
                teamTask = TeamTask.fromSavedState(savedTeamTasks[0]);
                teamTask.isOpen = true;
            } else {
                teamTask = new TeamTask(team.team_id, task.task_id);
                teamTask.isOpen = true;
            }

            this.teamTasks[id] = teamTask;
        } else {
            teamTask.isOpen = !teamTask.isOpen;
        }

        this.teamTasks = shallowCloneObject(this.teamTasks);
    }

    handleTeamTaskCellMouseEnter(team, task) {
        this.highlightedTeamId = team.team_id;
        this.highlightedTaskId = task.task_id;
    }

    handleTeamTaskCellMouseLeave(team, task) {
        this.highlightedTeamId = null;
        this.highlightedTaskId = null;
    }

    /**
     * @param {TeamTask} teamTask
     */
    handleDistributeEquallyInTeam(teamTask) {
        if (teamTask) {
            const completionDateTime = DateTime.fromISO(teamTask.completion_time);

            teamTask.removeAllParticipants();

            const task = this.getTaskById(teamTask.task_id);
            const participantIds = this.getTeamParticipantIds(teamTask.team_id, completionDateTime);
            const pointsAvailable = this.getTaskPointsByDateTime(task, completionDateTime);
            const participantPoints = divideIntoIntegers(pointsAvailable, participantIds.length);

            for (const [index, pId] of participantIds.entries()) {
                teamTask.addParticipant(pId, participantPoints[index]);
            }

            this.teamTasks = shallowCloneObject(this.teamTasks);
        }
    }

    handleAddParticipant(teamTask) {
        if (teamTask) {
            teamTask.addParticipant(null, null);
            this.teamTasks = shallowCloneObject(this.teamTasks);
        }
    }

    async handleSaveTeamTask(teamTask) {
        const saveInfo = teamTask.getSaveInfo();
        teamTask.isSaving = true;
        this.teamTasks = shallowCloneObject(this.teamTasks);

        try {
            await setCompletedTask(saveInfo);

            teamTask.isSaving = false;

            this.fetchCompletedTasksList();
            this.fetchTeamTask(teamTask.team_id, teamTask.task_id);

            for (const p of saveInfo.participants) {
                this.fetchPointsUsedByTaskParticipant(teamTask.task_id, p.participant_id, true);
            }
        } catch (e) {
            teamTask.isSaving = false;
            this.teamTasks = shallowCloneObject(this.teamTasks);
        }
    }

    handleCloseTeamTask(teamTask) {
        teamTask.isOpen = false;
        this.teamTasks = shallowCloneObject(this.teamTasks);
    }

    handleCompletionTime(teamTask, event) {
        if (teamTask.completion_time_input === event.currentTarget.value) {
            return;
        }

        teamTask.completion_time_input = event.currentTarget.value;

        const dateTime = DateTime.fromSQL(teamTask.completion_time_input);

        if (dateTime.isValid) {
            teamTask.completion_time = dateTime.toISO();
        } else {
            teamTask.completion_time = null;
        }

        this.teamTasks = shallowCloneObject(this.teamTasks);
    }

    handleTaskParticipantPoints(taskParticipant, event) {
        const newValue = parseInt(event.currentTarget.value, 10) || null;

        taskParticipant.points = newValue;
        this.teamTasks = shallowCloneObject(this.teamTasks);
    }

    /**
     * @param {TaskParticipant} taskParticipant
     * @param {Event} event
     */
    handleParticipantNameChanged(taskParticipant, event) {
        taskParticipant.participant_id = parseInt(event.target.value, 10) || null;

        this.teamTasks = shallowCloneObject(this.teamTasks);
    }

    handleTaskParticipantRemove(teamTask, taskParticipant) {
        teamTask.removeParticipant(taskParticipant);
        this.teamTasks = shallowCloneObject(this.teamTasks);
    }

    handleTaskParticipantRestore(teamTask, taskParticipant) {
        teamTask.restoreParticipant(taskParticipant.participant_id);
        this.teamTasks = shallowCloneObject(this.teamTasks);
    }

    handleRevertCompletionTime(teamTask) {
        teamTask.revertCompletionTime();
        this.teamTasks = shallowCloneObject(this.teamTasks);
    }

    handleSetCompletionTimeToNow(teamTask) {
        teamTask.setCompletionTime(DateTime.local().startOf('minute').toISO());
        this.teamTasks = shallowCloneObject(this.teamTasks);
    }

    handleRevertName(taskParticipant) {
        taskParticipant.revertName();
        this.teamTasks = shallowCloneObject(this.teamTasks);
    }

    handleRevertPoints(taskParticipant) {
        taskParticipant.revertPoints();
        this.teamTasks = shallowCloneObject(this.teamTasks);
    }

    handleShowTeamTaskChanges(teamTask) {
        this.fetchTeamTaskChanges(teamTask);
    }

    render() {
        return html`<table>
            ${this.renderHeader()}
            ${this.renderBody()}
            </table>`;
    }

    renderHeader() {
        return html`<thead><tr>
            ${this.nonTeamColumns.map(column => html`<th>${column}</th>`)}
            ${this.teams.map(team => {
                const classValue = classNames({
                    'highlighted': team.team_id === this.highlightedTeamId,
                });
                
                return html`<th class=${classValue}>${team.name}</th>`;
            })
        }</tr></thead>`;
    }

    renderBody() {
        return html`<tbody>${this.tasks.map(task => this.renderRow(task))}</tbody>`;
    }

    renderRow(task) {
        const columnCount = this.nonTeamColumns.length + this.teams.length;

        const classValue = classNames('task-row', `${task.task_group}-task`);

        const classValueTaskName = classNames({highlighted: task.task_id === this.highlightedTaskId});

        return html`<tr class=${classValue}>
            <td class=${classValueTaskName}>${this.renderTaskName(task)}</td>
            <td>${task.points}</td>
            <td>${formatTime(task.deadline)}</td>
            <td>${formatTime(task.expires_at)}</td>
            ${this.teams.map(team => this.renderTeamTaskCell(team, task))}
            </tr>
            <tr class="team-tasks-row"><td colspan="${columnCount}"><div class="team-tasks">
            ${this.teams
            .filter(team => this.isTeamTaskOpen(team, task))
            .map(team => this.renderTeamTask(team, task))}
            </div></td></tr>`
    }

    renderTaskName(task) {
        if (task.description) {
            return html`<a href="${task.description}" target="_blank">${task.name}</a>`
        }

        return html`${task.name}`;
    }

    renderTeamTaskCell(team, task) {
        const mode = this.mode;
        const completedTaskInfo = this.getCompletedTaskInfo(team, task);
        const done = !!completedTaskInfo;
        const canOpen = mode === 'edit' || mode === 'inspect' && done;
        const unavailable = DateTime.fromISO(task.expires_at) < DateTime.local();
        const pointsUsed = done ? completedTaskInfo.points_used : 0;
        const pointsAvailable = done ? completedTaskInfo.points_available : 0;
        const pointsInvalid = pointsUsed !== pointsAvailable;
        let title = '';
        const classValue = classNames({
            'team-task-cell': true,
            'can-open': canOpen,
            done,
            'points-invalid': done && pointsInvalid,
            unavailable
        });

        if (pointsInvalid) {
            if (pointsUsed === 0) {
                title = 'Points not distributed';
            } else if (pointsUsed < pointsAvailable) {
                title = 'All points not used';
            } else if (pointsUsed > pointsAvailable) {
                title = 'Too much points used';
            }
        }

        if (!canOpen) {
            return html`<td class=${classValue} title=${title}>${done ? 'Done' : ''}</td>`
        }

        return html`<td class=${classValue} title=${title} @click=${this.handleTeamTask.bind(this, team, task)} @mouseenter=${this.handleTeamTaskCellMouseEnter.bind(this, team, task)} @mouseleave=${this.handleTeamTaskCellMouseLeave.bind(this, team, task)}>
                ${done ? 'Done' : ''}</td>`
    }

    renderTeamTask(team, task) {
        if (!this.participants) {
            this.fetchParticipants();
            return html`<div class="team-task">Loading...</div>`;
        }

        if (!this.mode) {
            return null;
        }

        const teamTask = this.getTeamTask(team, task);
        const isNew = teamTask.isNew();
        const completionTime = DateTime.fromSQL(teamTask.completion_time_input);
        const isCompletionTimeValid = completionTime.isValid;
        const isCompletionTimeChanged = teamTask.isCompletionTimeChanged();
        const timeClassValue = classNames({
            invalid: !isCompletionTimeValid,
            changed: isCompletionTimeValid && !isNew && isCompletionTimeChanged
        });

        return html`<div class="team-task">
            <div class="team-task-header">
            <div class="title"><span>Team:</span><strong>${team.name}</strong><span> Task:</span><strong>${task.name}</strong></div>
            <div>
            ${this.renderSaveButton(teamTask)}
            <button class="close-button" @click=${this.handleCloseTeamTask.bind(this, teamTask)}>Close</button>
            </div>
            </div>
            <div class="completion-time">
            ${this.renderCompletedAtInput(teamTask)}
            ${this.renderCompletedAtSetNow(teamTask)}
            ${this.renderSavedCompletionTime(teamTask)}
            </div>
            ${this.renderAvailablePoints(team, task)}
            ${this.renderUsedPoints(team, task)}
            <div class="participants">
            ${this.renderDistributeEquallyInTeam(teamTask)}
            ${this.renderAddParticipant(teamTask)}
            ${teamTask.participants.map(taskParticipant =>  this.renderParticipantRow(teamTask, taskParticipant))}
            ${this.renderTeamTaskChanges(teamTask)}
            </div></div>`;
    }

    renderSaveButton(teamTask) {
        if (this.mode !== 'edit') {
            return null;
        }

        if (teamTask.isSaving) {
            return html`<span class="save-status">Saving</span>`;
        }

        return html`<button class="save-button" @click=${this.handleSaveTeamTask.bind(this, teamTask)}>Save</button>`;
    }

    renderCompletedAtInput(teamTask) {
        if (this.mode !== 'edit') {
            return html`<span>Completed at <strong>${teamTask.completion_time_input}</strong></span>`;
        }

        const isNew = teamTask.isNew();
        const completionTime = DateTime.fromSQL(teamTask.completion_time_input);
        const isCompletionTimeValid = completionTime.isValid;
        const isCompletionTimeChanged = teamTask.isCompletionTimeChanged();
        const timeClassValue = classNames({
            invalid: !isCompletionTimeValid,
            changed: isCompletionTimeValid && !isNew && isCompletionTimeChanged
        });

        return html`<label> Completed at <input 
               class=${timeClassValue} 
               @keyup=${this.handleCompletionTime.bind(this, teamTask)} 
               type="text" 
               .value=${teamTask.completion_time_input}>
               </label>`;
    }

    renderCompletedAtSetNow(teamTask) {
        if (this.mode !== 'edit') {
            return null;
        }

        return html`<button @click=${this.handleSetCompletionTimeToNow.bind(this, teamTask)}>Set to now</button>`;

        return null;
    }

    renderSavedCompletionTime(teamTask) {
        if (!teamTask.isNew() && teamTask.isCompletionTimeChanged()) {
            const time = DateTime.fromISO(teamTask.getSavedCompletionTime());

            return html`<del>${time.toSQL({includeOffset: false})}</del>
                <button @click=${this.handleRevertCompletionTime.bind(this, teamTask)}>Undo</button>`;
        }

        return null;
    }

    renderAvailablePoints(team, task) {
        const teamTask = this.getTeamTask(team, task);
        const completionDateTime = DateTime.fromISO(teamTask.completion_time);
        const pointsAvailable = this.getTaskPointsByDateTime(task, completionDateTime);

        return html`<div class="points-available"><span>Points available: </span><strong>${pointsAvailable}</strong>`;
    }

    renderUsedPoints(team, task) {
        const teamTask = this.getTeamTask(team, task);
        const total = teamTask.participants.reduce((runningTotal, p) => runningTotal + (p.isRemoved ? 0: p.points), 0);

        return html`<div class="points-used"><span>Points used: </span><strong>${total}</strong></div>`;
    }

    renderDistributeEquallyInTeam(teamTask) {
        if (this.mode !== 'edit') {
            return null;
        }

        return html`<button class="distribute-equally-in-team" @click=${this.handleDistributeEquallyInTeam.bind(this, teamTask)}>
            Distribute equally between team members</button>`;
    }

    renderAddParticipant(teamTask) {
        if (this.mode !== 'edit') {
            return html`<div class="title">Participants:</div>`;
        }

        return html`<button class="add-participant" @click=${this.handleAddParticipant.bind(this, teamTask)}>
            Add participant</button>`;
    }

    renderParticipantRow(teamTask, taskParticipant) {
        const participant = this.getParticipantById(taskParticipant.participant_id);

        if (this.mode !== 'edit') {
            return html`<div class="participant-row view">
                <span>${participant.name}</span>
                <strong>${taskParticipant.points}</strong>
                </div>`;
        }

        if (taskParticipant.isRemoved) {
            return html`<div class="removed participant-row">
                <span>${participant.name}</span>
                <span>${taskParticipant.points}</span>
                <button @click=${this.handleTaskParticipantRestore.bind(this, teamTask, taskParticipant)}>Restore</button>
                </div>`;
        }

        const task = this.getTaskById(teamTask.task_id);

        if (!task.is_progress) {
            this.fetchPointsUsedByTaskParticipant(teamTask.task_id, taskParticipant.participant_id);
        }

        const isNew = taskParticipant.isNew();
        const isPointsChanged = taskParticipant.isPointsChanged();

        const pointsClassValue = classNames({points: true, changed: !isNew && isPointsChanged, added: isNew});

        return html`<div class="participant-row">
                    ${this.renderParticipantSelector(taskParticipant, teamTask)}
                    <input class=${pointsClassValue} @keyup=${this.handleTaskParticipantPoints.bind(this, taskParticipant)} .value=${taskParticipant.points} type="text">
                    <button @click=${this.handleTaskParticipantRemove.bind(this, teamTask, taskParticipant)}>Remove</button>
                    ${this.renderParticipantPointsAvailable(teamTask, taskParticipant)}
                    ${this.renderSavedParticipantName(taskParticipant)}
                    ${this.renderSavedParticipantPoints(taskParticipant)}
                    </div>`;
    }

    renderParticipantSelector(selectedParticipant, teamTask) {
        const task = this.getTaskById(teamTask.task_id);
        const task_team_id = teamTask.team_id;
        const completionDateTime = DateTime.fromISO(teamTask.completion_time);
        const defaultOption = {
            value: null,
            text: 'Select participant',
            selected: selectedParticipant.participant_id === null
        };

        const options = [defaultOption].concat(this.participants
            .filter(p => {
                const isAlreadyAdded = teamTask.containsParticipant(p.participant_id);
                const isSelected = selectedParticipant.participant_id === p.participant_id;
                const isTeamMember = findParticipantsTeamIdByDateTime(p, completionDateTime) === task_team_id;
                const canShow = isSelected || !isAlreadyAdded;

                return task.is_progress ? isTeamMember && canShow : canShow;
            })
            .sort((a, b) => compareParticipantsOptions(a, b, task_team_id, teamTask.completion_time))
            .map(p => {
                const className = findParticipantsTeamIdByDateTime(p, completionDateTime) === task_team_id
                    ? 'team-member' : '';

                return {
                    value: p.participant_id,
                    text: p.name,
                    selected: p.participant_id === selectedParticipant.participant_id,
                    className,
                };
            }));

        const isNew = selectedParticipant.isNew();
        const isNameChanged = selectedParticipant.isNameChanged();

        const classValue = classNames({changed: !isNew && isNameChanged, added: isNew});

        return html`<participant-select 
            .options=${options}
            class=${classValue} 
            @change=${this.handleParticipantNameChanged.bind(this, selectedParticipant)}></participant-select>`;
    }

    renderParticipantPointsAvailable(teamTask, taskParticipant) {
        const task = this.getTaskById(teamTask.task_id);

        if (task.is_progress) {
            return null;
        }

        const used = this.getParticipantPointsUsed(teamTask.task_id, taskParticipant.participant_id);

        if (used === null) {
            return null;
        }
        const maxPoints = this.calcTaskMaxPoints(task);
        const savedPoints = taskParticipant.getSavedPoints();
        const available = Math.round(maxPoints - used + savedPoints);

        return html`<span>Available: </span><strong>${available}</strong><span> of ${maxPoints}</span>`;
    }

    renderSavedParticipantName(taskParticipant) {
        if (!taskParticipant.isNew() && taskParticipant.isNameChanged()) {
            const savedId = taskParticipant.getSavedParticipantId();
            const p = this.getParticipantById(savedId);

            if (p) {
                return html`<del>${p.name}</del>
                    <button @click=${this.handleRevertName.bind(this, taskParticipant)}>Undo</button>`;
            }
        }

        return null;
    }

    renderSavedParticipantPoints(taskParticipant) {
        if (!taskParticipant.isNew() && taskParticipant.isPointsChanged()) {
            const points = taskParticipant.getSavedPoints();

            return html`<del>${points}</del>
                <button @click=${this.handleRevertPoints.bind(this, taskParticipant)}>Undo</button>`;
        }

        return null;
    }

    renderTeamTaskChanges(teamTask) {
        if (!teamTask.savedState) {
            return null;
        }

        return html`<div class="team-task-changelog">
            <button @click=${this.handleShowTeamTaskChanges.bind(this, teamTask)}>Show changelog</button>
            <div>${(teamTask.changes || []).map(c => this.renderTeamTaskChangeRow(c))}</div>
            </div>`;
    }

    renderTeamTaskChangeRow(changeRow) {
        return html`<div>
            <div>
            <strong>${formatTime(changeRow.edit_time)}</strong>
            <span>${changeRow.editor}</span>
            </div>
            <ol>
            ${this.renderTeamTaskChangeDiff(changeRow.diff)}
            </ol>
            </div>`;
    }

    renderTeamTaskChangeDiff(diff) {
        if (!diff) {
            return html`<li>No changes</li>`;
        }

        const changeTexts = [];

        if (Array.isArray(diff.completion_time)) {
            if (diff.completion_time.length === 1) {
                changeTexts.push(html`<li>${'Added completion time ' + formatTime(diff.completion_time[0])}</li`);
            } else if (diff.completion_time.length === 2) {
                changeTexts.push(html`<li>${`Changed completion time ${formatTime(diff.completion_time[0])} to ${formatTime(diff.completion_time[1])}`}</li`);
            }
        }

        if (Array.isArray(diff.participants)) {
            if (diff.participants.length === 1) {
                const participantPointsTexts = Object.entries(diff.participants[0])
                    .map(entry => html`<li>${this.getParticipantById(parseInt(entry[0]), 10).name} ${entry[1]} points</li>`);

                changeTexts.push(html`<li>Added participants: ${html`<ul>${participantPointsTexts}</ul>`}</li>`);
            } else if (diff.participants.length === 2) {
                changeTexts.push(html`<li>${'Changed participants'}</li`);
            } else if (diff.participants.length === 3) {
                changeTexts.push(html`<li>${'Removed participants'}</li`);
            }
        } else if (diff.participants) {
            for (let [key, pointsChanges] of Object.entries(diff.participants)) {
                const participantId = parseInt(key,10);

                if (pointsChanges.length === 1) {
                    changeTexts.push(html`<li>${`Added ${this.getParticipantById(participantId).name} ${pointsChanges[0]} points`}</li`);
                } else if (pointsChanges.length === 2) {
                    changeTexts.push(html`<li>${`Changed ${this.getParticipantById(participantId).name} points from ${pointsChanges[0]} to ${pointsChanges[1]}`}</li`);
                } else if (pointsChanges.length === 3) {
                    changeTexts.push(html`<li>${'Removed ' + this.getParticipantById(participantId).name}</li`);
                }
             }
        }

        return html`${changeTexts}`;
    }
}

class ParticipantSelect extends LitElement {
    constructor() {
        super();

        this.options = [];
    }

    static get properties() {
        return {
            options: {type: Array},
        };
    }

    createRenderRoot() {
        return this;
    }

    render() {
        return html`<select>${this.options.map(option => this.renderParticipantOption(option))}</select>`;
    }

    renderParticipantOption(option) {
        return html`<option class=${option.className} .selected="${option.selected}" .value="${option.value}">
            ${option.text}</option>`;
    }
}

class TeamTask {
    constructor(team_id, task_id) {
        this.team_id = team_id;
        this.task_id = task_id;
        this.completion_time = null;
        this.completion_time_input = null;
        this.participants = [];

        this.isOpen = false;
        this.isSaving = false;

        this.savedState = null;

        this.changes = null;
    }

    static fromSavedState(savedState) {
        const teamTask = new TeamTask(savedState.team_id, savedState.task_id);
        teamTask.savedState = cloneObject(savedState);
        teamTask.completion_time = savedState.completion_time;
        teamTask.completion_time_input = formatTime(savedState.completion_time);
        teamTask.participants = (savedState.participants || []).map(p => TaskParticipant.fromSavedState(p));

        return teamTask;
    }

    setSavedState(savedState) {
        this.savedState = cloneObject(savedState);
        this.participants = (savedState.participants || []).map(p => TaskParticipant.fromSavedState(p));
    }

    getSaveInfo() {
        return {
            team_id: this.team_id,
            task_id: this.task_id,
            completion_time: this.completion_time,
            participants: this.participants.filter(p => !p.isRemoved).map(p => p.getSaveInfo()),
        }
    }

    isNew() {
        return !this.savedState || !this.savedState.completion_time;
    }

    containsParticipant(participant_id) {
        return this.participants.findIndex(p => p.participant_id === participant_id) !== -1;
    }

    getParticipantById(participant_id) {
        return this.participants.find(p => p.participant_id === participant_id);
    }

    addParticipant(participant_id, points) {
        const participant = this.getParticipantById(participant_id);

        if (participant) {
            participant.points = points;
            participant.isRemoved = false;
        } else {
            this.participants.push(new TaskParticipant(participant_id, points));
        }
    }

    removeParticipant(taskParticipant) {
        const index = this.participants.indexOf(taskParticipant);

        if (index === -1) {
            return;
        }

        if (taskParticipant.isNew()) {
            this.participants.splice(index, 1);
            return;
        }

        const participant = this.participants[index];
        participant.isRemoved = true;
    }

    removeAllParticipants() {
        for (const participant of this.participants.slice()) {
            this.removeParticipant(participant);
        }
    }

    restoreParticipant(participant_id) {
        const participant = this.participants.find(p => p.participant_id === participant_id);

        if (participant) {
            participant.isRemoved = false;
        }
    }

    getSavedCompletionTime() {
        return this.savedState && this.savedState.completion_time;
    }

    isCompletionTimeChanged() {
        const inputDateTime = DateTime.fromSQL(this.completion_time_input, {zone: timeZone});
        const savedDateTime = DateTime.fromISO(this.getSavedCompletionTime());

        return !inputDateTime.hasSame(savedDateTime, 'millisecond');
    }

    revertCompletionTime() {
        this.setCompletionTime(this.getSavedCompletionTime());
    }

    setCompletionTime(completionTime) {
        this.completion_time = completionTime;
        this.completion_time_input = formatTime(this.completion_time);
    }
}

class TaskParticipant {
    constructor(participant_id, points) {
        this.participant_id = participant_id;
        this.points = points;

        this.isRemoved = false;

        this.savedState = null;
    }

    static fromSavedState(savedState) {
        const participant = new TaskParticipant(savedState.participant_id, savedState.points);
        participant.savedState = cloneObject(savedState);

        return participant;
    }

    getSaveInfo() {
        return {
            participant_id: this.participant_id,
            points: this.points
        }
    }

    isNew() {
        return !this.savedState || !this.savedState.participant_id;
    }

    getSavedParticipantId() {
        return this.savedState && this.savedState.participant_id;
    }

    getSavedPoints() {
        return this.savedState && this.savedState.points;
    }

    isNameChanged() {
        return this.participant_id !== this.getSavedParticipantId();
    }

    isPointsChanged() {
        return this.points !== this.getSavedPoints();
    }

    revertName() {
        this.participant_id = this.getSavedParticipantId();
    }

    revertPoints() {
        this.points = this.getSavedPoints();
    }
}

function formatTime(isoString) {
    const dateTime = DateTime.fromISO(isoString);

    if (!dateTime.isValid) {
        return null;
    }

    return dateTime.toFormat('yyyy-MM-dd T');
}

function compareParticipantsOptions(a, b, task_team_id, completion_time) {
    const completionDateTime = DateTime.fromISO(completion_time);

    if (completionDateTime.isValid) {
        const aTeamId = findParticipantsTeamIdByDateTime(a, completionDateTime);
        const bTeamId = findParticipantsTeamIdByDateTime(b, completionDateTime);

        if (aTeamId === task_team_id && bTeamId !== task_team_id) {
            return -1;
        }

        if (aTeamId !== task_team_id && bTeamId === task_team_id) {
            return 1;
        }
    }

    return a.name.localeCompare(b.name);
}

function findParticipantsTeamIdByDateTime(participant, dateTime) {
    if (
        !Array.isArray(participant.teams)
        || participant.teams.length === 0
        || !dateTime
        || !dateTime.isValid
    ) {
        return null;
    }
    
    const team = participant.teams.find(t => {
        const startDateTime = DateTime.fromISO(t.start_time);
        const endDateTime = DateTime.fromISO(t.end_time);

        if (startDateTime.isValid) {
            if (endDateTime.isValid) {
                return startDateTime <= dateTime && dateTime <= endDateTime
            }

            return startDateTime <= dateTime;
        }

        return false;
    });

    return !!team ? team.team_id : null;
}

customElements.define('participant-select', ParticipantSelect);
customElements.define('tasks-table', TasksTable);