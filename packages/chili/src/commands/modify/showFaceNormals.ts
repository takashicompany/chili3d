// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { IFace, ShapeMeshData, ShapeNode, ShapeType, VisualConfig, command } from "chili-core";
import { IStep } from "../../step";
import { GetOrSelectNodeStep } from "../../step/selectStep";
import { MultistepCommand } from "../multistepCommand";

@command({
    key: "modify.showFaceNormals",
    icon: "icon-toFace",
})
export class ShowFaceNormals extends MultistepCommand {
    private visualId?: number;

    protected override getSteps(): IStep[] {
        return [new GetOrSelectNodeStep("prompt.select.shape", { multiple: true })];
    }

    protected override executeMainTask() {
        this.document.selection.clearSelection();

        const meshes: ShapeMeshData[] = [];

        this.stepDatas[0].nodes?.forEach((node) => {
            if (node instanceof ShapeNode) {
                const shape = node.shape.value;
                if (!shape) return;

                // Find all faces in the shape
                const faces = shape.findSubShapes(ShapeType.Face) as IFace[];

                faces.forEach((face) => {
                    // Get face center point and normal
                    const [point, normal] = face.normal(0.5, 0.5);

                    // Calculate arrow length based on face area
                    const area = face.area();
                    const length = Math.sqrt(area) * 0.3; // 30% of characteristic dimension

                    // Create arrow end point
                    const endPoint = point.add(normal.multiply(length));

                    // Add line mesh for normal vector
                    const lineMesh = this.meshLine(point, endPoint, VisualConfig.highlightEdgeColor, 2);
                    meshes.push(lineMesh);

                    // Add small sphere at tip to indicate direction
                    const arrowTip = this.meshPoint(endPoint);
                    meshes.push(arrowTip);
                });
            }
        });

        if (meshes.length > 0) {
            this.visualId = this.document.visual.context.displayMesh(meshes);

            // Clean up when user presses Escape or clicks
            const cleanup = () => {
                if (this.visualId !== undefined) {
                    this.document.visual.context.removeMesh(this.visualId);
                    this.visualId = undefined;
                }
            };

            // Auto-cleanup after 30 seconds
            setTimeout(cleanup, 30000);
        }
    }

    protected override afterExecute(): void {
        super.afterExecute();
        if (this.visualId !== undefined) {
            this.document.visual.context.removeMesh(this.visualId);
            this.visualId = undefined;
        }
    }
}
