import {html, render} from './lib/lit.mjs';

const mainElement = document.getElementById('main');

(async function () {
    let isSuccess = false;
    let isSending = false;
    let error = null;

    async function createAccount(username, password) {
        const queryStringMatch = location.search.match(/y=([\w-]+)/);

        if (!queryStringMatch || queryStringMatch.length !== 2) {
            throw 'Invalid token';
        }

        const token = queryStringMatch[1];

        return await fetch('/cafi', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({token, username, password})
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

    async function handleCreateAccount(event) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const username = data.get('username');
        const password = data.get('password');

        isSending = true;
        error = null;
        renderMain();

        try {
            await createAccount(username, password);
            isSuccess = true;
        } catch (e) {
            error = 'Failed';
        }

        isSending = false;

        renderMain();
    }

    function renderMain() {
        if (isSuccess) {
            render(html`<div>Account created</div>`, mainElement);
            return;
        }

        if (isSending) {
            render(html`<div>Creating account</div>`, mainElement);
            return;
        }

        render(html`<div>
                <form @submit="${handleCreateAccount}">
                    <input type="text" name="username" placeholder="Username" autofocus>
                    <input type="password" name="password" placeholder="Password">
                    <button type="submit">Create account</button>
                </form>
                ${renderError()}
                </div>`,
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