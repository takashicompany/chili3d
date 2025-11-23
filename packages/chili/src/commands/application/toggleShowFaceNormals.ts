// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { Binding, Config, IApplication, ICommand, command } from "chili-core";

@command({
    key: "application.toggleShowFaceNormals",
    toggle: new Binding(Config.instance, "showFaceNormals"),
    icon: "icon-toFace",
})
export class ToggleShowFaceNormalsCommand implements ICommand {
    async execute(app: IApplication): Promise<void> {
        Config.instance.showFaceNormals = !Config.instance.showFaceNormals;
        app.activeView?.document?.visual.update();
    }
}
