import {html, render, LitElement, classMap} from "./lib/lit.mjs";
import {getReviewList, getSession} from "./services/api.js";
import './components/default-page-header.js';
import './components/participant-select.js';
import {DateTime} from "./lib/luxon.mjs";
import {deepFreeze} from "./util.js";

class ReviewList extends LitElement {
    constructor() {
        super();

        this.reviewList = null;
        this.session = null;
        this.isInstructorSession = false;
    }

    static get properties() {
        return {
            reviewList: {type: Array},
            session: {type: Object},
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

    async fetchReviewList() {
        this.reviewList = await getReviewList();
        deepFreeze(this.reviewList);
        console.log(this.reviewList);
    }

    render() {
        if (!this.reviewList) {
            this.fetchReviewList();
            return html`<div>Loading...</div>`;
        }

        return this.renderTable(this.reviewList);
    }

    renderTable(list) {
        return html`<table>
            <thead>
            <tr>
                <th></th>
                <th>Team</th>
                <th>Type</th>
                <th>Link</th>
                <th>Tasks</th>
                <th>Requester</th>
                <th>Status</th>
                <th>Reviewers</th>
                <th>Last updated time</th>
                <th>Request time</th>
            </tr>
            </thead>
            <tbody>
                ${list.map(r => this.renderTableRow(r))}
            </tbody>
        </table>`;
    }

    renderTableRow(listRow) {
        const reviewLink = '/review/' + listRow.review_id;
        const reviewers = listRow.reviewers || [];
        const updatedDT = DateTime.fromISO(listRow.last_updated_time);
        const requestDT = DateTime.fromISO(listRow.request_time);
        const relativeTimeOptions = {locale: 'en', rounding: 'round', style: 'short'};
        const relativeUpdateTime = updatedDT.toRelative(relativeTimeOptions);
        const relativeRequestTime = requestDT.toRelative(relativeTimeOptions);
        const lastUpdated = `${updatedDT.toFormat('yyyy-MM-dd T')} (${relativeUpdateTime})`;
        const requestTime = `${requestDT.toFormat('yyyy-MM-dd T')} (${relativeRequestTime})`;
        const externalLinkName = listRow.type === 'mechanics' || listRow.type === 'electronics'
            ? 'Issues' : 'Merge request';
        const isReviewer = !!reviewers?.find(r => r.participant_id === this.session.participant_id);
        const isRequester = listRow.requester.participant_id === this.session.participant_id;
        const isTeamMember = listRow.team.team_id === this.session.team?.team_id;

        const rowClasses = classMap({
            completed: listRow.status === 'approved' || listRow.status === 'rejected',
            'changes-needed': listRow.status === 'changes_needed',
        });

        const teamClasses = classMap({
            'participant-highlight': isTeamMember
        });

        const requesterClasses = classMap({
            'participant-highlight': isRequester
        });

        const reviewerClasses = classMap({
            'participant-highlight': isReviewer,
        });

        return html`<tr class=${rowClasses}>
            <td><a href=${reviewLink}>Open</a></td>
            <td class=${teamClasses}>${listRow.team.name}</td>
            <td>${listRow.type}</td>
            <td><a href=${listRow.external_link}>${externalLinkName}</a></td>
            <td><ul>${listRow.tasks?.map(t => html`<li>${t.name}</li>`)}</ul></td>
            <td class=${requesterClasses}>${listRow.requester.name}</td>
            <td>${listRow.status}</td>
            <td class=${reviewerClasses}><ul>${reviewers?.map(this.renderReviewer)}</ul></td>
            <td>${lastUpdated}</td>
            <td>${requestTime}</td>
        </tr>`;
    }

    renderReviewer(reviewer) {
        if (reviewer.is_active) {
            return html`<li class="active-reviewer">${reviewer.name}</li>`;
        }

        return html`<li>${reviewer.name}</li>`;
    }
}

customElements.define('review-list', ReviewList);

(async function () {
    const mainElement = document.getElementById('main');

    let session = null;

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
                    title="Review list"
                    .session=${session}
                    @login-changed=${handleLoginChanged}
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

        return html`<review-list .session=${session}></review-list>`;
    }

    await fetchSession();

    renderContent();
})();
