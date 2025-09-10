import {html, render, LitElement} from "./lib/lit.mjs";
import {
    getReviewList,
    getSession,
    getParticipants,
    getReviewInputInfo,
    updateReview,
    updateReviewChangesCompleted
} from "./services/api.js";
import './components/default-page-header.js';
import './components/participant-select.js';
import {DateTime} from "./lib/luxon.mjs";
import {cloneObject, deepFreeze, getReviewTasksInfoByType} from "./util.js";

class Review extends LitElement {
    constructor() {
        super();

        this.reviewId = null;
        this.reviewInfo = null;
        this.reviewInputInfo = null;
        this.instructors = null;
        this.savedState = null;
        this.changedState = null;
        this.reviewerInputs = null;
        this.taskIdInputs = null;
        this.reviewTasksInfo = null;
        this.session = null;
        this.isInstructorSession = false;
        this.isValid = false;
        this.isChanged = false;
        this.isSuccess = false;
        this.isSaving = false;
        this.error = null;

        this.team_id = null;
        this.task_ids = null;
        this.external_link = null;
    }

    static get properties() {
        return {
            reviewId: {type: Number},
            reviewInfo: {type: Object},
            session: {type: Object},
            isValid: {type: Boolean},
            isChanged: {type: Boolean},
            isSuccess: {type: Boolean},
            isSaving: {type: Boolean},
            error: {type: String},
            team_id: {type: Number},
            task_ids: {type: Number},
            external_link: {type: String},
        };
    }

    createRenderRoot() {
        return this;
    }

    firstUpdated(changedProperties) {
        const isSessionSet = changedProperties.has('session');

        if (isSessionSet) {
            this.isInstructorSession = this.session?.role === 'instructor' ?? false;
        }
    }

    async fetchAdditionalInfo() {
        const returnValues = await Promise.all([
            getReviewInputInfo(),
            getParticipants({roles: ['instructor']}),
        ]);

        this.reviewInputInfo = returnValues[0];
        deepFreeze(this.reviewInputInfo);
        console.log(this.reviewInputInfo);

        this.instructors = returnValues[1];
        deepFreeze(this.instructors);
        console.log(this.instructors);
    }

    async fetchReviewInfo() {
        if (!this.reviewInputInfo) {
            await this.fetchAdditionalInfo();
        }

        this.reviewInfo = (await getReviewList({review_ids: [this.reviewId]}))[0];
        deepFreeze(this.reviewInfo);
        console.log(this.reviewInfo);

        if (!this.reviewerInputs) {
            this.reviewerInputs = {};

            for (const instructor of this.instructors) {
                this.reviewerInputs[instructor.participant_id] = {
                    isSelected: false,
                    isActive: false,
                }
            }

            if (Array.isArray(this.reviewInfo.reviewers)) {
                for (const reviewer of this.reviewInfo.reviewers) {
                    this.reviewerInputs[reviewer.participant_id].isSelected = true;
                    this.reviewerInputs[reviewer.participant_id].isActive = reviewer.is_active;
                }
            }
        }

        if (!this.taskIdInputs) {
            this.taskIdInputs = {};

            for (const taskInfo of this.reviewInputInfo.tasks) {
                this.taskIdInputs[taskInfo.task_id] = false;
            }

            if (Array.isArray(this.reviewInfo.tasks)) {
                for (const reviewTaskInfo of this.reviewInfo.tasks) {
                    this.taskIdInputs[reviewTaskInfo.task_id] = true;
                }
            }

            this.reviewTasksInfo = getReviewTasksInfoByType(this.reviewInputInfo, this.reviewInfo.type);
        }

        this.savedState = {
            status: this.reviewInfo.status,
            external_link: this.reviewInfo.external_link,
            task_ids: this.reviewInfo.tasks?.map(t => t.task_id) ?? [],
            reviewers: this.reviewInfo.reviewers?.map(r => {
                return {participant_id: r.participant_id, is_active: r.is_active}
            }) ?? [],
        };

        deepFreeze(this.savedState);

        if (!this.changedState) {
            this.changedState = cloneObject(this.savedState);
        }
    }

    async handleSaveReview(event) {
        this.isSaving = true;
        this.error = null;

        try {
            await updateReview({
                review_id: this.reviewId,
                ...this.changedState
            });

            this.isSuccess = true;

            await this.fetchReviewInfo();

            this.checkFormData();
        } catch (e) {
            this.error = 'Failed';
        }

        this.isSaving = false;
    }

    async handleChangesCompleted(event) {
        this.isSaving = true;
        this.error = null;

        try {
            await updateReviewChangesCompleted({review_id: this.reviewId});

            this.isSuccess = true;

            await this.fetchReviewInfo();
        } catch (e) {
            this.error = 'Failed';
        }

        this.isSaving = false;
    }

    handleStatusChange(event) {
        this.changedState.status = event.currentTarget.value;

        this.checkFormData();
    }

    updateChangedStateReviewersFromInputs() {
        const newReviewers = [];

        for (const [participant_id, inputStates] of Object.entries(this.reviewerInputs)) {
            if (inputStates.isSelected) {
                newReviewers.push({participant_id: parseInt(participant_id, 10), is_active: inputStates.isActive});
            }
        }

        this.changedState.reviewers = newReviewers;
    }

    handleReviewerChange(reviewer_id, event) {
        this.reviewerInputs[reviewer_id].isSelected = event.currentTarget.checked;

        this.updateChangedStateReviewersFromInputs();

        this.checkFormData();
    }

    handleReviewerIsActiveChange(reviewer_id, event) {
        this.reviewerInputs[reviewer_id].isActive = event.currentTarget.checked;

        this.updateChangedStateReviewersFromInputs();

        this.checkFormData();
    }

    handleTaskChange(event) {
        this.taskIdInputs[event.currentTarget.value] = event.currentTarget.checked;

        const newTaskIds = [];

        for (const [taskId, isChecked] of Object.entries(this.taskIdInputs)) {
            if (isChecked) {
                newTaskIds.push(parseInt(taskId, 10));
            }
        }

        this.changedState.task_ids = newTaskIds;

        this.checkFormData();
    }

    handleExternalLinkChange(event) {
        this.changedState.external_link = event.currentTarget.value;

        this.checkFormData();
    }

    checkFormData() {
        console.log(this.changedState);

        this.isValid = (this.isExternalLinkRequired() ? this.isExternalLinkValid() : true);

        this.isChanged =
            this.savedState.status !== this.changedState.status
            || this.savedState.external_link !== this.changedState.external_link
            || JSON.stringify(this.savedState.task_ids) !== JSON.stringify(this.changedState.task_ids)
            || JSON.stringify(this.savedState.reviewers) !== JSON.stringify(this.changedState.reviewers);
    }

    isExternalLinkValid() {
        return typeof this.changedState.external_link === 'string' && this.changedState.external_link.length > 0;
    }

    render() {
        if (!this.reviewInfo) {
            this.fetchReviewInfo();
            return html`<div>Loading...</div>`;
        }

        return html`${this.renderInfo()}
            ${this.renderExternalLink()}
            ${this.renderStatus()}
            ${this.renderReviewersSelector()}
            ${this.renderTaskSelector()}
            ${this.renderButtons()}
            ${this.renderError()}`;
    }

    renderButtons() {
        if (!this.isInstructorSession) {
            if (
                this.reviewInfo.status === 'changes_needed'
                && this.session?.team?.team_id === this.reviewInfo.team.team_id
            ) {
                return html`<button @click=${this.handleChangesCompleted}>Changes completed</button>`;
            }

            return null;
        }

        const canSave = !this.isSaving && this.isValid && this.isChanged;

        return html`<button ?disabled=${!canSave} @click=${this.handleSaveReview}>Save</button>`;
    }

    renderInfo() {
        const info = this.reviewInfo;

        const updatedDT = DateTime.fromISO(info.last_updated_time);
        const requestDT = DateTime.fromISO(info.request_time);
        const relativeUpdateTime = updatedDT.toRelative({locale: 'en', round: false});
        const relativeRequestTime = requestDT.toRelative({locale: 'en', round: false});
        const lastUpdated = `${updatedDT.toFormat('yyyy-MM-dd TT')} (${relativeUpdateTime})`
        const requestTime = `${requestDT.toFormat('yyyy-MM-dd TT')} (${relativeRequestTime})`

        return html`<div><b>Team:</b><span> ${info.team.name}</span></div>
            <div><b>Type:</b><span> ${info.type}</span></div>
            <div><b>Requester:</b><span> ${info.requester.name}</span></div>
            <div><b>Last updated time:</b><span> ${lastUpdated}</span></div>
            <div><b>Request time:</b><span> ${requestTime}</span></div>`;
    }

    renderStatus() {
        if (!this.isInstructorSession) {
            return html`<div><b>Status: </b><span>${this.reviewInfo.status}</span></div>`;
        }

        return html`<fieldset>
            <legend><b>Status:</b></legend>
            ${this.renderStatusOptions()}
        </fieldset>`;
    }

    renderStatusOptions() {
        const statusValue = ['new', 'in_review', 'changes_needed', 'changes_completed', 'approved', 'rejected'];

        return statusValue.map(s =>
            html`<div><label><input 
                    type=radio 
                    name=status
                    .checked=${s === this.changedState.status}
                    value=${s}
                    @change=${this.handleStatusChange}
            > ${s}</label></div>`)
    }

    renderReviewersSelector() {
        if (!this.isInstructorSession) {
            return html`<div><div><b>Reviewers:</b></div><ul>
                    ${this.reviewInfo.reviewers?.map(r => html`<li>${r.name + (r.is_active ? ' (active)' : '')}</li>`)}
                </ul></div>`;
        }

        return html`<fieldset>
            <legend><b>Reviewers:</b></legend>
            ${this.renderReviewerOptions()}
        </fieldset>`;
    }

    renderReviewerOptions() {
        return html`<table>
            <thead><tr><th>Name</th><th>Active?</th></tr></thead>
            <tbody>
            ${this.instructors.map(i => this.renderReviewerOption(i))}
            </tbody>
        </table>`;
    }

    renderReviewerOption(instructor) {
        const isSelected = this.reviewerInputs[instructor.participant_id].isSelected;
        const isActive = this.reviewerInputs[instructor.participant_id].isActive;

        return html`<tr><td><label><input
                type=checkbox
                name=reviewer
                .checked=${isSelected}
                value=${instructor.participant_id}
                @change=${this.handleReviewerChange.bind(this, instructor.participant_id)}
        > ${instructor.name}</label></td>
            <td><input
                    type=checkbox
                    name=reviewer_active
                    .checked=${isActive}
                    value=${isActive}
                    @change=${this.handleReviewerIsActiveChange.bind(this, instructor.participant_id)}
            ></td>
        </tr>`;
    }

    renderTaskSelector() {
        if (!this.isInstructorSession) {
            return html`<div><div><b>Tasks:</b></div><ul>
                    ${this.reviewInfo.tasks?.map(t => html`<li>${t.name}</li>`)}
                </ul></div>`;
        }

        return html`<fieldset>
            <legend><b>Tasks:</b></legend>
            ${this.renderTaskOptions()}
        </fieldset>`;
    }

    renderTaskOptions() {
        return this.reviewTasksInfo.map(t => {
            const isDone = Array.isArray(t.completed_by_team_ids)
                && t.completed_by_team_ids.includes(this.reviewInfo.team.team_id);
            const name = `${isDone ? '[Done] ' : ''}${t.name}`;
            const isSelected = this.taskIdInputs[t.task_id];

            return html`<div><label><input 
                    type=checkbox 
                    name=task 
                    .checked=${isSelected}
                    value=${t.task_id}
                    @change=${this.handleTaskChange}
            > ${name}</label></div>`
        })
    }

    renderExternalLink() {
        const link = this.changedState.external_link;
        const reviewType = this.reviewInfo.type;
        const linklabel = reviewType === 'mechanics' || reviewType === 'electronics' ?
            'Issues link: ' : 'Merge request link: ';

        if (!this.isInstructorSession) {
            return html`<div><b>${linklabel}</b><a href=${link}>${link}</a></div>`;
        }

        return html`<div><b>${linklabel}</b><input 
                type="text" 
                name="external_link" 
                .value=${link}
                @keyup="${this.handleExternalLinkChange}"></div>`
    }

    renderError() {
        if (!this.error) {
            return null;
        }

        return html`<div class="error">${this.error}</div>`;
    }
}

customElements.define('review-details', Review);

(async function () {
    const mainElement = document.getElementById('main');

    let session = null;

    let reviewId = null;

    const urlPathMatch = location.pathname.match(/review\/([0-9]+)/);

    if (urlPathMatch && urlPathMatch.length === 2) {
        reviewId = parseInt(urlPathMatch[1], 10);
    }

    async function fetchSession() {
        try {
            session = await getSession();
        } catch (e) {
            session = null;
        }
    }

    async function handleLoginChanged() {
        await fetchSession();
        renderContent();
    }

    function renderContent() {
        render(html`
            <default-page-header
                    title="Review"
                    .session=${session}
                    @login-changed=${handleLoginChanged}
                    .links=${[]}
                    .privateLinks=${[['/review/request', 'New'], ['/review/list', 'List']]}
            ></default-page-header>
            <div class="page-content">
                ${renderPageContent()}
            </div>`,
            mainElement);
    }

    function renderPageContent() {
        if (!session) {
            return null;
        }

        return html`<review-details 
                .reviewId="${reviewId}"
                .session=${session}
            ></review-details>`;
    }

    await fetchSession();

    renderContent();
})();
