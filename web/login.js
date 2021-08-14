import {html, render} from './lib/lit.mjs';

const mainElement = document.getElementById('main');

(async function () {
    let isSuccess = false;
    let isSending = false;
    let error = null;
    let email = null;

    async function login(email) {
        return await fetch('/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({email})
        }).then(async (response) => {
            if (response.ok) {
                return response.statusText;
            }

            throw response.statusText;
        }).catch((errorInfo) => {
            console.log(errorInfo);
            throw errorInfo;
        });
    }

    async function handleLogin(event) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        email = data.get('email');

        isSending = true;
        error = null;
        renderMain();

        try {
            await login(email);
            isSuccess = true;
        } catch (e) {
            error = 'Failed';
        }

        isSending = false;

        renderMain();
    }

    function renderMain() {
        if (isSuccess) {
            render(html`<div>E-mail sent</div>`, mainElement);
            return;
        }

        if (isSending) {
            render(html`<div>Sending e-mail to ${email}</div>`, mainElement);
            return;
        }

        render( html`<div>            
            <form @submit="${handleLogin}">
            <input type="email" name="email" placeholder="E-mail" .value=${email} autofocus>
            <button type="submit">Send login link</button>
            </form>
            ${renderError()}</div>`,
            mainElement);
    }

    function renderError() {
        if (!error) {
            return null;
        }

        return html`<div class="error">${error}</div>`;
    }

    renderMain();
})();
