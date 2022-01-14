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
        throw new Error("Unsupported ABR version (" + version + ")"); // TODO: ...
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
                    throw new Error("Invalid brush type: " + type);
            }
            // align to 4 bytes
            while (size % 4) {
                reader.offset++;
                size++;
            }
        }
    }
    else {
        throw new Error("Unsupported ABR version (" + version + ")");
    }
    return { samples: samples, patterns: patterns, brushes: brushes };
}

//# sourceMappingURL=data:application/json;charset=utf8;base64,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TSwgRGVzY3JpcHRvclVuaXRzVmFsdWUsIHBhcnNlQW5nbGUsIHBhcnNlUGVyY2VudCwgcGFyc2VVbml0c1RvTnVtYmVyLCByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IgfSBmcm9tICcuL2Rlc2NyaXB0b3InO1xyXG5pbXBvcnQgeyBCbGVuZE1vZGUsIFBhdHRlcm5JbmZvIH0gZnJvbSAnLi9wc2QnO1xyXG5pbXBvcnQge1xyXG5cdGNoZWNrU2lnbmF0dXJlLCBjcmVhdGVSZWFkZXIsIHJlYWRCeXRlcywgcmVhZERhdGFSTEUsIHJlYWRJbnQxNiwgcmVhZEludDMyLCByZWFkUGFzY2FsU3RyaW5nLCByZWFkUGF0dGVybixcclxuXHRyZWFkU2lnbmF0dXJlLCByZWFkVWludDE2LCByZWFkVWludDMyLCByZWFkVWludDgsIHNraXBCeXRlc1xyXG59IGZyb20gJy4vcHNkUmVhZGVyJztcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgQWJyIHtcclxuXHRicnVzaGVzOiBCcnVzaFtdO1xyXG5cdHNhbXBsZXM6IFNhbXBsZUluZm9bXTtcclxuXHRwYXR0ZXJuczogUGF0dGVybkluZm9bXTtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBTYW1wbGVJbmZvIHtcclxuXHRpZDogc3RyaW5nO1xyXG5cdGJvdW5kczogeyB4OiBudW1iZXI7IHk6IG51bWJlcjsgdzogbnVtYmVyOyBoOiBudW1iZXI7IH07XHJcblx0YWxwaGE6IFVpbnQ4QXJyYXk7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgQnJ1c2hEeW5hbWljcyB7XHJcblx0Y29udHJvbDogJ29mZicgfCAnZmFkZScgfCAncGVuIHByZXNzdXJlJyB8ICdwZW4gdGlsdCcgfCAnc3R5bHVzIHdoZWVsJyB8ICdpbml0aWFsIGRpcmVjdGlvbicgfCAnZGlyZWN0aW9uJyB8ICdpbml0aWFsIHJvdGF0aW9uJyB8ICdyb3RhdGlvbic7XHJcblx0c3RlcHM6IG51bWJlcjsgLy8gZm9yIGZhZGVcclxuXHRqaXR0ZXI6IG51bWJlcjtcclxuXHRtaW5pbXVtOiBudW1iZXI7XHJcbn1cclxuXHJcbmNvbnN0IGR5bmFtaWNzQ29udHJvbCA9IFsnb2ZmJywgJ2ZhZGUnLCAncGVuIHByZXNzdXJlJywgJ3BlbiB0aWx0JywgJ3N0eWx1cyB3aGVlbCcsICdpbml0aWFsIGRpcmVjdGlvbicsICdkaXJlY3Rpb24nLCAnaW5pdGlhbCByb3RhdGlvbicsICdyb3RhdGlvbiddO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBCcnVzaFNoYXBlIHtcclxuXHRuYW1lPzogc3RyaW5nO1xyXG5cdHNpemU6IG51bWJlcjtcclxuXHRhbmdsZTogbnVtYmVyO1xyXG5cdHJvdW5kbmVzczogbnVtYmVyO1xyXG5cdGhhcmRuZXNzPzogbnVtYmVyO1xyXG5cdHNwYWNpbmdPbjogYm9vbGVhbjtcclxuXHRzcGFjaW5nOiBudW1iZXI7XHJcblx0ZmxpcFg6IGJvb2xlYW47XHJcblx0ZmxpcFk6IGJvb2xlYW47XHJcblx0c2FtcGxlZERhdGE/OiBzdHJpbmc7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgQnJ1c2gge1xyXG5cdG5hbWU6IHN0cmluZztcclxuXHRzaGFwZTogQnJ1c2hTaGFwZTtcclxuXHRzaGFwZUR5bmFtaWNzPzoge1xyXG5cdFx0c2l6ZUR5bmFtaWNzOiBCcnVzaER5bmFtaWNzO1xyXG5cdFx0bWluaW11bURpYW1ldGVyOiBudW1iZXI7XHJcblx0XHR0aWx0U2NhbGU6IG51bWJlcjtcclxuXHRcdGFuZ2xlRHluYW1pY3M6IEJydXNoRHluYW1pY3M7XHJcblx0XHRyb3VuZG5lc3NEeW5hbWljczogQnJ1c2hEeW5hbWljcztcclxuXHRcdG1pbmltdW1Sb3VuZG5lc3M6IG51bWJlcjtcclxuXHRcdGZsaXBYOiBib29sZWFuO1xyXG5cdFx0ZmxpcFk6IGJvb2xlYW47XHJcblx0XHRicnVzaFByb2plY3Rpb246IGJvb2xlYW47XHJcblx0fTtcclxuXHRzY2F0dGVyPzoge1xyXG5cdFx0Ym90aEF4ZXM6IGJvb2xlYW47XHJcblx0XHRzY2F0dGVyRHluYW1pY3M6IEJydXNoRHluYW1pY3M7XHJcblx0XHRjb3VudER5bmFtaWNzOiBCcnVzaER5bmFtaWNzO1xyXG5cdFx0Y291bnQ6IG51bWJlcjtcclxuXHR9O1xyXG5cdHRleHR1cmU/OiB7XHJcblx0XHRpZDogc3RyaW5nO1xyXG5cdFx0bmFtZTogc3RyaW5nO1xyXG5cdFx0aW52ZXJ0OiBib29sZWFuO1xyXG5cdFx0c2NhbGU6IG51bWJlcjtcclxuXHRcdGJyaWdodG5lc3M6IG51bWJlcjtcclxuXHRcdGNvbnRyYXN0OiBudW1iZXI7XHJcblx0XHRibGVuZE1vZGU6IEJsZW5kTW9kZTtcclxuXHRcdGRlcHRoOiBudW1iZXI7XHJcblx0XHRkZXB0aE1pbmltdW06IG51bWJlcjtcclxuXHRcdGRlcHRoRHluYW1pY3M6IEJydXNoRHluYW1pY3M7XHJcblx0fTtcclxuXHRkdWFsQnJ1c2g/OiB7XHJcblx0XHRmbGlwOiBib29sZWFuO1xyXG5cdFx0c2hhcGU6IEJydXNoU2hhcGU7XHJcblx0XHRibGVuZE1vZGU6IEJsZW5kTW9kZTtcclxuXHRcdHVzZVNjYXR0ZXI6IGJvb2xlYW47XHJcblx0XHRzcGFjaW5nOiBudW1iZXI7XHJcblx0XHRjb3VudDogbnVtYmVyO1xyXG5cdFx0Ym90aEF4ZXM6IGJvb2xlYW47XHJcblx0XHRjb3VudER5bmFtaWNzOiBCcnVzaER5bmFtaWNzO1xyXG5cdFx0c2NhdHRlckR5bmFtaWNzOiBCcnVzaER5bmFtaWNzO1xyXG5cdH07XHJcblx0Y29sb3JEeW5hbWljcz86IHtcclxuXHRcdGZvcmVncm91bmRCYWNrZ3JvdW5kOiBCcnVzaER5bmFtaWNzO1xyXG5cdFx0aHVlOiBudW1iZXI7XHJcblx0XHRzYXR1cmF0aW9uOiBudW1iZXI7XHJcblx0XHRicmlnaHRuZXNzOiBudW1iZXI7XHJcblx0XHRwdXJpdHk6IG51bWJlcjtcclxuXHRcdHBlclRpcDogYm9vbGVhbjtcclxuXHR9O1xyXG5cdHRyYW5zZmVyPzoge1xyXG5cdFx0Zmxvd0R5bmFtaWNzOiBCcnVzaER5bmFtaWNzO1xyXG5cdFx0b3BhY2l0eUR5bmFtaWNzOiBCcnVzaER5bmFtaWNzO1xyXG5cdFx0d2V0bmVzc0R5bmFtaWNzOiBCcnVzaER5bmFtaWNzO1xyXG5cdFx0bWl4RHluYW1pY3M6IEJydXNoRHluYW1pY3M7XHJcblx0fTtcclxuXHRicnVzaFBvc2U/OiB7XHJcblx0XHRvdmVycmlkZUFuZ2xlOiBib29sZWFuO1xyXG5cdFx0b3ZlcnJpZGVUaWx0WDogYm9vbGVhbjtcclxuXHRcdG92ZXJyaWRlVGlsdFk6IGJvb2xlYW47XHJcblx0XHRvdmVycmlkZVByZXNzdXJlOiBib29sZWFuO1xyXG5cdFx0cHJlc3N1cmU6IG51bWJlcjtcclxuXHRcdHRpbHRYOiBudW1iZXI7XHJcblx0XHR0aWx0WTogbnVtYmVyO1xyXG5cdFx0YW5nbGU6IG51bWJlcjtcclxuXHR9O1xyXG5cdG5vaXNlOiBib29sZWFuO1xyXG5cdHdldEVkZ2VzOiBib29sZWFuO1xyXG5cdC8vIFRPRE86IGJ1aWxkLXVwXHJcblx0Ly8gVE9ETzogc21vb3RoaW5nXHJcblx0cHJvdGVjdFRleHR1cmU/OiBib29sZWFuO1xyXG5cdHNwYWNpbmc6IG51bWJlcjtcclxuXHRicnVzaEdyb3VwPzogdW5kZWZpbmVkOyAvLyA/XHJcblx0aW50ZXJwcmV0YXRpb24/OiBib29sZWFuOyAvLyA/XHJcblx0dXNlQnJ1c2hTaXplOiBib29sZWFuOyAvLyA/XHJcblx0dG9vbE9wdGlvbnM/OiB7XHJcblx0XHRicnVzaFByZXNldDogYm9vbGVhbjtcclxuXHRcdGZsb3c6IG51bWJlcjtcclxuXHRcdHNtb290aDogbnVtYmVyOyAvLyA/XHJcblx0XHRtb2RlOiBCbGVuZE1vZGU7XHJcblx0XHRvcGFjaXR5OiBudW1iZXI7XHJcblx0XHRzbW9vdGhpbmc6IGJvb2xlYW47XHJcblx0XHRzbW9vdGhpbmdWYWx1ZTogbnVtYmVyO1xyXG5cdFx0c21vb3RoaW5nUmFkaXVzTW9kZTogYm9vbGVhbjtcclxuXHRcdHNtb290aGluZ0NhdGNodXA6IGJvb2xlYW47XHJcblx0XHRzbW9vdGhpbmdDYXRjaHVwQXRFbmQ6IGJvb2xlYW47XHJcblx0XHRzbW9vdGhpbmdab29tQ29tcGVuc2F0aW9uOiBib29sZWFuO1xyXG5cdFx0cHJlc3N1cmVTbW9vdGhpbmc6IGJvb2xlYW47XHJcblx0XHR1c2VQcmVzc3VyZU92ZXJyaWRlc1NpemU6IGJvb2xlYW47XHJcblx0XHR1c2VQcmVzc3VyZU92ZXJyaWRlc09wYWNpdHk6IGJvb2xlYW47XHJcblx0XHR1c2VMZWdhY3k6IGJvb2xlYW47XHJcblx0fTtcclxufVxyXG5cclxuLy8gaW50ZXJuYWxcclxuXHJcbmludGVyZmFjZSBQaHJ5RGVzY3JpcHRvciB7XHJcblx0aGllcmFyY2h5OiBhbnlbXTtcclxufVxyXG5cclxuaW50ZXJmYWNlIER5bmFtaWNzRGVzY3JpcHRvciB7XHJcblx0YlZUeTogbnVtYmVyO1xyXG5cdGZTdHA6IG51bWJlcjtcclxuXHRqaXR0ZXI6IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xyXG5cdCdNbm0gJzogRGVzY3JpcHRvclVuaXRzVmFsdWU7XHJcbn1cclxuXHJcbmludGVyZmFjZSBCcnVzaFNoYXBlRGVzY3JpcHRvciB7XHJcblx0RG10cjogRGVzY3JpcHRvclVuaXRzVmFsdWU7XHJcblx0QW5nbDogRGVzY3JpcHRvclVuaXRzVmFsdWU7XHJcblx0Um5kbjogRGVzY3JpcHRvclVuaXRzVmFsdWU7XHJcblx0J05tICAnPzogc3RyaW5nO1xyXG5cdFNwY246IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xyXG5cdEludHI6IGJvb2xlYW47XHJcblx0SHJkbj86IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xyXG5cdGZsaXBYOiBib29sZWFuO1xyXG5cdGZsaXBZOiBib29sZWFuO1xyXG5cdHNhbXBsZWREYXRhPzogc3RyaW5nO1xyXG59XHJcblxyXG5pbnRlcmZhY2UgRGVzY0Rlc2NyaXB0b3Ige1xyXG5cdEJyc2g6IHtcclxuXHRcdCdObSAgJzogc3RyaW5nO1xyXG5cdFx0QnJzaDogQnJ1c2hTaGFwZURlc2NyaXB0b3I7XHJcblx0XHR1c2VUaXBEeW5hbWljczogYm9vbGVhbjtcclxuXHRcdGZsaXBYOiBib29sZWFuO1xyXG5cdFx0ZmxpcFk6IGJvb2xlYW47XHJcblx0XHRicnVzaFByb2plY3Rpb246IGJvb2xlYW47XHJcblx0XHRtaW5pbXVtRGlhbWV0ZXI6IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xyXG5cdFx0bWluaW11bVJvdW5kbmVzczogRGVzY3JpcHRvclVuaXRzVmFsdWU7XHJcblx0XHR0aWx0U2NhbGU6IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xyXG5cdFx0c3pWcjogRHluYW1pY3NEZXNjcmlwdG9yO1xyXG5cdFx0YW5nbGVEeW5hbWljczogRHluYW1pY3NEZXNjcmlwdG9yO1xyXG5cdFx0cm91bmRuZXNzRHluYW1pY3M6IER5bmFtaWNzRGVzY3JpcHRvcjtcclxuXHRcdHVzZVNjYXR0ZXI6IGJvb2xlYW47XHJcblx0XHRTcGNuOiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHRcdCdDbnQgJzogbnVtYmVyO1xyXG5cdFx0Ym90aEF4ZXM6IGJvb2xlYW47XHJcblx0XHRjb3VudER5bmFtaWNzOiBEeW5hbWljc0Rlc2NyaXB0b3I7XHJcblx0XHRzY2F0dGVyRHluYW1pY3M6IER5bmFtaWNzRGVzY3JpcHRvcjtcclxuXHRcdGR1YWxCcnVzaDogeyB1c2VEdWFsQnJ1c2g6IGZhbHNlOyB9IHwge1xyXG5cdFx0XHR1c2VEdWFsQnJ1c2g6IHRydWU7XHJcblx0XHRcdEZsaXA6IGJvb2xlYW47XHJcblx0XHRcdEJyc2g6IEJydXNoU2hhcGVEZXNjcmlwdG9yO1xyXG5cdFx0XHRCbG5NOiBzdHJpbmc7XHJcblx0XHRcdHVzZVNjYXR0ZXI6IGJvb2xlYW47XHJcblx0XHRcdFNwY246IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xyXG5cdFx0XHQnQ250ICc6IG51bWJlcjtcclxuXHRcdFx0Ym90aEF4ZXM6IGJvb2xlYW47XHJcblx0XHRcdGNvdW50RHluYW1pY3M6IER5bmFtaWNzRGVzY3JpcHRvcjtcclxuXHRcdFx0c2NhdHRlckR5bmFtaWNzOiBEeW5hbWljc0Rlc2NyaXB0b3I7XHJcblx0XHR9O1xyXG5cdFx0YnJ1c2hHcm91cDogeyB1c2VCcnVzaEdyb3VwOiBmYWxzZTsgfTtcclxuXHRcdHVzZVRleHR1cmU6IGJvb2xlYW47XHJcblx0XHRUeHRDOiBib29sZWFuO1xyXG5cdFx0aW50ZXJwcmV0YXRpb246IGJvb2xlYW47XHJcblx0XHR0ZXh0dXJlQmxlbmRNb2RlOiBzdHJpbmc7XHJcblx0XHR0ZXh0dXJlRGVwdGg6IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xyXG5cdFx0bWluaW11bURlcHRoOiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHRcdHRleHR1cmVEZXB0aER5bmFtaWNzOiBEeW5hbWljc0Rlc2NyaXB0b3I7XHJcblx0XHRUeHRyOiB7XHJcblx0XHRcdCdObSAgJzogc3RyaW5nO1xyXG5cdFx0XHRJZG50OiBzdHJpbmc7XHJcblx0XHR9O1xyXG5cdFx0dGV4dHVyZVNjYWxlOiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHRcdEludlQ6IGJvb2xlYW47XHJcblx0XHRwcm90ZWN0VGV4dHVyZTogYm9vbGVhbjtcclxuXHRcdHRleHR1cmVCcmlnaHRuZXNzOiBudW1iZXI7XHJcblx0XHR0ZXh0dXJlQ29udHJhc3Q6IG51bWJlcjtcclxuXHRcdHVzZVBhaW50RHluYW1pY3M6IGJvb2xlYW47XHJcblx0XHRwclZyPzogRHluYW1pY3NEZXNjcmlwdG9yO1xyXG5cdFx0b3BWcj86IER5bmFtaWNzRGVzY3JpcHRvcjtcclxuXHRcdHd0VnI/OiBEeW5hbWljc0Rlc2NyaXB0b3I7XHJcblx0XHRteFZyPzogRHluYW1pY3NEZXNjcmlwdG9yO1xyXG5cdFx0dXNlQ29sb3JEeW5hbWljczogYm9vbGVhbjtcclxuXHRcdGNsVnI/OiBEeW5hbWljc0Rlc2NyaXB0b3I7XHJcblx0XHQnSCAgICc/OiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHRcdFN0cnQ/OiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHRcdEJyZ2g/OiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHRcdHB1cml0eT86IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xyXG5cdFx0Y29sb3JEeW5hbWljc1BlclRpcD86IHRydWU7XHJcblx0XHRXdGRnOiBib29sZWFuO1xyXG5cdFx0Tm9zZTogYm9vbGVhbjtcclxuXHRcdCdScHQgJzogYm9vbGVhbjtcclxuXHRcdHVzZUJydXNoU2l6ZTogYm9vbGVhbjtcclxuXHRcdHVzZUJydXNoUG9zZTogYm9vbGVhbjtcclxuXHRcdG92ZXJyaWRlUG9zZUFuZ2xlPzogYm9vbGVhbjtcclxuXHRcdG92ZXJyaWRlUG9zZVRpbHRYPzogYm9vbGVhbjtcclxuXHRcdG92ZXJyaWRlUG9zZVRpbHRZPzogYm9vbGVhbjtcclxuXHRcdG92ZXJyaWRlUG9zZVByZXNzdXJlPzogYm9vbGVhbjtcclxuXHRcdGJydXNoUG9zZVByZXNzdXJlPzogRGVzY3JpcHRvclVuaXRzVmFsdWU7XHJcblx0XHRicnVzaFBvc2VUaWx0WD86IG51bWJlcjtcclxuXHRcdGJydXNoUG9zZVRpbHRZPzogbnVtYmVyO1xyXG5cdFx0YnJ1c2hQb3NlQW5nbGU/OiBudW1iZXI7XHJcblx0XHR0b29sT3B0aW9ucz86IHtcclxuXHRcdFx0YnJ1c2hQcmVzZXQ6IGJvb2xlYW47XHJcblx0XHRcdGZsb3c6IG51bWJlcjtcclxuXHRcdFx0U21vbzogbnVtYmVyO1xyXG5cdFx0XHQnTWQgICc6IHN0cmluZztcclxuXHRcdFx0T3BjdDogbnVtYmVyO1xyXG5cdFx0XHRzbW9vdGhpbmc6IGJvb2xlYW47XHJcblx0XHRcdHNtb290aGluZ1ZhbHVlOiBudW1iZXI7XHJcblx0XHRcdHNtb290aGluZ1JhZGl1c01vZGU6IGJvb2xlYW47XHJcblx0XHRcdHNtb290aGluZ0NhdGNodXA6IGJvb2xlYW47XHJcblx0XHRcdHNtb290aGluZ0NhdGNodXBBdEVuZDogYm9vbGVhbjtcclxuXHRcdFx0c21vb3RoaW5nWm9vbUNvbXBlbnNhdGlvbjogYm9vbGVhbjtcclxuXHRcdFx0cHJlc3N1cmVTbW9vdGhpbmc6IGJvb2xlYW47XHJcblx0XHRcdHVzZVByZXNzdXJlT3ZlcnJpZGVzU2l6ZTogYm9vbGVhbjtcclxuXHRcdFx0dXNlUHJlc3N1cmVPdmVycmlkZXNPcGFjaXR5OiBib29sZWFuO1xyXG5cdFx0XHR1c2VMZWdhY3k6IGJvb2xlYW47XHJcblx0XHR9O1xyXG5cdH1bXTtcclxufVxyXG5cclxuZnVuY3Rpb24gcGFyc2VEeW5hbWljcyhkZXNjOiBEeW5hbWljc0Rlc2NyaXB0b3IpOiBCcnVzaER5bmFtaWNzIHtcclxuXHRyZXR1cm4ge1xyXG5cdFx0Y29udHJvbDogZHluYW1pY3NDb250cm9sW2Rlc2MuYlZUeV0gYXMgYW55LFxyXG5cdFx0c3RlcHM6IGRlc2MuZlN0cCxcclxuXHRcdGppdHRlcjogcGFyc2VQZXJjZW50KGRlc2Muaml0dGVyKSxcclxuXHRcdG1pbmltdW06IHBhcnNlUGVyY2VudChkZXNjWydNbm0gJ10pLFxyXG5cdH07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBhcnNlQnJ1c2hTaGFwZShkZXNjOiBCcnVzaFNoYXBlRGVzY3JpcHRvcik6IEJydXNoU2hhcGUge1xyXG5cdGNvbnN0IHNoYXBlOiBCcnVzaFNoYXBlID0ge1xyXG5cdFx0c2l6ZTogcGFyc2VVbml0c1RvTnVtYmVyKGRlc2MuRG10ciwgJ1BpeGVscycpLFxyXG5cdFx0YW5nbGU6IHBhcnNlQW5nbGUoZGVzYy5BbmdsKSxcclxuXHRcdHJvdW5kbmVzczogcGFyc2VQZXJjZW50KGRlc2MuUm5kbiksXHJcblx0XHRzcGFjaW5nT246IGRlc2MuSW50cixcclxuXHRcdHNwYWNpbmc6IHBhcnNlUGVyY2VudChkZXNjLlNwY24pLFxyXG5cdFx0ZmxpcFg6IGRlc2MuZmxpcFgsXHJcblx0XHRmbGlwWTogZGVzYy5mbGlwWSxcclxuXHR9O1xyXG5cclxuXHRpZiAoZGVzY1snTm0gICddKSBzaGFwZS5uYW1lID0gZGVzY1snTm0gICddO1xyXG5cdGlmIChkZXNjLkhyZG4pIHNoYXBlLmhhcmRuZXNzID0gcGFyc2VQZXJjZW50KGRlc2MuSHJkbik7XHJcblx0aWYgKGRlc2Muc2FtcGxlZERhdGEpIHNoYXBlLnNhbXBsZWREYXRhID0gZGVzYy5zYW1wbGVkRGF0YTtcclxuXHJcblx0cmV0dXJuIHNoYXBlO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVhZEFicihidWZmZXI6IEFycmF5QnVmZmVyVmlldywgb3B0aW9uczogeyBsb2dNaXNzaW5nRmVhdHVyZXM/OiBib29sZWFuOyB9ID0ge30pOiBBYnIge1xyXG5cdGNvbnN0IHJlYWRlciA9IGNyZWF0ZVJlYWRlcihidWZmZXIuYnVmZmVyLCBidWZmZXIuYnl0ZU9mZnNldCwgYnVmZmVyLmJ5dGVMZW5ndGgpO1xyXG5cdGNvbnN0IHZlcnNpb24gPSByZWFkSW50MTYocmVhZGVyKTtcclxuXHRjb25zdCBzYW1wbGVzOiBTYW1wbGVJbmZvW10gPSBbXTtcclxuXHRjb25zdCBicnVzaGVzOiBCcnVzaFtdID0gW107XHJcblx0Y29uc3QgcGF0dGVybnM6IFBhdHRlcm5JbmZvW10gPSBbXTtcclxuXHJcblx0aWYgKHZlcnNpb24gPT09IDEgfHwgdmVyc2lvbiA9PT0gMikge1xyXG5cdFx0dGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBBQlIgdmVyc2lvbiAoJHt2ZXJzaW9ufSlgKTsgLy8gVE9ETzogLi4uXHJcblx0fSBlbHNlIGlmICh2ZXJzaW9uID09PSA2IHx8IHZlcnNpb24gPT09IDcgfHwgdmVyc2lvbiA9PT0gOSB8fCB2ZXJzaW9uID09PSAxMCkge1xyXG5cdFx0Y29uc3QgbWlub3JWZXJzaW9uID0gcmVhZEludDE2KHJlYWRlcik7XHJcblx0XHRpZiAobWlub3JWZXJzaW9uICE9PSAxICYmIG1pbm9yVmVyc2lvbiAhPT0gMikgdGhyb3cgbmV3IEVycm9yKCdVbnN1cHBvcnRlZCBBQlIgbWlub3IgdmVyc2lvbicpO1xyXG5cclxuXHRcdHdoaWxlIChyZWFkZXIub2Zmc2V0IDwgcmVhZGVyLnZpZXcuYnl0ZUxlbmd0aCkge1xyXG5cdFx0XHRjaGVja1NpZ25hdHVyZShyZWFkZXIsICc4QklNJyk7XHJcblx0XHRcdGNvbnN0IHR5cGUgPSByZWFkU2lnbmF0dXJlKHJlYWRlcikgYXMgJ3NhbXAnIHwgJ2Rlc2MnIHwgJ3BhdHQnIHwgJ3BocnknO1xyXG5cdFx0XHRsZXQgc2l6ZSA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdFx0Y29uc3QgZW5kID0gcmVhZGVyLm9mZnNldCArIHNpemU7XHJcblxyXG5cdFx0XHRzd2l0Y2ggKHR5cGUpIHtcclxuXHRcdFx0XHRjYXNlICdzYW1wJzoge1xyXG5cdFx0XHRcdFx0d2hpbGUgKHJlYWRlci5vZmZzZXQgPCBlbmQpIHtcclxuXHRcdFx0XHRcdFx0bGV0IGJydXNoTGVuZ3RoID0gcmVhZFVpbnQzMihyZWFkZXIpO1xyXG5cdFx0XHRcdFx0XHR3aGlsZSAoYnJ1c2hMZW5ndGggJiAwYjExKSBicnVzaExlbmd0aCsrOyAvLyBwYWQgdG8gNCBieXRlIGFsaWdubWVudFxyXG5cdFx0XHRcdFx0XHRjb25zdCBicnVzaEVuZCA9IHJlYWRlci5vZmZzZXQgKyBicnVzaExlbmd0aDtcclxuXHJcblx0XHRcdFx0XHRcdGNvbnN0IGlkID0gcmVhZFBhc2NhbFN0cmluZyhyZWFkZXIsIDEpO1xyXG5cclxuXHRcdFx0XHRcdFx0Ly8gdjEgLSBTa2lwIHRoZSBJbnQxNiBib3VuZHMgcmVjdGFuZ2xlIGFuZCB0aGUgdW5rbm93biBJbnQxNi5cclxuXHRcdFx0XHRcdFx0Ly8gdjIgLSBTa2lwIHRoZSB1bmtub3duIGJ5dGVzLlxyXG5cdFx0XHRcdFx0XHRza2lwQnl0ZXMocmVhZGVyLCBtaW5vclZlcnNpb24gPT09IDEgPyAxMCA6IDI2NCk7XHJcblxyXG5cdFx0XHRcdFx0XHRjb25zdCB5ID0gcmVhZEludDMyKHJlYWRlcik7XHJcblx0XHRcdFx0XHRcdGNvbnN0IHggPSByZWFkSW50MzIocmVhZGVyKTtcclxuXHRcdFx0XHRcdFx0Y29uc3QgaCA9IHJlYWRJbnQzMihyZWFkZXIpIC0geTtcclxuXHRcdFx0XHRcdFx0Y29uc3QgdyA9IHJlYWRJbnQzMihyZWFkZXIpIC0geDtcclxuXHRcdFx0XHRcdFx0aWYgKHcgPD0gMCB8fCBoIDw9IDApIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBib3VuZHMnKTtcclxuXHJcblx0XHRcdFx0XHRcdGNvbnN0IGRlcHRoID0gcmVhZEludDE2KHJlYWRlcik7XHJcblx0XHRcdFx0XHRcdGNvbnN0IGNvbXByZXNzaW9uID0gcmVhZFVpbnQ4KHJlYWRlcik7IC8vIDAgLSByYXcsIDEgLSBSTEVcclxuXHRcdFx0XHRcdFx0Y29uc3QgYWxwaGEgPSBuZXcgVWludDhBcnJheSh3ICogaCk7XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAoZGVwdGggPT09IDgpIHtcclxuXHRcdFx0XHRcdFx0XHRpZiAoY29tcHJlc3Npb24gPT09IDApIHtcclxuXHRcdFx0XHRcdFx0XHRcdGFscGhhLnNldChyZWFkQnl0ZXMocmVhZGVyLCBhbHBoYS5ieXRlTGVuZ3RoKSk7XHJcblx0XHRcdFx0XHRcdFx0fSBlbHNlIGlmIChjb21wcmVzc2lvbiA9PT0gMSkge1xyXG5cdFx0XHRcdFx0XHRcdFx0cmVhZERhdGFSTEUocmVhZGVyLCB7IHdpZHRoOiB3LCBoZWlnaHQ6IGgsIGRhdGE6IGFscGhhIH0sIHcsIGgsIDEsIFswXSwgZmFsc2UpO1xyXG5cdFx0XHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY29tcHJlc3Npb24nKTtcclxuXHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoZGVwdGggPT09IDE2KSB7XHJcblx0XHRcdFx0XHRcdFx0aWYgKGNvbXByZXNzaW9uID09PSAwKSB7XHJcblx0XHRcdFx0XHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGFscGhhLmJ5dGVMZW5ndGg7IGkrKykge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRhbHBoYVtpXSA9IHJlYWRVaW50MTYocmVhZGVyKSA+PiA4OyAvLyBjb252ZXJ0IHRvIDhiaXQgdmFsdWVzXHJcblx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0fSBlbHNlIGlmIChjb21wcmVzc2lvbiA9PT0gMSkge1xyXG5cdFx0XHRcdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQgKDE2Yml0IFJMRSknKTsgLy8gVE9ETzogLi4uXHJcblx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjb21wcmVzc2lvbicpO1xyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgZGVwdGgnKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdFx0c2FtcGxlcy5wdXNoKHsgaWQsIGJvdW5kczogeyB4LCB5LCB3LCBoIH0sIGFscGhhIH0pO1xyXG5cdFx0XHRcdFx0XHRyZWFkZXIub2Zmc2V0ID0gYnJ1c2hFbmQ7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0Y2FzZSAnZGVzYyc6IHtcclxuXHRcdFx0XHRcdGNvbnN0IGRlc2M6IERlc2NEZXNjcmlwdG9yID0gcmVhZFZlcnNpb25BbmREZXNjcmlwdG9yKHJlYWRlcik7XHJcblx0XHRcdFx0XHQvLyBjb25zb2xlLmxvZyhyZXF1aXJlKCd1dGlsJykuaW5zcGVjdChkZXNjLCBmYWxzZSwgOTksIHRydWUpKTtcclxuXHJcblx0XHRcdFx0XHRmb3IgKGNvbnN0IGJydXNoIG9mIGRlc2MuQnJzaCkge1xyXG5cdFx0XHRcdFx0XHRjb25zdCBiOiBCcnVzaCA9IHtcclxuXHRcdFx0XHRcdFx0XHRuYW1lOiBicnVzaFsnTm0gICddLFxyXG5cdFx0XHRcdFx0XHRcdHNoYXBlOiBwYXJzZUJydXNoU2hhcGUoYnJ1c2guQnJzaCksXHJcblx0XHRcdFx0XHRcdFx0c3BhY2luZzogcGFyc2VQZXJjZW50KGJydXNoLlNwY24pLFxyXG5cdFx0XHRcdFx0XHRcdC8vIFRPRE86IGJydXNoR3JvdXAgPz8/XHJcblx0XHRcdFx0XHRcdFx0d2V0RWRnZXM6IGJydXNoLld0ZGcsXHJcblx0XHRcdFx0XHRcdFx0bm9pc2U6IGJydXNoLk5vc2UsXHJcblx0XHRcdFx0XHRcdFx0Ly8gVE9ETzogVHh0QyA/Pz8gc21vb3RoaW5nIC8gYnVpbGQtdXAgP1xyXG5cdFx0XHRcdFx0XHRcdC8vIFRPRE86ICdScHQgJyA/Pz9cclxuXHRcdFx0XHRcdFx0XHR1c2VCcnVzaFNpemU6IGJydXNoLnVzZUJydXNoU2l6ZSwgLy8gPz8/XHJcblx0XHRcdFx0XHRcdH07XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAoYnJ1c2guaW50ZXJwcmV0YXRpb24gIT0gbnVsbCkgYi5pbnRlcnByZXRhdGlvbiA9IGJydXNoLmludGVycHJldGF0aW9uO1xyXG5cdFx0XHRcdFx0XHRpZiAoYnJ1c2gucHJvdGVjdFRleHR1cmUgIT0gbnVsbCkgYi5wcm90ZWN0VGV4dHVyZSA9IGJydXNoLnByb3RlY3RUZXh0dXJlO1xyXG5cclxuXHRcdFx0XHRcdFx0aWYgKGJydXNoLnVzZVRpcER5bmFtaWNzKSB7XHJcblx0XHRcdFx0XHRcdFx0Yi5zaGFwZUR5bmFtaWNzID0ge1xyXG5cdFx0XHRcdFx0XHRcdFx0dGlsdFNjYWxlOiBwYXJzZVBlcmNlbnQoYnJ1c2gudGlsdFNjYWxlKSxcclxuXHRcdFx0XHRcdFx0XHRcdHNpemVEeW5hbWljczogcGFyc2VEeW5hbWljcyhicnVzaC5zelZyKSxcclxuXHRcdFx0XHRcdFx0XHRcdGFuZ2xlRHluYW1pY3M6IHBhcnNlRHluYW1pY3MoYnJ1c2guYW5nbGVEeW5hbWljcyksXHJcblx0XHRcdFx0XHRcdFx0XHRyb3VuZG5lc3NEeW5hbWljczogcGFyc2VEeW5hbWljcyhicnVzaC5yb3VuZG5lc3NEeW5hbWljcyksXHJcblx0XHRcdFx0XHRcdFx0XHRmbGlwWDogYnJ1c2guZmxpcFgsXHJcblx0XHRcdFx0XHRcdFx0XHRmbGlwWTogYnJ1c2guZmxpcFksXHJcblx0XHRcdFx0XHRcdFx0XHRicnVzaFByb2plY3Rpb246IGJydXNoLmJydXNoUHJvamVjdGlvbixcclxuXHRcdFx0XHRcdFx0XHRcdG1pbmltdW1EaWFtZXRlcjogcGFyc2VQZXJjZW50KGJydXNoLm1pbmltdW1EaWFtZXRlciksXHJcblx0XHRcdFx0XHRcdFx0XHRtaW5pbXVtUm91bmRuZXNzOiBwYXJzZVBlcmNlbnQoYnJ1c2gubWluaW11bVJvdW5kbmVzcyksXHJcblx0XHRcdFx0XHRcdFx0fTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdFx0aWYgKGJydXNoLnVzZVNjYXR0ZXIpIHtcclxuXHRcdFx0XHRcdFx0XHRiLnNjYXR0ZXIgPSB7XHJcblx0XHRcdFx0XHRcdFx0XHRjb3VudDogYnJ1c2hbJ0NudCAnXSxcclxuXHRcdFx0XHRcdFx0XHRcdGJvdGhBeGVzOiBicnVzaC5ib3RoQXhlcyxcclxuXHRcdFx0XHRcdFx0XHRcdGNvdW50RHluYW1pY3M6IHBhcnNlRHluYW1pY3MoYnJ1c2guY291bnREeW5hbWljcyksXHJcblx0XHRcdFx0XHRcdFx0XHRzY2F0dGVyRHluYW1pY3M6IHBhcnNlRHluYW1pY3MoYnJ1c2guc2NhdHRlckR5bmFtaWNzKSxcclxuXHRcdFx0XHRcdFx0XHR9O1xyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAoYnJ1c2gudXNlVGV4dHVyZSkge1xyXG5cdFx0XHRcdFx0XHRcdGIudGV4dHVyZSA9IHtcclxuXHRcdFx0XHRcdFx0XHRcdGlkOiBicnVzaC5UeHRyLklkbnQsXHJcblx0XHRcdFx0XHRcdFx0XHRuYW1lOiBicnVzaC5UeHRyWydObSAgJ10sXHJcblx0XHRcdFx0XHRcdFx0XHRibGVuZE1vZGU6IEJsbk0uZGVjb2RlKGJydXNoLnRleHR1cmVCbGVuZE1vZGUpLFxyXG5cdFx0XHRcdFx0XHRcdFx0ZGVwdGg6IHBhcnNlUGVyY2VudChicnVzaC50ZXh0dXJlRGVwdGgpLFxyXG5cdFx0XHRcdFx0XHRcdFx0ZGVwdGhNaW5pbXVtOiBwYXJzZVBlcmNlbnQoYnJ1c2gubWluaW11bURlcHRoKSxcclxuXHRcdFx0XHRcdFx0XHRcdGRlcHRoRHluYW1pY3M6IHBhcnNlRHluYW1pY3MoYnJ1c2gudGV4dHVyZURlcHRoRHluYW1pY3MpLFxyXG5cdFx0XHRcdFx0XHRcdFx0c2NhbGU6IHBhcnNlUGVyY2VudChicnVzaC50ZXh0dXJlU2NhbGUpLFxyXG5cdFx0XHRcdFx0XHRcdFx0aW52ZXJ0OiBicnVzaC5JbnZULFxyXG5cdFx0XHRcdFx0XHRcdFx0YnJpZ2h0bmVzczogYnJ1c2gudGV4dHVyZUJyaWdodG5lc3MsXHJcblx0XHRcdFx0XHRcdFx0XHRjb250cmFzdDogYnJ1c2gudGV4dHVyZUNvbnRyYXN0LFxyXG5cdFx0XHRcdFx0XHRcdH07XHJcblx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRcdGNvbnN0IGRiID0gYnJ1c2guZHVhbEJydXNoO1xyXG5cdFx0XHRcdFx0XHRpZiAoZGIgJiYgZGIudXNlRHVhbEJydXNoKSB7XHJcblx0XHRcdFx0XHRcdFx0Yi5kdWFsQnJ1c2ggPSB7XHJcblx0XHRcdFx0XHRcdFx0XHRmbGlwOiBkYi5GbGlwLFxyXG5cdFx0XHRcdFx0XHRcdFx0c2hhcGU6IHBhcnNlQnJ1c2hTaGFwZShkYi5CcnNoKSxcclxuXHRcdFx0XHRcdFx0XHRcdGJsZW5kTW9kZTogQmxuTS5kZWNvZGUoZGIuQmxuTSksXHJcblx0XHRcdFx0XHRcdFx0XHR1c2VTY2F0dGVyOiBkYi51c2VTY2F0dGVyLFxyXG5cdFx0XHRcdFx0XHRcdFx0c3BhY2luZzogcGFyc2VQZXJjZW50KGRiLlNwY24pLFxyXG5cdFx0XHRcdFx0XHRcdFx0Y291bnQ6IGRiWydDbnQgJ10sXHJcblx0XHRcdFx0XHRcdFx0XHRib3RoQXhlczogZGIuYm90aEF4ZXMsXHJcblx0XHRcdFx0XHRcdFx0XHRjb3VudER5bmFtaWNzOiBwYXJzZUR5bmFtaWNzKGRiLmNvdW50RHluYW1pY3MpLFxyXG5cdFx0XHRcdFx0XHRcdFx0c2NhdHRlckR5bmFtaWNzOiBwYXJzZUR5bmFtaWNzKGRiLnNjYXR0ZXJEeW5hbWljcyksXHJcblx0XHRcdFx0XHRcdFx0fTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdFx0aWYgKGJydXNoLnVzZUNvbG9yRHluYW1pY3MpIHtcclxuXHRcdFx0XHRcdFx0XHRiLmNvbG9yRHluYW1pY3MgPSB7XHJcblx0XHRcdFx0XHRcdFx0XHRmb3JlZ3JvdW5kQmFja2dyb3VuZDogcGFyc2VEeW5hbWljcyhicnVzaC5jbFZyISksXHJcblx0XHRcdFx0XHRcdFx0XHRodWU6IHBhcnNlUGVyY2VudChicnVzaFsnSCAgICddISksXHJcblx0XHRcdFx0XHRcdFx0XHRzYXR1cmF0aW9uOiBwYXJzZVBlcmNlbnQoYnJ1c2guU3RydCEpLFxyXG5cdFx0XHRcdFx0XHRcdFx0YnJpZ2h0bmVzczogcGFyc2VQZXJjZW50KGJydXNoLkJyZ2ghKSxcclxuXHRcdFx0XHRcdFx0XHRcdHB1cml0eTogcGFyc2VQZXJjZW50KGJydXNoLnB1cml0eSEpLFxyXG5cdFx0XHRcdFx0XHRcdFx0cGVyVGlwOiBicnVzaC5jb2xvckR5bmFtaWNzUGVyVGlwISxcclxuXHRcdFx0XHRcdFx0XHR9O1xyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAoYnJ1c2gudXNlUGFpbnREeW5hbWljcykge1xyXG5cdFx0XHRcdFx0XHRcdGIudHJhbnNmZXIgPSB7XHJcblx0XHRcdFx0XHRcdFx0XHRmbG93RHluYW1pY3M6IHBhcnNlRHluYW1pY3MoYnJ1c2gucHJWciEpLFxyXG5cdFx0XHRcdFx0XHRcdFx0b3BhY2l0eUR5bmFtaWNzOiBwYXJzZUR5bmFtaWNzKGJydXNoLm9wVnIhKSxcclxuXHRcdFx0XHRcdFx0XHRcdHdldG5lc3NEeW5hbWljczogcGFyc2VEeW5hbWljcyhicnVzaC53dFZyISksXHJcblx0XHRcdFx0XHRcdFx0XHRtaXhEeW5hbWljczogcGFyc2VEeW5hbWljcyhicnVzaC5teFZyISksXHJcblx0XHRcdFx0XHRcdFx0fTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdFx0aWYgKGJydXNoLnVzZUJydXNoUG9zZSkge1xyXG5cdFx0XHRcdFx0XHRcdGIuYnJ1c2hQb3NlID0ge1xyXG5cdFx0XHRcdFx0XHRcdFx0b3ZlcnJpZGVBbmdsZTogYnJ1c2gub3ZlcnJpZGVQb3NlQW5nbGUhLFxyXG5cdFx0XHRcdFx0XHRcdFx0b3ZlcnJpZGVUaWx0WDogYnJ1c2gub3ZlcnJpZGVQb3NlVGlsdFghLFxyXG5cdFx0XHRcdFx0XHRcdFx0b3ZlcnJpZGVUaWx0WTogYnJ1c2gub3ZlcnJpZGVQb3NlVGlsdFkhLFxyXG5cdFx0XHRcdFx0XHRcdFx0b3ZlcnJpZGVQcmVzc3VyZTogYnJ1c2gub3ZlcnJpZGVQb3NlUHJlc3N1cmUhLFxyXG5cdFx0XHRcdFx0XHRcdFx0cHJlc3N1cmU6IHBhcnNlUGVyY2VudChicnVzaC5icnVzaFBvc2VQcmVzc3VyZSEpLFxyXG5cdFx0XHRcdFx0XHRcdFx0dGlsdFg6IGJydXNoLmJydXNoUG9zZVRpbHRYISxcclxuXHRcdFx0XHRcdFx0XHRcdHRpbHRZOiBicnVzaC5icnVzaFBvc2VUaWx0WSEsXHJcblx0XHRcdFx0XHRcdFx0XHRhbmdsZTogYnJ1c2guYnJ1c2hQb3NlQW5nbGUhLFxyXG5cdFx0XHRcdFx0XHRcdH07XHJcblx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRcdGNvbnN0IHRvID0gYnJ1c2gudG9vbE9wdGlvbnM7XHJcblx0XHRcdFx0XHRcdGlmICh0bykge1xyXG5cdFx0XHRcdFx0XHRcdGIudG9vbE9wdGlvbnMgPSB7XHJcblx0XHRcdFx0XHRcdFx0XHRicnVzaFByZXNldDogdG8uYnJ1c2hQcmVzZXQsXHJcblx0XHRcdFx0XHRcdFx0XHRmbG93OiB0by5mbG93LFxyXG5cdFx0XHRcdFx0XHRcdFx0c21vb3RoOiB0by5TbW9vLFxyXG5cdFx0XHRcdFx0XHRcdFx0bW9kZTogQmxuTS5kZWNvZGUodG9bJ01kICAnXSksXHJcblx0XHRcdFx0XHRcdFx0XHRvcGFjaXR5OiB0by5PcGN0LFxyXG5cdFx0XHRcdFx0XHRcdFx0c21vb3RoaW5nOiB0by5zbW9vdGhpbmcsXHJcblx0XHRcdFx0XHRcdFx0XHRzbW9vdGhpbmdWYWx1ZTogdG8uc21vb3RoaW5nVmFsdWUsXHJcblx0XHRcdFx0XHRcdFx0XHRzbW9vdGhpbmdSYWRpdXNNb2RlOiB0by5zbW9vdGhpbmdSYWRpdXNNb2RlLFxyXG5cdFx0XHRcdFx0XHRcdFx0c21vb3RoaW5nQ2F0Y2h1cDogdG8uc21vb3RoaW5nQ2F0Y2h1cCxcclxuXHRcdFx0XHRcdFx0XHRcdHNtb290aGluZ0NhdGNodXBBdEVuZDogdG8uc21vb3RoaW5nQ2F0Y2h1cEF0RW5kLFxyXG5cdFx0XHRcdFx0XHRcdFx0c21vb3RoaW5nWm9vbUNvbXBlbnNhdGlvbjogdG8uc21vb3RoaW5nWm9vbUNvbXBlbnNhdGlvbixcclxuXHRcdFx0XHRcdFx0XHRcdHByZXNzdXJlU21vb3RoaW5nOiB0by5wcmVzc3VyZVNtb290aGluZyxcclxuXHRcdFx0XHRcdFx0XHRcdHVzZVByZXNzdXJlT3ZlcnJpZGVzU2l6ZTogdG8udXNlUHJlc3N1cmVPdmVycmlkZXNTaXplLFxyXG5cdFx0XHRcdFx0XHRcdFx0dXNlUHJlc3N1cmVPdmVycmlkZXNPcGFjaXR5OiB0by51c2VQcmVzc3VyZU92ZXJyaWRlc09wYWNpdHksXHJcblx0XHRcdFx0XHRcdFx0XHR1c2VMZWdhY3k6IHRvLnVzZUxlZ2FjeSxcclxuXHRcdFx0XHRcdFx0XHR9O1xyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHRicnVzaGVzLnB1c2goYik7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0Y2FzZSAncGF0dCc6IHtcclxuXHRcdFx0XHRcdGlmIChyZWFkZXIub2Zmc2V0IDwgZW5kKSB7IC8vIFRPRE86IGNoZWNrIG11bHRpcGxlIHBhdHRlcm5zXHJcblx0XHRcdFx0XHRcdHBhdHRlcm5zLnB1c2gocmVhZFBhdHRlcm4ocmVhZGVyKSk7XHJcblx0XHRcdFx0XHRcdHJlYWRlci5vZmZzZXQgPSBlbmQ7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0Y2FzZSAncGhyeSc6IHtcclxuXHRcdFx0XHRcdC8vIFRPRE86IHdoYXQgaXMgdGhpcyA/XHJcblx0XHRcdFx0XHRjb25zdCBkZXNjOiBQaHJ5RGVzY3JpcHRvciA9IHJlYWRWZXJzaW9uQW5kRGVzY3JpcHRvcihyZWFkZXIpO1xyXG5cdFx0XHRcdFx0aWYgKG9wdGlvbnMubG9nTWlzc2luZ0ZlYXR1cmVzKSB7XHJcblx0XHRcdFx0XHRcdGlmIChkZXNjLmhpZXJhcmNoeT8ubGVuZ3RoKSB7XHJcblx0XHRcdFx0XHRcdFx0Y29uc29sZS5sb2coJ3VuaGFuZGxlZCBwaHJ5IHNlY3Rpb24nLCBkZXNjKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGRlZmF1bHQ6XHJcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgYnJ1c2ggdHlwZTogJHt0eXBlfWApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBhbGlnbiB0byA0IGJ5dGVzXHJcblx0XHRcdHdoaWxlIChzaXplICUgNCkge1xyXG5cdFx0XHRcdHJlYWRlci5vZmZzZXQrKztcclxuXHRcdFx0XHRzaXplKys7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9IGVsc2Uge1xyXG5cdFx0dGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBBQlIgdmVyc2lvbiAoJHt2ZXJzaW9ufSlgKTtcclxuXHR9XHJcblxyXG5cdHJldHVybiB7IHNhbXBsZXMsIHBhdHRlcm5zLCBicnVzaGVzIH07XHJcbn1cclxuIl0sInNvdXJjZVJvb3QiOiJGOlxccHJvamVjdHNcXGFnLXBzZFxcc3JjIn0=
