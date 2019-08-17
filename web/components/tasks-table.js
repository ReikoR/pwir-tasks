import {define, html} from '../lib/heresy.mjs';
import {
    getParticipants, getCompletedTask, setCompletedTask, getCompletedTasksList, getPointsUsedByTaskParticipant
} from "../services/api.js";
import {cloneObject, deepFreeze, classNames} from "../util.js";
import {DateTime} from "../lib/luxon.js";

const _tasks = new WeakMap();
const _teams = new WeakMap();

const timeZone = 'Europe/Tallinn';

class TasksTable extends HTMLDivElement {
    oninit() {
        /**@type {Object.<number, TeamTask>}*/
        this.teamTasks = {};

        this.paricipantPointsUsedCache = {};

        this.participants = null;
        this.completedTasksList = [];

        this.fetchCompletedTasksList();
    }

    get tasks() {
        return _tasks.get(this) || [];
    }

    set tasks(tasks) {
        _tasks.set(this, tasks);
        this.render();
    }

    get teams() {
        return _teams.get(this) || [];
    }

    set teams(teams) {
        _teams.set(this, teams);
        this.render();
    }

    getTeamById(id) {
        return this.teams.find(team => team.team_id === id);
    }

    getTaskById(id) {
        return this.tasks.find(task => task.task_id === id);
    }

    getTeamTask(team, task) {
        const id = `${team.team_id}_${task.task_id}`;
        return this.teamTasks[id];
    }

    getParticipantPointsUsed(task_id, participant_id) {
        const id = `${task_id}_${participant_id}`;
        const used = this.paricipantPointsUsedCache[id];
        return typeof used === 'number' ? used : null;
    }

    getParticipantById(id) {
        return cloneObject(this.participants.find(p => p.participant_id === id) || null);
    }

    isTeamTaskDone(team, task) {
        /*const teamTask = this.getTeamTask(team, task);

        return teamTask && teamTask.savedState !== null;*/

        return this.completedTasksList.findIndex(
            t => t.task_id === task.task_id && t.team_id === team.team_id) !== -1;
    }

    isTeamTaskOpen(team, task) {
        const teamTask = this.getTeamTask(team, task);

        return teamTask && teamTask.isOpen;
    }

    async fetchParticipants() {
        this.participants = await getParticipants({roles: ['student']});
        deepFreeze(this.participants);
        this.render();
    }

    async fetchCompletedTasksList() {
        this.completedTasksList = await getCompletedTasksList();
        deepFreeze(this.completedTasksList);
        this.render();
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
            }

            this.render();
        }
    }

    fetchPointsUsedByTaskParticipant(task_id, participant_id) {
        if (!task_id || !participant_id) {
            return;
        }

        getPointsUsedByTaskParticipant({task_id, participant_id}).then(info => {
            const id = `${task_id}_${participant_id}`;
            this.paricipantPointsUsedCache[id] = info.used;
            this.render();
        });
    }

    checkPointsUsedByTaskParticipant(task_id, participant_id) {
        if (this.getParticipantPointsUsed(task_id, participant_id) === null) {
            this.fetchPointsUsedByTaskParticipant(task_id, participant_id);
        }
    }

    calcTaskMaxPoints(task) {
        return task.points * (1 + (task.week_before_bonus ? 0.2 : task.on_time_bonus ? 0.1 : 0))
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

        this.render();
    }

    handleAddParticipant(teamTask) {
        if (teamTask) {
            teamTask.addParticipant(null, null);
            this.render();
        }
    }

    async handleSaveTeamTask(teamTask) {
        const saveInfo = teamTask.getSaveInfo();
        await setCompletedTask(saveInfo);
        this.fetchCompletedTasksList();
        this.fetchTeamTask(teamTask.team_id, teamTask.task_id);

        for (const p of saveInfo.participants) {
            this.fetchPointsUsedByTaskParticipant(teamTask.task_id, p.participant_id);
        }
    }

    handleCloseTeamTask(teamTask) {
        teamTask.isOpen = false;
        this.render();
    }

    handleCompletionTime(teamTask, event) {
        if (teamTask.completion_time_input === event.currentTarget.value) {
            return;
        }

        teamTask.completion_time_input = event.currentTarget.value;

        const dateTime = DateTime.fromSQL(teamTask.completion_time_input);

        if (dateTime.isValid) {
            teamTask.completion_time = dateTime.toISO();
        }

        this.render();
    }

    handleBlogCount(teamTask, event) {
        const newValue = parseInt(event.currentTarget.value, 10) || null;

        if (teamTask.blog_count === newValue) {
            return;
        }

        teamTask.blog_count = newValue;
        this.render();
    }

    handleTaskParticipantPoints(taskParticipant, event) {
        const newValue = parseInt(event.currentTarget.value, 10) || null;

        if (taskParticipant.blog_count === newValue) {
            return;
        }

        taskParticipant.points = newValue;
        this.render();
    }

    /**
     * @param {TaskParticipant} taskParticipant
     * @param {TeamTask} teamTask
     * @param {Event} event
     */
    handleParticipantNameChanged(taskParticipant, teamTask, event) {
        taskParticipant.participant_id = parseInt(event.currentTarget.value, 10) || null;

        this.render();
    }

    handleTaskParticipantRemove(teamTask, taskParticipant) {
        teamTask.removeParticipant(taskParticipant);
        this.render();
    }

    handleTaskParticipantRestore(teamTask, taskParticipant) {
        teamTask.restoreParticipant(taskParticipant.participant_id);
        this.render();
    }

    handleRevertCompletionTime(teamTask) {
        teamTask.revertCompletionTime();
        this.render();
    }

    handleRevertBlogCount(teamTask) {
        teamTask.revertBlogCount();
        this.render();
    }

    handleRevertName(taskParticipant) {
        taskParticipant.revertName();
        this.render();
    }

    handleRevertPoints(taskParticipant) {
        taskParticipant.revertPoints();
        this.render();
    }

    render() {
        this.html`<table>
            ${this.renderHeader()}
            ${this.renderBody()}
            </table>`;
    }

    renderHeader() {
        const columns = ['Task', 'Points', 'Deadline'].concat(this.teams.map(team => team.name));

        return html`<thead><tr>${columns.map(column => html`<th>${column}</th>`)}</tr></thead>`;
    }

    renderBody() {
        const columnCount = this.teams.length + 3;

        return html`<tbody>${this.tasks.map(task => html`<tr class="task-row">
            <td>${task.name}</td>
            <td>${task.points}</td>
            <td>${formatTime(task.deadline)}</td>
            ${this.teams.map(team => this.renderTeamTaskCell(team, task))}
            </tr>
            <tr class="team-tasks-row"><td colspan="${columnCount}">
            ${this.teams
            .filter(team => this.isTeamTaskOpen(team, task))
            .map(team => this.renderTeamTask(team, task))}
            </td></tr>
            `)}</tbody>`;
    }

    renderTeamTaskCell(team, task) {
        const mode = this.getAttribute('mode');
        const done = this.isTeamTaskDone(team, task);
        const canOpen = mode === 'edit' || mode === 'inspect' && done;
        const unavailable = !done && !task.allow_overdue && DateTime.fromISO(task.deadline) < DateTime.local();
        const classValue = classNames({
            'team-task-cell': true,
            'can-open': canOpen,
            done,
            unavailable
        });

        if (!canOpen) {
            return html`<td class=${classValue}>${done ? 'Done' : ''}</td>`
        }

        return html`<td class=${classValue} onclick=${this.handleTeamTask.bind(this, team, task)}>
                ${done ? 'Done' : ''}</td>`
    }

    renderTeamTask(team, task) {
        if (!this.participants) {
            this.fetchParticipants();
            return html`<div class="team-task">Loading...</div>`;
        }

        const mode = this.getAttribute('mode');

        if (!mode) {
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
            <button class="close-button" onclick=${this.handleCloseTeamTask.bind(this, teamTask)}>Close</button>
            </div>
            </div>
            <div class="completion-time">
            ${this.renderCompletedAtInput(teamTask)}
            ${this.renderSavedCompletionTime(teamTask)}
            </div>
            <div class="blog-count">
            ${this.renderBlogsRow(task, teamTask)}
            ${this.renderSavedBlogCount(teamTask)}
            </div>
            ${this.renderAvailablePoints(team, task)}
            ${this.renderUsedPoints(team, task)}
            <div class="participants">
            ${this.renderAddParticipant(teamTask)}
            ${teamTask.participants.map(taskParticipant =>  this.renderParticipantRow(teamTask, taskParticipant))}
            </div></div>`;
    }

    renderSaveButton(teamTask) {
        if (this.getAttribute('mode') !== 'edit') {
            return null;
        }

        return html`<button class="save-button" onclick=${this.handleSaveTeamTask.bind(this, teamTask)}>Save</button>`;
    }

    renderCompletedAtInput(teamTask) {
        if (this.getAttribute('mode') !== 'edit') {
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
               onkeyup=${this.handleCompletionTime.bind(this, teamTask)} 
               type="text" 
               value=${teamTask.completion_time_input}/>
               </label>`;
    }

    renderSavedCompletionTime(teamTask) {
        if (!teamTask.isNew() && teamTask.isCompletionTimeChanged()) {
            const time = DateTime.fromISO(teamTask.getSavedCompletionTime());

            return html`<del>${time.toSQL({includeOffset: false})}</del>
                <button onclick=${this.handleRevertCompletionTime.bind(this, teamTask)}>Undo</button>`;
        }

        return null;
    }

    renderBlogsRow(task, teamTask) {
        if (!task.is_progress) {
            return null;
        }

        if (this.getAttribute('mode') !== 'edit') {
            return html`<span>Blog count <strong>${teamTask.blog_count}</strong></span>`;
        }

        const isNew = teamTask.isNew();
        const isChanged = teamTask.isBlogCountChanged();

        const classValue = classNames({
            changed: !isNew && isChanged
        });

        return html`<label>Blog count 
            <input 
                class=${classValue} 
                onkeyup="${this.handleBlogCount.bind(this, teamTask)}" 
                type="text" 
                value=${teamTask.blog_count}/>
            </label>`;
    }

    renderSavedBlogCount(teamTask) {
        if (!teamTask.isNew() && teamTask.isBlogCountChanged()) {
            return html`<del>${teamTask.blog_count}</del>
                <button onclick=${this.handleRevertBlogCount.bind(this, teamTask)}>Undo</button>`;
        }

        return null;
    }

    renderAvailablePoints(team, task) {
        const teamTask = this.getTeamTask(team, task);
        const completionDateTime = DateTime.fromISO(teamTask.completion_time);
        const basePoints = task.points;
        let isOnTime = false;
        let isWeekBefore = false;

        if (completionDateTime.isValid) {
            const deadlineDateTime = DateTime.fromISO(task.deadline);
            const weekBeforeDeadlineDateTime = DateTime.fromISO(task.deadline).minus({weeks: 1});

            if (task.week_before_bonus && completionDateTime <= weekBeforeDeadlineDateTime) {
                isWeekBefore = true;
            } else if (task.week_before_bonus && completionDateTime <= deadlineDateTime) {
                isOnTime = true;
            }
        }

        const blogCount = teamTask.blog_count || 0;

        if (task.is_progress) {
            return html`<div class="points-available"><span>Points available: </span>
            ${basePoints} &times; ${blogCount} = <strong>${basePoints * blogCount}</strong></div>`;
        }

        const bonusPoints = isWeekBefore ? basePoints * 0.2 : (isOnTime ? basePoints * 0.1 : 0);

        if (bonusPoints === 0) {
            return html`<div class="points-available"><span>Points available: </span><strong>${basePoints}</strong>`;
        }

        const info = isWeekBefore ? '(20% for at least 1 week before deadline)' : '(10% for before deadline)';

        return html`<div class="points-available"><span>Points available: </span>
            ${basePoints} + ${bonusPoints} = <strong>${basePoints + bonusPoints}</strong> ${info}</div>`;
    }

    renderUsedPoints(team, task) {
        const teamTask = this.getTeamTask(team, task);
        const total = teamTask.participants.reduce((runningTotal, p) => runningTotal + p.points, 0);

        return html`<div class="points-used"><span>Points used: </span><strong>${total}</strong></div>`;
    }

    renderAddParticipant(teamTask) {
        if (this.getAttribute('mode') !== 'edit') {
            return html`<div class="title">Participants:</div>`;
        }

        return html`<button class="add-participant" onclick=${this.handleAddParticipant.bind(this, teamTask)}>
            Add participant</button>`;
    }

    renderParticipantRow(teamTask, taskParticipant) {
        const participant = this.getParticipantById(taskParticipant.participant_id);

        if (this.getAttribute('mode') !== 'edit') {
            return html`<div class="participant-row view">
                <span>${participant.name}</span>
                <strong>${taskParticipant.points}</strong>
                </div>`;
        }

        if (taskParticipant.isRemoved) {
            return html`<div class="removed participant-row">
                <span>${participant.name}</span>
                <span>${taskParticipant.points}</span>
                <button onclick=${this.handleTaskParticipantRestore.bind(this, teamTask, taskParticipant)}>Restore</button>
                </div>`;
        }

        this.checkPointsUsedByTaskParticipant(teamTask.task_id, taskParticipant.participant_id);

        const isNew = taskParticipant.isNew();
        const isPointsChanged = taskParticipant.isPointsChanged();

        const pointsClassValue = classNames({points: true, changed: !isNew && isPointsChanged, added: isNew});

        return html`<div class="participant-row">
                    ${this.renderParticipantSelector(taskParticipant, teamTask)}
                    <input class=${pointsClassValue} onkeyup=${this.handleTaskParticipantPoints.bind(this, taskParticipant)} value=${taskParticipant.points} type="text"/>
                    <button onclick=${this.handleTaskParticipantRemove.bind(this, teamTask, taskParticipant)}>Remove</button>
                    ${this.renderParticipantPointsAvailable(teamTask, taskParticipant)}
                    ${this.renderSavedParticipantName(taskParticipant)}
                    ${this.renderSavedParticipantPoints(taskParticipant)}
                    </div>`;
    }

    renderParticipantSelector(selectedParticipant, teamTask) {
        const task_team_id = teamTask.team_id;

        const options = [{value: '', text: 'Select participant'}].concat(this.participants
            .slice()
            .filter(p => selectedParticipant.participant_id === p.participant_id || !teamTask.containsParticipant(p.participant_id))
            .sort((a, b) => compareParticipantsOptions(a, b, task_team_id))
            .map(p => {
                const className = p.team_id === task_team_id ? 'team-member' : '';
                return {value: p.participant_id, text: p.name, className};
            }));

        const isNew = selectedParticipant.isNew();
        const isNameChanged = selectedParticipant.isNameChanged();

        const classValue = classNames({changed: !isNew && isNameChanged, added: isNew});

        return html`<select class=${classValue} onchange=${this.handleParticipantNameChanged.bind(this, selectedParticipant, teamTask)}>
            ${options.map(option => {
                return html`<option 
                    class=${option.className}
                    selected="${selectedParticipant.participant_id === option.value}"
                    value="${option.value}"
                    >${option.text}</option>`;
            })}
            </select>`;
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
        const available = maxPoints - used + savedPoints;

        return html`<span>Available: </span><strong>${available}</strong><span> of ${maxPoints}</span>`;
    }

    renderSavedParticipantName(taskParticipant) {
        if (!taskParticipant.isNew() && taskParticipant.isNameChanged()) {
            const savedId = taskParticipant.getSavedParticipantId();
            const p = this.getParticipantById(savedId);

            if (p) {
                return html`<del>${p.name}</del>
                    <button onclick=${this.handleRevertName.bind(this, taskParticipant)}>Undo</button>`;
            }
        }

        return null;
    }

    renderSavedParticipantPoints(taskParticipant) {
        if (!taskParticipant.isNew() && taskParticipant.isPointsChanged()) {
            const points = taskParticipant.getSavedPoints();

            return html`<del>${points}</del>
                <button onclick=${this.handleRevertPoints.bind(this, taskParticipant)}>Undo</button>`;
        }

        return null;
    }
}

class TeamTask {
    constructor(team_id, task_id) {
        this.team_id = team_id;
        this.task_id = task_id;
        this.completion_time = null;
        this.completion_time_input = null;
        this.participants = [];
        this.blog_count = null;

        this.isOpen = false;

        this.savedState = null;
    }

    static fromSavedState(savedState) {
        const teamTask = new TeamTask(savedState.team_id, savedState.task_id);
        teamTask.savedState = cloneObject(savedState);
        teamTask.completion_time = savedState.completion_time;
        teamTask.completion_time_input = formatTime(savedState.completion_time);
        teamTask.blog_count = savedState.blog_count;
        teamTask.participants = savedState.participants.map(p => TaskParticipant.fromSavedState(p));

        return teamTask;
    }

    setSavedState(savedState) {
        this.savedState = cloneObject(savedState);
        this.participants = savedState.participants.map(p => TaskParticipant.fromSavedState(p));
    }

    getSaveInfo() {
        return {
            team_id: this.team_id,
            task_id: this.task_id,
            completion_time: this.completion_time,
            blog_count: this.blog_count,
            participants: this.participants.filter(p => !p.isRemoved).map(p => p.getSaveInfo()),
        }
    }

    isNew() {
        return !this.savedState || !this.savedState.completion_time;
    }

    containsParticipant(participant_id) {
        return this.participants.findIndex(p => p.participant_id === participant_id) !== -1;
    }

    addParticipant(participant_id, points) {
        this.participants.push(new TaskParticipant(participant_id, points));
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
        this.completion_time = this.getSavedCompletionTime();
        this.completion_time_input = formatTime(this.completion_time);
    }

    getSavedBlogCount() {
        return this.savedState && this.savedState.blog_count;
    }

    isBlogCountChanged() {
        return this.getSavedBlogCount() !== this.blog_count;
    }

    revertBlogCount() {
        this.blog_count = this.getSavedBlogCount();
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
    return DateTime.fromISO(isoString).toFormat('yyyy-MM-dd T');
}

function compareParticipantsOptions(a, b, task_team_id) {
    if (a.team_id === task_team_id && b.team_id !== task_team_id) {
        return -1;
    }

    if (a.team_id !== task_team_id && b.team_id === task_team_id) {
        return 1;
    }

    return a.name.localeCompare(b.name);
}

define('TasksTable:div', TasksTable);