import {LitElement, html, classMap} from "../lib/lit.mjs";
import {login, logout} from "../services/api.js";

class PageHeader extends LitElement {
    constructor() {
        super();

        this.isSuccess = false;
        this.isSending = false;
        this.error = null;
    }

    static get properties() {
        return {
            session: {type: Object},
            links: {type: Array},
            isSuccess: {type: Boolean},
            isSending: {type: Boolean},
            error: {type: String},
        };
    }

    createRenderRoot() {
        return this;
    }

    dispatchLogInChangedEvent() {
        let event = new CustomEvent('login-changed');

        this.dispatchEvent(event);
    }

    async handleLogout() {
        await logout();

        this.error = null;

        this.dispatchLogInChangedEvent();
    }

    async handleLogin(event) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const username = data.get('username');
        const password = data.get('password');

        this.isSending = true;
        this.error = null;

        try {
            await login(username, password);
            this.isSuccess = true;
        } catch (e) {
            this.error = 'Failed';
        }

        this.isSending = false;

        this.dispatchLogInChangedEvent();
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

    renderLogin() {
        const classes = classMap({
            user: true,
            error: this.error !== null,
        });

        return html`<form class=${classes} @submit="${this.handleLogin}">
                <input type="text" name="username" placeholder="Username" ?disabled=${this.isSending} autofocus>
                <input type="password" name="password" placeholder="Password" ?disabled=${this.isSending}>
                <button type="submit">Log In</button>
            </form>`;
    }

    renderUser() {
        if (this.session) {
            const name = this.session && this.session.name;

            return html`<span class="user">
                    <a>${name}</a>
                    <button @click=${this.handleLogout}>Log Out</button>
                </span>`;
        }

        return html`${this.renderLogin()}`;
    }
}

customElements.define('page-header', PageHeader);