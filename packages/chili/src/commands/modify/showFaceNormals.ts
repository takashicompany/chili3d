// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import {
    Binding,
    Config,
    EdgeMeshData,
    IApplication,
    ICommand,
    IFace,
    INode,
    LineType,
    ShapeMeshData,
    ShapeNode,
    ShapeType,
    VertexMeshData,
    VisualConfig,
    command,
} from "chili-core";

@command({
    key: "modify.showFaceNormals",
    toggle: new Binding(Config.instance, "showFaceNormals"),
    icon: "icon-toFace",
})
export class ShowFaceNormals implements ICommand {
    private static visualId?: number;

    async execute(app: IApplication): Promise<void> {
        const newValue = !Config.instance.showFaceNormals;
        Config.instance.showFaceNormals = newValue;

        const document = app.activeView?.document;
        if (!document) return;

        // Remove existing normals
        if (ShowFaceNormals.visualId !== undefined) {
            document.visual.context.removeMesh(ShowFaceNormals.visualId);
            ShowFaceNormals.visualId = undefined;
        }

        // If turning on, display normals
        if (newValue) {
            const meshes: ShapeMeshData[] = [];

            // Get all shape nodes in the document
            const allNodes = this.getAllShapeNodes(document.rootNode);

            allNodes.forEach((node) => {
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

                    // Create arrow end point (reversed to match extrude direction)
                    const endPoint = point.add(normal.multiply(-length));

                    // Transform points by node's world transform
                    const transform = node.worldTransform();
                    const transformedPoint = transform.ofPoint(point);
                    const transformedEnd = transform.ofPoint(endPoint);

                    // Add line mesh for normal vector
                    const lineMesh = this.createLineMesh(transformedPoint, transformedEnd);
                    meshes.push(lineMesh);

                    // Add small sphere at tip to indicate direction
                    const arrowTip = this.createPointMesh(transformedEnd);
                    meshes.push(arrowTip);
                });
            });

            if (meshes.length > 0) {
                ShowFaceNormals.visualId = document.visual.context.displayMesh(meshes);
            }
        }
    }

    private getAllShapeNodes(node: any): ShapeNode[] {
        const result: ShapeNode[] = [];

        if (node instanceof ShapeNode) {
            result.push(node);
        }

        if (INode.isLinkedListNode(node)) {
            let child = node.firstChild;
            while (child) {
                result.push(...this.getAllShapeNodes(child));
                child = child.nextSibling;
            }
        }

        return result;
    }

    private createLineMesh(start: any, end: any): EdgeMeshData {
        const positions = new Float32Array([start.x, start.y, start.z, end.x, end.y, end.z]);

        return {
            position: positions,
            range: [],
            color: VisualConfig.highlightEdgeColor,
            lineType: LineType.Solid,
            lineWidth: 2,
        };
    }

    private createPointMesh(point: any): VertexMeshData {
        return VertexMeshData.from(point, VisualConfig.editVertexSize, VisualConfig.highlightEdgeColor);
    }
}
