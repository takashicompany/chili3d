// Part of the Chili3d Project, under the AGPL-3.0 License.
// See LICENSE file in the project root for full license information.

import { SVGPathData, SVGPathDataParser } from "svg-pathdata";
import { EditableShapeNode, GroupNode, IDocument, IEdge, Result, XYZ } from "chili-core";

export class SVGConverter {
    private logs: string[] = [];

    private addLog(message: string) {
        const timestamp = new Date().toISOString().split("T")[1].split(".")[0];
        this.logs.push(`[${timestamp}] ${message}`);
    }

    private getErrorWithLogs(errorMessage: string): string {
        return `${errorMessage}\n\n--- Debug Log ---\n${this.logs.join("\n")}`;
    }

    convertFromSVG(document: IDocument, svgContent: string): Result<GroupNode> {
        this.logs = [];
        this.addLog("SVG import started");

        try {
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgContent, "image/svg+xml");
            this.addLog("SVG content parsed by DOMParser");

            // Check for parsing errors
            const parserError = svgDoc.querySelector("parsererror");
            if (parserError) {
                this.addLog(`Parser error detected: ${parserError.textContent}`);
                return Result.err(this.getErrorWithLogs("Invalid SVG file"));
            }

            // Get all supported SVG elements
            const pathElements = Array.from(svgDoc.querySelectorAll("path"));
            const rectElements = Array.from(svgDoc.querySelectorAll("rect"));
            const circleElements = Array.from(svgDoc.querySelectorAll("circle"));
            const ellipseElements = Array.from(svgDoc.querySelectorAll("ellipse"));
            const lineElements = Array.from(svgDoc.querySelectorAll("line"));
            const polylineElements = Array.from(svgDoc.querySelectorAll("polyline"));
            const polygonElements = Array.from(svgDoc.querySelectorAll("polygon"));

            const totalElements =
                pathElements.length +
                rectElements.length +
                circleElements.length +
                ellipseElements.length +
                lineElements.length +
                polylineElements.length +
                polygonElements.length;

            this.addLog(
                `Found ${totalElements} SVG elements (${pathElements.length} path, ${rectElements.length} rect, ${circleElements.length} circle, ${ellipseElements.length} ellipse, ${lineElements.length} line, ${polylineElements.length} polyline, ${polygonElements.length} polygon)`,
            );

            if (totalElements === 0) {
                return Result.err(this.getErrorWithLogs("No supported SVG elements found"));
            }

            const folder = new GroupNode(document, "SVG Import");
            let successCount = 0;
            let failCount = 0;
            let elementIndex = 0;

            // Process all elements
            const allElements: Array<{ element: Element; type: string }> = [
                ...pathElements.map((e) => ({ element: e, type: "path" })),
                ...rectElements.map((e) => ({ element: e, type: "rect" })),
                ...circleElements.map((e) => ({ element: e, type: "circle" })),
                ...ellipseElements.map((e) => ({ element: e, type: "ellipse" })),
                ...lineElements.map((e) => ({ element: e, type: "line" })),
                ...polylineElements.map((e) => ({ element: e, type: "polyline" })),
                ...polygonElements.map((e) => ({ element: e, type: "polygon" })),
            ];

            allElements.forEach(({ element, type }) => {
                elementIndex++;
                const elementName =
                    element.getAttribute("id") ||
                    element.getAttribute("data-name") ||
                    `Element ${elementIndex}`;

                this.addLog(`Processing ${type} ${elementIndex}: "${elementName}"`);

                // Convert element to path data
                let pathData: string | null = null;
                if (type === "path") {
                    pathData = element.getAttribute("d");
                } else {
                    pathData = this.convertBasicShapeToPath(element, type);
                }

                if (!pathData || pathData.trim() === "") {
                    this.addLog(`${type} ${elementIndex}: empty path data, skipping`);
                    return;
                }

                const pathResult = this.convertPathToEdges(document, pathData);
                if (!pathResult.isOk) {
                    this.addLog(`${type} ${elementIndex} conversion failed: ${pathResult.error}`);
                    failCount++;
                    return;
                }

                const edges = pathResult.value;
                this.addLog(`${type} ${elementIndex}: generated ${edges.length} edges`);

                if (edges.length === 0) {
                    this.addLog(`${type} ${elementIndex}: no edges generated, skipping`);
                    return;
                }

                // Create wire from edges
                const wireResult = document.application.shapeFactory.wire(edges);
                if (!wireResult.isOk) {
                    this.addLog(`${type} ${elementIndex} wire creation failed: ${wireResult.error}`);
                    failCount++;
                    return;
                }

                const shapeNode = new EditableShapeNode(document, elementName, wireResult.value);
                folder.add(shapeNode);
                this.addLog(`${type} ${elementIndex}: successfully created as "${elementName}"`);
                successCount++;
            });

            this.addLog(`Import completed: ${successCount} success, ${failCount} failed`);

            if (folder.count === 0) {
                return Result.err(this.getErrorWithLogs("No valid paths could be imported"));
            }

            return Result.ok(folder);
        } catch (error) {
            this.addLog(`Exception caught: ${error}`);
            return Result.err(this.getErrorWithLogs(`SVG conversion error: ${error}`));
        }
    }

    private convertPathToEdges(document: IDocument, pathData: string): Result<IEdge[]> {
        try {
            // Parse and convert to absolute coordinates
            const parser = new SVGPathDataParser();
            const commands = new SVGPathData(pathData).toAbs().commands;
            this.addLog(`Parsed ${commands.length} path commands`);

            const edges: IEdge[] = [];
            let currentPoint = new XYZ(0, 0, 0);
            let pathStartPoint = currentPoint;
            let lastControlPoint: XYZ | undefined;

            for (const cmd of commands) {
                switch (cmd.type) {
                    case SVGPathData.MOVE_TO:
                        currentPoint = new XYZ(cmd.x, -cmd.y, 0);
                        pathStartPoint = currentPoint;
                        lastControlPoint = undefined;
                        break;

                    case SVGPathData.LINE_TO:
                        const lineEnd = new XYZ(cmd.x, -cmd.y, 0);
                        const lineResult = document.application.shapeFactory.line(currentPoint, lineEnd);
                        if (lineResult.isOk) {
                            edges.push(lineResult.value);
                        }
                        currentPoint = lineEnd;
                        lastControlPoint = undefined;
                        break;

                    case SVGPathData.HORIZ_LINE_TO:
                        const hLineEnd = new XYZ(cmd.x, currentPoint.y, 0);
                        const hLineResult = document.application.shapeFactory.line(currentPoint, hLineEnd);
                        if (hLineResult.isOk) {
                            edges.push(hLineResult.value);
                        }
                        currentPoint = hLineEnd;
                        lastControlPoint = undefined;
                        break;

                    case SVGPathData.VERT_LINE_TO:
                        const vLineEnd = new XYZ(currentPoint.x, -cmd.y, 0);
                        const vLineResult = document.application.shapeFactory.line(currentPoint, vLineEnd);
                        if (vLineResult.isOk) {
                            edges.push(vLineResult.value);
                        }
                        currentPoint = vLineEnd;
                        lastControlPoint = undefined;
                        break;

                    case SVGPathData.CURVE_TO:
                        // Cubic Bezier curve
                        const cp1 = new XYZ(cmd.x1, -cmd.y1, 0);
                        const cp2 = new XYZ(cmd.x2, -cmd.y2, 0);
                        const curveEnd = new XYZ(cmd.x, -cmd.y, 0);
                        const bezierResult = document.application.shapeFactory.bezier([
                            currentPoint,
                            cp1,
                            cp2,
                            curveEnd,
                        ]);
                        if (bezierResult.isOk) {
                            edges.push(bezierResult.value);
                        }
                        lastControlPoint = cp2;
                        currentPoint = curveEnd;
                        break;

                    case SVGPathData.SMOOTH_CURVE_TO:
                        // Smooth cubic Bezier - reflect previous control point
                        const scp1 = lastControlPoint
                            ? new XYZ(
                                  2 * currentPoint.x - lastControlPoint.x,
                                  2 * currentPoint.y - lastControlPoint.y,
                                  0,
                              )
                            : currentPoint;
                        const scp2 = new XYZ(cmd.x2, -cmd.y2, 0);
                        const sCurveEnd = new XYZ(cmd.x, -cmd.y, 0);
                        const sBezierResult = document.application.shapeFactory.bezier([
                            currentPoint,
                            scp1,
                            scp2,
                            sCurveEnd,
                        ]);
                        if (sBezierResult.isOk) {
                            edges.push(sBezierResult.value);
                        }
                        lastControlPoint = scp2;
                        currentPoint = sCurveEnd;
                        break;

                    case SVGPathData.QUAD_TO:
                        // Quadratic Bezier - convert to cubic
                        const qcp = new XYZ(cmd.x1, -cmd.y1, 0);
                        const qEnd = new XYZ(cmd.x, -cmd.y, 0);
                        const cubicPoints = this.quadraticToCubic(currentPoint, qcp, qEnd);
                        const qBezierResult = document.application.shapeFactory.bezier(cubicPoints);
                        if (qBezierResult.isOk) {
                            edges.push(qBezierResult.value);
                        }
                        lastControlPoint = qcp;
                        currentPoint = qEnd;
                        break;

                    case SVGPathData.SMOOTH_QUAD_TO:
                        // Smooth quadratic Bezier
                        const sqcp = lastControlPoint
                            ? new XYZ(
                                  2 * currentPoint.x - lastControlPoint.x,
                                  2 * currentPoint.y - lastControlPoint.y,
                                  0,
                              )
                            : currentPoint;
                        const sqEnd = new XYZ(cmd.x, -cmd.y, 0);
                        const sqCubicPoints = this.quadraticToCubic(currentPoint, sqcp, sqEnd);
                        const sqBezierResult = document.application.shapeFactory.bezier(sqCubicPoints);
                        if (sqBezierResult.isOk) {
                            edges.push(sqBezierResult.value);
                        }
                        lastControlPoint = sqcp;
                        currentPoint = sqEnd;
                        break;

                    case SVGPathData.ARC:
                        // For now, approximate arc with a straight line
                        // TODO: Implement proper elliptical arc conversion
                        this.addLog(
                            "Elliptical arc (A) command not fully supported yet, using line approximation",
                        );
                        const arcEnd = new XYZ(cmd.x, -cmd.y, 0);
                        const arcLineResult = document.application.shapeFactory.line(currentPoint, arcEnd);
                        if (arcLineResult.isOk) {
                            edges.push(arcLineResult.value);
                        }
                        currentPoint = arcEnd;
                        lastControlPoint = undefined;
                        break;

                    case SVGPathData.CLOSE_PATH:
                        // Close the path by connecting to start point
                        const distToStart = Math.sqrt(
                            Math.pow(currentPoint.x - pathStartPoint.x, 2) +
                                Math.pow(currentPoint.y - pathStartPoint.y, 2) +
                                Math.pow(currentPoint.z - pathStartPoint.z, 2),
                        );
                        if (distToStart > 0.001) {
                            const closeResult = document.application.shapeFactory.line(
                                currentPoint,
                                pathStartPoint,
                            );
                            if (closeResult.isOk) {
                                edges.push(closeResult.value);
                            }
                        }
                        currentPoint = pathStartPoint;
                        lastControlPoint = undefined;
                        break;

                    default:
                        this.addLog(`Unsupported SVG path command: ${(cmd as any).type}`);
                }
            }

            this.addLog(`Total edges generated: ${edges.length}`);
            return Result.ok(edges);
        } catch (error) {
            this.addLog(`Path conversion exception: ${error}`);
            return Result.err(`Path conversion error: ${error}`);
        }
    }

    /**
     * Convert quadratic Bezier to cubic Bezier
     * P0: start point, P1: control point, P2: end point
     * Returns [P0, CP1, CP2, P2] for cubic Bezier
     */
    private quadraticToCubic(p0: XYZ, p1: XYZ, p2: XYZ): XYZ[] {
        // CP1 = P0 + 2/3 * (P1 - P0)
        const cp1 = new XYZ(p0.x + (2 / 3) * (p1.x - p0.x), p0.y + (2 / 3) * (p1.y - p0.y), 0);

        // CP2 = P2 + 2/3 * (P1 - P2)
        const cp2 = new XYZ(p2.x + (2 / 3) * (p1.x - p2.x), p2.y + (2 / 3) * (p1.y - p2.y), 0);

        return [p0, cp1, cp2, p2];
    }

    /**
     * Convert SVG basic shapes to path data string
     */
    private convertBasicShapeToPath(element: Element, type: string): string | null {
        switch (type) {
            case "rect":
                return this.rectToPath(element);
            case "circle":
                return this.circleToPath(element);
            case "ellipse":
                return this.ellipseToPath(element);
            case "line":
                return this.lineToPath(element);
            case "polyline":
                return this.polylineToPath(element);
            case "polygon":
                return this.polygonToPath(element);
            default:
                return null;
        }
    }

    private rectToPath(element: Element): string {
        const x = parseFloat(element.getAttribute("x") || "0");
        const y = parseFloat(element.getAttribute("y") || "0");
        const width = parseFloat(element.getAttribute("width") || "0");
        const height = parseFloat(element.getAttribute("height") || "0");
        const rx = parseFloat(element.getAttribute("rx") || "0");
        const ry = parseFloat(element.getAttribute("ry") || rx.toString()) || rx;

        if (rx === 0 && ry === 0) {
            // Simple rectangle without rounded corners
            return `M ${x},${y} h ${width} v ${height} h ${-width} Z`;
        } else {
            // Rounded rectangle (approximation using bezier curves)
            const actualRx = Math.min(rx, width / 2);
            const actualRy = Math.min(ry, height / 2);
            return `M ${x + actualRx},${y}
                    h ${width - 2 * actualRx}
                    a ${actualRx},${actualRy} 0 0 1 ${actualRx},${actualRy}
                    v ${height - 2 * actualRy}
                    a ${actualRx},${actualRy} 0 0 1 ${-actualRx},${actualRy}
                    h ${-(width - 2 * actualRx)}
                    a ${actualRx},${actualRy} 0 0 1 ${-actualRx},${-actualRy}
                    v ${-(height - 2 * actualRy)}
                    a ${actualRx},${actualRy} 0 0 1 ${actualRx},${-actualRy} Z`;
        }
    }

    private circleToPath(element: Element): string {
        const cx = parseFloat(element.getAttribute("cx") || "0");
        const cy = parseFloat(element.getAttribute("cy") || "0");
        const r = parseFloat(element.getAttribute("r") || "0");

        // Approximate circle with 4 bezier curves
        // Magic number for bezier curve approximation: 4/3 * tan(π/8) ≈ 0.5522847498
        const k = 0.5522847498;
        const kr = k * r;

        return `M ${cx - r},${cy}
                C ${cx - r},${cy - kr} ${cx - kr},${cy - r} ${cx},${cy - r}
                C ${cx + kr},${cy - r} ${cx + r},${cy - kr} ${cx + r},${cy}
                C ${cx + r},${cy + kr} ${cx + kr},${cy + r} ${cx},${cy + r}
                C ${cx - kr},${cy + r} ${cx - r},${cy + kr} ${cx - r},${cy} Z`;
    }

    private ellipseToPath(element: Element): string {
        const cx = parseFloat(element.getAttribute("cx") || "0");
        const cy = parseFloat(element.getAttribute("cy") || "0");
        const rx = parseFloat(element.getAttribute("rx") || "0");
        const ry = parseFloat(element.getAttribute("ry") || "0");

        // Approximate ellipse with 4 bezier curves
        const k = 0.5522847498;
        const krx = k * rx;
        const kry = k * ry;

        return `M ${cx - rx},${cy}
                C ${cx - rx},${cy - kry} ${cx - krx},${cy - ry} ${cx},${cy - ry}
                C ${cx + krx},${cy - ry} ${cx + rx},${cy - kry} ${cx + rx},${cy}
                C ${cx + rx},${cy + kry} ${cx + krx},${cy + ry} ${cx},${cy + ry}
                C ${cx - krx},${cy + ry} ${cx - rx},${cy + kry} ${cx - rx},${cy} Z`;
    }

    private lineToPath(element: Element): string {
        const x1 = parseFloat(element.getAttribute("x1") || "0");
        const y1 = parseFloat(element.getAttribute("y1") || "0");
        const x2 = parseFloat(element.getAttribute("x2") || "0");
        const y2 = parseFloat(element.getAttribute("y2") || "0");

        return `M ${x1},${y1} L ${x2},${y2}`;
    }

    private polylineToPath(element: Element): string {
        const points = element.getAttribute("points") || "";
        const pairs = points
            .trim()
            .split(/[\s,]+/)
            .filter((p) => p.length > 0);

        if (pairs.length < 2) return "";

        let path = `M ${pairs[0]},${pairs[1]}`;
        for (let i = 2; i < pairs.length; i += 2) {
            if (i + 1 < pairs.length) {
                path += ` L ${pairs[i]},${pairs[i + 1]}`;
            }
        }
        return path;
    }

    private polygonToPath(element: Element): string {
        const polylinePath = this.polylineToPath(element);
        return polylinePath ? `${polylinePath} Z` : "";
    }
}
