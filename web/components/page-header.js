import {define, html} from '../lib/heresy.mjs';

const _session = new WeakMap();
const _links = new WeakMap();

class PageHeader extends HTMLDivElement {
    get session() {
        return _session.get(this);
    }

    set session(session) {
        _session.set(this, session);
        this.render();
    }

    get links() {
        return _links.get(this) || [];
    }

    set links(links) {
        _links.set(this, links);
        this.render();
    }

    render() {
        this.html`<span>
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

define('PageHeader:div', PageHeader);