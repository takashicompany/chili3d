// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { collection, div, label, span, svg } from "chili-controls";
import {
    Binding,
    ButtonSize,
    Command,
    CommandKeys,
    IApplication,
    ICommand,
    IConverter,
    IView,
    Localize,
    Logger,
    Observable,
    ObservableCollection,
    PubSub,
    Result,
} from "chili-core";
import { CommandContext } from "./commandContext";
import style from "./ribbon.module.css";
import { RibbonButton } from "./ribbonButton";
import { RibbonCheckboxWithInput } from "./ribbonCheckboxWithInput";
import { RibbonCommandData, RibbonGroupData, RibbonTabData } from "./ribbonData";
import { RibbonStack } from "./ribbonStack";

export class RibbonDataContent extends Observable {
    readonly quickCommands = new ObservableCollection<CommandKeys>();
    readonly ribbonTabs = new ObservableCollection<RibbonTabData>();
    private _activeTab: RibbonTabData;
    private _activeView: IView | undefined;

    constructor(
        readonly app: IApplication,
        quickCommands: CommandKeys[],
        ribbonTabs: RibbonTabData[],
    ) {
        super();
        this.quickCommands.push(...quickCommands);
        this.ribbonTabs.push(...ribbonTabs);
        this._activeTab = ribbonTabs[0];
        PubSub.default.sub("activeViewChanged", (v) => (this.activeView = v));
    }

    get activeTab() {
        return this._activeTab;
    }
    set activeTab(value: RibbonTabData) {
        this.setProperty("activeTab", value);
    }

    get activeView() {
        return this._activeView;
    }
    set activeView(value: IView | undefined) {
        this.setProperty("activeView", value);
    }
}

export const QuickButton = (command: ICommand) => {
    const data = Command.getData(command);
    if (!data || !data.icon) {
        Logger.warn("commandData is undefined or has no icon");
        return span({ textContent: "null" });
    }

    return svg({
        icon: data.icon,
        title: new Localize(`command.${data.key}`),
        onclick: () => PubSub.default.pub("executeCommand", data.key),
    });
};

class ActivedRibbonTabConverter implements IConverter<RibbonTabData> {
    constructor(
        readonly tab: RibbonTabData,
        readonly style: string,
        readonly activeStyle: string,
    ) {}

    convert(value: RibbonTabData): Result<string> {
        return Result.ok(this.tab === value ? `${this.style} ${this.activeStyle}` : this.style);
    }
}

class DisplayConverter implements IConverter<RibbonTabData> {
    constructor(readonly tab: RibbonTabData) {}

    convert(value: RibbonTabData): Result<string> {
        return Result.ok(this.tab === value ? "" : "none");
    }
}

export class Ribbon extends HTMLElement {
    private readonly _commandContext = div({ className: style.commandContextPanel });
    private commandContext?: CommandContext;

    constructor(readonly dataContent: RibbonDataContent) {
        super();
        this.className = style.root;
        this.append(this.ribbonHeader(), this.ribbonTabs(), this._commandContext);
    }

    private ribbonHeader() {
        return collection({
            className: style.ribbonHeaderPanel,
            sources: this.dataContent.ribbonTabs,
            template: (tab: RibbonTabData) => {
                const converter = new ActivedRibbonTabConverter(tab, style.tabHeader, style.activedTab);
                return label({
                    className: new Binding(this.dataContent, "activeTab", converter),
                    textContent: new Localize(tab.tabName),
                    onclick: () => (this.dataContent.activeTab = tab),
                });
            },
        });
    }

    private ribbonTabs() {
        return collection({
            className: style.tabContentPanel,
            sources: this.dataContent.ribbonTabs,
            template: (tab: RibbonTabData) => this.ribbonTab(tab),
        });
    }

    private ribbonTab(tab: RibbonTabData) {
        return collection({
            className: style.groupPanel,
            sources: tab.groups,
            style: {
                display: new Binding(this.dataContent, "activeTab", new DisplayConverter(tab)),
            },
            template: (group: RibbonGroupData) => this.ribbonGroup(group),
        });
    }

    private ribbonGroup(group: RibbonGroupData) {
        return div(
            { className: style.ribbonGroup },
            collection({
                sources: group.items,
                className: style.content,
                template: (item) => this.ribbonButton(item),
            }),
            label({ className: style.header, textContent: new Localize(group.groupName) }),
        );
    }

    private ribbonButton(item: RibbonCommandData) {
        if (typeof item === "string") {
            // Special handling for showFaceNormals
            if (item === "modify.showFaceNormals") {
                return RibbonCheckboxWithInput.forShowFaceNormals();
            }
            return RibbonButton.fromCommandName(item, ButtonSize.large)!;
        } else if (item instanceof ObservableCollection) {
            const stack = new RibbonStack();
            item.forEach((b) => {
                const button = RibbonButton.fromCommandName(b, ButtonSize.small);
                if (button) stack.append(button);
            });
            return stack;
        } else {
            return new RibbonButton(item.display, item.icon, ButtonSize.large, item.onClick);
        }
    }

    connectedCallback(): void {
        PubSub.default.sub("openCommandContext", this.openContext);
        PubSub.default.sub("closeCommandContext", this.closeContext);
    }

    disconnectedCallback(): void {
        PubSub.default.remove("openCommandContext", this.openContext);
        PubSub.default.remove("closeCommandContext", this.closeContext);
    }

    private readonly openContext = (command: ICommand) => {
        if (this.commandContext) {
            this.closeContext();
        }
        this.commandContext = new CommandContext(command);
        this._commandContext.append(this.commandContext);
    };

    private readonly closeContext = () => {
        this.commandContext?.remove();
        this.commandContext?.dispose();
        this.commandContext = undefined;
        this._commandContext.innerHTML = "";
    };
}

customElements.define("chili-ribbon", Ribbon);
