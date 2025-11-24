// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { a, collection, div, span, svg } from "chili-controls";
import { CommandKeys, I18n, IView, Localize, PubSub, Binding, IConverter, Result } from "chili-core";
import { QuickButton, RibbonDataContent } from "../ribbon";
import style from "./toolbar.module.css";

class ViewActiveConverter implements IConverter<IView> {
    constructor(
        readonly target: IView,
        readonly style: string,
        readonly activeStyle: string,
    ) {}

    convert(value: IView): Result<string> {
        return Result.ok(this.target === value ? `${this.style} ${this.activeStyle}` : this.style);
    }
}

export class Toolbar extends HTMLElement {
    constructor(
        readonly dataContent: RibbonDataContent,
        readonly quickCommands: CommandKeys[],
    ) {
        super();
        this.className = style.root;
        this.append(this.leftPanel(), this.centerPanel(), this.rightPanel());
    }

    private leftPanel() {
        return div(
            { className: style.left },
            div(
                { className: style.appIcon, onclick: () => PubSub.default.pub("displayHome", true) },
                svg({ className: style.icon, icon: "icon-chili" }),
                span({ id: "appName", textContent: `Chili3D - v${__APP_VERSION__}` }),
            ),
            div(
                { className: style.quickPanel },
                svg({
                    className: style.home,
                    icon: "icon-home",
                    onclick: () => PubSub.default.pub("displayHome", true),
                }),
                collection({
                    className: style.quickCommands,
                    sources: this.quickCommands,
                    template: (command: CommandKeys) => QuickButton(command as any),
                }),
            ),
        );
    }

    private centerPanel() {
        return div(
            { className: style.center },
            collection({
                className: style.views,
                sources: this.dataContent.app.views,
                template: (view) => this.createViewItem(view),
            }),
            svg({
                className: style.new,
                icon: "icon-plus",
                title: I18n.translate("command.doc.new"),
                onclick: () => PubSub.default.pub("executeCommand", "doc.new"),
            }),
        );
    }

    private createViewItem(view: IView) {
        return div(
            {
                className: new Binding(
                    this.dataContent,
                    "activeView",
                    new ViewActiveConverter(view, style.tab, style.active),
                ),
                onclick: () => {
                    this.dataContent.app.activeView = view;
                },
            },
            div({ className: style.name }, span({ textContent: new Binding(view.document, "name") })),
            svg({
                className: style.close,
                icon: "icon-times",
                onclick: (e) => {
                    e.stopPropagation();
                    view.close();
                },
            }),
        );
    }

    private rightPanel() {
        return div(
            { className: style.right },
            a(
                { href: "https://github.com/xiangechen/chili3d", target: "_blank" },
                svg({ title: "Github", className: style.icon, icon: "icon-github" }),
            ),
        );
    }
}

customElements.define("chili-toolbar", Toolbar);
