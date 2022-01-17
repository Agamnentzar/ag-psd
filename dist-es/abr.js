import { BlnM, parseAngle, parsePercent, parseUnitsToNumber, readVersionAndDescriptor } from './descriptor';
import { checkSignature, createReader, readBytes, readDataRLE, readInt16, readInt32, readPascalString, readPattern, readSignature, readUint16, readUint32, readUint8, skipBytes } from './psdReader';
var dynamicsControl = ['off', 'fade', 'pen pressure', 'pen tilt', 'stylus wheel', 'initial direction', 'direction', 'initial rotation', 'rotation'];
function parseDynamics(desc) {
    return {
        control: dynamicsControl[desc.bVTy],
        steps: desc.fStp,
        jitter: parsePercent(desc.jitter),
        minimum: parsePercent(desc['Mnm ']),
    };
}
function parseBrushShape(desc) {
    var shape = {
        size: parseUnitsToNumber(desc.Dmtr, 'Pixels'),
        angle: parseAngle(desc.Angl),
        roundness: parsePercent(desc.Rndn),
        spacingOn: desc.Intr,
        spacing: parsePercent(desc.Spcn),
        flipX: desc.flipX,
        flipY: desc.flipY,
    };
    if (desc['Nm  '])
        shape.name = desc['Nm  '];
    if (desc.Hrdn)
        shape.hardness = parsePercent(desc.Hrdn);
    if (desc.sampledData)
        shape.sampledData = desc.sampledData;
    return shape;
}
export function readAbr(buffer, options) {
    var _a;
    if (options === void 0) { options = {}; }
    var reader = createReader(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    var version = readInt16(reader);
    var samples = [];
    var brushes = [];
    var patterns = [];
    if (version === 1 || version === 2) {
        throw new Error("Unsupported ABR version (".concat(version, ")")); // TODO: ...
    }
    else if (version === 6 || version === 7 || version === 9 || version === 10) {
        var minorVersion = readInt16(reader);
        if (minorVersion !== 1 && minorVersion !== 2)
            throw new Error('Unsupported ABR minor version');
        while (reader.offset < reader.view.byteLength) {
            checkSignature(reader, '8BIM');
            var type = readSignature(reader);
            var size = readUint32(reader);
            var end = reader.offset + size;
            switch (type) {
                case 'samp': {
                    while (reader.offset < end) {
                        var brushLength = readUint32(reader);
                        while (brushLength & 3)
                            brushLength++; // pad to 4 byte alignment
                        var brushEnd = reader.offset + brushLength;
                        var id = readPascalString(reader, 1);
                        // v1 - Skip the Int16 bounds rectangle and the unknown Int16.
                        // v2 - Skip the unknown bytes.
                        skipBytes(reader, minorVersion === 1 ? 10 : 264);
                        var y = readInt32(reader);
                        var x = readInt32(reader);
                        var h = readInt32(reader) - y;
                        var w = readInt32(reader) - x;
                        if (w <= 0 || h <= 0)
                            throw new Error('Invalid bounds');
                        var depth = readInt16(reader);
                        var compression = readUint8(reader); // 0 - raw, 1 - RLE
                        var alpha = new Uint8Array(w * h);
                        if (depth === 8) {
                            if (compression === 0) {
                                alpha.set(readBytes(reader, alpha.byteLength));
                            }
                            else if (compression === 1) {
                                readDataRLE(reader, { width: w, height: h, data: alpha }, w, h, 1, [0], false);
                            }
                            else {
                                throw new Error('Invalid compression');
                            }
                        }
                        else if (depth === 16) {
                            if (compression === 0) {
                                for (var i = 0; i < alpha.byteLength; i++) {
                                    alpha[i] = readUint16(reader) >> 8; // convert to 8bit values
                                }
                            }
                            else if (compression === 1) {
                                throw new Error('not implemented (16bit RLE)'); // TODO: ...
                            }
                            else {
                                throw new Error('Invalid compression');
                            }
                        }
                        else {
                            throw new Error('Invalid depth');
                        }
                        samples.push({ id: id, bounds: { x: x, y: y, w: w, h: h }, alpha: alpha });
                        reader.offset = brushEnd;
                    }
                    break;
                }
                case 'desc': {
                    var desc = readVersionAndDescriptor(reader);
                    // console.log(require('util').inspect(desc, false, 99, true));
                    for (var _i = 0, _b = desc.Brsh; _i < _b.length; _i++) {
                        var brush = _b[_i];
                        var b = {
                            name: brush['Nm  '],
                            shape: parseBrushShape(brush.Brsh),
                            spacing: parsePercent(brush.Spcn),
                            // TODO: brushGroup ???
                            wetEdges: brush.Wtdg,
                            noise: brush.Nose,
                            // TODO: TxtC ??? smoothing / build-up ?
                            // TODO: 'Rpt ' ???
                            useBrushSize: brush.useBrushSize, // ???
                        };
                        if (brush.interpretation != null)
                            b.interpretation = brush.interpretation;
                        if (brush.protectTexture != null)
                            b.protectTexture = brush.protectTexture;
                        if (brush.useTipDynamics) {
                            b.shapeDynamics = {
                                tiltScale: parsePercent(brush.tiltScale),
                                sizeDynamics: parseDynamics(brush.szVr),
                                angleDynamics: parseDynamics(brush.angleDynamics),
                                roundnessDynamics: parseDynamics(brush.roundnessDynamics),
                                flipX: brush.flipX,
                                flipY: brush.flipY,
                                brushProjection: brush.brushProjection,
                                minimumDiameter: parsePercent(brush.minimumDiameter),
                                minimumRoundness: parsePercent(brush.minimumRoundness),
                            };
                        }
                        if (brush.useScatter) {
                            b.scatter = {
                                count: brush['Cnt '],
                                bothAxes: brush.bothAxes,
                                countDynamics: parseDynamics(brush.countDynamics),
                                scatterDynamics: parseDynamics(brush.scatterDynamics),
                            };
                        }
                        if (brush.useTexture) {
                            b.texture = {
                                id: brush.Txtr.Idnt,
                                name: brush.Txtr['Nm  '],
                                blendMode: BlnM.decode(brush.textureBlendMode),
                                depth: parsePercent(brush.textureDepth),
                                depthMinimum: parsePercent(brush.minimumDepth),
                                depthDynamics: parseDynamics(brush.textureDepthDynamics),
                                scale: parsePercent(brush.textureScale),
                                invert: brush.InvT,
                                brightness: brush.textureBrightness,
                                contrast: brush.textureContrast,
                            };
                        }
                        var db = brush.dualBrush;
                        if (db && db.useDualBrush) {
                            b.dualBrush = {
                                flip: db.Flip,
                                shape: parseBrushShape(db.Brsh),
                                blendMode: BlnM.decode(db.BlnM),
                                useScatter: db.useScatter,
                                spacing: parsePercent(db.Spcn),
                                count: db['Cnt '],
                                bothAxes: db.bothAxes,
                                countDynamics: parseDynamics(db.countDynamics),
                                scatterDynamics: parseDynamics(db.scatterDynamics),
                            };
                        }
                        if (brush.useColorDynamics) {
                            b.colorDynamics = {
                                foregroundBackground: parseDynamics(brush.clVr),
                                hue: parsePercent(brush['H   ']),
                                saturation: parsePercent(brush.Strt),
                                brightness: parsePercent(brush.Brgh),
                                purity: parsePercent(brush.purity),
                                perTip: brush.colorDynamicsPerTip,
                            };
                        }
                        if (brush.usePaintDynamics) {
                            b.transfer = {
                                flowDynamics: parseDynamics(brush.prVr),
                                opacityDynamics: parseDynamics(brush.opVr),
                                wetnessDynamics: parseDynamics(brush.wtVr),
                                mixDynamics: parseDynamics(brush.mxVr),
                            };
                        }
                        if (brush.useBrushPose) {
                            b.brushPose = {
                                overrideAngle: brush.overridePoseAngle,
                                overrideTiltX: brush.overridePoseTiltX,
                                overrideTiltY: brush.overridePoseTiltY,
                                overridePressure: brush.overridePosePressure,
                                pressure: parsePercent(brush.brushPosePressure),
                                tiltX: brush.brushPoseTiltX,
                                tiltY: brush.brushPoseTiltY,
                                angle: brush.brushPoseAngle,
                            };
                        }
                        var to = brush.toolOptions;
                        if (to) {
                            b.toolOptions = {
                                brushPreset: to.brushPreset,
                                flow: to.flow,
                                smooth: to.Smoo,
                                mode: BlnM.decode(to['Md  ']),
                                opacity: to.Opct,
                                smoothing: to.smoothing,
                                smoothingValue: to.smoothingValue,
                                smoothingRadiusMode: to.smoothingRadiusMode,
                                smoothingCatchup: to.smoothingCatchup,
                                smoothingCatchupAtEnd: to.smoothingCatchupAtEnd,
                                smoothingZoomCompensation: to.smoothingZoomCompensation,
                                pressureSmoothing: to.pressureSmoothing,
                                usePressureOverridesSize: to.usePressureOverridesSize,
                                usePressureOverridesOpacity: to.usePressureOverridesOpacity,
                                useLegacy: to.useLegacy,
                            };
                        }
                        brushes.push(b);
                    }
                    break;
                }
                case 'patt': {
                    if (reader.offset < end) { // TODO: check multiple patterns
                        patterns.push(readPattern(reader));
                        reader.offset = end;
                    }
                    break;
                }
                case 'phry': {
                    // TODO: what is this ?
                    var desc = readVersionAndDescriptor(reader);
                    if (options.logMissingFeatures) {
                        if ((_a = desc.hierarchy) === null || _a === void 0 ? void 0 : _a.length) {
                            console.log('unhandled phry section', desc);
                        }
                    }
                    break;
                }
                default:
                    throw new Error("Invalid brush type: ".concat(type));
            }
            // align to 4 bytes
            while (size % 4) {
                reader.offset++;
                size++;
            }
        }
    }
    else {
        throw new Error("Unsupported ABR version (".concat(version, ")"));
    }
    return { samples: samples, patterns: patterns, brushes: brushes };
}

//# sourceMappingURL=data:application/json;charset=utf8;base64,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eyBCbG5NLCBEZXNjcmlwdG9yVW5pdHNWYWx1ZSwgcGFyc2VBbmdsZSwgcGFyc2VQZXJjZW50LCBwYXJzZVVuaXRzVG9OdW1iZXIsIHJlYWRWZXJzaW9uQW5kRGVzY3JpcHRvciB9IGZyb20gJy4vZGVzY3JpcHRvcic7XHJcbmltcG9ydCB7IEJsZW5kTW9kZSwgUGF0dGVybkluZm8gfSBmcm9tICcuL3BzZCc7XHJcbmltcG9ydCB7XHJcblx0Y2hlY2tTaWduYXR1cmUsIGNyZWF0ZVJlYWRlciwgcmVhZEJ5dGVzLCByZWFkRGF0YVJMRSwgcmVhZEludDE2LCByZWFkSW50MzIsIHJlYWRQYXNjYWxTdHJpbmcsIHJlYWRQYXR0ZXJuLFxyXG5cdHJlYWRTaWduYXR1cmUsIHJlYWRVaW50MTYsIHJlYWRVaW50MzIsIHJlYWRVaW50OCwgc2tpcEJ5dGVzXHJcbn0gZnJvbSAnLi9wc2RSZWFkZXInO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBBYnIge1xyXG5cdGJydXNoZXM6IEJydXNoW107XHJcblx0c2FtcGxlczogU2FtcGxlSW5mb1tdO1xyXG5cdHBhdHRlcm5zOiBQYXR0ZXJuSW5mb1tdO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIFNhbXBsZUluZm8ge1xyXG5cdGlkOiBzdHJpbmc7XHJcblx0Ym91bmRzOiB7IHg6IG51bWJlcjsgeTogbnVtYmVyOyB3OiBudW1iZXI7IGg6IG51bWJlcjsgfTtcclxuXHRhbHBoYTogVWludDhBcnJheTtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBCcnVzaER5bmFtaWNzIHtcclxuXHRjb250cm9sOiAnb2ZmJyB8ICdmYWRlJyB8ICdwZW4gcHJlc3N1cmUnIHwgJ3BlbiB0aWx0JyB8ICdzdHlsdXMgd2hlZWwnIHwgJ2luaXRpYWwgZGlyZWN0aW9uJyB8ICdkaXJlY3Rpb24nIHwgJ2luaXRpYWwgcm90YXRpb24nIHwgJ3JvdGF0aW9uJztcclxuXHRzdGVwczogbnVtYmVyOyAvLyBmb3IgZmFkZVxyXG5cdGppdHRlcjogbnVtYmVyO1xyXG5cdG1pbmltdW06IG51bWJlcjtcclxufVxyXG5cclxuY29uc3QgZHluYW1pY3NDb250cm9sID0gWydvZmYnLCAnZmFkZScsICdwZW4gcHJlc3N1cmUnLCAncGVuIHRpbHQnLCAnc3R5bHVzIHdoZWVsJywgJ2luaXRpYWwgZGlyZWN0aW9uJywgJ2RpcmVjdGlvbicsICdpbml0aWFsIHJvdGF0aW9uJywgJ3JvdGF0aW9uJ107XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEJydXNoU2hhcGUge1xyXG5cdG5hbWU/OiBzdHJpbmc7XHJcblx0c2l6ZTogbnVtYmVyO1xyXG5cdGFuZ2xlOiBudW1iZXI7XHJcblx0cm91bmRuZXNzOiBudW1iZXI7XHJcblx0aGFyZG5lc3M/OiBudW1iZXI7XHJcblx0c3BhY2luZ09uOiBib29sZWFuO1xyXG5cdHNwYWNpbmc6IG51bWJlcjtcclxuXHRmbGlwWDogYm9vbGVhbjtcclxuXHRmbGlwWTogYm9vbGVhbjtcclxuXHRzYW1wbGVkRGF0YT86IHN0cmluZztcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBCcnVzaCB7XHJcblx0bmFtZTogc3RyaW5nO1xyXG5cdHNoYXBlOiBCcnVzaFNoYXBlO1xyXG5cdHNoYXBlRHluYW1pY3M/OiB7XHJcblx0XHRzaXplRHluYW1pY3M6IEJydXNoRHluYW1pY3M7XHJcblx0XHRtaW5pbXVtRGlhbWV0ZXI6IG51bWJlcjtcclxuXHRcdHRpbHRTY2FsZTogbnVtYmVyO1xyXG5cdFx0YW5nbGVEeW5hbWljczogQnJ1c2hEeW5hbWljcztcclxuXHRcdHJvdW5kbmVzc0R5bmFtaWNzOiBCcnVzaER5bmFtaWNzO1xyXG5cdFx0bWluaW11bVJvdW5kbmVzczogbnVtYmVyO1xyXG5cdFx0ZmxpcFg6IGJvb2xlYW47XHJcblx0XHRmbGlwWTogYm9vbGVhbjtcclxuXHRcdGJydXNoUHJvamVjdGlvbjogYm9vbGVhbjtcclxuXHR9O1xyXG5cdHNjYXR0ZXI/OiB7XHJcblx0XHRib3RoQXhlczogYm9vbGVhbjtcclxuXHRcdHNjYXR0ZXJEeW5hbWljczogQnJ1c2hEeW5hbWljcztcclxuXHRcdGNvdW50RHluYW1pY3M6IEJydXNoRHluYW1pY3M7XHJcblx0XHRjb3VudDogbnVtYmVyO1xyXG5cdH07XHJcblx0dGV4dHVyZT86IHtcclxuXHRcdGlkOiBzdHJpbmc7XHJcblx0XHRuYW1lOiBzdHJpbmc7XHJcblx0XHRpbnZlcnQ6IGJvb2xlYW47XHJcblx0XHRzY2FsZTogbnVtYmVyO1xyXG5cdFx0YnJpZ2h0bmVzczogbnVtYmVyO1xyXG5cdFx0Y29udHJhc3Q6IG51bWJlcjtcclxuXHRcdGJsZW5kTW9kZTogQmxlbmRNb2RlO1xyXG5cdFx0ZGVwdGg6IG51bWJlcjtcclxuXHRcdGRlcHRoTWluaW11bTogbnVtYmVyO1xyXG5cdFx0ZGVwdGhEeW5hbWljczogQnJ1c2hEeW5hbWljcztcclxuXHR9O1xyXG5cdGR1YWxCcnVzaD86IHtcclxuXHRcdGZsaXA6IGJvb2xlYW47XHJcblx0XHRzaGFwZTogQnJ1c2hTaGFwZTtcclxuXHRcdGJsZW5kTW9kZTogQmxlbmRNb2RlO1xyXG5cdFx0dXNlU2NhdHRlcjogYm9vbGVhbjtcclxuXHRcdHNwYWNpbmc6IG51bWJlcjtcclxuXHRcdGNvdW50OiBudW1iZXI7XHJcblx0XHRib3RoQXhlczogYm9vbGVhbjtcclxuXHRcdGNvdW50RHluYW1pY3M6IEJydXNoRHluYW1pY3M7XHJcblx0XHRzY2F0dGVyRHluYW1pY3M6IEJydXNoRHluYW1pY3M7XHJcblx0fTtcclxuXHRjb2xvckR5bmFtaWNzPzoge1xyXG5cdFx0Zm9yZWdyb3VuZEJhY2tncm91bmQ6IEJydXNoRHluYW1pY3M7XHJcblx0XHRodWU6IG51bWJlcjtcclxuXHRcdHNhdHVyYXRpb246IG51bWJlcjtcclxuXHRcdGJyaWdodG5lc3M6IG51bWJlcjtcclxuXHRcdHB1cml0eTogbnVtYmVyO1xyXG5cdFx0cGVyVGlwOiBib29sZWFuO1xyXG5cdH07XHJcblx0dHJhbnNmZXI/OiB7XHJcblx0XHRmbG93RHluYW1pY3M6IEJydXNoRHluYW1pY3M7XHJcblx0XHRvcGFjaXR5RHluYW1pY3M6IEJydXNoRHluYW1pY3M7XHJcblx0XHR3ZXRuZXNzRHluYW1pY3M6IEJydXNoRHluYW1pY3M7XHJcblx0XHRtaXhEeW5hbWljczogQnJ1c2hEeW5hbWljcztcclxuXHR9O1xyXG5cdGJydXNoUG9zZT86IHtcclxuXHRcdG92ZXJyaWRlQW5nbGU6IGJvb2xlYW47XHJcblx0XHRvdmVycmlkZVRpbHRYOiBib29sZWFuO1xyXG5cdFx0b3ZlcnJpZGVUaWx0WTogYm9vbGVhbjtcclxuXHRcdG92ZXJyaWRlUHJlc3N1cmU6IGJvb2xlYW47XHJcblx0XHRwcmVzc3VyZTogbnVtYmVyO1xyXG5cdFx0dGlsdFg6IG51bWJlcjtcclxuXHRcdHRpbHRZOiBudW1iZXI7XHJcblx0XHRhbmdsZTogbnVtYmVyO1xyXG5cdH07XHJcblx0bm9pc2U6IGJvb2xlYW47XHJcblx0d2V0RWRnZXM6IGJvb2xlYW47XHJcblx0Ly8gVE9ETzogYnVpbGQtdXBcclxuXHQvLyBUT0RPOiBzbW9vdGhpbmdcclxuXHRwcm90ZWN0VGV4dHVyZT86IGJvb2xlYW47XHJcblx0c3BhY2luZzogbnVtYmVyO1xyXG5cdGJydXNoR3JvdXA/OiB1bmRlZmluZWQ7IC8vID9cclxuXHRpbnRlcnByZXRhdGlvbj86IGJvb2xlYW47IC8vID9cclxuXHR1c2VCcnVzaFNpemU6IGJvb2xlYW47IC8vID9cclxuXHR0b29sT3B0aW9ucz86IHtcclxuXHRcdGJydXNoUHJlc2V0OiBib29sZWFuO1xyXG5cdFx0ZmxvdzogbnVtYmVyO1xyXG5cdFx0c21vb3RoOiBudW1iZXI7IC8vID9cclxuXHRcdG1vZGU6IEJsZW5kTW9kZTtcclxuXHRcdG9wYWNpdHk6IG51bWJlcjtcclxuXHRcdHNtb290aGluZzogYm9vbGVhbjtcclxuXHRcdHNtb290aGluZ1ZhbHVlOiBudW1iZXI7XHJcblx0XHRzbW9vdGhpbmdSYWRpdXNNb2RlOiBib29sZWFuO1xyXG5cdFx0c21vb3RoaW5nQ2F0Y2h1cDogYm9vbGVhbjtcclxuXHRcdHNtb290aGluZ0NhdGNodXBBdEVuZDogYm9vbGVhbjtcclxuXHRcdHNtb290aGluZ1pvb21Db21wZW5zYXRpb246IGJvb2xlYW47XHJcblx0XHRwcmVzc3VyZVNtb290aGluZzogYm9vbGVhbjtcclxuXHRcdHVzZVByZXNzdXJlT3ZlcnJpZGVzU2l6ZTogYm9vbGVhbjtcclxuXHRcdHVzZVByZXNzdXJlT3ZlcnJpZGVzT3BhY2l0eTogYm9vbGVhbjtcclxuXHRcdHVzZUxlZ2FjeTogYm9vbGVhbjtcclxuXHR9O1xyXG59XHJcblxyXG4vLyBpbnRlcm5hbFxyXG5cclxuaW50ZXJmYWNlIFBocnlEZXNjcmlwdG9yIHtcclxuXHRoaWVyYXJjaHk6IGFueVtdO1xyXG59XHJcblxyXG5pbnRlcmZhY2UgRHluYW1pY3NEZXNjcmlwdG9yIHtcclxuXHRiVlR5OiBudW1iZXI7XHJcblx0ZlN0cDogbnVtYmVyO1xyXG5cdGppdHRlcjogRGVzY3JpcHRvclVuaXRzVmFsdWU7XHJcblx0J01ubSAnOiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxufVxyXG5cclxuaW50ZXJmYWNlIEJydXNoU2hhcGVEZXNjcmlwdG9yIHtcclxuXHREbXRyOiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHRBbmdsOiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHRSbmRuOiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHQnTm0gICc/OiBzdHJpbmc7XHJcblx0U3BjbjogRGVzY3JpcHRvclVuaXRzVmFsdWU7XHJcblx0SW50cjogYm9vbGVhbjtcclxuXHRIcmRuPzogRGVzY3JpcHRvclVuaXRzVmFsdWU7XHJcblx0ZmxpcFg6IGJvb2xlYW47XHJcblx0ZmxpcFk6IGJvb2xlYW47XHJcblx0c2FtcGxlZERhdGE/OiBzdHJpbmc7XHJcbn1cclxuXHJcbmludGVyZmFjZSBEZXNjRGVzY3JpcHRvciB7XHJcblx0QnJzaDoge1xyXG5cdFx0J05tICAnOiBzdHJpbmc7XHJcblx0XHRCcnNoOiBCcnVzaFNoYXBlRGVzY3JpcHRvcjtcclxuXHRcdHVzZVRpcER5bmFtaWNzOiBib29sZWFuO1xyXG5cdFx0ZmxpcFg6IGJvb2xlYW47XHJcblx0XHRmbGlwWTogYm9vbGVhbjtcclxuXHRcdGJydXNoUHJvamVjdGlvbjogYm9vbGVhbjtcclxuXHRcdG1pbmltdW1EaWFtZXRlcjogRGVzY3JpcHRvclVuaXRzVmFsdWU7XHJcblx0XHRtaW5pbXVtUm91bmRuZXNzOiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHRcdHRpbHRTY2FsZTogRGVzY3JpcHRvclVuaXRzVmFsdWU7XHJcblx0XHRzelZyOiBEeW5hbWljc0Rlc2NyaXB0b3I7XHJcblx0XHRhbmdsZUR5bmFtaWNzOiBEeW5hbWljc0Rlc2NyaXB0b3I7XHJcblx0XHRyb3VuZG5lc3NEeW5hbWljczogRHluYW1pY3NEZXNjcmlwdG9yO1xyXG5cdFx0dXNlU2NhdHRlcjogYm9vbGVhbjtcclxuXHRcdFNwY246IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xyXG5cdFx0J0NudCAnOiBudW1iZXI7XHJcblx0XHRib3RoQXhlczogYm9vbGVhbjtcclxuXHRcdGNvdW50RHluYW1pY3M6IER5bmFtaWNzRGVzY3JpcHRvcjtcclxuXHRcdHNjYXR0ZXJEeW5hbWljczogRHluYW1pY3NEZXNjcmlwdG9yO1xyXG5cdFx0ZHVhbEJydXNoOiB7IHVzZUR1YWxCcnVzaDogZmFsc2U7IH0gfCB7XHJcblx0XHRcdHVzZUR1YWxCcnVzaDogdHJ1ZTtcclxuXHRcdFx0RmxpcDogYm9vbGVhbjtcclxuXHRcdFx0QnJzaDogQnJ1c2hTaGFwZURlc2NyaXB0b3I7XHJcblx0XHRcdEJsbk06IHN0cmluZztcclxuXHRcdFx0dXNlU2NhdHRlcjogYm9vbGVhbjtcclxuXHRcdFx0U3BjbjogRGVzY3JpcHRvclVuaXRzVmFsdWU7XHJcblx0XHRcdCdDbnQgJzogbnVtYmVyO1xyXG5cdFx0XHRib3RoQXhlczogYm9vbGVhbjtcclxuXHRcdFx0Y291bnREeW5hbWljczogRHluYW1pY3NEZXNjcmlwdG9yO1xyXG5cdFx0XHRzY2F0dGVyRHluYW1pY3M6IER5bmFtaWNzRGVzY3JpcHRvcjtcclxuXHRcdH07XHJcblx0XHRicnVzaEdyb3VwOiB7IHVzZUJydXNoR3JvdXA6IGZhbHNlOyB9O1xyXG5cdFx0dXNlVGV4dHVyZTogYm9vbGVhbjtcclxuXHRcdFR4dEM6IGJvb2xlYW47XHJcblx0XHRpbnRlcnByZXRhdGlvbjogYm9vbGVhbjtcclxuXHRcdHRleHR1cmVCbGVuZE1vZGU6IHN0cmluZztcclxuXHRcdHRleHR1cmVEZXB0aDogRGVzY3JpcHRvclVuaXRzVmFsdWU7XHJcblx0XHRtaW5pbXVtRGVwdGg6IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xyXG5cdFx0dGV4dHVyZURlcHRoRHluYW1pY3M6IER5bmFtaWNzRGVzY3JpcHRvcjtcclxuXHRcdFR4dHI6IHtcclxuXHRcdFx0J05tICAnOiBzdHJpbmc7XHJcblx0XHRcdElkbnQ6IHN0cmluZztcclxuXHRcdH07XHJcblx0XHR0ZXh0dXJlU2NhbGU6IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xyXG5cdFx0SW52VDogYm9vbGVhbjtcclxuXHRcdHByb3RlY3RUZXh0dXJlOiBib29sZWFuO1xyXG5cdFx0dGV4dHVyZUJyaWdodG5lc3M6IG51bWJlcjtcclxuXHRcdHRleHR1cmVDb250cmFzdDogbnVtYmVyO1xyXG5cdFx0dXNlUGFpbnREeW5hbWljczogYm9vbGVhbjtcclxuXHRcdHByVnI/OiBEeW5hbWljc0Rlc2NyaXB0b3I7XHJcblx0XHRvcFZyPzogRHluYW1pY3NEZXNjcmlwdG9yO1xyXG5cdFx0d3RWcj86IER5bmFtaWNzRGVzY3JpcHRvcjtcclxuXHRcdG14VnI/OiBEeW5hbWljc0Rlc2NyaXB0b3I7XHJcblx0XHR1c2VDb2xvckR5bmFtaWNzOiBib29sZWFuO1xyXG5cdFx0Y2xWcj86IER5bmFtaWNzRGVzY3JpcHRvcjtcclxuXHRcdCdIICAgJz86IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xyXG5cdFx0U3RydD86IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xyXG5cdFx0QnJnaD86IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xyXG5cdFx0cHVyaXR5PzogRGVzY3JpcHRvclVuaXRzVmFsdWU7XHJcblx0XHRjb2xvckR5bmFtaWNzUGVyVGlwPzogdHJ1ZTtcclxuXHRcdFd0ZGc6IGJvb2xlYW47XHJcblx0XHROb3NlOiBib29sZWFuO1xyXG5cdFx0J1JwdCAnOiBib29sZWFuO1xyXG5cdFx0dXNlQnJ1c2hTaXplOiBib29sZWFuO1xyXG5cdFx0dXNlQnJ1c2hQb3NlOiBib29sZWFuO1xyXG5cdFx0b3ZlcnJpZGVQb3NlQW5nbGU/OiBib29sZWFuO1xyXG5cdFx0b3ZlcnJpZGVQb3NlVGlsdFg/OiBib29sZWFuO1xyXG5cdFx0b3ZlcnJpZGVQb3NlVGlsdFk/OiBib29sZWFuO1xyXG5cdFx0b3ZlcnJpZGVQb3NlUHJlc3N1cmU/OiBib29sZWFuO1xyXG5cdFx0YnJ1c2hQb3NlUHJlc3N1cmU/OiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHRcdGJydXNoUG9zZVRpbHRYPzogbnVtYmVyO1xyXG5cdFx0YnJ1c2hQb3NlVGlsdFk/OiBudW1iZXI7XHJcblx0XHRicnVzaFBvc2VBbmdsZT86IG51bWJlcjtcclxuXHRcdHRvb2xPcHRpb25zPzoge1xyXG5cdFx0XHRicnVzaFByZXNldDogYm9vbGVhbjtcclxuXHRcdFx0ZmxvdzogbnVtYmVyO1xyXG5cdFx0XHRTbW9vOiBudW1iZXI7XHJcblx0XHRcdCdNZCAgJzogc3RyaW5nO1xyXG5cdFx0XHRPcGN0OiBudW1iZXI7XHJcblx0XHRcdHNtb290aGluZzogYm9vbGVhbjtcclxuXHRcdFx0c21vb3RoaW5nVmFsdWU6IG51bWJlcjtcclxuXHRcdFx0c21vb3RoaW5nUmFkaXVzTW9kZTogYm9vbGVhbjtcclxuXHRcdFx0c21vb3RoaW5nQ2F0Y2h1cDogYm9vbGVhbjtcclxuXHRcdFx0c21vb3RoaW5nQ2F0Y2h1cEF0RW5kOiBib29sZWFuO1xyXG5cdFx0XHRzbW9vdGhpbmdab29tQ29tcGVuc2F0aW9uOiBib29sZWFuO1xyXG5cdFx0XHRwcmVzc3VyZVNtb290aGluZzogYm9vbGVhbjtcclxuXHRcdFx0dXNlUHJlc3N1cmVPdmVycmlkZXNTaXplOiBib29sZWFuO1xyXG5cdFx0XHR1c2VQcmVzc3VyZU92ZXJyaWRlc09wYWNpdHk6IGJvb2xlYW47XHJcblx0XHRcdHVzZUxlZ2FjeTogYm9vbGVhbjtcclxuXHRcdH07XHJcblx0fVtdO1xyXG59XHJcblxyXG5mdW5jdGlvbiBwYXJzZUR5bmFtaWNzKGRlc2M6IER5bmFtaWNzRGVzY3JpcHRvcik6IEJydXNoRHluYW1pY3Mge1xyXG5cdHJldHVybiB7XHJcblx0XHRjb250cm9sOiBkeW5hbWljc0NvbnRyb2xbZGVzYy5iVlR5XSBhcyBhbnksXHJcblx0XHRzdGVwczogZGVzYy5mU3RwLFxyXG5cdFx0aml0dGVyOiBwYXJzZVBlcmNlbnQoZGVzYy5qaXR0ZXIpLFxyXG5cdFx0bWluaW11bTogcGFyc2VQZXJjZW50KGRlc2NbJ01ubSAnXSksXHJcblx0fTtcclxufVxyXG5cclxuZnVuY3Rpb24gcGFyc2VCcnVzaFNoYXBlKGRlc2M6IEJydXNoU2hhcGVEZXNjcmlwdG9yKTogQnJ1c2hTaGFwZSB7XHJcblx0Y29uc3Qgc2hhcGU6IEJydXNoU2hhcGUgPSB7XHJcblx0XHRzaXplOiBwYXJzZVVuaXRzVG9OdW1iZXIoZGVzYy5EbXRyLCAnUGl4ZWxzJyksXHJcblx0XHRhbmdsZTogcGFyc2VBbmdsZShkZXNjLkFuZ2wpLFxyXG5cdFx0cm91bmRuZXNzOiBwYXJzZVBlcmNlbnQoZGVzYy5SbmRuKSxcclxuXHRcdHNwYWNpbmdPbjogZGVzYy5JbnRyLFxyXG5cdFx0c3BhY2luZzogcGFyc2VQZXJjZW50KGRlc2MuU3BjbiksXHJcblx0XHRmbGlwWDogZGVzYy5mbGlwWCxcclxuXHRcdGZsaXBZOiBkZXNjLmZsaXBZLFxyXG5cdH07XHJcblxyXG5cdGlmIChkZXNjWydObSAgJ10pIHNoYXBlLm5hbWUgPSBkZXNjWydObSAgJ107XHJcblx0aWYgKGRlc2MuSHJkbikgc2hhcGUuaGFyZG5lc3MgPSBwYXJzZVBlcmNlbnQoZGVzYy5IcmRuKTtcclxuXHRpZiAoZGVzYy5zYW1wbGVkRGF0YSkgc2hhcGUuc2FtcGxlZERhdGEgPSBkZXNjLnNhbXBsZWREYXRhO1xyXG5cclxuXHRyZXR1cm4gc2hhcGU7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWFkQWJyKGJ1ZmZlcjogQXJyYXlCdWZmZXJWaWV3LCBvcHRpb25zOiB7IGxvZ01pc3NpbmdGZWF0dXJlcz86IGJvb2xlYW47IH0gPSB7fSk6IEFiciB7XHJcblx0Y29uc3QgcmVhZGVyID0gY3JlYXRlUmVhZGVyKGJ1ZmZlci5idWZmZXIsIGJ1ZmZlci5ieXRlT2Zmc2V0LCBidWZmZXIuYnl0ZUxlbmd0aCk7XHJcblx0Y29uc3QgdmVyc2lvbiA9IHJlYWRJbnQxNihyZWFkZXIpO1xyXG5cdGNvbnN0IHNhbXBsZXM6IFNhbXBsZUluZm9bXSA9IFtdO1xyXG5cdGNvbnN0IGJydXNoZXM6IEJydXNoW10gPSBbXTtcclxuXHRjb25zdCBwYXR0ZXJuczogUGF0dGVybkluZm9bXSA9IFtdO1xyXG5cclxuXHRpZiAodmVyc2lvbiA9PT0gMSB8fCB2ZXJzaW9uID09PSAyKSB7XHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIEFCUiB2ZXJzaW9uICgke3ZlcnNpb259KWApOyAvLyBUT0RPOiAuLi5cclxuXHR9IGVsc2UgaWYgKHZlcnNpb24gPT09IDYgfHwgdmVyc2lvbiA9PT0gNyB8fCB2ZXJzaW9uID09PSA5IHx8IHZlcnNpb24gPT09IDEwKSB7XHJcblx0XHRjb25zdCBtaW5vclZlcnNpb24gPSByZWFkSW50MTYocmVhZGVyKTtcclxuXHRcdGlmIChtaW5vclZlcnNpb24gIT09IDEgJiYgbWlub3JWZXJzaW9uICE9PSAyKSB0aHJvdyBuZXcgRXJyb3IoJ1Vuc3VwcG9ydGVkIEFCUiBtaW5vciB2ZXJzaW9uJyk7XHJcblxyXG5cdFx0d2hpbGUgKHJlYWRlci5vZmZzZXQgPCByZWFkZXIudmlldy5ieXRlTGVuZ3RoKSB7XHJcblx0XHRcdGNoZWNrU2lnbmF0dXJlKHJlYWRlciwgJzhCSU0nKTtcclxuXHRcdFx0Y29uc3QgdHlwZSA9IHJlYWRTaWduYXR1cmUocmVhZGVyKSBhcyAnc2FtcCcgfCAnZGVzYycgfCAncGF0dCcgfCAncGhyeSc7XHJcblx0XHRcdGxldCBzaXplID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0XHRjb25zdCBlbmQgPSByZWFkZXIub2Zmc2V0ICsgc2l6ZTtcclxuXHJcblx0XHRcdHN3aXRjaCAodHlwZSkge1xyXG5cdFx0XHRcdGNhc2UgJ3NhbXAnOiB7XHJcblx0XHRcdFx0XHR3aGlsZSAocmVhZGVyLm9mZnNldCA8IGVuZCkge1xyXG5cdFx0XHRcdFx0XHRsZXQgYnJ1c2hMZW5ndGggPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRcdFx0XHRcdHdoaWxlIChicnVzaExlbmd0aCAmIDBiMTEpIGJydXNoTGVuZ3RoKys7IC8vIHBhZCB0byA0IGJ5dGUgYWxpZ25tZW50XHJcblx0XHRcdFx0XHRcdGNvbnN0IGJydXNoRW5kID0gcmVhZGVyLm9mZnNldCArIGJydXNoTGVuZ3RoO1xyXG5cclxuXHRcdFx0XHRcdFx0Y29uc3QgaWQgPSByZWFkUGFzY2FsU3RyaW5nKHJlYWRlciwgMSk7XHJcblxyXG5cdFx0XHRcdFx0XHQvLyB2MSAtIFNraXAgdGhlIEludDE2IGJvdW5kcyByZWN0YW5nbGUgYW5kIHRoZSB1bmtub3duIEludDE2LlxyXG5cdFx0XHRcdFx0XHQvLyB2MiAtIFNraXAgdGhlIHVua25vd24gYnl0ZXMuXHJcblx0XHRcdFx0XHRcdHNraXBCeXRlcyhyZWFkZXIsIG1pbm9yVmVyc2lvbiA9PT0gMSA/IDEwIDogMjY0KTtcclxuXHJcblx0XHRcdFx0XHRcdGNvbnN0IHkgPSByZWFkSW50MzIocmVhZGVyKTtcclxuXHRcdFx0XHRcdFx0Y29uc3QgeCA9IHJlYWRJbnQzMihyZWFkZXIpO1xyXG5cdFx0XHRcdFx0XHRjb25zdCBoID0gcmVhZEludDMyKHJlYWRlcikgLSB5O1xyXG5cdFx0XHRcdFx0XHRjb25zdCB3ID0gcmVhZEludDMyKHJlYWRlcikgLSB4O1xyXG5cdFx0XHRcdFx0XHRpZiAodyA8PSAwIHx8IGggPD0gMCkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGJvdW5kcycpO1xyXG5cclxuXHRcdFx0XHRcdFx0Y29uc3QgZGVwdGggPSByZWFkSW50MTYocmVhZGVyKTtcclxuXHRcdFx0XHRcdFx0Y29uc3QgY29tcHJlc3Npb24gPSByZWFkVWludDgocmVhZGVyKTsgLy8gMCAtIHJhdywgMSAtIFJMRVxyXG5cdFx0XHRcdFx0XHRjb25zdCBhbHBoYSA9IG5ldyBVaW50OEFycmF5KHcgKiBoKTtcclxuXHJcblx0XHRcdFx0XHRcdGlmIChkZXB0aCA9PT0gOCkge1xyXG5cdFx0XHRcdFx0XHRcdGlmIChjb21wcmVzc2lvbiA9PT0gMCkge1xyXG5cdFx0XHRcdFx0XHRcdFx0YWxwaGEuc2V0KHJlYWRCeXRlcyhyZWFkZXIsIGFscGhhLmJ5dGVMZW5ndGgpKTtcclxuXHRcdFx0XHRcdFx0XHR9IGVsc2UgaWYgKGNvbXByZXNzaW9uID09PSAxKSB7XHJcblx0XHRcdFx0XHRcdFx0XHRyZWFkRGF0YVJMRShyZWFkZXIsIHsgd2lkdGg6IHcsIGhlaWdodDogaCwgZGF0YTogYWxwaGEgfSwgdywgaCwgMSwgWzBdLCBmYWxzZSk7XHJcblx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjb21wcmVzc2lvbicpO1xyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0fSBlbHNlIGlmIChkZXB0aCA9PT0gMTYpIHtcclxuXHRcdFx0XHRcdFx0XHRpZiAoY29tcHJlc3Npb24gPT09IDApIHtcclxuXHRcdFx0XHRcdFx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgYWxwaGEuYnl0ZUxlbmd0aDsgaSsrKSB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdGFscGhhW2ldID0gcmVhZFVpbnQxNihyZWFkZXIpID4+IDg7IC8vIGNvbnZlcnQgdG8gOGJpdCB2YWx1ZXNcclxuXHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHR9IGVsc2UgaWYgKGNvbXByZXNzaW9uID09PSAxKSB7XHJcblx0XHRcdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCAoMTZiaXQgUkxFKScpOyAvLyBUT0RPOiAuLi5cclxuXHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGNvbXByZXNzaW9uJyk7XHJcblx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBkZXB0aCcpO1xyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHRzYW1wbGVzLnB1c2goeyBpZCwgYm91bmRzOiB7IHgsIHksIHcsIGggfSwgYWxwaGEgfSk7XHJcblx0XHRcdFx0XHRcdHJlYWRlci5vZmZzZXQgPSBicnVzaEVuZDtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRjYXNlICdkZXNjJzoge1xyXG5cdFx0XHRcdFx0Y29uc3QgZGVzYzogRGVzY0Rlc2NyaXB0b3IgPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKTtcclxuXHRcdFx0XHRcdC8vIGNvbnNvbGUubG9nKHJlcXVpcmUoJ3V0aWwnKS5pbnNwZWN0KGRlc2MsIGZhbHNlLCA5OSwgdHJ1ZSkpO1xyXG5cclxuXHRcdFx0XHRcdGZvciAoY29uc3QgYnJ1c2ggb2YgZGVzYy5CcnNoKSB7XHJcblx0XHRcdFx0XHRcdGNvbnN0IGI6IEJydXNoID0ge1xyXG5cdFx0XHRcdFx0XHRcdG5hbWU6IGJydXNoWydObSAgJ10sXHJcblx0XHRcdFx0XHRcdFx0c2hhcGU6IHBhcnNlQnJ1c2hTaGFwZShicnVzaC5CcnNoKSxcclxuXHRcdFx0XHRcdFx0XHRzcGFjaW5nOiBwYXJzZVBlcmNlbnQoYnJ1c2guU3BjbiksXHJcblx0XHRcdFx0XHRcdFx0Ly8gVE9ETzogYnJ1c2hHcm91cCA/Pz9cclxuXHRcdFx0XHRcdFx0XHR3ZXRFZGdlczogYnJ1c2guV3RkZyxcclxuXHRcdFx0XHRcdFx0XHRub2lzZTogYnJ1c2guTm9zZSxcclxuXHRcdFx0XHRcdFx0XHQvLyBUT0RPOiBUeHRDID8/PyBzbW9vdGhpbmcgLyBidWlsZC11cCA/XHJcblx0XHRcdFx0XHRcdFx0Ly8gVE9ETzogJ1JwdCAnID8/P1xyXG5cdFx0XHRcdFx0XHRcdHVzZUJydXNoU2l6ZTogYnJ1c2gudXNlQnJ1c2hTaXplLCAvLyA/Pz9cclxuXHRcdFx0XHRcdFx0fTtcclxuXHJcblx0XHRcdFx0XHRcdGlmIChicnVzaC5pbnRlcnByZXRhdGlvbiAhPSBudWxsKSBiLmludGVycHJldGF0aW9uID0gYnJ1c2guaW50ZXJwcmV0YXRpb247XHJcblx0XHRcdFx0XHRcdGlmIChicnVzaC5wcm90ZWN0VGV4dHVyZSAhPSBudWxsKSBiLnByb3RlY3RUZXh0dXJlID0gYnJ1c2gucHJvdGVjdFRleHR1cmU7XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAoYnJ1c2gudXNlVGlwRHluYW1pY3MpIHtcclxuXHRcdFx0XHRcdFx0XHRiLnNoYXBlRHluYW1pY3MgPSB7XHJcblx0XHRcdFx0XHRcdFx0XHR0aWx0U2NhbGU6IHBhcnNlUGVyY2VudChicnVzaC50aWx0U2NhbGUpLFxyXG5cdFx0XHRcdFx0XHRcdFx0c2l6ZUR5bmFtaWNzOiBwYXJzZUR5bmFtaWNzKGJydXNoLnN6VnIpLFxyXG5cdFx0XHRcdFx0XHRcdFx0YW5nbGVEeW5hbWljczogcGFyc2VEeW5hbWljcyhicnVzaC5hbmdsZUR5bmFtaWNzKSxcclxuXHRcdFx0XHRcdFx0XHRcdHJvdW5kbmVzc0R5bmFtaWNzOiBwYXJzZUR5bmFtaWNzKGJydXNoLnJvdW5kbmVzc0R5bmFtaWNzKSxcclxuXHRcdFx0XHRcdFx0XHRcdGZsaXBYOiBicnVzaC5mbGlwWCxcclxuXHRcdFx0XHRcdFx0XHRcdGZsaXBZOiBicnVzaC5mbGlwWSxcclxuXHRcdFx0XHRcdFx0XHRcdGJydXNoUHJvamVjdGlvbjogYnJ1c2guYnJ1c2hQcm9qZWN0aW9uLFxyXG5cdFx0XHRcdFx0XHRcdFx0bWluaW11bURpYW1ldGVyOiBwYXJzZVBlcmNlbnQoYnJ1c2gubWluaW11bURpYW1ldGVyKSxcclxuXHRcdFx0XHRcdFx0XHRcdG1pbmltdW1Sb3VuZG5lc3M6IHBhcnNlUGVyY2VudChicnVzaC5taW5pbXVtUm91bmRuZXNzKSxcclxuXHRcdFx0XHRcdFx0XHR9O1xyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAoYnJ1c2gudXNlU2NhdHRlcikge1xyXG5cdFx0XHRcdFx0XHRcdGIuc2NhdHRlciA9IHtcclxuXHRcdFx0XHRcdFx0XHRcdGNvdW50OiBicnVzaFsnQ250ICddLFxyXG5cdFx0XHRcdFx0XHRcdFx0Ym90aEF4ZXM6IGJydXNoLmJvdGhBeGVzLFxyXG5cdFx0XHRcdFx0XHRcdFx0Y291bnREeW5hbWljczogcGFyc2VEeW5hbWljcyhicnVzaC5jb3VudER5bmFtaWNzKSxcclxuXHRcdFx0XHRcdFx0XHRcdHNjYXR0ZXJEeW5hbWljczogcGFyc2VEeW5hbWljcyhicnVzaC5zY2F0dGVyRHluYW1pY3MpLFxyXG5cdFx0XHRcdFx0XHRcdH07XHJcblx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRcdGlmIChicnVzaC51c2VUZXh0dXJlKSB7XHJcblx0XHRcdFx0XHRcdFx0Yi50ZXh0dXJlID0ge1xyXG5cdFx0XHRcdFx0XHRcdFx0aWQ6IGJydXNoLlR4dHIuSWRudCxcclxuXHRcdFx0XHRcdFx0XHRcdG5hbWU6IGJydXNoLlR4dHJbJ05tICAnXSxcclxuXHRcdFx0XHRcdFx0XHRcdGJsZW5kTW9kZTogQmxuTS5kZWNvZGUoYnJ1c2gudGV4dHVyZUJsZW5kTW9kZSksXHJcblx0XHRcdFx0XHRcdFx0XHRkZXB0aDogcGFyc2VQZXJjZW50KGJydXNoLnRleHR1cmVEZXB0aCksXHJcblx0XHRcdFx0XHRcdFx0XHRkZXB0aE1pbmltdW06IHBhcnNlUGVyY2VudChicnVzaC5taW5pbXVtRGVwdGgpLFxyXG5cdFx0XHRcdFx0XHRcdFx0ZGVwdGhEeW5hbWljczogcGFyc2VEeW5hbWljcyhicnVzaC50ZXh0dXJlRGVwdGhEeW5hbWljcyksXHJcblx0XHRcdFx0XHRcdFx0XHRzY2FsZTogcGFyc2VQZXJjZW50KGJydXNoLnRleHR1cmVTY2FsZSksXHJcblx0XHRcdFx0XHRcdFx0XHRpbnZlcnQ6IGJydXNoLkludlQsXHJcblx0XHRcdFx0XHRcdFx0XHRicmlnaHRuZXNzOiBicnVzaC50ZXh0dXJlQnJpZ2h0bmVzcyxcclxuXHRcdFx0XHRcdFx0XHRcdGNvbnRyYXN0OiBicnVzaC50ZXh0dXJlQ29udHJhc3QsXHJcblx0XHRcdFx0XHRcdFx0fTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdFx0Y29uc3QgZGIgPSBicnVzaC5kdWFsQnJ1c2g7XHJcblx0XHRcdFx0XHRcdGlmIChkYiAmJiBkYi51c2VEdWFsQnJ1c2gpIHtcclxuXHRcdFx0XHRcdFx0XHRiLmR1YWxCcnVzaCA9IHtcclxuXHRcdFx0XHRcdFx0XHRcdGZsaXA6IGRiLkZsaXAsXHJcblx0XHRcdFx0XHRcdFx0XHRzaGFwZTogcGFyc2VCcnVzaFNoYXBlKGRiLkJyc2gpLFxyXG5cdFx0XHRcdFx0XHRcdFx0YmxlbmRNb2RlOiBCbG5NLmRlY29kZShkYi5CbG5NKSxcclxuXHRcdFx0XHRcdFx0XHRcdHVzZVNjYXR0ZXI6IGRiLnVzZVNjYXR0ZXIsXHJcblx0XHRcdFx0XHRcdFx0XHRzcGFjaW5nOiBwYXJzZVBlcmNlbnQoZGIuU3BjbiksXHJcblx0XHRcdFx0XHRcdFx0XHRjb3VudDogZGJbJ0NudCAnXSxcclxuXHRcdFx0XHRcdFx0XHRcdGJvdGhBeGVzOiBkYi5ib3RoQXhlcyxcclxuXHRcdFx0XHRcdFx0XHRcdGNvdW50RHluYW1pY3M6IHBhcnNlRHluYW1pY3MoZGIuY291bnREeW5hbWljcyksXHJcblx0XHRcdFx0XHRcdFx0XHRzY2F0dGVyRHluYW1pY3M6IHBhcnNlRHluYW1pY3MoZGIuc2NhdHRlckR5bmFtaWNzKSxcclxuXHRcdFx0XHRcdFx0XHR9O1xyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAoYnJ1c2gudXNlQ29sb3JEeW5hbWljcykge1xyXG5cdFx0XHRcdFx0XHRcdGIuY29sb3JEeW5hbWljcyA9IHtcclxuXHRcdFx0XHRcdFx0XHRcdGZvcmVncm91bmRCYWNrZ3JvdW5kOiBwYXJzZUR5bmFtaWNzKGJydXNoLmNsVnIhKSxcclxuXHRcdFx0XHRcdFx0XHRcdGh1ZTogcGFyc2VQZXJjZW50KGJydXNoWydIICAgJ10hKSxcclxuXHRcdFx0XHRcdFx0XHRcdHNhdHVyYXRpb246IHBhcnNlUGVyY2VudChicnVzaC5TdHJ0ISksXHJcblx0XHRcdFx0XHRcdFx0XHRicmlnaHRuZXNzOiBwYXJzZVBlcmNlbnQoYnJ1c2guQnJnaCEpLFxyXG5cdFx0XHRcdFx0XHRcdFx0cHVyaXR5OiBwYXJzZVBlcmNlbnQoYnJ1c2gucHVyaXR5ISksXHJcblx0XHRcdFx0XHRcdFx0XHRwZXJUaXA6IGJydXNoLmNvbG9yRHluYW1pY3NQZXJUaXAhLFxyXG5cdFx0XHRcdFx0XHRcdH07XHJcblx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRcdGlmIChicnVzaC51c2VQYWludER5bmFtaWNzKSB7XHJcblx0XHRcdFx0XHRcdFx0Yi50cmFuc2ZlciA9IHtcclxuXHRcdFx0XHRcdFx0XHRcdGZsb3dEeW5hbWljczogcGFyc2VEeW5hbWljcyhicnVzaC5wclZyISksXHJcblx0XHRcdFx0XHRcdFx0XHRvcGFjaXR5RHluYW1pY3M6IHBhcnNlRHluYW1pY3MoYnJ1c2gub3BWciEpLFxyXG5cdFx0XHRcdFx0XHRcdFx0d2V0bmVzc0R5bmFtaWNzOiBwYXJzZUR5bmFtaWNzKGJydXNoLnd0VnIhKSxcclxuXHRcdFx0XHRcdFx0XHRcdG1peER5bmFtaWNzOiBwYXJzZUR5bmFtaWNzKGJydXNoLm14VnIhKSxcclxuXHRcdFx0XHRcdFx0XHR9O1xyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAoYnJ1c2gudXNlQnJ1c2hQb3NlKSB7XHJcblx0XHRcdFx0XHRcdFx0Yi5icnVzaFBvc2UgPSB7XHJcblx0XHRcdFx0XHRcdFx0XHRvdmVycmlkZUFuZ2xlOiBicnVzaC5vdmVycmlkZVBvc2VBbmdsZSEsXHJcblx0XHRcdFx0XHRcdFx0XHRvdmVycmlkZVRpbHRYOiBicnVzaC5vdmVycmlkZVBvc2VUaWx0WCEsXHJcblx0XHRcdFx0XHRcdFx0XHRvdmVycmlkZVRpbHRZOiBicnVzaC5vdmVycmlkZVBvc2VUaWx0WSEsXHJcblx0XHRcdFx0XHRcdFx0XHRvdmVycmlkZVByZXNzdXJlOiBicnVzaC5vdmVycmlkZVBvc2VQcmVzc3VyZSEsXHJcblx0XHRcdFx0XHRcdFx0XHRwcmVzc3VyZTogcGFyc2VQZXJjZW50KGJydXNoLmJydXNoUG9zZVByZXNzdXJlISksXHJcblx0XHRcdFx0XHRcdFx0XHR0aWx0WDogYnJ1c2guYnJ1c2hQb3NlVGlsdFghLFxyXG5cdFx0XHRcdFx0XHRcdFx0dGlsdFk6IGJydXNoLmJydXNoUG9zZVRpbHRZISxcclxuXHRcdFx0XHRcdFx0XHRcdGFuZ2xlOiBicnVzaC5icnVzaFBvc2VBbmdsZSEsXHJcblx0XHRcdFx0XHRcdFx0fTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdFx0Y29uc3QgdG8gPSBicnVzaC50b29sT3B0aW9ucztcclxuXHRcdFx0XHRcdFx0aWYgKHRvKSB7XHJcblx0XHRcdFx0XHRcdFx0Yi50b29sT3B0aW9ucyA9IHtcclxuXHRcdFx0XHRcdFx0XHRcdGJydXNoUHJlc2V0OiB0by5icnVzaFByZXNldCxcclxuXHRcdFx0XHRcdFx0XHRcdGZsb3c6IHRvLmZsb3csXHJcblx0XHRcdFx0XHRcdFx0XHRzbW9vdGg6IHRvLlNtb28sXHJcblx0XHRcdFx0XHRcdFx0XHRtb2RlOiBCbG5NLmRlY29kZSh0b1snTWQgICddKSxcclxuXHRcdFx0XHRcdFx0XHRcdG9wYWNpdHk6IHRvLk9wY3QsXHJcblx0XHRcdFx0XHRcdFx0XHRzbW9vdGhpbmc6IHRvLnNtb290aGluZyxcclxuXHRcdFx0XHRcdFx0XHRcdHNtb290aGluZ1ZhbHVlOiB0by5zbW9vdGhpbmdWYWx1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdHNtb290aGluZ1JhZGl1c01vZGU6IHRvLnNtb290aGluZ1JhZGl1c01vZGUsXHJcblx0XHRcdFx0XHRcdFx0XHRzbW9vdGhpbmdDYXRjaHVwOiB0by5zbW9vdGhpbmdDYXRjaHVwLFxyXG5cdFx0XHRcdFx0XHRcdFx0c21vb3RoaW5nQ2F0Y2h1cEF0RW5kOiB0by5zbW9vdGhpbmdDYXRjaHVwQXRFbmQsXHJcblx0XHRcdFx0XHRcdFx0XHRzbW9vdGhpbmdab29tQ29tcGVuc2F0aW9uOiB0by5zbW9vdGhpbmdab29tQ29tcGVuc2F0aW9uLFxyXG5cdFx0XHRcdFx0XHRcdFx0cHJlc3N1cmVTbW9vdGhpbmc6IHRvLnByZXNzdXJlU21vb3RoaW5nLFxyXG5cdFx0XHRcdFx0XHRcdFx0dXNlUHJlc3N1cmVPdmVycmlkZXNTaXplOiB0by51c2VQcmVzc3VyZU92ZXJyaWRlc1NpemUsXHJcblx0XHRcdFx0XHRcdFx0XHR1c2VQcmVzc3VyZU92ZXJyaWRlc09wYWNpdHk6IHRvLnVzZVByZXNzdXJlT3ZlcnJpZGVzT3BhY2l0eSxcclxuXHRcdFx0XHRcdFx0XHRcdHVzZUxlZ2FjeTogdG8udXNlTGVnYWN5LFxyXG5cdFx0XHRcdFx0XHRcdH07XHJcblx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRcdGJydXNoZXMucHVzaChiKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRjYXNlICdwYXR0Jzoge1xyXG5cdFx0XHRcdFx0aWYgKHJlYWRlci5vZmZzZXQgPCBlbmQpIHsgLy8gVE9ETzogY2hlY2sgbXVsdGlwbGUgcGF0dGVybnNcclxuXHRcdFx0XHRcdFx0cGF0dGVybnMucHVzaChyZWFkUGF0dGVybihyZWFkZXIpKTtcclxuXHRcdFx0XHRcdFx0cmVhZGVyLm9mZnNldCA9IGVuZDtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRjYXNlICdwaHJ5Jzoge1xyXG5cdFx0XHRcdFx0Ly8gVE9ETzogd2hhdCBpcyB0aGlzID9cclxuXHRcdFx0XHRcdGNvbnN0IGRlc2M6IFBocnlEZXNjcmlwdG9yID0gcmVhZFZlcnNpb25BbmREZXNjcmlwdG9yKHJlYWRlcik7XHJcblx0XHRcdFx0XHRpZiAob3B0aW9ucy5sb2dNaXNzaW5nRmVhdHVyZXMpIHtcclxuXHRcdFx0XHRcdFx0aWYgKGRlc2MuaGllcmFyY2h5Py5sZW5ndGgpIHtcclxuXHRcdFx0XHRcdFx0XHRjb25zb2xlLmxvZygndW5oYW5kbGVkIHBocnkgc2VjdGlvbicsIGRlc2MpO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0ZGVmYXVsdDpcclxuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBicnVzaCB0eXBlOiAke3R5cGV9YCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIGFsaWduIHRvIDQgYnl0ZXNcclxuXHRcdFx0d2hpbGUgKHNpemUgJSA0KSB7XHJcblx0XHRcdFx0cmVhZGVyLm9mZnNldCsrO1xyXG5cdFx0XHRcdHNpemUrKztcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH0gZWxzZSB7XHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIEFCUiB2ZXJzaW9uICgke3ZlcnNpb259KWApO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIHsgc2FtcGxlcywgcGF0dGVybnMsIGJydXNoZXMgfTtcclxufVxyXG4iXSwic291cmNlUm9vdCI6IkY6XFxwcm9qZWN0c1xcYWctcHNkXFxzcmMifQ==
