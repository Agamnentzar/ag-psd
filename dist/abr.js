"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readAbr = void 0;
var descriptor_1 = require("./descriptor");
var psdReader_1 = require("./psdReader");
var dynamicsControl = ['off', 'fade', 'pen pressure', 'pen tilt', 'stylus wheel', 'initial direction', 'direction', 'initial rotation', 'rotation'];
function parseDynamics(desc) {
    return {
        control: dynamicsControl[desc.bVTy],
        steps: desc.fStp,
        jitter: descriptor_1.parsePercent(desc.jitter),
        minimum: descriptor_1.parsePercent(desc['Mnm ']),
    };
}
function parseBrushShape(desc) {
    var shape = {
        size: descriptor_1.parseUnitsToNumber(desc.Dmtr, 'Pixels'),
        angle: descriptor_1.parseAngle(desc.Angl),
        roundness: descriptor_1.parsePercent(desc.Rndn),
        spacingOn: desc.Intr,
        spacing: descriptor_1.parsePercent(desc.Spcn),
        flipX: desc.flipX,
        flipY: desc.flipY,
    };
    if (desc['Nm  '])
        shape.name = desc['Nm  '];
    if (desc.Hrdn)
        shape.hardness = descriptor_1.parsePercent(desc.Hrdn);
    if (desc.sampledData)
        shape.sampledData = desc.sampledData;
    return shape;
}
function readAbr(buffer, options) {
    var _a;
    if (options === void 0) { options = {}; }
    var reader = psdReader_1.createReader(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    var version = psdReader_1.readInt16(reader);
    var samples = [];
    var brushes = [];
    var patterns = [];
    if (version === 1 || version === 2) {
        throw new Error("Unsupported ABR version (" + version + ")"); // TODO: ...
    }
    else if (version === 6 || version === 7 || version === 9 || version === 10) {
        var minorVersion = psdReader_1.readInt16(reader);
        if (minorVersion !== 1 && minorVersion !== 2)
            throw new Error('Unsupported ABR minor version');
        while (reader.offset < reader.view.byteLength) {
            psdReader_1.checkSignature(reader, '8BIM');
            var type = psdReader_1.readSignature(reader);
            var size = psdReader_1.readUint32(reader);
            var end = reader.offset + size;
            switch (type) {
                case 'samp': {
                    while (reader.offset < end) {
                        var brushLength = psdReader_1.readUint32(reader);
                        while (brushLength & 3)
                            brushLength++; // pad to 4 byte alignment
                        var brushEnd = reader.offset + brushLength;
                        var id = psdReader_1.readPascalString(reader, 1);
                        // v1 - Skip the Int16 bounds rectangle and the unknown Int16.
                        // v2 - Skip the unknown bytes.
                        psdReader_1.skipBytes(reader, minorVersion === 1 ? 10 : 264);
                        var y = psdReader_1.readInt32(reader);
                        var x = psdReader_1.readInt32(reader);
                        var h = psdReader_1.readInt32(reader) - y;
                        var w = psdReader_1.readInt32(reader) - x;
                        if (w <= 0 || h <= 0)
                            throw new Error('Invalid bounds');
                        var depth = psdReader_1.readInt16(reader);
                        var compression = psdReader_1.readUint8(reader); // 0 - raw, 1 - RLE
                        var alpha = new Uint8Array(w * h);
                        if (depth === 8) {
                            if (compression === 0) {
                                alpha.set(psdReader_1.readBytes(reader, alpha.byteLength));
                            }
                            else if (compression === 1) {
                                psdReader_1.readDataRLE(reader, { width: w, height: h, data: alpha }, w, h, 1, [0], false);
                            }
                            else {
                                throw new Error('Invalid compression');
                            }
                        }
                        else if (depth === 16) {
                            if (compression === 0) {
                                for (var i = 0; i < alpha.byteLength; i++) {
                                    alpha[i] = psdReader_1.readUint16(reader) >> 8; // convert to 8bit values
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
                    var desc = descriptor_1.readVersionAndDescriptor(reader);
                    // console.log(require('util').inspect(desc, false, 99, true));
                    for (var _i = 0, _b = desc.Brsh; _i < _b.length; _i++) {
                        var brush = _b[_i];
                        var b = {
                            name: brush['Nm  '],
                            shape: parseBrushShape(brush.Brsh),
                            spacing: descriptor_1.parsePercent(brush.Spcn),
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
                                tiltScale: descriptor_1.parsePercent(brush.tiltScale),
                                sizeDynamics: parseDynamics(brush.szVr),
                                angleDynamics: parseDynamics(brush.angleDynamics),
                                roundnessDynamics: parseDynamics(brush.roundnessDynamics),
                                flipX: brush.flipX,
                                flipY: brush.flipY,
                                brushProjection: brush.brushProjection,
                                minimumDiameter: descriptor_1.parsePercent(brush.minimumDiameter),
                                minimumRoundness: descriptor_1.parsePercent(brush.minimumRoundness),
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
                                blendMode: descriptor_1.BlnM.decode(brush.textureBlendMode),
                                depth: descriptor_1.parsePercent(brush.textureDepth),
                                depthMinimum: descriptor_1.parsePercent(brush.minimumDepth),
                                depthDynamics: parseDynamics(brush.textureDepthDynamics),
                                scale: descriptor_1.parsePercent(brush.textureScale),
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
                                blendMode: descriptor_1.BlnM.decode(db.BlnM),
                                useScatter: db.useScatter,
                                spacing: descriptor_1.parsePercent(db.Spcn),
                                count: db['Cnt '],
                                bothAxes: db.bothAxes,
                                countDynamics: parseDynamics(db.countDynamics),
                                scatterDynamics: parseDynamics(db.scatterDynamics),
                            };
                        }
                        if (brush.useColorDynamics) {
                            b.colorDynamics = {
                                foregroundBackground: parseDynamics(brush.clVr),
                                hue: descriptor_1.parsePercent(brush['H   ']),
                                saturation: descriptor_1.parsePercent(brush.Strt),
                                brightness: descriptor_1.parsePercent(brush.Brgh),
                                purity: descriptor_1.parsePercent(brush.purity),
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
                                pressure: descriptor_1.parsePercent(brush.brushPosePressure),
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
                                mode: descriptor_1.BlnM.decode(to['Md  ']),
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
                        patterns.push(psdReader_1.readPattern(reader));
                        reader.offset = end;
                    }
                    break;
                }
                case 'phry': {
                    // TODO: what is this ?
                    var desc = descriptor_1.readVersionAndDescriptor(reader);
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
exports.readAbr = readAbr;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUksQ0FBQyx1QkFBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7d0JBQ25DLE1BQU0sQ0FBQyxNQUFNLEdBQUcsR0FBRyxDQUFDO3FCQUNwQjtvQkFDRCxNQUFNO2lCQUNOO2dCQUNELEtBQUssTUFBTSxDQUFDLENBQUM7b0JBQ1osdUJBQXVCO29CQUN2QixJQUFNLElBQUksR0FBbUIscUNBQXdCLENBQUMsTUFBTSxDQUFDLENBQUM7b0JBQzlELElBQUksT0FBTyxDQUFDLGtCQUFrQixFQUFFO3dCQUMvQixJQUFJLE1BQUEsSUFBSSxDQUFDLFNBQVMsMENBQUUsTUFBTSxFQUFFOzRCQUMzQixPQUFPLENBQUMsR0FBRyxDQUFDLHdCQUF3QixFQUFFLElBQUksQ0FBQyxDQUFDO3lCQUM1QztxQkFDRDtvQkFDRCxNQUFNO2lCQUNOO2dCQUNEO29CQUNDLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXVCLElBQU0sQ0FBQyxDQUFDO2FBQ2hEO1lBRUQsbUJBQW1CO1lBQ25CLE9BQU8sSUFBSSxHQUFHLENBQUMsRUFBRTtnQkFDaEIsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDO2dCQUNoQixJQUFJLEVBQUUsQ0FBQzthQUNQO1NBQ0Q7S0FDRDtTQUFNO1FBQ04sTUFBTSxJQUFJLEtBQUssQ0FBQyw4QkFBNEIsT0FBTyxNQUFHLENBQUMsQ0FBQztLQUN4RDtJQUVELE9BQU8sRUFBRSxPQUFPLFNBQUEsRUFBRSxRQUFRLFVBQUEsRUFBRSxPQUFPLFNBQUEsRUFBRSxDQUFDO0FBQ3ZDLENBQUM7QUF4T0QsMEJBd09DIiwiZmlsZSI6ImFici5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJsbk0sIERlc2NyaXB0b3JVbml0c1ZhbHVlLCBwYXJzZUFuZ2xlLCBwYXJzZVBlcmNlbnQsIHBhcnNlVW5pdHNUb051bWJlciwgcmVhZFZlcnNpb25BbmREZXNjcmlwdG9yIH0gZnJvbSAnLi9kZXNjcmlwdG9yJztcclxuaW1wb3J0IHsgQmxlbmRNb2RlLCBQYXR0ZXJuSW5mbyB9IGZyb20gJy4vcHNkJztcclxuaW1wb3J0IHtcclxuXHRjaGVja1NpZ25hdHVyZSwgY3JlYXRlUmVhZGVyLCByZWFkQnl0ZXMsIHJlYWREYXRhUkxFLCByZWFkSW50MTYsIHJlYWRJbnQzMiwgcmVhZFBhc2NhbFN0cmluZywgcmVhZFBhdHRlcm4sXHJcblx0cmVhZFNpZ25hdHVyZSwgcmVhZFVpbnQxNiwgcmVhZFVpbnQzMiwgcmVhZFVpbnQ4LCBza2lwQnl0ZXNcclxufSBmcm9tICcuL3BzZFJlYWRlcic7XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEFiciB7XHJcblx0YnJ1c2hlczogQnJ1c2hbXTtcclxuXHRzYW1wbGVzOiBTYW1wbGVJbmZvW107XHJcblx0cGF0dGVybnM6IFBhdHRlcm5JbmZvW107XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgU2FtcGxlSW5mbyB7XHJcblx0aWQ6IHN0cmluZztcclxuXHRib3VuZHM6IHsgeDogbnVtYmVyOyB5OiBudW1iZXI7IHc6IG51bWJlcjsgaDogbnVtYmVyOyB9O1xyXG5cdGFscGhhOiBVaW50OEFycmF5O1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEJydXNoRHluYW1pY3Mge1xyXG5cdGNvbnRyb2w6ICdvZmYnIHwgJ2ZhZGUnIHwgJ3BlbiBwcmVzc3VyZScgfCAncGVuIHRpbHQnIHwgJ3N0eWx1cyB3aGVlbCcgfCAnaW5pdGlhbCBkaXJlY3Rpb24nIHwgJ2RpcmVjdGlvbicgfCAnaW5pdGlhbCByb3RhdGlvbicgfCAncm90YXRpb24nO1xyXG5cdHN0ZXBzOiBudW1iZXI7IC8vIGZvciBmYWRlXHJcblx0aml0dGVyOiBudW1iZXI7XHJcblx0bWluaW11bTogbnVtYmVyO1xyXG59XHJcblxyXG5jb25zdCBkeW5hbWljc0NvbnRyb2wgPSBbJ29mZicsICdmYWRlJywgJ3BlbiBwcmVzc3VyZScsICdwZW4gdGlsdCcsICdzdHlsdXMgd2hlZWwnLCAnaW5pdGlhbCBkaXJlY3Rpb24nLCAnZGlyZWN0aW9uJywgJ2luaXRpYWwgcm90YXRpb24nLCAncm90YXRpb24nXTtcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgQnJ1c2hTaGFwZSB7XHJcblx0bmFtZT86IHN0cmluZztcclxuXHRzaXplOiBudW1iZXI7XHJcblx0YW5nbGU6IG51bWJlcjtcclxuXHRyb3VuZG5lc3M6IG51bWJlcjtcclxuXHRoYXJkbmVzcz86IG51bWJlcjtcclxuXHRzcGFjaW5nT246IGJvb2xlYW47XHJcblx0c3BhY2luZzogbnVtYmVyO1xyXG5cdGZsaXBYOiBib29sZWFuO1xyXG5cdGZsaXBZOiBib29sZWFuO1xyXG5cdHNhbXBsZWREYXRhPzogc3RyaW5nO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEJydXNoIHtcclxuXHRuYW1lOiBzdHJpbmc7XHJcblx0c2hhcGU6IEJydXNoU2hhcGU7XHJcblx0c2hhcGVEeW5hbWljcz86IHtcclxuXHRcdHNpemVEeW5hbWljczogQnJ1c2hEeW5hbWljcztcclxuXHRcdG1pbmltdW1EaWFtZXRlcjogbnVtYmVyO1xyXG5cdFx0dGlsdFNjYWxlOiBudW1iZXI7XHJcblx0XHRhbmdsZUR5bmFtaWNzOiBCcnVzaER5bmFtaWNzO1xyXG5cdFx0cm91bmRuZXNzRHluYW1pY3M6IEJydXNoRHluYW1pY3M7XHJcblx0XHRtaW5pbXVtUm91bmRuZXNzOiBudW1iZXI7XHJcblx0XHRmbGlwWDogYm9vbGVhbjtcclxuXHRcdGZsaXBZOiBib29sZWFuO1xyXG5cdFx0YnJ1c2hQcm9qZWN0aW9uOiBib29sZWFuO1xyXG5cdH07XHJcblx0c2NhdHRlcj86IHtcclxuXHRcdGJvdGhBeGVzOiBib29sZWFuO1xyXG5cdFx0c2NhdHRlckR5bmFtaWNzOiBCcnVzaER5bmFtaWNzO1xyXG5cdFx0Y291bnREeW5hbWljczogQnJ1c2hEeW5hbWljcztcclxuXHRcdGNvdW50OiBudW1iZXI7XHJcblx0fTtcclxuXHR0ZXh0dXJlPzoge1xyXG5cdFx0aWQ6IHN0cmluZztcclxuXHRcdG5hbWU6IHN0cmluZztcclxuXHRcdGludmVydDogYm9vbGVhbjtcclxuXHRcdHNjYWxlOiBudW1iZXI7XHJcblx0XHRicmlnaHRuZXNzOiBudW1iZXI7XHJcblx0XHRjb250cmFzdDogbnVtYmVyO1xyXG5cdFx0YmxlbmRNb2RlOiBCbGVuZE1vZGU7XHJcblx0XHRkZXB0aDogbnVtYmVyO1xyXG5cdFx0ZGVwdGhNaW5pbXVtOiBudW1iZXI7XHJcblx0XHRkZXB0aER5bmFtaWNzOiBCcnVzaER5bmFtaWNzO1xyXG5cdH07XHJcblx0ZHVhbEJydXNoPzoge1xyXG5cdFx0ZmxpcDogYm9vbGVhbjtcclxuXHRcdHNoYXBlOiBCcnVzaFNoYXBlO1xyXG5cdFx0YmxlbmRNb2RlOiBCbGVuZE1vZGU7XHJcblx0XHR1c2VTY2F0dGVyOiBib29sZWFuO1xyXG5cdFx0c3BhY2luZzogbnVtYmVyO1xyXG5cdFx0Y291bnQ6IG51bWJlcjtcclxuXHRcdGJvdGhBeGVzOiBib29sZWFuO1xyXG5cdFx0Y291bnREeW5hbWljczogQnJ1c2hEeW5hbWljcztcclxuXHRcdHNjYXR0ZXJEeW5hbWljczogQnJ1c2hEeW5hbWljcztcclxuXHR9O1xyXG5cdGNvbG9yRHluYW1pY3M/OiB7XHJcblx0XHRmb3JlZ3JvdW5kQmFja2dyb3VuZDogQnJ1c2hEeW5hbWljcztcclxuXHRcdGh1ZTogbnVtYmVyO1xyXG5cdFx0c2F0dXJhdGlvbjogbnVtYmVyO1xyXG5cdFx0YnJpZ2h0bmVzczogbnVtYmVyO1xyXG5cdFx0cHVyaXR5OiBudW1iZXI7XHJcblx0XHRwZXJUaXA6IGJvb2xlYW47XHJcblx0fTtcclxuXHR0cmFuc2Zlcj86IHtcclxuXHRcdGZsb3dEeW5hbWljczogQnJ1c2hEeW5hbWljcztcclxuXHRcdG9wYWNpdHlEeW5hbWljczogQnJ1c2hEeW5hbWljcztcclxuXHRcdHdldG5lc3NEeW5hbWljczogQnJ1c2hEeW5hbWljcztcclxuXHRcdG1peER5bmFtaWNzOiBCcnVzaER5bmFtaWNzO1xyXG5cdH07XHJcblx0YnJ1c2hQb3NlPzoge1xyXG5cdFx0b3ZlcnJpZGVBbmdsZTogYm9vbGVhbjtcclxuXHRcdG92ZXJyaWRlVGlsdFg6IGJvb2xlYW47XHJcblx0XHRvdmVycmlkZVRpbHRZOiBib29sZWFuO1xyXG5cdFx0b3ZlcnJpZGVQcmVzc3VyZTogYm9vbGVhbjtcclxuXHRcdHByZXNzdXJlOiBudW1iZXI7XHJcblx0XHR0aWx0WDogbnVtYmVyO1xyXG5cdFx0dGlsdFk6IG51bWJlcjtcclxuXHRcdGFuZ2xlOiBudW1iZXI7XHJcblx0fTtcclxuXHRub2lzZTogYm9vbGVhbjtcclxuXHR3ZXRFZGdlczogYm9vbGVhbjtcclxuXHQvLyBUT0RPOiBidWlsZC11cFxyXG5cdC8vIFRPRE86IHNtb290aGluZ1xyXG5cdHByb3RlY3RUZXh0dXJlPzogYm9vbGVhbjtcclxuXHRzcGFjaW5nOiBudW1iZXI7XHJcblx0YnJ1c2hHcm91cD86IHVuZGVmaW5lZDsgLy8gP1xyXG5cdGludGVycHJldGF0aW9uPzogYm9vbGVhbjsgLy8gP1xyXG5cdHVzZUJydXNoU2l6ZTogYm9vbGVhbjsgLy8gP1xyXG5cdHRvb2xPcHRpb25zPzoge1xyXG5cdFx0YnJ1c2hQcmVzZXQ6IGJvb2xlYW47XHJcblx0XHRmbG93OiBudW1iZXI7XHJcblx0XHRzbW9vdGg6IG51bWJlcjsgLy8gP1xyXG5cdFx0bW9kZTogQmxlbmRNb2RlO1xyXG5cdFx0b3BhY2l0eTogbnVtYmVyO1xyXG5cdFx0c21vb3RoaW5nOiBib29sZWFuO1xyXG5cdFx0c21vb3RoaW5nVmFsdWU6IG51bWJlcjtcclxuXHRcdHNtb290aGluZ1JhZGl1c01vZGU6IGJvb2xlYW47XHJcblx0XHRzbW9vdGhpbmdDYXRjaHVwOiBib29sZWFuO1xyXG5cdFx0c21vb3RoaW5nQ2F0Y2h1cEF0RW5kOiBib29sZWFuO1xyXG5cdFx0c21vb3RoaW5nWm9vbUNvbXBlbnNhdGlvbjogYm9vbGVhbjtcclxuXHRcdHByZXNzdXJlU21vb3RoaW5nOiBib29sZWFuO1xyXG5cdFx0dXNlUHJlc3N1cmVPdmVycmlkZXNTaXplOiBib29sZWFuO1xyXG5cdFx0dXNlUHJlc3N1cmVPdmVycmlkZXNPcGFjaXR5OiBib29sZWFuO1xyXG5cdFx0dXNlTGVnYWN5OiBib29sZWFuO1xyXG5cdH07XHJcbn1cclxuXHJcbi8vIGludGVybmFsXHJcblxyXG5pbnRlcmZhY2UgUGhyeURlc2NyaXB0b3Ige1xyXG5cdGhpZXJhcmNoeTogYW55W107XHJcbn1cclxuXHJcbmludGVyZmFjZSBEeW5hbWljc0Rlc2NyaXB0b3Ige1xyXG5cdGJWVHk6IG51bWJlcjtcclxuXHRmU3RwOiBudW1iZXI7XHJcblx0aml0dGVyOiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHQnTW5tICc6IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xyXG59XHJcblxyXG5pbnRlcmZhY2UgQnJ1c2hTaGFwZURlc2NyaXB0b3Ige1xyXG5cdERtdHI6IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xyXG5cdEFuZ2w6IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xyXG5cdFJuZG46IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xyXG5cdCdObSAgJz86IHN0cmluZztcclxuXHRTcGNuOiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHRJbnRyOiBib29sZWFuO1xyXG5cdEhyZG4/OiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHRmbGlwWDogYm9vbGVhbjtcclxuXHRmbGlwWTogYm9vbGVhbjtcclxuXHRzYW1wbGVkRGF0YT86IHN0cmluZztcclxufVxyXG5cclxuaW50ZXJmYWNlIERlc2NEZXNjcmlwdG9yIHtcclxuXHRCcnNoOiB7XHJcblx0XHQnTm0gICc6IHN0cmluZztcclxuXHRcdEJyc2g6IEJydXNoU2hhcGVEZXNjcmlwdG9yO1xyXG5cdFx0dXNlVGlwRHluYW1pY3M6IGJvb2xlYW47XHJcblx0XHRmbGlwWDogYm9vbGVhbjtcclxuXHRcdGZsaXBZOiBib29sZWFuO1xyXG5cdFx0YnJ1c2hQcm9qZWN0aW9uOiBib29sZWFuO1xyXG5cdFx0bWluaW11bURpYW1ldGVyOiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHRcdG1pbmltdW1Sb3VuZG5lc3M6IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xyXG5cdFx0dGlsdFNjYWxlOiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHRcdHN6VnI6IER5bmFtaWNzRGVzY3JpcHRvcjtcclxuXHRcdGFuZ2xlRHluYW1pY3M6IER5bmFtaWNzRGVzY3JpcHRvcjtcclxuXHRcdHJvdW5kbmVzc0R5bmFtaWNzOiBEeW5hbWljc0Rlc2NyaXB0b3I7XHJcblx0XHR1c2VTY2F0dGVyOiBib29sZWFuO1xyXG5cdFx0U3BjbjogRGVzY3JpcHRvclVuaXRzVmFsdWU7XHJcblx0XHQnQ250ICc6IG51bWJlcjtcclxuXHRcdGJvdGhBeGVzOiBib29sZWFuO1xyXG5cdFx0Y291bnREeW5hbWljczogRHluYW1pY3NEZXNjcmlwdG9yO1xyXG5cdFx0c2NhdHRlckR5bmFtaWNzOiBEeW5hbWljc0Rlc2NyaXB0b3I7XHJcblx0XHRkdWFsQnJ1c2g6IHsgdXNlRHVhbEJydXNoOiBmYWxzZTsgfSB8IHtcclxuXHRcdFx0dXNlRHVhbEJydXNoOiB0cnVlO1xyXG5cdFx0XHRGbGlwOiBib29sZWFuO1xyXG5cdFx0XHRCcnNoOiBCcnVzaFNoYXBlRGVzY3JpcHRvcjtcclxuXHRcdFx0QmxuTTogc3RyaW5nO1xyXG5cdFx0XHR1c2VTY2F0dGVyOiBib29sZWFuO1xyXG5cdFx0XHRTcGNuOiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHRcdFx0J0NudCAnOiBudW1iZXI7XHJcblx0XHRcdGJvdGhBeGVzOiBib29sZWFuO1xyXG5cdFx0XHRjb3VudER5bmFtaWNzOiBEeW5hbWljc0Rlc2NyaXB0b3I7XHJcblx0XHRcdHNjYXR0ZXJEeW5hbWljczogRHluYW1pY3NEZXNjcmlwdG9yO1xyXG5cdFx0fTtcclxuXHRcdGJydXNoR3JvdXA6IHsgdXNlQnJ1c2hHcm91cDogZmFsc2U7IH07XHJcblx0XHR1c2VUZXh0dXJlOiBib29sZWFuO1xyXG5cdFx0VHh0QzogYm9vbGVhbjtcclxuXHRcdGludGVycHJldGF0aW9uOiBib29sZWFuO1xyXG5cdFx0dGV4dHVyZUJsZW5kTW9kZTogc3RyaW5nO1xyXG5cdFx0dGV4dHVyZURlcHRoOiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHRcdG1pbmltdW1EZXB0aDogRGVzY3JpcHRvclVuaXRzVmFsdWU7XHJcblx0XHR0ZXh0dXJlRGVwdGhEeW5hbWljczogRHluYW1pY3NEZXNjcmlwdG9yO1xyXG5cdFx0VHh0cjoge1xyXG5cdFx0XHQnTm0gICc6IHN0cmluZztcclxuXHRcdFx0SWRudDogc3RyaW5nO1xyXG5cdFx0fTtcclxuXHRcdHRleHR1cmVTY2FsZTogRGVzY3JpcHRvclVuaXRzVmFsdWU7XHJcblx0XHRJbnZUOiBib29sZWFuO1xyXG5cdFx0cHJvdGVjdFRleHR1cmU6IGJvb2xlYW47XHJcblx0XHR0ZXh0dXJlQnJpZ2h0bmVzczogbnVtYmVyO1xyXG5cdFx0dGV4dHVyZUNvbnRyYXN0OiBudW1iZXI7XHJcblx0XHR1c2VQYWludER5bmFtaWNzOiBib29sZWFuO1xyXG5cdFx0cHJWcj86IER5bmFtaWNzRGVzY3JpcHRvcjtcclxuXHRcdG9wVnI/OiBEeW5hbWljc0Rlc2NyaXB0b3I7XHJcblx0XHR3dFZyPzogRHluYW1pY3NEZXNjcmlwdG9yO1xyXG5cdFx0bXhWcj86IER5bmFtaWNzRGVzY3JpcHRvcjtcclxuXHRcdHVzZUNvbG9yRHluYW1pY3M6IGJvb2xlYW47XHJcblx0XHRjbFZyPzogRHluYW1pY3NEZXNjcmlwdG9yO1xyXG5cdFx0J0ggICAnPzogRGVzY3JpcHRvclVuaXRzVmFsdWU7XHJcblx0XHRTdHJ0PzogRGVzY3JpcHRvclVuaXRzVmFsdWU7XHJcblx0XHRCcmdoPzogRGVzY3JpcHRvclVuaXRzVmFsdWU7XHJcblx0XHRwdXJpdHk/OiBEZXNjcmlwdG9yVW5pdHNWYWx1ZTtcclxuXHRcdGNvbG9yRHluYW1pY3NQZXJUaXA/OiB0cnVlO1xyXG5cdFx0V3RkZzogYm9vbGVhbjtcclxuXHRcdE5vc2U6IGJvb2xlYW47XHJcblx0XHQnUnB0ICc6IGJvb2xlYW47XHJcblx0XHR1c2VCcnVzaFNpemU6IGJvb2xlYW47XHJcblx0XHR1c2VCcnVzaFBvc2U6IGJvb2xlYW47XHJcblx0XHRvdmVycmlkZVBvc2VBbmdsZT86IGJvb2xlYW47XHJcblx0XHRvdmVycmlkZVBvc2VUaWx0WD86IGJvb2xlYW47XHJcblx0XHRvdmVycmlkZVBvc2VUaWx0WT86IGJvb2xlYW47XHJcblx0XHRvdmVycmlkZVBvc2VQcmVzc3VyZT86IGJvb2xlYW47XHJcblx0XHRicnVzaFBvc2VQcmVzc3VyZT86IERlc2NyaXB0b3JVbml0c1ZhbHVlO1xyXG5cdFx0YnJ1c2hQb3NlVGlsdFg/OiBudW1iZXI7XHJcblx0XHRicnVzaFBvc2VUaWx0WT86IG51bWJlcjtcclxuXHRcdGJydXNoUG9zZUFuZ2xlPzogbnVtYmVyO1xyXG5cdFx0dG9vbE9wdGlvbnM/OiB7XHJcblx0XHRcdGJydXNoUHJlc2V0OiBib29sZWFuO1xyXG5cdFx0XHRmbG93OiBudW1iZXI7XHJcblx0XHRcdFNtb286IG51bWJlcjtcclxuXHRcdFx0J01kICAnOiBzdHJpbmc7XHJcblx0XHRcdE9wY3Q6IG51bWJlcjtcclxuXHRcdFx0c21vb3RoaW5nOiBib29sZWFuO1xyXG5cdFx0XHRzbW9vdGhpbmdWYWx1ZTogbnVtYmVyO1xyXG5cdFx0XHRzbW9vdGhpbmdSYWRpdXNNb2RlOiBib29sZWFuO1xyXG5cdFx0XHRzbW9vdGhpbmdDYXRjaHVwOiBib29sZWFuO1xyXG5cdFx0XHRzbW9vdGhpbmdDYXRjaHVwQXRFbmQ6IGJvb2xlYW47XHJcblx0XHRcdHNtb290aGluZ1pvb21Db21wZW5zYXRpb246IGJvb2xlYW47XHJcblx0XHRcdHByZXNzdXJlU21vb3RoaW5nOiBib29sZWFuO1xyXG5cdFx0XHR1c2VQcmVzc3VyZU92ZXJyaWRlc1NpemU6IGJvb2xlYW47XHJcblx0XHRcdHVzZVByZXNzdXJlT3ZlcnJpZGVzT3BhY2l0eTogYm9vbGVhbjtcclxuXHRcdFx0dXNlTGVnYWN5OiBib29sZWFuO1xyXG5cdFx0fTtcclxuXHR9W107XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHBhcnNlRHluYW1pY3MoZGVzYzogRHluYW1pY3NEZXNjcmlwdG9yKTogQnJ1c2hEeW5hbWljcyB7XHJcblx0cmV0dXJuIHtcclxuXHRcdGNvbnRyb2w6IGR5bmFtaWNzQ29udHJvbFtkZXNjLmJWVHldIGFzIGFueSxcclxuXHRcdHN0ZXBzOiBkZXNjLmZTdHAsXHJcblx0XHRqaXR0ZXI6IHBhcnNlUGVyY2VudChkZXNjLmppdHRlciksXHJcblx0XHRtaW5pbXVtOiBwYXJzZVBlcmNlbnQoZGVzY1snTW5tICddKSxcclxuXHR9O1xyXG59XHJcblxyXG5mdW5jdGlvbiBwYXJzZUJydXNoU2hhcGUoZGVzYzogQnJ1c2hTaGFwZURlc2NyaXB0b3IpOiBCcnVzaFNoYXBlIHtcclxuXHRjb25zdCBzaGFwZTogQnJ1c2hTaGFwZSA9IHtcclxuXHRcdHNpemU6IHBhcnNlVW5pdHNUb051bWJlcihkZXNjLkRtdHIsICdQaXhlbHMnKSxcclxuXHRcdGFuZ2xlOiBwYXJzZUFuZ2xlKGRlc2MuQW5nbCksXHJcblx0XHRyb3VuZG5lc3M6IHBhcnNlUGVyY2VudChkZXNjLlJuZG4pLFxyXG5cdFx0c3BhY2luZ09uOiBkZXNjLkludHIsXHJcblx0XHRzcGFjaW5nOiBwYXJzZVBlcmNlbnQoZGVzYy5TcGNuKSxcclxuXHRcdGZsaXBYOiBkZXNjLmZsaXBYLFxyXG5cdFx0ZmxpcFk6IGRlc2MuZmxpcFksXHJcblx0fTtcclxuXHJcblx0aWYgKGRlc2NbJ05tICAnXSkgc2hhcGUubmFtZSA9IGRlc2NbJ05tICAnXTtcclxuXHRpZiAoZGVzYy5IcmRuKSBzaGFwZS5oYXJkbmVzcyA9IHBhcnNlUGVyY2VudChkZXNjLkhyZG4pO1xyXG5cdGlmIChkZXNjLnNhbXBsZWREYXRhKSBzaGFwZS5zYW1wbGVkRGF0YSA9IGRlc2Muc2FtcGxlZERhdGE7XHJcblxyXG5cdHJldHVybiBzaGFwZTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRBYnIoYnVmZmVyOiBBcnJheUJ1ZmZlclZpZXcsIG9wdGlvbnM6IHsgbG9nTWlzc2luZ0ZlYXR1cmVzPzogYm9vbGVhbjsgfSA9IHt9KTogQWJyIHtcclxuXHRjb25zdCByZWFkZXIgPSBjcmVhdGVSZWFkZXIoYnVmZmVyLmJ1ZmZlciwgYnVmZmVyLmJ5dGVPZmZzZXQsIGJ1ZmZlci5ieXRlTGVuZ3RoKTtcclxuXHRjb25zdCB2ZXJzaW9uID0gcmVhZEludDE2KHJlYWRlcik7XHJcblx0Y29uc3Qgc2FtcGxlczogU2FtcGxlSW5mb1tdID0gW107XHJcblx0Y29uc3QgYnJ1c2hlczogQnJ1c2hbXSA9IFtdO1xyXG5cdGNvbnN0IHBhdHRlcm5zOiBQYXR0ZXJuSW5mb1tdID0gW107XHJcblxyXG5cdGlmICh2ZXJzaW9uID09PSAxIHx8IHZlcnNpb24gPT09IDIpIHtcclxuXHRcdHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgQUJSIHZlcnNpb24gKCR7dmVyc2lvbn0pYCk7IC8vIFRPRE86IC4uLlxyXG5cdH0gZWxzZSBpZiAodmVyc2lvbiA9PT0gNiB8fCB2ZXJzaW9uID09PSA3IHx8IHZlcnNpb24gPT09IDkgfHwgdmVyc2lvbiA9PT0gMTApIHtcclxuXHRcdGNvbnN0IG1pbm9yVmVyc2lvbiA9IHJlYWRJbnQxNihyZWFkZXIpO1xyXG5cdFx0aWYgKG1pbm9yVmVyc2lvbiAhPT0gMSAmJiBtaW5vclZlcnNpb24gIT09IDIpIHRocm93IG5ldyBFcnJvcignVW5zdXBwb3J0ZWQgQUJSIG1pbm9yIHZlcnNpb24nKTtcclxuXHJcblx0XHR3aGlsZSAocmVhZGVyLm9mZnNldCA8IHJlYWRlci52aWV3LmJ5dGVMZW5ndGgpIHtcclxuXHRcdFx0Y2hlY2tTaWduYXR1cmUocmVhZGVyLCAnOEJJTScpO1xyXG5cdFx0XHRjb25zdCB0eXBlID0gcmVhZFNpZ25hdHVyZShyZWFkZXIpIGFzICdzYW1wJyB8ICdkZXNjJyB8ICdwYXR0JyB8ICdwaHJ5JztcclxuXHRcdFx0bGV0IHNpemUgPSByZWFkVWludDMyKHJlYWRlcik7XHJcblx0XHRcdGNvbnN0IGVuZCA9IHJlYWRlci5vZmZzZXQgKyBzaXplO1xyXG5cclxuXHRcdFx0c3dpdGNoICh0eXBlKSB7XHJcblx0XHRcdFx0Y2FzZSAnc2FtcCc6IHtcclxuXHRcdFx0XHRcdHdoaWxlIChyZWFkZXIub2Zmc2V0IDwgZW5kKSB7XHJcblx0XHRcdFx0XHRcdGxldCBicnVzaExlbmd0aCA9IHJlYWRVaW50MzIocmVhZGVyKTtcclxuXHRcdFx0XHRcdFx0d2hpbGUgKGJydXNoTGVuZ3RoICYgMGIxMSkgYnJ1c2hMZW5ndGgrKzsgLy8gcGFkIHRvIDQgYnl0ZSBhbGlnbm1lbnRcclxuXHRcdFx0XHRcdFx0Y29uc3QgYnJ1c2hFbmQgPSByZWFkZXIub2Zmc2V0ICsgYnJ1c2hMZW5ndGg7XHJcblxyXG5cdFx0XHRcdFx0XHRjb25zdCBpZCA9IHJlYWRQYXNjYWxTdHJpbmcocmVhZGVyLCAxKTtcclxuXHJcblx0XHRcdFx0XHRcdC8vIHYxIC0gU2tpcCB0aGUgSW50MTYgYm91bmRzIHJlY3RhbmdsZSBhbmQgdGhlIHVua25vd24gSW50MTYuXHJcblx0XHRcdFx0XHRcdC8vIHYyIC0gU2tpcCB0aGUgdW5rbm93biBieXRlcy5cclxuXHRcdFx0XHRcdFx0c2tpcEJ5dGVzKHJlYWRlciwgbWlub3JWZXJzaW9uID09PSAxID8gMTAgOiAyNjQpO1xyXG5cclxuXHRcdFx0XHRcdFx0Y29uc3QgeSA9IHJlYWRJbnQzMihyZWFkZXIpO1xyXG5cdFx0XHRcdFx0XHRjb25zdCB4ID0gcmVhZEludDMyKHJlYWRlcik7XHJcblx0XHRcdFx0XHRcdGNvbnN0IGggPSByZWFkSW50MzIocmVhZGVyKSAtIHk7XHJcblx0XHRcdFx0XHRcdGNvbnN0IHcgPSByZWFkSW50MzIocmVhZGVyKSAtIHg7XHJcblx0XHRcdFx0XHRcdGlmICh3IDw9IDAgfHwgaCA8PSAwKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgYm91bmRzJyk7XHJcblxyXG5cdFx0XHRcdFx0XHRjb25zdCBkZXB0aCA9IHJlYWRJbnQxNihyZWFkZXIpO1xyXG5cdFx0XHRcdFx0XHRjb25zdCBjb21wcmVzc2lvbiA9IHJlYWRVaW50OChyZWFkZXIpOyAvLyAwIC0gcmF3LCAxIC0gUkxFXHJcblx0XHRcdFx0XHRcdGNvbnN0IGFscGhhID0gbmV3IFVpbnQ4QXJyYXkodyAqIGgpO1xyXG5cclxuXHRcdFx0XHRcdFx0aWYgKGRlcHRoID09PSA4KSB7XHJcblx0XHRcdFx0XHRcdFx0aWYgKGNvbXByZXNzaW9uID09PSAwKSB7XHJcblx0XHRcdFx0XHRcdFx0XHRhbHBoYS5zZXQocmVhZEJ5dGVzKHJlYWRlciwgYWxwaGEuYnl0ZUxlbmd0aCkpO1xyXG5cdFx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoY29tcHJlc3Npb24gPT09IDEpIHtcclxuXHRcdFx0XHRcdFx0XHRcdHJlYWREYXRhUkxFKHJlYWRlciwgeyB3aWR0aDogdywgaGVpZ2h0OiBoLCBkYXRhOiBhbHBoYSB9LCB3LCBoLCAxLCBbMF0sIGZhbHNlKTtcclxuXHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGNvbXByZXNzaW9uJyk7XHJcblx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKGRlcHRoID09PSAxNikge1xyXG5cdFx0XHRcdFx0XHRcdGlmIChjb21wcmVzc2lvbiA9PT0gMCkge1xyXG5cdFx0XHRcdFx0XHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBhbHBoYS5ieXRlTGVuZ3RoOyBpKyspIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0YWxwaGFbaV0gPSByZWFkVWludDE2KHJlYWRlcikgPj4gODsgLy8gY29udmVydCB0byA4Yml0IHZhbHVlc1xyXG5cdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoY29tcHJlc3Npb24gPT09IDEpIHtcclxuXHRcdFx0XHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkICgxNmJpdCBSTEUpJyk7IC8vIFRPRE86IC4uLlxyXG5cdFx0XHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY29tcHJlc3Npb24nKTtcclxuXHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGRlcHRoJyk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRcdHNhbXBsZXMucHVzaCh7IGlkLCBib3VuZHM6IHsgeCwgeSwgdywgaCB9LCBhbHBoYSB9KTtcclxuXHRcdFx0XHRcdFx0cmVhZGVyLm9mZnNldCA9IGJydXNoRW5kO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGNhc2UgJ2Rlc2MnOiB7XHJcblx0XHRcdFx0XHRjb25zdCBkZXNjOiBEZXNjRGVzY3JpcHRvciA9IHJlYWRWZXJzaW9uQW5kRGVzY3JpcHRvcihyZWFkZXIpO1xyXG5cdFx0XHRcdFx0Ly8gY29uc29sZS5sb2cocmVxdWlyZSgndXRpbCcpLmluc3BlY3QoZGVzYywgZmFsc2UsIDk5LCB0cnVlKSk7XHJcblxyXG5cdFx0XHRcdFx0Zm9yIChjb25zdCBicnVzaCBvZiBkZXNjLkJyc2gpIHtcclxuXHRcdFx0XHRcdFx0Y29uc3QgYjogQnJ1c2ggPSB7XHJcblx0XHRcdFx0XHRcdFx0bmFtZTogYnJ1c2hbJ05tICAnXSxcclxuXHRcdFx0XHRcdFx0XHRzaGFwZTogcGFyc2VCcnVzaFNoYXBlKGJydXNoLkJyc2gpLFxyXG5cdFx0XHRcdFx0XHRcdHNwYWNpbmc6IHBhcnNlUGVyY2VudChicnVzaC5TcGNuKSxcclxuXHRcdFx0XHRcdFx0XHQvLyBUT0RPOiBicnVzaEdyb3VwID8/P1xyXG5cdFx0XHRcdFx0XHRcdHdldEVkZ2VzOiBicnVzaC5XdGRnLFxyXG5cdFx0XHRcdFx0XHRcdG5vaXNlOiBicnVzaC5Ob3NlLFxyXG5cdFx0XHRcdFx0XHRcdC8vIFRPRE86IFR4dEMgPz8/IHNtb290aGluZyAvIGJ1aWxkLXVwID9cclxuXHRcdFx0XHRcdFx0XHQvLyBUT0RPOiAnUnB0ICcgPz8/XHJcblx0XHRcdFx0XHRcdFx0dXNlQnJ1c2hTaXplOiBicnVzaC51c2VCcnVzaFNpemUsIC8vID8/P1xyXG5cdFx0XHRcdFx0XHR9O1xyXG5cclxuXHRcdFx0XHRcdFx0aWYgKGJydXNoLmludGVycHJldGF0aW9uICE9IG51bGwpIGIuaW50ZXJwcmV0YXRpb24gPSBicnVzaC5pbnRlcnByZXRhdGlvbjtcclxuXHRcdFx0XHRcdFx0aWYgKGJydXNoLnByb3RlY3RUZXh0dXJlICE9IG51bGwpIGIucHJvdGVjdFRleHR1cmUgPSBicnVzaC5wcm90ZWN0VGV4dHVyZTtcclxuXHJcblx0XHRcdFx0XHRcdGlmIChicnVzaC51c2VUaXBEeW5hbWljcykge1xyXG5cdFx0XHRcdFx0XHRcdGIuc2hhcGVEeW5hbWljcyA9IHtcclxuXHRcdFx0XHRcdFx0XHRcdHRpbHRTY2FsZTogcGFyc2VQZXJjZW50KGJydXNoLnRpbHRTY2FsZSksXHJcblx0XHRcdFx0XHRcdFx0XHRzaXplRHluYW1pY3M6IHBhcnNlRHluYW1pY3MoYnJ1c2guc3pWciksXHJcblx0XHRcdFx0XHRcdFx0XHRhbmdsZUR5bmFtaWNzOiBwYXJzZUR5bmFtaWNzKGJydXNoLmFuZ2xlRHluYW1pY3MpLFxyXG5cdFx0XHRcdFx0XHRcdFx0cm91bmRuZXNzRHluYW1pY3M6IHBhcnNlRHluYW1pY3MoYnJ1c2gucm91bmRuZXNzRHluYW1pY3MpLFxyXG5cdFx0XHRcdFx0XHRcdFx0ZmxpcFg6IGJydXNoLmZsaXBYLFxyXG5cdFx0XHRcdFx0XHRcdFx0ZmxpcFk6IGJydXNoLmZsaXBZLFxyXG5cdFx0XHRcdFx0XHRcdFx0YnJ1c2hQcm9qZWN0aW9uOiBicnVzaC5icnVzaFByb2plY3Rpb24sXHJcblx0XHRcdFx0XHRcdFx0XHRtaW5pbXVtRGlhbWV0ZXI6IHBhcnNlUGVyY2VudChicnVzaC5taW5pbXVtRGlhbWV0ZXIpLFxyXG5cdFx0XHRcdFx0XHRcdFx0bWluaW11bVJvdW5kbmVzczogcGFyc2VQZXJjZW50KGJydXNoLm1pbmltdW1Sb3VuZG5lc3MpLFxyXG5cdFx0XHRcdFx0XHRcdH07XHJcblx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRcdGlmIChicnVzaC51c2VTY2F0dGVyKSB7XHJcblx0XHRcdFx0XHRcdFx0Yi5zY2F0dGVyID0ge1xyXG5cdFx0XHRcdFx0XHRcdFx0Y291bnQ6IGJydXNoWydDbnQgJ10sXHJcblx0XHRcdFx0XHRcdFx0XHRib3RoQXhlczogYnJ1c2guYm90aEF4ZXMsXHJcblx0XHRcdFx0XHRcdFx0XHRjb3VudER5bmFtaWNzOiBwYXJzZUR5bmFtaWNzKGJydXNoLmNvdW50RHluYW1pY3MpLFxyXG5cdFx0XHRcdFx0XHRcdFx0c2NhdHRlckR5bmFtaWNzOiBwYXJzZUR5bmFtaWNzKGJydXNoLnNjYXR0ZXJEeW5hbWljcyksXHJcblx0XHRcdFx0XHRcdFx0fTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdFx0aWYgKGJydXNoLnVzZVRleHR1cmUpIHtcclxuXHRcdFx0XHRcdFx0XHRiLnRleHR1cmUgPSB7XHJcblx0XHRcdFx0XHRcdFx0XHRpZDogYnJ1c2guVHh0ci5JZG50LFxyXG5cdFx0XHRcdFx0XHRcdFx0bmFtZTogYnJ1c2guVHh0clsnTm0gICddLFxyXG5cdFx0XHRcdFx0XHRcdFx0YmxlbmRNb2RlOiBCbG5NLmRlY29kZShicnVzaC50ZXh0dXJlQmxlbmRNb2RlKSxcclxuXHRcdFx0XHRcdFx0XHRcdGRlcHRoOiBwYXJzZVBlcmNlbnQoYnJ1c2gudGV4dHVyZURlcHRoKSxcclxuXHRcdFx0XHRcdFx0XHRcdGRlcHRoTWluaW11bTogcGFyc2VQZXJjZW50KGJydXNoLm1pbmltdW1EZXB0aCksXHJcblx0XHRcdFx0XHRcdFx0XHRkZXB0aER5bmFtaWNzOiBwYXJzZUR5bmFtaWNzKGJydXNoLnRleHR1cmVEZXB0aER5bmFtaWNzKSxcclxuXHRcdFx0XHRcdFx0XHRcdHNjYWxlOiBwYXJzZVBlcmNlbnQoYnJ1c2gudGV4dHVyZVNjYWxlKSxcclxuXHRcdFx0XHRcdFx0XHRcdGludmVydDogYnJ1c2guSW52VCxcclxuXHRcdFx0XHRcdFx0XHRcdGJyaWdodG5lc3M6IGJydXNoLnRleHR1cmVCcmlnaHRuZXNzLFxyXG5cdFx0XHRcdFx0XHRcdFx0Y29udHJhc3Q6IGJydXNoLnRleHR1cmVDb250cmFzdCxcclxuXHRcdFx0XHRcdFx0XHR9O1xyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHRjb25zdCBkYiA9IGJydXNoLmR1YWxCcnVzaDtcclxuXHRcdFx0XHRcdFx0aWYgKGRiICYmIGRiLnVzZUR1YWxCcnVzaCkge1xyXG5cdFx0XHRcdFx0XHRcdGIuZHVhbEJydXNoID0ge1xyXG5cdFx0XHRcdFx0XHRcdFx0ZmxpcDogZGIuRmxpcCxcclxuXHRcdFx0XHRcdFx0XHRcdHNoYXBlOiBwYXJzZUJydXNoU2hhcGUoZGIuQnJzaCksXHJcblx0XHRcdFx0XHRcdFx0XHRibGVuZE1vZGU6IEJsbk0uZGVjb2RlKGRiLkJsbk0pLFxyXG5cdFx0XHRcdFx0XHRcdFx0dXNlU2NhdHRlcjogZGIudXNlU2NhdHRlcixcclxuXHRcdFx0XHRcdFx0XHRcdHNwYWNpbmc6IHBhcnNlUGVyY2VudChkYi5TcGNuKSxcclxuXHRcdFx0XHRcdFx0XHRcdGNvdW50OiBkYlsnQ250ICddLFxyXG5cdFx0XHRcdFx0XHRcdFx0Ym90aEF4ZXM6IGRiLmJvdGhBeGVzLFxyXG5cdFx0XHRcdFx0XHRcdFx0Y291bnREeW5hbWljczogcGFyc2VEeW5hbWljcyhkYi5jb3VudER5bmFtaWNzKSxcclxuXHRcdFx0XHRcdFx0XHRcdHNjYXR0ZXJEeW5hbWljczogcGFyc2VEeW5hbWljcyhkYi5zY2F0dGVyRHluYW1pY3MpLFxyXG5cdFx0XHRcdFx0XHRcdH07XHJcblx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRcdGlmIChicnVzaC51c2VDb2xvckR5bmFtaWNzKSB7XHJcblx0XHRcdFx0XHRcdFx0Yi5jb2xvckR5bmFtaWNzID0ge1xyXG5cdFx0XHRcdFx0XHRcdFx0Zm9yZWdyb3VuZEJhY2tncm91bmQ6IHBhcnNlRHluYW1pY3MoYnJ1c2guY2xWciEpLFxyXG5cdFx0XHRcdFx0XHRcdFx0aHVlOiBwYXJzZVBlcmNlbnQoYnJ1c2hbJ0ggICAnXSEpLFxyXG5cdFx0XHRcdFx0XHRcdFx0c2F0dXJhdGlvbjogcGFyc2VQZXJjZW50KGJydXNoLlN0cnQhKSxcclxuXHRcdFx0XHRcdFx0XHRcdGJyaWdodG5lc3M6IHBhcnNlUGVyY2VudChicnVzaC5CcmdoISksXHJcblx0XHRcdFx0XHRcdFx0XHRwdXJpdHk6IHBhcnNlUGVyY2VudChicnVzaC5wdXJpdHkhKSxcclxuXHRcdFx0XHRcdFx0XHRcdHBlclRpcDogYnJ1c2guY29sb3JEeW5hbWljc1BlclRpcCEsXHJcblx0XHRcdFx0XHRcdFx0fTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdFx0aWYgKGJydXNoLnVzZVBhaW50RHluYW1pY3MpIHtcclxuXHRcdFx0XHRcdFx0XHRiLnRyYW5zZmVyID0ge1xyXG5cdFx0XHRcdFx0XHRcdFx0Zmxvd0R5bmFtaWNzOiBwYXJzZUR5bmFtaWNzKGJydXNoLnByVnIhKSxcclxuXHRcdFx0XHRcdFx0XHRcdG9wYWNpdHlEeW5hbWljczogcGFyc2VEeW5hbWljcyhicnVzaC5vcFZyISksXHJcblx0XHRcdFx0XHRcdFx0XHR3ZXRuZXNzRHluYW1pY3M6IHBhcnNlRHluYW1pY3MoYnJ1c2gud3RWciEpLFxyXG5cdFx0XHRcdFx0XHRcdFx0bWl4RHluYW1pY3M6IHBhcnNlRHluYW1pY3MoYnJ1c2gubXhWciEpLFxyXG5cdFx0XHRcdFx0XHRcdH07XHJcblx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRcdGlmIChicnVzaC51c2VCcnVzaFBvc2UpIHtcclxuXHRcdFx0XHRcdFx0XHRiLmJydXNoUG9zZSA9IHtcclxuXHRcdFx0XHRcdFx0XHRcdG92ZXJyaWRlQW5nbGU6IGJydXNoLm92ZXJyaWRlUG9zZUFuZ2xlISxcclxuXHRcdFx0XHRcdFx0XHRcdG92ZXJyaWRlVGlsdFg6IGJydXNoLm92ZXJyaWRlUG9zZVRpbHRYISxcclxuXHRcdFx0XHRcdFx0XHRcdG92ZXJyaWRlVGlsdFk6IGJydXNoLm92ZXJyaWRlUG9zZVRpbHRZISxcclxuXHRcdFx0XHRcdFx0XHRcdG92ZXJyaWRlUHJlc3N1cmU6IGJydXNoLm92ZXJyaWRlUG9zZVByZXNzdXJlISxcclxuXHRcdFx0XHRcdFx0XHRcdHByZXNzdXJlOiBwYXJzZVBlcmNlbnQoYnJ1c2guYnJ1c2hQb3NlUHJlc3N1cmUhKSxcclxuXHRcdFx0XHRcdFx0XHRcdHRpbHRYOiBicnVzaC5icnVzaFBvc2VUaWx0WCEsXHJcblx0XHRcdFx0XHRcdFx0XHR0aWx0WTogYnJ1c2guYnJ1c2hQb3NlVGlsdFkhLFxyXG5cdFx0XHRcdFx0XHRcdFx0YW5nbGU6IGJydXNoLmJydXNoUG9zZUFuZ2xlISxcclxuXHRcdFx0XHRcdFx0XHR9O1xyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHRjb25zdCB0byA9IGJydXNoLnRvb2xPcHRpb25zO1xyXG5cdFx0XHRcdFx0XHRpZiAodG8pIHtcclxuXHRcdFx0XHRcdFx0XHRiLnRvb2xPcHRpb25zID0ge1xyXG5cdFx0XHRcdFx0XHRcdFx0YnJ1c2hQcmVzZXQ6IHRvLmJydXNoUHJlc2V0LFxyXG5cdFx0XHRcdFx0XHRcdFx0ZmxvdzogdG8uZmxvdyxcclxuXHRcdFx0XHRcdFx0XHRcdHNtb290aDogdG8uU21vbyxcclxuXHRcdFx0XHRcdFx0XHRcdG1vZGU6IEJsbk0uZGVjb2RlKHRvWydNZCAgJ10pLFxyXG5cdFx0XHRcdFx0XHRcdFx0b3BhY2l0eTogdG8uT3BjdCxcclxuXHRcdFx0XHRcdFx0XHRcdHNtb290aGluZzogdG8uc21vb3RoaW5nLFxyXG5cdFx0XHRcdFx0XHRcdFx0c21vb3RoaW5nVmFsdWU6IHRvLnNtb290aGluZ1ZhbHVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0c21vb3RoaW5nUmFkaXVzTW9kZTogdG8uc21vb3RoaW5nUmFkaXVzTW9kZSxcclxuXHRcdFx0XHRcdFx0XHRcdHNtb290aGluZ0NhdGNodXA6IHRvLnNtb290aGluZ0NhdGNodXAsXHJcblx0XHRcdFx0XHRcdFx0XHRzbW9vdGhpbmdDYXRjaHVwQXRFbmQ6IHRvLnNtb290aGluZ0NhdGNodXBBdEVuZCxcclxuXHRcdFx0XHRcdFx0XHRcdHNtb290aGluZ1pvb21Db21wZW5zYXRpb246IHRvLnNtb290aGluZ1pvb21Db21wZW5zYXRpb24sXHJcblx0XHRcdFx0XHRcdFx0XHRwcmVzc3VyZVNtb290aGluZzogdG8ucHJlc3N1cmVTbW9vdGhpbmcsXHJcblx0XHRcdFx0XHRcdFx0XHR1c2VQcmVzc3VyZU92ZXJyaWRlc1NpemU6IHRvLnVzZVByZXNzdXJlT3ZlcnJpZGVzU2l6ZSxcclxuXHRcdFx0XHRcdFx0XHRcdHVzZVByZXNzdXJlT3ZlcnJpZGVzT3BhY2l0eTogdG8udXNlUHJlc3N1cmVPdmVycmlkZXNPcGFjaXR5LFxyXG5cdFx0XHRcdFx0XHRcdFx0dXNlTGVnYWN5OiB0by51c2VMZWdhY3ksXHJcblx0XHRcdFx0XHRcdFx0fTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdFx0YnJ1c2hlcy5wdXNoKGIpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGNhc2UgJ3BhdHQnOiB7XHJcblx0XHRcdFx0XHRpZiAocmVhZGVyLm9mZnNldCA8IGVuZCkgeyAvLyBUT0RPOiBjaGVjayBtdWx0aXBsZSBwYXR0ZXJuc1xyXG5cdFx0XHRcdFx0XHRwYXR0ZXJucy5wdXNoKHJlYWRQYXR0ZXJuKHJlYWRlcikpO1xyXG5cdFx0XHRcdFx0XHRyZWFkZXIub2Zmc2V0ID0gZW5kO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGNhc2UgJ3BocnknOiB7XHJcblx0XHRcdFx0XHQvLyBUT0RPOiB3aGF0IGlzIHRoaXMgP1xyXG5cdFx0XHRcdFx0Y29uc3QgZGVzYzogUGhyeURlc2NyaXB0b3IgPSByZWFkVmVyc2lvbkFuZERlc2NyaXB0b3IocmVhZGVyKTtcclxuXHRcdFx0XHRcdGlmIChvcHRpb25zLmxvZ01pc3NpbmdGZWF0dXJlcykge1xyXG5cdFx0XHRcdFx0XHRpZiAoZGVzYy5oaWVyYXJjaHk/Lmxlbmd0aCkge1xyXG5cdFx0XHRcdFx0XHRcdGNvbnNvbGUubG9nKCd1bmhhbmRsZWQgcGhyeSBzZWN0aW9uJywgZGVzYyk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRkZWZhdWx0OlxyXG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGJydXNoIHR5cGU6ICR7dHlwZX1gKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gYWxpZ24gdG8gNCBieXRlc1xyXG5cdFx0XHR3aGlsZSAoc2l6ZSAlIDQpIHtcclxuXHRcdFx0XHRyZWFkZXIub2Zmc2V0Kys7XHJcblx0XHRcdFx0c2l6ZSsrO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fSBlbHNlIHtcclxuXHRcdHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgQUJSIHZlcnNpb24gKCR7dmVyc2lvbn0pYCk7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4geyBzYW1wbGVzLCBwYXR0ZXJucywgYnJ1c2hlcyB9O1xyXG59XHJcbiJdLCJzb3VyY2VSb290IjoiRjpcXHByb2plY3RzXFxhZy1wc2RcXHNyYyJ9
