import {html, render, LitElement} from "./lib/lit.mjs";
import {createReview, getReviewInputInfo, getSession} from "./services/api.js";
import './components/default-page-header.js';
import './components/participant-select.js';
import {DateTime} from "./lib/luxon.mjs";
import {deepFreeze, getReviewTasksInfoByType} from "./util.js";

class ReviewRequest extends LitElement {
    constructor() {
        super();

        this.inputInfo = null;
        this.isInstructorSession = false;
        this.isFilled = false;
        this.isSuccess = false;
        this.isSending = false;
        this.error = null;

        this.team_id = null;
        this.requester_id = null;
        this.review_type = null;
        this.task_ids = null;
        this.external_link = null;

        this.review_id = null;

        this.teamInfo = null;
        this.teamNameId = null;
        this.mergeRequestNumber = null;
    }

    static get properties() {
        return {
            inputInfo: {type: Array},
            isInstructorSession: {type: Boolean},
            isFilled: {type: Boolean},
            isSuccess: {type: Boolean},
            isSending: {type: Boolean},
            error: {type: String},
            team_id: {type: Number},
            requester_id: {type: Number},
            review_type: {type: Number},
            task_ids: {type: Number},
            external_link: {type: String},
            review_id: {type: Number},
            mergeRequestNumber: {type: Number},
        };
    }

    createRenderRoot() {
        return this;
    }

    async fetchInputInfo() {
        this.inputInfo = await getReviewInputInfo();
        deepFreeze(this.inputInfo);
        console.log(this.inputInfo);

        if (!this.isInstructorSession) {
            const teamInfo = this.inputInfo.teams.find(t =>
                t.members.find(m => m.participant_id === this.requester_id) !== undefined);

            if (teamInfo) {
                this.team_id = teamInfo.team_id;
            }
        }

        this.updateSelectedTeamInfo();
    }

    updateSelectedTeamInfo() {
        this.teamInfo = this.inputInfo.teams.find(t => t.team_id === this.team_id);
        this.teamNameId = this.teamInfo?.name_id ?? 'TEAM-NAME';

        this.updateExternalLink();
    }

    updateExternalLink() {
        const yearString = (new Date()).getFullYear().toString();
        const shortYearString = yearString.slice(2);
        const urlStart = `https://gitlab.ut.ee/loti/loti.05.023/picr${yearString}/picr${shortYearString}-team-`;

        if (this.isIssuesLinkNeeded()) {
            this.external_link = `${urlStart}${this.teamNameId}/-/issues/?label_name%5B%5D=${this.review_type}`;
        } else {
            this.external_link = `${urlStart}${this.teamNameId}/-/merge_requests/${this.mergeRequestNumber ?? 'MERGE_REQUEST_NUMBER'}`;
        }
    }

    isIssuesLinkNeeded() {
        return this.review_type === 'mechanics' || this.review_type === 'electronics';
    }

    async handleCreateReview(event) {
        event.preventDefault();

        this.isSending = true;
        this.error = null;

        try {
            const createdReviewInfo= await createReview({
                team_id: this.team_id,
                requester_id: this.requester_id,
                type: this.review_type,
                task_ids: this.task_ids,
                external_link: this.external_link,
            });

            console.log(createdReviewInfo);

            this.review_id = createdReviewInfo.review_id;
            this.isSuccess = true;
        } catch (e) {
            this.error = 'Failed';
        }

        this.isSending = false;
    }

    handleTeamChange(event) {
        const data = new FormData(event.currentTarget.form);
        this.team_id = parseInt(data.get('team'), 10);
        this.requester_id = null;

        this.updateSelectedTeamInfo();

        this.checkFormData();
    }

    handleRequesterChange(event) {
        const data = new FormData(event.currentTarget.form);
        this.requester_id = parseInt(data.get('requester'), 10);

        this.checkFormData();
    }

    handleTypeChange(event) {
        const data = new FormData(event.currentTarget.form);
        this.review_type = data.get('type');
        this.task_ids = null;

        this.updateExternalLink();

        this.checkFormData();
    }

    handleTaskChange(event) {
        const data = new FormData(event.currentTarget.form);
        this.task_ids = data.getAll('task').map(s => parseInt(s, 10));

        this.checkFormData();
    }

    handleMergeRequestNumberChange(event) {
        this.mergeRequestNumber = parseInt(event.currentTarget.value, 10);

        if (!this.isMergeRequestNumberValid()) {
            this.mergeRequestNumber = null;
        }

        this.updateExternalLink();

        this.checkFormData();
    }

    checkFormData() {
        console.log(this.team_id, this.requester_id, this.review_type, this.task_ids, this.external_link);

        this.isFilled =
            this.team_id !== null
            && this.requester_id !== null
            && this.review_type !== null
            && Array.isArray(this.task_ids) && this.task_ids.length > 0
            && (this.isIssuesLinkNeeded() ? true : this.isMergeRequestNumberValid());
    }

    isMergeRequestNumberValid() {
        return typeof Number.isInteger(this.mergeRequestNumber) && this.mergeRequestNumber > 0;
    }

    render() {
        if (!this.inputInfo) {
            this.fetchInputInfo();
            return html`<div>Loading...</div>`;
        }

        if (this.isSuccess) {
            const reviewLink = '/review/' + this.review_id;

            return html`<div>
                    <span>Review request created: <span>
                    <a href=${reviewLink}>Open</a>
                </div>`;
        }

        return html`${this.renderForm()}
            ${this.renderMessage()}`;
    }

    renderMessage() {
        if (this.isSending) {
            return html`<div>Creating review request</div>`;
        }

        return html`${this.renderError()}`;
    }

    renderForm() {
        return html`<form @submit=${this.handleCreateReview}>
                ${this.renderTeamSelector()}
                ${this.renderRequesterSelector()}
                ${this.renderReviewTypeSelector()}
                ${this.renderTaskSelector()}
                ${this.renderExternalLink()}
                <button type="submit" ?disabled=${!this.isFilled}>Request review</button>
            </form>`;
    }

    renderTeamSelector() {
        if (!this.isInstructorSession) {
            const teamInfo = this.inputInfo.teams.find(t => t.team_id === this.team_id);

            return html`<div><b>Team:</b><span> ${teamInfo.name}</span></div>`;
        }

        return html`<fieldset>
            <legend><b>Team:</b></legend>
            ${this.inputInfo.teams.map(t => 
                    html`<div><label><input 
                            type=radio 
                            name=team 
                            value=${t.team_id}
                            @change="${this.handleTeamChange}"
                    > ${t.name}</label></div>`)}
        </fieldset>`;
    }

    renderRequesterSelector() {
        if (!this.isInstructorSession) {
            const teamInfo = this.inputInfo.teams.find(t => t.team_id === this.team_id);
            const requesterInfo = teamInfo.members.find(m => m.participant_id === this.requester_id);

            return html`<div><b>Requester:</b><span> ${requesterInfo.name}</span></div>`;
        }

        return html`<fieldset>
            <legend><b>Requester:</b></legend>
            ${this.renderRequesterOptions()}
        </fieldset>`;
    }

    renderRequesterOptions() {
        if (!this.team_id) {
            return html`<div>Select team first</div>`;
        }

        const teamInfo = this.inputInfo.teams.find(t => t.team_id === this.team_id);

        return teamInfo.members.map(m =>
            html`<div><label><input 
                    type=radio 
                    name=requester
                    .checked=${m.participant_id === this.requester_id}
                    value=${m.participant_id}
                    @change=${this.handleRequesterChange}
            > ${m.name}</label></div>`)
    }

    renderReviewTypeSelector() {
        const reviewTypes = ['software', 'mechanics', 'electronics', 'firmware', 'documentation'];

        return html`<fieldset>
            <legend><b>Review type:</b></legend>
            ${reviewTypes.map(t => 
                    html`<div><label><input 
                            type=radio 
                            name=type 
                            value=${t}
                            @change=${this.handleTypeChange}
                    > ${t}</label></div>`)}
        </fieldset>`;
    }

    renderTaskSelector() {
        return html`<fieldset>
            <legend><b>Tasks:</b></legend>
            ${this.renderTaskOptions()}
        </fieldset>`;
    }

    renderTaskOptions() {
        if (!this.review_type) {
            return html`<div>Select review type first</div>`;
        }

        const tasksInfo = getReviewTasksInfoByType(this.inputInfo, this.review_type);

        return tasksInfo.map(t => {
            const isDone = Array.isArray(t.completed_by_team_ids) && t.completed_by_team_ids.includes(this.team_id);
            const name = `${isDone ? '[Done] ' : ''}${t.name}`;
            const isSelected = Array.isArray(this.task_ids) && this.task_ids.includes(t.task_id);

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
        if (!this.review_type) {
            return null;
        }

        if (this.isIssuesLinkNeeded()) {
            return html`<div class="external-link-group">
                <b>Issues link:</b>
                <div>
                    <span>${this.external_link}</span>
                </div>
                </div>`;
        }

        return html`<div class="external-link-group">
            <b>Merge request link:</b>
            <div>
                <span>${this.external_link}</span>
            </div>
            <label>Merge request number  <input 
                type="number" 
                min="1" 
                .value=${this.mergeRequestNumber} 
                @input=${this.handleMergeRequestNumberChange}>
            </label>
            </div>`;
    }

    renderError() {
        if (!this.error) {
            return null;
        }

        return html`<div class="error">${this.error}</div>`;
    }
}

customElements.define('review-request', ReviewRequest);

(async function () {
    const mainElement = document.getElementById('main');

    let session = null;
    let isInstructorSession = false;

    async function fetchSession() {
        try {
            session = await getSession();
            isInstructorSession = session.role === 'instructor';
        } catch (e) {
            session = null;
            isInstructorSession = false;
        }
    }

    async function handleLoginChanged() {
        await fetchSession();
        renderContent();
    }

    function renderContent() {
        render(html`
            <default-page-header
                    title="New"
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

        return html`<review-request 
                .isInstructorSession=${isInstructorSession}
                .requester_id=${!isInstructorSession ? session.participant_id : null}
            ></review-request>`;
    }

    await fetchSession();

    renderContent();
})();
