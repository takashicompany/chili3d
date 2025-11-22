// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    AsyncController,
    BoundingBox,
    GeometryNode,
    IApplication,
    Matrix4,
    PubSub,
    Result,
    Transaction,
    command,
} from "chili-core";
import { ICommand } from "chili-core";

@command({
    key: "modify.setOriginToCenter",
    icon: "icon-center",
})
export class SetOriginToCenter implements ICommand {
    async execute(app: IApplication): Promise<void> {
        const document = app.activeView?.document;
        if (!document) {
            PubSub.default.pub("showToast", "toast.document.noActivated");
            return;
        }

        // Get selected nodes or prompt user to select
        let nodes = document.selection
            .getSelectedNodes()
            .filter((x): x is GeometryNode => x instanceof GeometryNode);

        if (nodes.length === 0) {
            const controller = new AsyncController();
            const selected = await document.selection.pickNode("prompt.select.models", controller, true);
            nodes = selected.filter((x): x is GeometryNode => x instanceof GeometryNode);

            if (nodes.length === 0) {
                if (controller.result?.status === "success") {
                    PubSub.default.pub("showToast", "toast.select.noSelected");
                }
                return;
            }
        }

        // Execute transformation within transaction for undo/redo support
        Transaction.execute(document, "Set Origin to Center", () => {
            nodes.forEach((node) => {
                this.setNodeOriginToCenter(node);
            });
            document.visual.update();
        });
    }

    private setNodeOriginToCenter(node: GeometryNode): void {
        // Get bounding box in world coordinates
        const boundingBox = node.boundingBox();
        if (!boundingBox) {
            return;
        }

        // Calculate center in world coordinates
        const worldCenter = BoundingBox.center(boundingBox);

        // Calculate center in local coordinates
        const invertTransform = node.transform.invert();
        if (!invertTransform) {
            return;
        }
        const localCenter = invertTransform.ofPoint(worldCenter);

        // If already centered (within tolerance), skip
        const tolerance = 0.0001;
        if (
            Math.abs(localCenter.x) < tolerance &&
            Math.abs(localCenter.y) < tolerance &&
            Math.abs(localCenter.z) < tolerance
        ) {
            return;
        }

        // Transform shape to move geometry so center is at origin
        const offsetMatrix = Matrix4.fromTranslation(-localCenter.x, -localCenter.y, -localCenter.z);

        // For EditableShapeNode, we can modify the shape directly
        if ("shape" in node && node.shape instanceof Result) {
            const currentShape = node.shape;
            if (currentShape.isOk) {
                const newShape = currentShape.value.transformed(offsetMatrix);
                (node as any).shape = Result.ok(newShape);
            }
        }

        // Adjust transform to maintain world position
        const transformOffset = Matrix4.fromTranslation(localCenter.x, localCenter.y, localCenter.z);
        node.transform = node.transform.multiply(transformOffset);
    }
}
