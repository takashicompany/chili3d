// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { button, input, label } from "chili-controls";
import { Binding, Config, I18nKeys, Localize, PubSub } from "chili-core";
import style from "./ribbonCheckboxWithInput.module.css";

export class RibbonCheckboxWithInput extends HTMLElement {
    private checkbox: HTMLInputElement;
    private numberInput: HTMLInputElement;
    private applyButton: HTMLButtonElement;
    private container: HTMLDivElement;

    constructor(
        display: I18nKeys,
        private checkboxBinding: Binding,
        private numberBinding: Binding,
    ) {
        super();
        this.className = style.container;

        // Create checkbox
        this.checkbox = document.createElement("input");
        this.checkbox.type = "checkbox";
        this.checkbox.className = style.checkbox;

        // Create label
        const labelElement = label({
            className: style.label,
            textContent: new Localize(display),
        });

        // Create number input
        this.numberInput = input({
            className: style.numberInput,
            type: "number",
            step: "0.1",
            min: "0.1",
            onkeydown: (e: KeyboardEvent) => {
                e.stopPropagation();
            },
        });
        // Set initial value manually
        this.numberInput.value = Config.instance.normalLength.toString();

        // Create apply button
        this.applyButton = button({
            className: style.applyButton,
            textContent: "✓",
        });

        // Create container
        this.container = document.createElement("div");
        this.container.className = style.inputContainer;

        // Create number input container
        const numberContainer = document.createElement("div");
        numberContainer.className = style.numberContainer;
        numberContainer.append(this.numberInput, this.applyButton);

        // Assemble
        this.container.append(this.checkbox, labelElement);
        this.append(this.container, numberContainer);

        // Bind checkbox
        checkboxBinding.setBinding(this.checkbox, "checked");
        numberContainer.style.display = this.checkbox.checked ? "flex" : "none";
        this.checkbox.addEventListener("change", () => {
            numberContainer.style.display = this.checkbox.checked ? "flex" : "none";
            // Update Config value (Binding is one-way, so we need to update manually)
            (this.checkboxBinding as any).source[(this.checkboxBinding as any).path] = this.checkbox.checked;
            // Trigger update when checkbox changes
            this.triggerUpdate();
        });

        // Apply button click handler
        this.applyButton.addEventListener("click", () => {
            const value = parseFloat(this.numberInput.value);
            if (!isNaN(value) && value > 0) {
                // Update Config value
                (this.numberBinding as any).source[(this.numberBinding as any).path] = value;
                // Trigger update when value changes
                this.triggerUpdate();
            }
        });
    }

    private triggerUpdate() {
        // Dispatch custom event for update
        this.dispatchEvent(new CustomEvent("normalDisplayUpdate"));
    }

    static forShowFaceNormals() {
        const component = new RibbonCheckboxWithInput(
            "command.modify.showFaceNormals",
            new Binding(Config.instance, "showFaceNormals"),
            new Binding(Config.instance, "normalLength"),
        );

        // Listen for updates and trigger face normals redraw
        component.addEventListener("normalDisplayUpdate", () => {
            PubSub.default.pub("updateFaceNormals");
        });

        return component;
    }
}

customElements.define("ribbon-checkbox-with-input", RibbonCheckboxWithInput);
