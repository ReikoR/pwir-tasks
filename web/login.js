import {html, render, ref} from './lib/heresy.mjs';

const mainElement = document.getElementById('main');

(async function () {
    let isSuccess = false;
    let isSending = false;
    let error = null;
    let email = null;
    let inputRef = ref();

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
            render(mainElement, html`<div>E-mail sent</div>`);
            return;
        }

        if (isSending) {
            render(mainElement, html`<div>Sending e-mail to ${email}</div>`);
            return;
        }

        render(mainElement, html`<div>            
            <form onsubmit="${handleLogin}">
            <input ref=${inputRef} type="email" name="email" placeholder="E-mail" value=${email}>
            <button type="submit">Send login link</button>
            </form>
            ${renderError()}</div>`);

        if (inputRef.current) {
            inputRef.current.focus();
        }
    }

    function renderError() {
        if (!error) {
            return null;
        }

        return html`<div class="error">${error}</div>`;
    }

    renderMain();
})();
