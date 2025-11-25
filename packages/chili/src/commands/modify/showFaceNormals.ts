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
    PubSub,
    ShapeMeshData,
    ShapeNode,
    ShapeType,
    VertexMeshData,
    VisualConfig,
    command,
    getCurrentApplication,
} from "chili-core";

@command({
    key: "modify.showFaceNormals",
    toggle: new Binding(Config.instance, "showFaceNormals"),
})
export class ShowFaceNormals implements ICommand {
    private static visualId?: number;
    private static currentDocument?: any;
    private static initialized = false;

    static {
        // Subscribe to update events
        if (!ShowFaceNormals.initialized) {
            PubSub.default.sub("updateFaceNormals", () => {
                ShowFaceNormals.updateDisplay();
            });
            ShowFaceNormals.initialized = true;
        }
    }

    async execute(app: IApplication): Promise<void> {
        const document = app.activeView?.document;
        if (!document) return;

        // Toggle the setting
        Config.instance.showFaceNormals = !Config.instance.showFaceNormals;

        ShowFaceNormals.currentDocument = document;
        ShowFaceNormals.updateDisplay(document);
    }

    static updateDisplay(document?: any) {
        if (!document) {
            const app = getCurrentApplication();
            document = app?.activeView?.document ?? ShowFaceNormals.currentDocument;
        }
        if (!document) return;

        // Remove existing normals
        if (ShowFaceNormals.visualId !== undefined) {
            document.visual.context.removeMesh(ShowFaceNormals.visualId);
            ShowFaceNormals.visualId = undefined;
        }

        // If enabled, display normals
        if (Config.instance.showFaceNormals) {
            const meshes: ShapeMeshData[] = [];

            // Get all shape nodes in the document
            const allNodes = ShowFaceNormals.getAllShapeNodes(document.rootNode);

            allNodes.forEach((node) => {
                const shape = node.shape.value;
                if (!shape) return;

                // Find all faces in the shape
                const faces = shape.findSubShapes(ShapeType.Face) as IFace[];

                faces.forEach((face) => {
                    // Get face center point and normal
                    const [point, normal] = face.normal(0.5, 0.5);

                    // Use configured normal length
                    const length = Config.instance.normalLength;

                    // Create arrow end point (reversed to match extrude direction)
                    const endPoint = point.add(normal.multiply(-length));

                    // Transform points by node's world transform
                    const transform = node.worldTransform();
                    const transformedPoint = transform.ofPoint(point);
                    const transformedEnd = transform.ofPoint(endPoint);

                    // Add line mesh for normal vector
                    const lineMesh = ShowFaceNormals.createLineMesh(transformedPoint, transformedEnd);
                    meshes.push(lineMesh);

                    // Add small sphere at tip to indicate direction
                    const arrowTip = ShowFaceNormals.createPointMesh(transformedEnd);
                    meshes.push(arrowTip);
                });
            });

            if (meshes.length > 0) {
                ShowFaceNormals.visualId = document.visual.context.displayMesh(meshes);
            }
        }
    }

    private static getAllShapeNodes(node: any): ShapeNode[] {
        const result: ShapeNode[] = [];

        if (node instanceof ShapeNode) {
            result.push(node);
        }

        if (INode.isLinkedListNode(node)) {
            let child = node.firstChild;
            while (child) {
                result.push(...ShowFaceNormals.getAllShapeNodes(child));
                child = child.nextSibling;
            }
        }

        return result;
    }

    private static createLineMesh(start: any, end: any): EdgeMeshData {
        const positions = new Float32Array([start.x, start.y, start.z, end.x, end.y, end.z]);

        return {
            position: positions,
            range: [],
            color: VisualConfig.highlightEdgeColor,
            lineType: LineType.Solid,
            lineWidth: 2,
        };
    }

    private static createPointMesh(point: any): VertexMeshData {
        return VertexMeshData.from(point, VisualConfig.editVertexSize, VisualConfig.highlightEdgeColor);
    }
}
