import {LitElement, html} from "../lib/lit-element.mjs";

class PageHeader extends LitElement {
    static get properties() {
        return {
            session: {type: Object},
            links: {type: Array}
        };
    }

    createRenderRoot() {
        return this;
    }

    render() {
        return html`<span>
            <span class="title">${this.getAttribute('title')}</span>
            <span>${this.links.map(l => this.renderLink(l))}</span>
            </span>
            ${this.renderUser()}`;
    }

    renderLink(link) {
        const [url, name] = link;

        return html`<a href=${url}>${name}</a>`;
    }

    renderUser() {
        if (this.session) {
            const name = this.session && this.session.name;

            return html`<span><a>${name}</a><a href="/logout">Log Out</a></span>`;
        }

        return html`<span><a href="/login">Log In</a></span>`;
    }
}

customElements.define('page-header', PageHeader);