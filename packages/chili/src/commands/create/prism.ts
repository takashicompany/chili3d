// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { GeometryNode, IShape, Precision, ShapeType, Transaction, command } from "chili-core";
import { GeoUtils } from "chili-geo";
import { PrismNode } from "../../bodys";
import { LengthAtAxisSnapData } from "../../snap";
import { IStep, LengthAtAxisStep } from "../../step";
import { SelectShapeStep } from "../../step/selectStep";
import { CreateCommand } from "../createCommand";

@command({
    key: "create.extrude",
    icon: "icon-prism",
})
export class Prism extends CreateCommand {
    protected override geometryNode(): GeometryNode {
        const shape = this.transformdFirstShape(this.stepDatas[0], false);
        const { point, normal } = this.getAxis(shape, 0);
        const dist = this.stepDatas[1].point!.sub(point).dot(normal);
        return new PrismNode(this.document, shape, dist);
    }

    protected override executeMainTask(): void {
        const firstShape = this.transformdFirstShape(this.stepDatas[0]);
        const { point, normal } = this.getAxis(firstShape, 0);
        const dist = this.stepDatas[1].point!.sub(point).dot(normal);

        Transaction.execute(this.document, `excute ${Object.getPrototypeOf(this).data.name}`, () => {
            this.stepDatas[0].shapes.forEach((shapeData) => {
                const shape = shapeData.shape.transformedMul(shapeData.transform);
                const prismNode = new PrismNode(this.document, shape, dist);
                this.document.addNode(prismNode);
                this.disposeStack.add(shape);
            });
            this.document.visual.update();
        });
    }

    protected override getSteps(): IStep[] {
        return [
            new SelectShapeStep(ShapeType.Face | ShapeType.Edge | ShapeType.Wire, "prompt.select.shape", {
                multiple: true,
                keepSelection: true,
            }),
            new LengthAtAxisStep("prompt.pickNextPoint", this.getLengthStepData, true),
        ];
    }

    private readonly getLengthStepData = (): LengthAtAxisSnapData => {
        const firstShape = this.transformdFirstShape(this.stepDatas[0]);
        const { point, normal } = this.getAxis(firstShape, 0);
        return {
            point,
            direction: normal,
            preview: (p) => {
                if (!p) return [];
                const dist = p.sub(point).dot(normal);
                if (Math.abs(dist) < Precision.Float) return [];
                const vec = normal.multiply(dist);

                // Preview all selected shapes
                const previews = [];
                for (const shapeData of this.stepDatas[0].shapes) {
                    const shape = shapeData.shape.transformedMul(shapeData.transform);
                    previews.push(this.meshCreatedShape("prism", shape, vec));
                    this.disposeStack.add(shape);
                }
                return previews;
            },
        };
    };

    private getAxis(shape: IShape, shapeIndex: number) {
        const point = this.stepDatas[0].shapes[shapeIndex].point!;
        const normal = GeoUtils.normal(shape as any);
        return { point, normal };
    }
}
