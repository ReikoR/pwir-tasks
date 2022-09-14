import {LitElement, html} from "../lib/lit.mjs";
import './page-header.js';
import {getSession} from "../services/api.js";

class DefaultPageHeader extends LitElement {
    constructor() {
        super();

        this.links = [['/', 'Home'], ['/tasks-table', 'Tasks table']];
        this.privateLinks = [['/participants', 'Participants']];
    }

    static get properties() {
        return {
            session: {type: Object},
            links: {type: Array}
        };
    }

    createRenderRoot() {
        return this;
    }

    async fetchSession() {
        try {
            this.session = await getSession();
        } catch (e) {
            this.session = null;
        }
    }

    firstUpdated(changedProperties) {
        const isSessionSetByParent = changedProperties.has('session');

        if (!isSessionSetByParent && !this.session) {
            this.fetchSession();
        }
    }

    dispatchLogInChangedEvent() {
        let event = new CustomEvent('login-changed');

        this.dispatchEvent(event);
    }

    handleLoginChanged() {
        this.fetchSession();

        this.dispatchLogInChangedEvent();
    }

    render() {
        const title = this.getAttribute('title');

        let links = this.links.slice();

        if (this.session) {
            links = links.concat(this.privateLinks);
        }

        links = links.filter(l => l[1] !== title);

        return html`<page-header 
            .session=${this.session} 
            title=${title} 
            .links=${links}
            @login-changed=${this.handleLoginChanged}
        ></page-header>`;
    }
}

customElements.define('default-page-header', DefaultPageHeader);
