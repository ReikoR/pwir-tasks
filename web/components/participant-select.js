import {html, LitElement} from "../lib/lit.mjs";

export class ParticipantSelect extends LitElement {
    constructor() {
        super();

        this.options = [];
    }

    static get properties() {
        return {
            options: {type: Array},
        };
    }

    createRenderRoot() {
        return this;
    }

    render() {
        return html`<select>${this.options.map(option => this.renderParticipantOption(option))}</select>`;
    }

    renderParticipantOption(option) {
        return html`<option class=${option.className} .selected="${option.selected}" .value="${option.value}">
            ${option.text}</option>`;
    }
}

customElements.define('participant-select', ParticipantSelect);