// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { EditableShapeNode, ShapeNode, Transaction, command } from "chili-core";
import { IStep } from "../../step";
import { GetOrSelectNodeStep } from "../../step/selectStep";
import { MultistepCommand } from "../multistepCommand";

@command({
    key: "modify.reverseFace",
    icon: "icon-toFace",
})
export class ReverseFace extends MultistepCommand {
    protected override getSteps(): IStep[] {
        return [new GetOrSelectNodeStep("prompt.select.shape", { multiple: true })];
    }

    protected override executeMainTask() {
        this.document.selection.clearSelection();

        Transaction.execute(this.document, `excute ${Object.getPrototypeOf(this).data.name}`, () => {
            this.stepDatas[0].nodes?.forEach((node) => {
                if (node instanceof ShapeNode) {
                    const shape = node.shape.value;
                    if (!shape) return;

                    // Reverse the face orientation
                    shape.reserve();

                    // Create new node with reversed shape
                    const reversedNode = new EditableShapeNode(
                        this.document,
                        node.name,
                        shape,
                        node.materialId,
                    );
                    reversedNode.transform = node.transform;

                    // Replace the original node
                    node.parent?.insertAfter(node.previousSibling, reversedNode);
                    node.parent?.remove(node);
                }
            });
        });

        this.document.visual.update();
    }
}
