import {html, render, LitElement} from "./lib/lit.mjs";
import {getReviewList, getSession} from "./services/api.js";
import './components/default-page-header.js';
import './components/participant-select.js';
import {DateTime} from "./lib/luxon.mjs";
import {deepFreeze} from "./util.js";

class ReviewList extends LitElement {
    constructor() {
        super();

        this.reviewList = null;
    }

    static get properties() {
        return {
            reviewList: {type: Array},
        };
    }

    createRenderRoot() {
        return this;
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
        const relativeUpdateTime = updatedDT.toRelative({locale: 'en', round: false});
        const relativeRequestTime = requestDT.toRelative({locale: 'en', round: false});
        const lastUpdated = `${updatedDT.toFormat('yyyy-MM-dd TT')} (${relativeUpdateTime})`;
        const requestTime = `${requestDT.toFormat('yyyy-MM-dd TT')} (${relativeRequestTime})`;
        const externalLinkName = listRow.type === 'mechanics' || listRow.type === 'electronics'
            ? 'Issues' : 'Merge request';

        return html`<tr>
            <td><a href=${reviewLink}>Open</a></td>
            <td>${listRow.team.name}</td>
            <td>${listRow.type}</td>
            <td><a href=${listRow.external_link}>${externalLinkName}</a></td>
            <td><ul>${listRow.tasks?.map(t => html`<li>${t.name}</li>`)}</ul></td>
            <td>${listRow.requester.name}</td>
            <td>${listRow.status}</td>
            <td>${reviewers?.map(r => html`<li>${r.name}</li>`)}</td>
            <td>${lastUpdated}</td>
            <td>${requestTime}</td>
        </tr>`;
    }
}

customElements.define('review-list', ReviewList);

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
                    title="List"
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

        return html`<review-list></review-list>`;
    }

    await fetchSession();

    renderContent();
})();
