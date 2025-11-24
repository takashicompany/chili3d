// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { div } from "chili-controls";
import {
    AsyncController,
    Button,
    CommandKeys,
    I18nKeys,
    IApplication,
    IDocument,
    Material,
    PubSub,
    RibbonTab,
    ObservableCollection,
} from "chili-core";
import style from "./editor.module.css";
import { OKCancel } from "./okCancel";
import { ProjectView } from "./project";
import { PropertyView } from "./property";
import { MaterialDataContent, MaterialEditor } from "./property/material";
import { Ribbon, RibbonDataContent } from "./ribbon";
import { RibbonTabData } from "./ribbon/ribbonData";
import { Statusbar } from "./statusbar";
import { Toolbar } from "./toolbar";
import { LayoutViewport } from "./viewport";

let quickCommands: CommandKeys[] = ["doc.save", "doc.saveToFile", "edit.undo", "edit.redo"];

export class Editor extends HTMLElement {
    readonly ribbonContent: RibbonDataContent;
    private readonly _selectionController: OKCancel;
    private readonly _viewportContainer: HTMLDivElement;
    private _ribbonWidth: number = 280;
    private _sidebarWidth: number = 360;
    private _isResizingRibbon: boolean = false;
    private _isResizingSidebar: boolean = false;
    private _ribbonEl: HTMLDivElement | null = null;
    private _sidebarEl: HTMLDivElement | null = null;

    constructor(
        readonly app: IApplication,
        tabs: RibbonTab[],
    ) {
        super();
        const quickCommandsCollection = new ObservableCollection<CommandKeys>();
        quickCommandsCollection.push(...quickCommands);
        this.ribbonContent = new RibbonDataContent(app, quickCommands, tabs.map(RibbonTabData.fromProfile));
        const viewport = new LayoutViewport(app);
        viewport.classList.add(style.viewport);
        this._selectionController = new OKCancel();
        this._viewportContainer = div(
            { className: style.viewportContainer },
            this._selectionController,
            viewport,
        );
        this.clearSelectionControl();
        this.render();
    }

    private render() {
        this._ribbonEl = div(
            {
                className: style.ribbon,
                style: `width: ${this._ribbonWidth}px;`,
            },
            new Ribbon(this.ribbonContent),
            div({
                className: style.ribbonResizer,
                onmousedown: (e: MouseEvent) => this._startRibbonResize(e),
            }),
        );

        this._sidebarEl = div(
            {
                className: style.sidebar,
                style: `width: ${this._sidebarWidth}px;`,
            },
            div({
                className: style.sidebarResizer,
                onmousedown: (e: MouseEvent) => this._startSidebarResize(e),
            }),
            new PropertyView({ className: style.sidebarItem }),
            new ProjectView({ className: style.sidebarItem }),
        );

        this.append(
            div(
                { className: style.root },
                new Toolbar(this.ribbonContent, quickCommands),
                div({ className: style.content }, this._ribbonEl, this._viewportContainer, this._sidebarEl),
                new Statusbar(style.statusbar),
            ),
        );
        this.app.mainWindow?.appendChild(this);
    }

    private _startRibbonResize(e: MouseEvent) {
        e.preventDefault();
        this._isResizingRibbon = true;
        if (this.app.mainWindow) this.app.mainWindow.style.cursor = "ew-resize";
        const onMouseMove = (ev: MouseEvent) => {
            if (!this._isResizingRibbon) return;
            if (!this._ribbonEl) return;
            const ribbonRect = this._ribbonEl.getBoundingClientRect();
            let newWidth = ev.clientX - ribbonRect.left;
            const minWidth = 150;
            const maxWidth = Math.floor(window.innerWidth * 0.5);
            newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
            this._ribbonWidth = newWidth;
            this._ribbonEl.style.width = `${newWidth}px`;
        };
        const onMouseUp = () => {
            this._isResizingRibbon = false;
            if (this.app.mainWindow) this.app.mainWindow.style.cursor = "";
            this.app.mainWindow?.removeEventListener("mousemove", onMouseMove);
            this.app.mainWindow?.removeEventListener("mouseup", onMouseUp);
        };
        this.app.mainWindow?.addEventListener("mousemove", onMouseMove);
        this.app.mainWindow?.addEventListener("mouseup", onMouseUp);
    }

    private _startSidebarResize(e: MouseEvent) {
        e.preventDefault();
        this._isResizingSidebar = true;
        if (this.app.mainWindow) this.app.mainWindow.style.cursor = "ew-resize";
        const onMouseMove = (ev: MouseEvent) => {
            if (!this._isResizingSidebar) return;
            if (!this._sidebarEl) return;
            const sidebarRect = this._sidebarEl.getBoundingClientRect();
            let newWidth = sidebarRect.right - ev.clientX;
            const minWidth = 150;
            const maxWidth = Math.floor(window.innerWidth * 0.5);
            newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
            this._sidebarWidth = newWidth;
            this._sidebarEl.style.width = `${newWidth}px`;
        };
        const onMouseUp = () => {
            this._isResizingSidebar = false;
            if (this.app.mainWindow) this.app.mainWindow.style.cursor = "";
            this.app.mainWindow?.removeEventListener("mousemove", onMouseMove);
            this.app.mainWindow?.removeEventListener("mouseup", onMouseUp);
        };
        this.app.mainWindow?.addEventListener("mousemove", onMouseMove);
        this.app.mainWindow?.addEventListener("mouseup", onMouseUp);
    }

    connectedCallback(): void {
        PubSub.default.sub("showSelectionControl", this.showSelectionControl);
        PubSub.default.sub("editMaterial", this._handleMaterialEdit);
        PubSub.default.sub("clearSelectionControl", this.clearSelectionControl);
    }

    disconnectedCallback(): void {
        PubSub.default.remove("showSelectionControl", this.showSelectionControl);
        PubSub.default.remove("editMaterial", this._handleMaterialEdit);
        PubSub.default.remove("clearSelectionControl", this.clearSelectionControl);
    }

    private readonly showSelectionControl = (controller: AsyncController) => {
        this._selectionController.setControl(controller);
        this._selectionController.style.visibility = "visible";
        this._selectionController.style.zIndex = "1000";
    };

    private readonly clearSelectionControl = () => {
        this._selectionController.setControl(undefined);
        this._selectionController.style.visibility = "hidden";
    };

    private readonly _handleMaterialEdit = (
        document: IDocument,
        editingMaterial: Material,
        callback: (material: Material) => void,
    ) => {
        let context = new MaterialDataContent(document, callback, editingMaterial);
        this._viewportContainer.append(new MaterialEditor(context));
    };

    registerRibbonCommand(tabName: I18nKeys, groupName: I18nKeys, command: CommandKeys | Button) {
        const tab = this.ribbonContent.ribbonTabs.find((p) => p.tabName === tabName);
        const group = tab?.groups.find((p) => p.groupName === groupName);
        group?.items.push(command);
    }
}

customElements.define("chili-editor", Editor);
