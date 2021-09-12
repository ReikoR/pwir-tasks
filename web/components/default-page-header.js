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
        } catch (e) {}
    }

    firstUpdated(changedProperties) {
        const isSessionSetByParent = changedProperties.has('session');

        if (!isSessionSetByParent && !this.session) {
            this.fetchSession();
        }
    }

    render() {
        let links = this.links.filter(l => l[0] !== location.pathname);

        if (this.session) {
            links = links.concat(this.privateLinks);
        }

        return html`<page-header .session=${this.session} title=${this.getAttribute('title')} .links=${links}></page-header>`;
    }
}

customElements.define('default-page-header', DefaultPageHeader);
