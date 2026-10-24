import { expect } from 'chai';
import './common';
import { Psd, Layer, Filter, ReadOptions, GradientMapAdjustment, PhotoFilterAdjustment, WriteOptions, Annotation } from '../psd';
import { readPsd, writePsdBuffer } from '../index';
import { infoHandlersMap, ExtendedWriteOptions } from '../additionalInfo';
import { createWriter, getWriterBuffer, writeUint16, writeUint32, writeUint8, writeSignature, writeInt32, writePascalString, writeColor, writeZeros, writeInt16 } from '../psdWriter';
import { createReader, readUint32, readSignature, readUint8, skipBytes } from '../psdReader';
import { readVersionAndDescriptor, writeVersionAndDescriptor } from '../descriptor';

const readOpts: ReadOptions = { skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true };

function roundTrip(psd: Psd, writeOptions: WriteOptions = {}, readOptions: ReadOptions = {}) {
	const buffer = writePsdBuffer(psd, writeOptions);
	return readPsd(buffer, { ...readOpts, ...readOptions });
}

function writeHandler(key: string, target: any, psd: Psd, options: Partial<ExtendedWriteOptions> = {}) {
	const writer = createWriter();
	const opts: ExtendedWriteOptions = { layerIds: new Set(), layerToId: new Map(), ...options };
	infoHandlersMap[key].write(writer, target, psd, opts);
	return getWriterBuffer(writer);
}

function readHandler(key: string, buffer: ArrayBuffer, psd: Psd = { width: 10, height: 10 }) {
	const reader = createReader(buffer);
	const target: any = {};
	const end = buffer.byteLength;
	infoHandlersMap[key].read(reader, target, () => end - reader.offset, psd, {} as any);
	return target;
}

const guid1 = '20953ddb-9391-11ec-b4f1-c15674f50bc4';
const guid2 = '20953ddb-9391-11ec-b4f1-c15674f50bc5';

describe('additionalInfo', () => {
	it('round-trips brst without dropping the last value', () => {
		const psd = roundTrip({
			width: 10, height: 10,
			children: [{ name: 'a', channelBlendingRestrictions: [0, 2] }],
		});
		expect(psd.children![0].channelBlendingRestrictions).eql([0, 2]);
	});

	it('round-trips brst with single value', () => {
		const psd = roundTrip({
			width: 10, height: 10,
			children: [{ name: 'a', channelBlendingRestrictions: [1] }],
		});
		expect(psd.children![0].channelBlendingRestrictions).eql([1]);
	});

	it('writes FEid extra data per mask', () => {
		const masks: Layer['filterEffectsMasks'] = [
			{
				id: 'a', top: 0, left: 0, bottom: 2, right: 2, depth: 8,
				channels: [{ compressionMode: 0, data: new Uint8Array([1, 2, 3, 4]) }, undefined, undefined],
				extra: { top: 0, left: 0, bottom: 1, right: 1, compressionMode: 0, data: new Uint8Array([9]) },
			},
			{
				id: 'b', top: 0, left: 0, bottom: 2, right: 2, depth: 8,
				channels: [{ compressionMode: 0, data: new Uint8Array([5, 6, 7, 8]) }, undefined, undefined],
			},
		];
		const buffer = writeHandler('FEid', { filterEffectsMasks: masks }, { width: 10, height: 10 });
		const result = readHandler('FEid', buffer).filterEffectsMasks as Layer['filterEffectsMasks'];

		expect(result!.length).equal(2);
		expect(result![0].id).equal('a');
		expect(result![0].extra).not.undefined;
		expect(Array.from(result![0].extra!.data)).eql([9]);
		expect(result![1].id).equal('b');
		expect(result![1].extra).undefined;
		expect(Array.from(result![1].channels[0]!.data)).eql([5, 6, 7, 8]);
	});

	it('round-trips external linked file (lnkE)', () => {
		const psd = roundTrip({
			width: 10, height: 10,
			linkedFiles: [
				{
					id: guid1,
					name: 'external.png',
					time: '2020-01-02T03:04:05.250Z',
					linkedFile: {
						fileSize: 1234,
						name: 'external.png',
						fullPath: 'file:///C:/external.png',
						originalPath: 'C:\\external.png',
						relativePath: 'external.png',
					},
				},
				{
					id: guid2,
					name: 'embedded.png',
					data: new Uint8Array([1, 2, 3, 4, 5]),
				},
			],
		});

		expect(psd.linkedFiles!.length).equal(2);
		const embedded = psd.linkedFiles!.find(f => f.id === guid2)!;
		expect(Array.from(embedded.data!)).eql([1, 2, 3, 4, 5]);
		const external = psd.linkedFiles!.find(f => f.id === guid1)!;
		expect(external.time).equal('2020-01-02T03:04:05.250Z');
		expect(external.data).undefined;
		expect(external.linkedFile).eql({
			fileSize: 1234,
			name: 'external.png',
			fullPath: 'file:///C:/external.png',
			originalPath: 'C:\\external.png',
			relativePath: 'external.png',
		});
	});

	it('writes embedded data for external linked file with data', () => {
		const psd = roundTrip({
			width: 10, height: 10,
			linkedFiles: [
				{
					id: guid1,
					name: 'external.png',
					data: new Uint8Array([1, 2, 3]),
					linkedFile: { fileSize: 0, name: 'external.png', fullPath: '', originalPath: '', relativePath: '' },
				},
			],
		});

		expect(psd.linkedFiles!.length).equal(1);
		expect(psd.linkedFiles![0].linkedFile!.fileSize).equal(3);
		expect(Array.from(psd.linkedFiles![0].data!)).eql([1, 2, 3]);
	});

	it('writes correct LaID in mlst for layers with duplicate ids', () => {
		const psd: Psd = { width: 10, height: 10 };
		const layer1: Layer = { id: 5, animationFrames: [{ frames: [1], enable: true }] };
		const layer2: Layer = { id: 5, animationFrames: [{ frames: [1], enable: true }] };
		const options: Partial<ExtendedWriteOptions> = { layerIds: new Set(), layerToId: new Map() };

		writeHandler('lyid', layer1, psd, options);
		writeHandler('lyid', layer2, psd, options);
		expect(options.layerToId!.get(layer2)).equal(105);

		const buffer = writeHandler('shmd', layer2, psd, options);
		const reader = createReader(buffer);
		expect(readUint32(reader)).equal(1); // count
		expect(readSignature(reader)).equal('8BIM');
		expect(readSignature(reader)).equal('mlst');
		readUint8(reader);
		skipBytes(reader, 3);
		readUint32(reader); // length
		const desc = readVersionAndDescriptor(reader);
		expect(desc.LaID).equal(105);

		// full round trip doesn't throw
		const result = roundTrip({ width: 10, height: 10, children: [{ ...layer1 }, { ...layer2 }] });
		expect(result.children![0].animationFrames).not.undefined;
		expect(result.children![1].animationFrames).not.undefined;
	});

	it('does not use ids of other layers when generating layer id', () => {
		const psd = roundTrip({
			width: 10, height: 10,
			children: [
				{ name: 'a', animationFrames: [{ frames: [1], enable: true }] },
				{ name: 'b', id: 1 },
				{ name: 'c', children: [{ name: 'd', id: 2 }] },
			],
		});

		const [a, b, c] = psd.children!;
		expect(b.id).equal(1);
		expect(c.children![0].id).equal(2);
		expect(a.id).not.undefined;
		expect(a.id !== 1 && a.id !== 2).true;
	});

	it('generates layer id when writing mlst for layer without id', () => {
		const psd: Psd = { width: 10, height: 10 };
		const layer1: Layer = { animationFrames: [{ frames: [1], enable: true }] };
		const layer2: Layer = { id: 1, animationFrames: [{ frames: [1], enable: true }] };
		const options: Partial<ExtendedWriteOptions> = { layerIds: new Set(), layerToId: new Map() };

		writeHandler('lyid', layer1, psd, options);
		writeHandler('lyid', layer2, psd, options);
		const id1 = options.layerToId!.get(layer1)!;
		const id2 = options.layerToId!.get(layer2)!;
		expect(id1).not.undefined;
		expect(id2).not.equal(id1);
		expect(layer1.id).undefined; // doesn't modify input

		const reader = createReader(writeHandler('shmd', layer1, psd, options));
		readUint32(reader); // count
		readSignature(reader);
		expect(readSignature(reader)).equal('mlst');
		readUint8(reader);
		skipBytes(reader, 3);
		readUint32(reader); // length
		expect(readVersionAndDescriptor(reader).LaID).equal(id1);

		const result = roundTrip({ width: 10, height: 10, children: [{ ...layer1 }, { ...layer2 }] });
		expect(result.children![0].id).not.undefined;
		expect(result.children![1].id).not.undefined;
		expect(result.children![0].id).not.equal(result.children![1].id);
		expect(result.children![0].animationFrames).not.undefined;
	});

	it('writes TySh without left/top/right/bottom', () => {
		const psd = roundTrip({
			width: 10, height: 10,
			children: [{ name: 'text', text: { text: 'hello', transform: [1, 0, 0, 1, 0, 0] } }],
		});
		const text = psd.children![0].text!;
		expect(text.text).equal('hello');
		expect(text.left).equal(0);
		expect(text.top).equal(0);
		expect(text.right).equal(0);
		expect(text.bottom).equal(0);
	});

	function writeAnnotationRecord(writer: ReturnType<typeof createWriter>, text: string | undefined, dataLength: number, extraPadding: number) {
		const lengthOffset = writer.offset;
		writeUint32(writer, 0); // length
		writeSignature(writer, 'txtA');
		writeUint8(writer, 1); // open
		writeUint8(writer, 28);
		writeUint16(writer, 1);
		for (let i = 0; i < 8; i++) writeInt32(writer, i);
		writeColor(writer, { r: 255, g: 0, b: 0 });
		writePascalString(writer, 'author', 2);
		writePascalString(writer, 'name', 2);
		writePascalString(writer, 'date', 2);
		writeUint32(writer, 12 + dataLength); // content length
		writeSignature(writer, 'txtC');
		writeUint32(writer, dataLength);
		if (text !== undefined) {
			writeUint16(writer, 0xfeff);
			for (let i = 0; i < text.length; i++) writeUint16(writer, text.charCodeAt(i));
			if ((dataLength - 2) % 2) writeUint8(writer, 0); // odd trailing byte
		}
		writeZeros(writer, extraPadding);
		writer.view.setUint32(lengthOffset, writer.offset - lengthOffset, false);
	}

	it('reads Anno records with empty data, odd data length and record padding', () => {
		const writer = createWriter();
		writeUint16(writer, 2);
		writeUint16(writer, 1);
		writeUint32(writer, 3);
		writeAnnotationRecord(writer, undefined, 0, 4); // empty data + padding
		writeAnnotationRecord(writer, 'ab', 7, 0); // odd data length with BOM
		writeAnnotationRecord(writer, 'xyz', 8, 2); // regular + padding
		const buffer = getWriterBuffer(writer);
		const annotations = readHandler('Anno', buffer).annotations as Annotation[];

		expect(annotations.length).equal(3);
		expect(annotations[0].data).equal('');
		expect(annotations[0].author).equal('author');
		expect(annotations[1].data).equal('ab');
		expect(annotations[2].data).equal('xyz');
		expect(annotations[2].name).equal('name');
	});

	it('round-trips Anno', () => {
		const annotations: Annotation[] = [
			{
				type: 'text', open: true, author: 'a', name: 'n', date: 'd', data: 'hello\nworld',
				color: { r: 255, g: 0, b: 0 },
				iconLocation: { left: 1, top: 2, right: 3, bottom: 4 },
				popupLocation: { left: 5, top: 6, right: 7, bottom: 8 },
			},
			{
				type: 'text', open: false, author: '', name: '', date: '', data: '',
				color: { r: 0, g: 255, b: 0 },
				iconLocation: { left: 1, top: 2, right: 3, bottom: 4 },
				popupLocation: { left: 5, top: 6, right: 7, bottom: 8 },
			},
		];
		const psd = roundTrip({ width: 10, height: 10, annotations });
		expect(psd.annotations!.length).equal(2);
		expect(psd.annotations![0].data).equal('hello\nworld');
		expect(psd.annotations![1].data).equal('');
	});

	it('round-trips gradient map with smoothness 0', () => {
		const adjustment: GradientMapAdjustment = {
			type: 'gradient map',
			gradientType: 'solid',
			smoothness: 0,
			colorStops: [
				{ location: 0, midpoint: 0.5, color: { r: 0, g: 0, b: 0 } },
				{ location: 0.25, midpoint: 0.5, color: { r: 128, g: 0, b: 0 } },
				{ location: 1, midpoint: 0.5, color: { r: 255, g: 255, b: 255 } },
			],
			opacityStops: [
				{ location: 0, midpoint: 0.5, opacity: 1 },
				{ location: 0.5, midpoint: 0.5, opacity: 1 },
			],
		};
		const psd = roundTrip({ width: 10, height: 10, children: [{ name: 'gm', adjustment }] });
		const result = psd.children![0].adjustment as GradientMapAdjustment;
		expect(result.smoothness).equal(0);
		expect(result.colorStops!.map(s => s.location)).eql([0, 0.25, 1]);
		expect(result.opacityStops!.map(s => s.location)).eql([0, 0.5]);
	});

	it('round-trips gradient map with smoothness 0.5 keeping locations', () => {
		const adjustment: GradientMapAdjustment = {
			type: 'gradient map',
			gradientType: 'solid',
			smoothness: 0.5,
			colorStops: [
				{ location: 0, midpoint: 0.5, color: { r: 0, g: 0, b: 0 } },
				{ location: 1, midpoint: 0.5, color: { r: 255, g: 255, b: 255 } },
			],
			opacityStops: [
				{ location: 0, midpoint: 0.5, opacity: 1 },
				{ location: 1, midpoint: 0.5, opacity: 1 },
			],
		};
		const psd = roundTrip({ width: 10, height: 10, children: [{ name: 'gm', adjustment }] });
		const result = psd.children![0].adjustment as GradientMapAdjustment;
		expect(result.smoothness).equal(0.5);
		expect(result.colorStops!.map(s => s.location)).eql([0, 1]);
		expect(result.opacityStops!.map(s => s.location)).eql([0, 1]);
	});

	it('rounds fill opacity (iOpa)', () => {
		const psd = roundTrip({
			width: 10, height: 10,
			children: [
				{ name: 'a', fillOpacity: 0.5 },
				{ name: 'b', fillOpacity: 0.999 },
				{ name: 'c', fillOpacity: 1.5 },
			],
		});
		expect(psd.children![0].fillOpacity).equal(128 / 255);
		expect(psd.children![1].fillOpacity).equal(1);
		expect(psd.children![2].fillOpacity).equal(1);
	});

	it('rounds photo filter density (phfl)', () => {
		const adjustment: PhotoFilterAdjustment = {
			type: 'photo filter',
			color: { l: 0.5, a: 0.25, b: -0.25 },
			density: 0.337,
			preserveLuminosity: true,
		};
		const psd = roundTrip({ width: 10, height: 10, children: [{ name: 'pf', adjustment }] });
		const result = psd.children![0].adjustment as PhotoFilterAdjustment;
		expect(result.density).equal(0.34);
		expect(result.preserveLuminosity).true;
	});

	it('reads photo filter version 3 (XYZ) as Lab color', () => {
		// Photoshop "Yellow" photo filter preset (#F9E31C)
		const writer = createWriter();
		writeUint16(writer, 3);
		writeInt32(writer, 24191);
		writeInt32(writer, 25002);
		writeInt32(writer, 3827);
		writeUint32(writer, 25); // density
		writeUint8(writer, 1);
		writeZeros(writer, 3);
		const target = readHandler('phfl', getWriterBuffer(writer));
		const adjustment = target.adjustment as PhotoFilterAdjustment;
		const color = adjustment.color as { l: number; a: number; b: number; };
		expect(color.l * 100).closeTo(90.0, 0.1);
		expect(color.a * 128).closeTo(-5.0, 0.1);
		expect(color.b * 127).closeTo(85.0, 0.1);
		expect(adjustment.density).equal(0.25);

		// writes back as version 2 and reads the same values
		const result = readHandler('phfl', writeHandler('phfl', target, { width: 10, height: 10 }));
		expect(result.adjustment.color.l).closeTo(color.l, 0.001);
		expect(result.adjustment.color.a).closeTo(color.a, 0.001);
		expect(result.adjustment.color.b).closeTo(color.b, 0.001);
		expect(result.adjustment.density).equal(0.25);
	});

	it('round-trips user mask and filter mask opacity in 0-100 range', () => {
		const writer = createWriter();
		writeColor(writer, { r: 0, g: 0, b: 0 });
		writeUint16(writer, 50);
		const target = readHandler('FMsk', getWriterBuffer(writer));
		expect(target.filterMask.opacity).equal(0.5);

		const result = readHandler('FMsk', writeHandler('FMsk', { filterMask: { colorSpace: { r: 0, g: 0, b: 0 }, opacity: 0.333 } }, { width: 10, height: 10 }));
		expect(result.filterMask.opacity).equal(0.33);

		const result2 = readHandler('LMsk', writeHandler('LMsk', { userMask: { colorSpace: { r: 0, g: 0, b: 0 }, opacity: 0.5 } }, { width: 10, height: 10 }));
		expect(result2.userMask.opacity).equal(0.5);
	});

	it('round-trips hsb/hsl smart filter', () => {
		// serialize/parse through SoLd writer and reader
		const layer: Layer = {
			name: 'p',
			placedLayer: {
				id: guid1, type: 'raster', transform: [0, 0, 10, 0, 10, 10, 0, 10], width: 10, height: 10,
				filter: {
					enabled: true, validAtPosition: true, maskEnabled: false, maskLinked: false, maskExtendWithWhite: false,
					list: [{
						name: 'hsb', opacity: 1, blendMode: 'normal', enabled: true, hasOptions: true,
						foregroundColor: { r: 0, g: 0, b: 0 }, backgroundColor: { r: 255, g: 255, b: 255 },
						type: 'hsb/hsl', filter: { inputMode: 'rgb', rowOrder: 'hsl' },
					}],
				},
			},
		};
		const buffer = writeHandler('SoLd', layer, { width: 10, height: 10 });
		const result = readHandler('SoLd', buffer);
		const filter = result.placedLayer.filter.list[0];
		expect(filter.type).equal('hsb/hsl');
		expect(filter.filter).eql({ inputMode: 'rgb', rowOrder: 'hsl' });
	});

	it('keeps unknown smart filters and curves filter without preset kind', () => {
		const base = {
			opacity: 1, blendMode: 'normal' as const, enabled: true, hasOptions: true,
			foregroundColor: { r: 0, g: 0, b: 0 }, backgroundColor: { r: 255, g: 255, b: 255 },
		};
		const list: Filter[] = [
			{ ...base, name: 'Shadows/Highlights', type: 'unknown', filterID: 781 }, // stored without settings at default values
			{ ...base, name: 'Hue/Saturation', type: 'unknown', filterID: 1213428850, descriptor: { _name: 'Hue/Saturation', _classID: 'HStr', Clrz: true } },
			{ ...base, name: 'Curves', type: 'curves', filter: { adjustments: [{ channels: ['composite'], curve: [{ x: 0, y: 0 }, { x: 255, y: 200 }] }] } },
		];
		const layer: Layer = {
			placedLayer: {
				id: guid1, type: 'raster', transform: [0, 0, 10, 0, 10, 10, 0, 10], width: 10, height: 10,
				filter: { enabled: true, validAtPosition: true, maskEnabled: false, maskLinked: false, maskExtendWithWhite: false, list },
			},
		};
		const buffer = writeHandler('SoLd', layer, { width: 10, height: 10 });
		expect(readHandler('SoLd', buffer).placedLayer.filter.list).eql(list);
	});

	it('round-trips levels smart filter', () => {
		const base = {
			opacity: 1, blendMode: 'normal' as const, enabled: true, hasOptions: true,
			foregroundColor: { r: 0, g: 0, b: 0 }, backgroundColor: { r: 255, g: 255, b: 255 },
		};
		const list: Filter[] = [
			{
				...base, name: 'Levels...', type: 'levels', filter: {
					presetKind: 'custom',
					adjustments: [
						{ channels: ['composite'], shadowInput: 20, highlightInput: 220, midtoneInput: 1.4 },
						{ channels: ['red'], shadowOutput: 10, highlightOutput: 240 },
					],
				},
			},
		];
		const layer: Layer = {
			placedLayer: {
				id: guid1, type: 'raster', transform: [0, 0, 10, 0, 10, 10, 0, 10], width: 10, height: 10,
				filter: { enabled: true, validAtPosition: true, maskEnabled: false, maskLinked: false, maskExtendWithWhite: false, list },
			},
		};
		const buffer = writeHandler('SoLd', layer, { width: 10, height: 10 });
		expect(readHandler('SoLd', buffer).placedLayer.filter.list).eql(list);

		// levels with settings we don't know about are kept as unknown filter
		const reader = createReader(buffer);
		readSignature(reader);
		readUint32(reader);
		const desc = readVersionAndDescriptor(reader, true);
		desc.filterFX.filterFXList[0].Fltr.Adjs[0].Auto = true;
		const writer = createWriter();
		writeSignature(writer, 'soLD');
		writeUint32(writer, 4);
		writeVersionAndDescriptor(writer, '', 'null', desc);
		const unknown = readHandler('SoLd', getWriterBuffer(writer)).placedLayer.filter.list[0];
		expect(unknown.type).equal('unknown');
		expect(unknown.descriptor.Adjs[0].Auto).true;
	});

	it('writes linked smart objects as SoLE without PlLd', () => {
		const placedLayer: Layer['placedLayer'] = { id: guid1, type: 'raster', external: true, transform: [0, 0, 10, 0, 10, 10, 0, 10], width: 10, height: 10 };
		expect(infoHandlersMap['SoLd'].has({ placedLayer })).false;
		expect(infoHandlersMap['PlLd'].has({ placedLayer })).false;
		expect(infoHandlersMap['SoLE'].has({ placedLayer })).true;
		const result = readHandler('SoLE', writeHandler('SoLE', { placedLayer }, { width: 10, height: 10 }));
		expect(result.placedLayer.external).true;
		expect(readHandler('SoLd', writeHandler('SoLd', { placedLayer: { ...placedLayer, external: undefined } }, { width: 10, height: 10 })).placedLayer.external).undefined;
	});

	it('reads and writes hue/saturation colorize values', () => {
		const writer = createWriter();
		writeUint16(writer, 2); // version
		writeUint8(writer, 1); // colorize
		writeUint8(writer, 0);
		for (const v of [-160, 40, 5, 10, 20, -30]) writeInt16(writer, v); // colorize hue/sat/lightness, master hue/sat/lightness
		for (let i = 0; i < 6 * 7; i++) writeInt16(writer, i);
		const bytes = new Uint8Array(getWriterBuffer(writer));
		const target = readHandler('hue2', bytes.buffer);
		expect(target.adjustment.colorize).true;
		expect(target.adjustment.colorization).eql({ hue: 200, saturation: 40, lightness: 5 });
		expect(target.adjustment.master).eql({ hue: 10, saturation: 20, lightness: -30 });
		expect(target.adjustment.reds).eql({ a: 0, b: 1, c: 2, d: 3, hue: 4, saturation: 5, lightness: 6 });
		expect(Array.from(new Uint8Array(writeHandler('hue2', target, { width: 10, height: 10 })))).eql(Array.from(bytes));
	});

	it('reads vector stroke without line dash set', () => {
		const writer = createWriter();
		writeVersionAndDescriptor(writer, '', 'strokeStyle', {
			strokeStyleVersion: 2, strokeEnabled: true, fillEnabled: true,
			strokeStyleLineWidth: { units: 'Points', value: 3 },
			strokeStyleLineDashOffset: { units: 'Points', value: 0 },
			strokeStyleMiterLimit: 100,
			strokeStyleLineCapType: 'strokeStyleLineCapType.strokeStyleButtCap',
			strokeStyleLineJoinType: 'strokeStyleLineJoinType.strokeStyleMiterJoin',
			strokeStyleLineAlignment: 'strokeStyleLineAlignment.strokeStyleAlignInside',
			strokeStyleScaleLock: false, strokeStyleStrokeAdjust: false,
			strokeStyleBlendMode: 'BlnM.Nrml',
			strokeStyleOpacity: { units: 'Percent', value: 100 },
			strokeStyleContent: { _name: '', _classID: 'solidColorLayer', 'Clr ': { _name: '', _classID: 'RGBC', 'Rd  ': 255, 'Grn ': 0, 'Bl  ': 0 } },
			strokeStyleResolution: 72,
		});
		const target = readHandler('vstk', getWriterBuffer(writer));
		expect(target.vectorStroke.lineDashSet).eql([]);
		expect(target.vectorStroke.lineWidth).eql({ units: 'Points', value: 3 });
	});

	it('replaces 8bit compatibility layers with layers from Lr16', () => {
		// layer info section of 8bit document is the same structure as Lr16 data
		const buffer = writePsdBuffer({ width: 10, height: 10, children: [{ name: 'real' }] });
		const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
		let offset = 26 + 4 + view.getUint32(26); // header, color mode data
		offset += 4 + view.getUint32(offset); // image resources
		const layerInfoLength = view.getUint32(offset + 4);
		const layerInfo = new Uint8Array(buffer.buffer, buffer.byteOffset + offset + 8, layerInfoLength).slice();

		const psd: Psd = { width: 10, height: 10, bitsPerChannel: 16, children: [{ name: 'compatibility' }] };
		const reader = createReader(layerInfo.buffer);
		reader.skipLayerImageData = true;
		infoHandlersMap['Lr16'].read(reader, psd, () => layerInfo.byteLength - reader.offset, psd, {});
		expect(psd.children!.map(c => c.name)).eql(['real']);

		// Layr in 8bit document doesn't replace layers from layer info section
		const psd8: Psd = { width: 10, height: 10, bitsPerChannel: 8, children: [{ name: 'section' }] };
		const reader8 = createReader(layerInfo.buffer);
		infoHandlersMap['Layr'].read(reader8, psd8, () => layerInfo.byteLength - reader8.offset, psd8, {});
		expect(psd8.children!.map(c => c.name)).eql(['section']);
	});

	it('round-trips pixelSource (PxSc)', () => {
		const pixelSource: Layer['pixelSource'] = {
			type: 'vdPS',
			origin: { x: 0, y: -24 },
			interpretation: { interpretAlpha: 'straight', profile: new Uint8Array([1, 2, 3, 4]) },
			frameReader: {
				type: 'QTFR',
				link: { name: 'a.mp4', fullPath: 'file:///a.mp4', originalPath: '/a.mp4', relativePath: 'a.mp4', alias: 'abc' },
				mediaDescriptor: 'ImporterMPEG',
			},
			showAlteredVideo: true,
		};
		const result = readHandler('PxSc', writeHandler('PxSc', { pixelSource }, { width: 10, height: 10 }));
		expect(result.pixelSource).eql(pixelSource);
	});

	it('throws for invalid placed layer type in SoLd', () => {
		const layer: Layer = {
			placedLayer: { id: guid1, type: 'foo' as any, transform: [0, 0, 10, 0, 10, 10, 0, 10], width: 10, height: 10 },
		};
		expect(() => writeHandler('SoLd', layer, { width: 10, height: 10 })).throw('Invalid placedLayer type');
	});

	it('round-trips gradient map interpolation method', () => {
		const adjustment: GradientMapAdjustment = {
			type: 'gradient map',
			gradientType: 'solid',
			method: 'linear',
			colorStops: [
				{ location: 0, midpoint: 0.5, color: { r: 0, g: 0, b: 0 } },
				{ location: 1, midpoint: 0.5, color: { r: 255, g: 255, b: 255 } },
			],
			opacityStops: [
				{ location: 0, midpoint: 0.5, opacity: 1 },
				{ location: 1, midpoint: 0.5, opacity: 1 },
			],
		};
		const psd = roundTrip({ width: 10, height: 10, children: [{ name: 'gm', adjustment }] });
		expect((psd.children![0].adjustment as GradientMapAdjustment).method).equal('linear');
	});

	it('round-trips "lock all" protection flag', () => {
		const psd = roundTrip({
			width: 10, height: 10,
			children: [{ name: 'a', protected: { transparency: false, composite: false, position: false, all: true } }],
		});
		expect(psd.children![0].protected).eql({ transparency: false, composite: false, position: false, all: true });
	});

	it('does not take explicit id of other layer when fixing duplicate layer ids', () => {
		const psd = roundTrip({
			width: 10, height: 10,
			children: [{ name: 'a', id: 1 }, { name: 'b', id: 1 }, { name: 'c', id: 101 }],
		});
		const ids = psd.children!.map(c => c.id!);
		expect(ids[0]).equal(1);
		expect(ids[2]).equal(101);
		expect(new Set(ids).size).equal(3);
	});

	it('round-trips multiple effects and exact opacity of animation frames', () => {
		const shadow = (distance: number) => ({
			enabled: true, distance: { units: 'Pixels' as const, value: distance }, size: { units: 'Pixels' as const, value: 5 },
		});
		const psd = roundTrip({
			width: 10, height: 10,
			children: [{
				name: 'a',
				animationFrames: [{ frames: [1], opacity: 0.5294117647058824, effects: { dropShadow: [shadow(5), shadow(10)] } }],
			}],
		});
		const frame = psd.children![0].animationFrames![0];
		expect(frame.opacity).equal(0.5294117647058824);
		expect(frame.effects!.dropShadow!.map(s => s.distance!.value)).eql([5, 10]);
	});

	it('reads artboard info without colors', () => {
		const artdWriter = createWriter();
		writeVersionAndDescriptor(artdWriter, '', 'null', { 'Cnt ': 2, autoExpandEnabled: true }, 'artd');
		expect(readHandler('artd', getWriterBuffer(artdWriter)).artboards).eql({ count: 2, autoExpandEnabled: true, shrinkwrapOnSaveEnabled: false });

		const artbWriter = createWriter();
		const artboardRect = { 'Top ': 0, Left: 0, Btom: 10, Rght: 20 };
		writeVersionAndDescriptor(artbWriter, '', 'artboard', { artboardRect, guideIndeces: [], artboardPresetName: '' });
		expect(readHandler('artb', getWriterBuffer(artbWriter)).artboard).eql({
			rect: { top: 0, left: 0, bottom: 10, right: 20 }, guideIndices: [], presetName: '',
		});
	});

	it('reads empty linked file creator as undefined', () => {
		const psd = roundTrip({
			width: 10, height: 10,
			linkedFiles: [{ id: guid1, name: 'a.png', data: new Uint8Array([1, 2, 3]) }],
		});
		expect(psd.linkedFiles![0].creator).undefined;
		expect(psd.linkedFiles![0].type).undefined;
	});
});
