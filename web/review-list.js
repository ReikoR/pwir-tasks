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
        this.total = 0;
        this.offset = 0;
        this.limit = 50;

        this.areFiltersVisible = false;

        this.filters = {
            types: {
                options: ['software', 'mechanics', 'electronics', 'firmware', 'documentation'],
                inputs: {},
            },
            statuses: {
                options: ['new', 'in_review', 'changes_needed', 'changes_completed', 'approved', 'rejected'],
                inputs: {},
            }
        }
    }

    static get properties() {
        return {
            reviewList: {type: Array},
            session: {type: Object},
            offset: {type: Number},
            limit: {type: Number},
            areFiltersVisible: {type: Boolean},
        };
    }

    createRenderRoot() {
        return this;
    }

    connectedCallback() {
        super.connectedCallback();

        const url = new URL(location);

        const pageParam = url.searchParams.get('page');
        const page = parseInt(pageParam, 10);

        if (page > 0) {
            this.offset = (page - 1) * this.limit;
        }

        for (const [filterName, filterParams] of Object.entries(this.filters)) {
            const values = url.searchParams.get(filterName)?.split('-');

            if (Array.isArray(values) && values.length > 0) {
                for (const value of values) {
                    filterParams.inputs[value] = true;
                }
            }
        }

        this.popStateHandler = this.handlePopState.bind(this);
        window.addEventListener('popstate', this.popStateHandler);
    }

    disconnectedCallback() {
        super.disconnectedCallback();

        window.removeEventListener('popstate', this.popStateHandler);
    }

    handlePopState(event) {
        if (event.state) {
            if (Number.isInteger(event.state.page) && event.state.page > 0) {
                this.offset = (event.state.page - 1) * this.limit;
            }

            for (const [filterName, filterParams] of Object.entries(this.filters)) {
                filterParams.inputs = {};

                if (Array.isArray(event.state[filterName])) {
                    for (const value of event.state[filterName]) {
                        filterParams.inputs[value] = true;
                    }
                }
            }

            this.fetchReviewList();
        }
    }

    firstUpdated(changedProperties) {
        if (changedProperties.has('session')) {
            this.isInstructorSession = this.session?.role === 'instructor' ?? false;
        }

        if (changedProperties.has('offset')) {
            const [state, url] = this.getNewStateAndUrl();

            history.replaceState(state, "", url);
        }
    }

    getCurrentPageNumber() {
        return Math.floor(this.offset / this.limit) + 1;
    }

    getSelectedFilterOptions(filterName) {
        const selectedOptions  = [];

        for (const option of this.filters[filterName].options) {
            if (this.filters[filterName].inputs[option]) {
                selectedOptions.push(option);
            }
        }

        return selectedOptions;
    }

    getNewUrl(pageNumber) {
        const url = new URL(location);

        url.searchParams.set('page', pageNumber);

        return url;
    }

    getNewStateAndUrl() {
        const pageNumber = this.getCurrentPageNumber();
        const url = this.getNewUrl(pageNumber);
        const state = {page: pageNumber};

        for (const filterName of Object.keys(this.filters)) {
            const selectedOptions = this.getSelectedFilterOptions(filterName);

            if (selectedOptions.length > 0) {
                state[filterName] = selectedOptions;
                url.searchParams.set(filterName, selectedOptions.join('-'));
            } else {
                url.searchParams.delete(filterName);
            }
        }

        return [state, url];
    }

    async fetchReviewList() {
        const params = {
            limit: this.limit,
            offset: this.offset,
        }

        for (const filterName of Object.keys(this.filters)) {
            params[filterName] = this.getSelectedFilterOptions(filterName);
        }

        const listQueryResult = await getReviewList(params);

        this.total = listQueryResult.total;
        this.reviewList = listQueryResult.rows;

        deepFreeze(this.reviewList);
    }

    handlePageChange(pageIndex) {
        this.offset = pageIndex * this.limit;

        const [state, url] = this.getNewStateAndUrl();
        history.pushState(state, "", url);

        this.fetchReviewList();
    }

    handleToggleFiltersVisibility() {
        this.areFiltersVisible = !this.areFiltersVisible;
    }

    handleApplyFilters() {
        const [state, url] = this.getNewStateAndUrl();
        history.pushState(state, "", url);

        this.fetchReviewList();
    }

    handleFilterChange(event) {
        const input = event.currentTarget;
        this.filters[input.name].inputs[input.value] = input.checked;
    }

    render() {
        if (!this.reviewList) {
            this.fetchReviewList();
            return html`<div>Loading...</div>`;
        }

        return html`<div>
            ${this.renderFilters()}
            ${this.renderTable(this.reviewList)}
            ${this.renderPagination()}
        </div>`;
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

    renderPagination() {
        const pageCount = Math.ceil(this.total / this.limit);
        const currentPageIndex = Math.floor(this.offset / this.limit);

        const pageNumbers = [];

        for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
            pageNumbers.push(html`<button
                    @click=${this.handlePageChange.bind(this, pageIndex)}
                    ?disabled=${pageIndex === currentPageIndex}
            >${pageIndex + 1}</button>`);
        }

        return html`<div class="pagination"><span>Page:</span>${pageNumbers}</div>`;
    }

    renderFilters() {
        if (!this.areFiltersVisible) {
            return html`<div class="filters">
                <div>
                <button @click=${this.handleToggleFiltersVisibility}>Show Filters</button>
                </div>
            </div>`;
        }

        return html`<div class="filters">
            <div>
            <button @click=${this.handleToggleFiltersVisibility}>Hide Filters</button>
            <button @click=${this.handleApplyFilters}>Apply Filters</button>
            </div>
            ${Object.entries(this.filters).map(([name, params]) => this.renderFilter(name, params))}
        </div>`;
    }

    renderFilter(name, params) {
        return html`<div><b>${name}</b>
            ${params.options.map(option => {
                const isSelected = params.inputs[option];
                
                return html`<label><input
                        type=checkbox
                        name=${name}
                        .checked=${isSelected}
                        value=${option}
                        @change=${this.handleFilterChange}
                > ${option}</label>`;
            })}
        </div>`;
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
