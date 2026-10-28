import { expect } from 'chai';
import { toReader, writeDescriptorId, writeDescriptorClass, writeDescriptorKey } from './common';
import { pathSelectionStateToReference, readVersionAndDescriptor, writeVersionAndDescriptor } from '../descriptor';
import { createWriter, getWriterBuffer, writeInt32, writeSignature, writeUint32, writeUnicodeStringWithPadding } from '../psdWriter';
import { resourceHandlersMap, InternalImageResources } from '../imageResources';
import { writePsdBuffer, readPsd } from '../index';
import { BezierPath, ImageResources, Psd } from '../psd';

function writeResource(key: number, target: InternalImageResources) {
	const writer = createWriter();
	resourceHandlersMap[key].write(writer, target, 0, { width: 4, height: 4 });
	return new Uint8Array(getWriterBuffer(writer));
}

function resourceInfo(id: number) {
	return { signature: '8BIM', id, name: new Uint8Array(0), width: 4, height: 4 };
}

function readResource(key: number, buffer: Uint8Array) {
	const reader = toReader(buffer);
	const target: InternalImageResources = {};
	resourceHandlersMap[key].read(reader, target, () => reader.view.byteLength - reader.offset, resourceInfo(key));
	return target;
}

function writeAndReadImageResources(imageResources: ImageResources) {
	const psd: Psd = { width: 4, height: 4, imageResources };
	const buffer = writePsdBuffer(psd);
	return readPsd(buffer, { skipCompositeImageData: true, skipLayerImageData: true, skipThumbnail: true }).imageResources!;
}

describe('imageResources', () => {
	it('writes timeline information without audio clip groups', () => {
		const timelineInformation: ImageResources['timelineInformation'] = {
			enabled: true,
			frameStep: { numerator: 1, denominator: 30 },
			frameRate: 30,
			time: { numerator: 0, denominator: 30 },
			duration: { numerator: 150, denominator: 30 },
			workInTime: { numerator: 0, denominator: 30 },
			workOutTime: { numerator: 150, denominator: 30 },
			repeats: 1,
			hasMotion: false,
			globalTracks: [],
		};

		const result = readResource(1075, writeResource(1075, { timelineInformation }));
		expect(result.timelineInformation).eql(timelineInformation);
	});

	it('rounds onion skin opacities instead of truncating', () => {
		const onionSkins: ImageResources['onionSkins'] = {
			enabled: true, framesBefore: 1, framesAfter: 1, frameSpacing: 1,
			minOpacity: 0.29, maxOpacity: 0.57, blendMode: 'multiply',
		};
		const desc = readVersionAndDescriptor(toReader(writeResource(1078, { onionSkins })));
		expect(desc.minOpacity).equal(29); // 0.29 * 100 = 28.999999999999996
		expect(desc.maxOpacity).equal(57); // 0.57 * 100 = 56.99999999999999
	});

	it('rounds animation frame delay instead of truncating', () => {
		const result = writeAndReadImageResources({
			animations: {
				frames: [{ id: 1, delay: 0.29, dispose: 'auto' }],
				animations: [{ id: 2, frames: [1], repeats: 0, activeFrame: 0 }],
			},
		});
		expect(result.animations!.frames[0].delay).equal(0.29);
	});

	it('reads and writes negative and fractional guide locations', () => {
		const gridAndGuidesInformation: ImageResources['gridAndGuidesInformation'] = {
			grid: { horizontal: 576, vertical: 576 },
			guides: [
				{ location: -0.5, direction: 'horizontal' },
				{ location: -1554, direction: 'vertical' },
				{ location: 10.03125, direction: 'vertical' },
				{ location: 10.1, direction: 'horizontal' }, // not representable exactly, should be rounded
			],
		};
		const result = readResource(1032, writeResource(1032, { gridAndGuidesInformation }));
		expect(result.gridAndGuidesInformation!.guides).eql([
			{ location: -0.5, direction: 'horizontal' },
			{ location: -1554, direction: 'vertical' },
			{ location: 10.03125, direction: 'vertical' },
			{ location: 10.09375, direction: 'horizontal' },
		]);
	});

	it('writes layer comps with explicitly undefined comment and lastApplied', () => {
		const layerComps: ImageResources['layerComps'] = {
			list: [
				{ id: 1, name: 'a', capturedInfo: 1, comment: undefined },
				{ id: 2, name: 'b', capturedInfo: 1, comment: 'hello' },
			],
			lastApplied: undefined,
		};
		const result = readResource(1065, writeResource(1065, { layerComps }));
		expect(result.layerComps).eql({
			list: [
				{ id: 1, name: 'a', capturedInfo: 1 },
				{ id: 2, name: 'b', capturedInfo: 1, comment: 'hello' },
			],
		});
	});

	it('round-trips print information printer profile color space and writes only provided fields', () => {
		const printInformation: ImageResources['printInformation'] = {
			printerName: 'printer',
			renderingIntent: 'perceptual',
			printerProfileColorSpace: 'grayscale',
			printSixteenBit: false,
		};
		const buffer = writeResource(1082, { printInformation });
		const result = readResource(1082, buffer);
		expect(result.printInformation).eql(printInformation);

		const text = Buffer.from(buffer).toString('latin1');
		expect(text).not.contain('printProofSetup');
		expect(text).not.contain('MpBl');
		expect(text).not.contain('Nm  ');
	});

	it('writes print information with proof setup profile as text', () => {
		const printInformation: ImageResources['printInformation'] = {
			printerName: 'printer',
			renderingIntent: 'perceptual',
			printerProfile: 'sRGB',
			proofSetup: {
				profile: 'Coated FOGRA39',
				renderingIntent: 'saturation',
				blackPointCompensation: true,
				paperWhite: false,
			},
		};
		const result = readResource(1082, writeResource(1082, { printInformation }));
		expect(result.printInformation!.proofSetup).eql(printInformation.proofSetup);
	});

	it('reads slices without group name', () => {
		const writer = createWriter();
		writeUint32(writer, 7); // version
		writeVersionAndDescriptor(writer, '', 'null', {
			bounds: { 'Top ': 0, Left: 0, Btom: 4, Rght: 4 },
			slices: [],
		}, 'slices');
		const result = readResource(1050, new Uint8Array(getWriterBuffer(writer)));
		expect(result.slices).eql([{ groupName: '', bounds: { top: 0, left: 0, bottom: 4, right: 4 }, slices: [] }]);
		expect(readResource(1050, writeResource(1050, result)).slices).eql(result.slices);
	});

	it('writes slices with background color', () => {
		const slices: ImageResources['slices'] = [{
			bounds: { left: 0, top: 0, right: 4, bottom: 4 },
			groupName: 'group',
			slices: [{
				id: 0, groupId: 0, origin: 'autoGenerated', associatedLayerId: 0, name: 'slice', type: 'image',
				bounds: { left: 0, top: 0, right: 4, bottom: 4 },
				url: '', target: '', message: '', altTag: '', cellTextIsHTML: true, cellText: '',
				horizontalAlignment: 'default', verticalAlignment: 'default',
				backgroundColorType: 'color', backgroundColor: { r: 182, g: 51, b: 52, a: 255 },
				topOutset: 1, leftOutset: 2, bottomOutset: 3, rightOutset: 4,
			}],
		}];
		const result = readResource(1050, writeResource(1050, { slices }));
		expect(result.slices).eql(slices);
	});

	it('writes alpha channel names longer than 255 bytes and with astral characters', () => {
		const long = 'x'.repeat(300);
		const astral = 'a\u{1F600}b';
		const buffer = writeResource(1006, { alphaChannelNames: [long, astral, 'c'] });
		const result = readResource(1006, buffer);
		expect(result.alphaChannelNames).eql(['x'.repeat(255), 'a?b', 'c']);
	});

	it('writes path selection state with dots in names', () => {
		const result = readResource(1088, writeResource(1088, { pathSelectionState: ['Path.vectorMask', 'My.Path', 'Ordn.Trgt'] }));
		expect(result.pathSelectionState).eql(['Path.vectorMask', 'My.Path', 'Ordn.Trgt']);

		const desc = readVersionAndDescriptor(toReader(writeResource(1088, { pathSelectionState: ['My.Path'] })));
		expect(desc.null).eql(['My.Path']);

		const values = ['Ordn.Trgt', 'ordinal.targetEnum', 'My.Path', 'Logo.v2', 'Rectangle 5'];
		expect(readResource(1088, writeResource(1088, { pathSelectionState: values })).pathSelectionState).eql(values);
		expect(pathSelectionStateToReference(values).map(i => i.type)).eql(['Enmr', 'Enmr', 'name', 'name', 'name']);
	});

	it('writes path selection state with the same reference classes as Photoshop', () => {
		// Photoshop writes enumerated references with 'Path' class and names with 'Lyr ' class
		const writer = createWriter();
		writeUint32(writer, 16);
		writeDescriptorClass(writer, '', 'null');
		writeUint32(writer, 1);
		writeDescriptorKey(writer, 'null', 'obj ');
		writeInt32(writer, 2);
		writeSignature(writer, 'Enmr'); writeDescriptorClass(writer, '', 'Path'); writeDescriptorId(writer, 'Ordn'); writeDescriptorId(writer, 'Trgt');
		writeSignature(writer, 'name'); writeDescriptorClass(writer, '', 'Lyr '); writeUnicodeStringWithPadding(writer, 'Work Path');
		const bytes = new Uint8Array(getWriterBuffer(writer));

		const target = readResource(1088, bytes);
		expect(target.pathSelectionState).eql(['Ordn.Trgt', 'Work Path']);
		expect(Array.from(writeResource(1088, target))).eql(Array.from(bytes));
	});

	it('reads GBK alpha channel names', () => {
		// also valid UTF-8 ('С'), GBK is preferred
		const result = readResource(1006, new Uint8Array([2, 0xd0, 0xa1]));
		expect(result.alphaChannelNames).eql(['小']);
	});

	it('reads UTF-8 alpha channel names that are not valid GBK', () => {
		const name = Buffer.from('小', 'utf8');
		const result = readResource(1006, new Uint8Array([name.byteLength, ...name]));
		expect(result.alphaChannelNames).eql(['小']);
	});

	it('round-trips icc profile, exif, print style, print flags info, indexed color info and display info', () => {
		const imageResources: ImageResources = {
			iccProfile: new Uint8Array([1, 2, 3, 4, 5]),
			exifData: new Uint8Array([0x4d, 0x4d, 0, 42]),
			printStyle: {
				caption: true, calibrationBars: false, registrationMarks: true, cornerCropMarks: false, centerCropMarks: true,
				labels: false, negative: true, emulsionDown: false, interpolate: true,
				backgroundColor: { r: 255, g: 128, b: 0 },
				border: { units: 'Distance', value: 1.5 },
				bleed: { units: 'Distance', value: 0 },
				resolution: { units: 'Pixels', value: 300 },
				vectorData: true,
				pagePosition: 'centered',
				left: { units: 'Distance', value: 197.5 },
				top: { units: 'Distance', value: 273.5 },
				scale: 0.5,
				cropWhenPrinting: false,
				cropRect: { top: 0, left: 0, bottom: 594, right: 594 },
			},
			printFlagsInfo: { centerCropMarks: true, bleedWidth: 10, bleedWidthScale: 2 },
			indexedColorCount: 23,
			transparencyIndex: 22,
			alphaChannelDisplayInfo: [
				{ color: { r: 255, g: 0, b: 0 }, opacity: 1, kind: 'protected' },
				{ color: { r: 0, g: 0, b: 255 }, opacity: 0.5, kind: 'selected' },
			],
		};
		expect(writeAndReadImageResources(imageResources)).deep.include(imageResources);
	});

	it('round-trips saved paths, work path and clipping path', () => {
		const path = (open: boolean): BezierPath => ({
			open,
			operation: 'combine',
			fillRule: 'even-odd',
			knots: [
				{ linked: true, points: [1, 1, 1, 1, 1, 1] },
				{ linked: false, points: [3, 1, 3, 1, 3, 2] },
				{ linked: true, points: [2, 3, 2, 3, 2, 3] },
			],
		});
		const imageResources: ImageResources = {
			savedPaths: [
				{
					name: 'Path 1', fillStartsWithAllPixels: false, paths: [path(false)],
					vectorOrigination: { keyDescriptorList: [{ keyShapeInvalidated: true }] },
				},
				{ name: 'ユニコード', symmetryMode: 'pathSymmetryModeBasicPath', fillStartsWithAllPixels: true, paths: [path(true), path(false)] },
			],
			workPath: { fillStartsWithAllPixels: false, paths: [path(true)] },
			clippingPath: { name: 'ユニコード', flatness: 1.5 },
		};
		expect(writeAndReadImageResources(imageResources)).deep.include(imageResources);
	});

	it('reads origin path info stored before saved paths', () => {
		const keyDescriptorList = [{ keyOriginType: 1, keyOriginResolution: 72 }];
		const origin = writeResource(3000, { savedPaths: [{ name: 'a', paths: [], vectorOrigination: { keyDescriptorList } }] });
		const paths = writeResource(2000, { savedPaths: [{ name: 'a', paths: [] }] });
		const target: InternalImageResources = {};

		for (const [id, bytes] of [[3000, origin], [2000, paths]] as const) {
			const reader = toReader(bytes);
			resourceHandlersMap[id].read(reader, target, () => reader.view.byteLength - reader.offset, { ...resourceInfo(id), name: new Uint8Array([0x61]) });
		}

		expect(target.savedPaths).eql([{ name: 'a', fillStartsWithAllPixels: false, paths: [], vectorOrigination: { keyDescriptorList } }]);
	});

	it('round-trips halftone screens, transfer functions and IPTC data', () => {
		const screen = (angle: number) => ({
			frequency: 47.399993896484375, frequencyUnits: 'lines/inch' as const, angle, shape: 'diamond' as const, accurateScreens: false, printerDefaultScreens: true,
		});
		const transfer = { curve: [0, -1, -1, -1, -1, -1, 500, -1, -1, -1, -1, -1, 1000], override: true };
		const imageResources: ImageResources = {
			colorHalftoneScreens: [screen(108.39999389648438), screen(161.60000610351562), screen(90), screen(45)],
			grayscaleHalftoneScreens: [{ ...screen(45), frequencyUnits: 'lines/cm' }],
			colorTransferFunctions: [transfer, transfer, transfer, transfer],
			grayscaleTransferFunctions: [transfer],
			iptcData: new Uint8Array([0x1c, 0x02, 0x00, 0x00, 0x02, 0x00, 0x04]),
		};
		expect(writeAndReadImageResources(imageResources)).deep.include(imageResources);

		// Photoshop default color halftone screens
		const bytes = new Uint8Array(Buffer.from('002f66660001006c66660006000000000001', 'hex'));
		expect(readResource(1013, bytes).colorHalftoneScreens).eql([screen(108.39999389648438)]);
		expect(Array.from(writeResource(1013, readResource(1013, bytes)))).eql(Array.from(bytes));
	});

	it('reads animations with padding and unknown data after animations section', () => {
		const uint32 = (v: number) => [v >>> 24, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
		const animations: ImageResources['animations'] = {
			frames: [{ id: 1, delay: 0.5, dispose: 'auto' }],
			animations: [{ id: 2, frames: [1], repeats: 0, activeFrame: 0 }],
		};
		const written = Array.from(writeResource(4000, { animations }));
		// 'mani', 'IRFR', section length, '8BIM', 'AnDs', descriptor length, descriptor
		const descriptor = written.slice(24);
		const anDs = [...Buffer.from('8BIMAnDs', 'latin1'), ...uint32(descriptor.length + 2), ...descriptor, 0, 0]; // padding
		const bytes = new Uint8Array([...Buffer.from('maniIRFR', 'latin1'), ...uint32(anDs.length), ...anDs, 1, 2, 3, 4]);

		const reader = toReader(bytes);
		reader.strict = true;
		const target: InternalImageResources = {};
		resourceHandlersMap[4000].read(reader, target, () => reader.view.byteLength - reader.offset, resourceInfo(4000));
		expect(target.animations).eql(animations);
		expect(reader.offset).equal(bytes.byteLength);
	});

	it('reads and writes guide colors (1092) and guide ids (1097)', () => {
		const gridAndGuidesInformation: ImageResources['gridAndGuidesInformation'] = {
			grid: { horizontal: 576, vertical: 576 },
			guides: [
				{ location: 16, direction: 'horizontal', color: { r: 74, g: 255, b: 255 }, id: '8544d157-6d38-7249-8b2c-56d4a2d49c08' },
				{ location: -5.6875, direction: 'vertical', color: { r: 74, g: 132, b: 255 }, id: '4fb4b9d2-31e7-7843-ac73-5c7fdb35a1e1' },
			],
		};
		expect(writeAndReadImageResources({ gridAndGuidesInformation }).gridAndGuidesInformation).eql(gridAndGuidesInformation);

		// Photoshop guide records: position (1/32 px), direction, 0 and RGB color
		const colors = new Uint8Array(Buffer.from('000000020000024000000240000000010000020001004affff', 'hex'));
		expect(Array.from(writeResource(1092, readResource(1092, colors)))).eql(Array.from(colors));
		expect(readResource(1092, colors).gridAndGuidesInformation!.guides).eql([{ location: 16, direction: 'horizontal', color: { r: 74, g: 255, b: 255 } }]);

		// guide ids are only written if all guides have them
		expect(resourceHandlersMap[1097].has({ gridAndGuidesInformation: { guides: [{ location: 1, direction: 'vertical' }] } })).false;
		expect(resourceHandlersMap[1097].has({ gridAndGuidesInformation: { guides: [] } })).true;
	});

	it('writes frame info (mfri) for animations and reads save for web output settings (mset)', () => {
		const animations: ImageResources['animations'] = {
			frames: [{ id: 1, delay: 0.5, dispose: 'auto' }, { id: 2, delay: 0.5, dispose: 'auto' }],
			animations: [{ id: 3, frames: [1, 2], repeats: 0, activeFrame: 1 }],
		};
		const outputSettings = { _name: '', _classID: 'null', Version: 0 };
		const imageResources: ImageResources = { animations, outputSettings };
		const handler = resourceHandlersMap[4000];
		expect(handler.has(imageResources)).equal(3);

		const written = [0, 1, 2].map(i => {
			const writer = createWriter();
			handler.write(writer, imageResources, i, { width: 1, height: 1 } as any);
			return Buffer.from(getWriterBuffer(writer));
		});

		// same order and data as Photoshop
		expect(written.map(b => b.toString('latin1', 0, 4))).eql(['mset', 'mani', 'mfri']);
		expect(written[0].toString('hex')).equal('6d73657400000010000000010000000000046e756c6c000000010000000756657273696f6e6c6f6e6700000000');
		expect(written[2].toString('hex')).equal('6d667269' + '00000002' + '00000010' + '00000002' + '00000001' + '00000001' + '00000000');

		expect(writeAndReadImageResources(imageResources)).deep.include({ animations, outputSettings });
	});

	it('round-trips windows DEVMODE (1085)', () => {
		const windowsDevMode = new Uint8Array([2, 0, 0, 0, 32, 110, 105, 87]);
		expect(writeAndReadImageResources({ windowsDevMode }).windowsDevMode).eql(windowsDevMode);
	});

	it('reads and writes color samplers (1038)', () => {
		// Photoshop 5.5 file with 2 samplers
		const bytes = new Uint8Array(Buffer.from('0000000100000002000009f0000006b0ffff000015b0000014d0ffff', 'hex'));
		const target = readResource(1038, bytes);
		expect(target.colorSamplers).eql([{ x: 107, y: 159, colorSpace: -1 }, { x: 333, y: 347, colorSpace: -1 }]);
		expect(Array.from(writeResource(1038, target))).eql(Array.from(bytes));
	});

	it('reads and writes effects visible flag (1042)', () => {
		expect(readResource(1042, new Uint8Array([1])).effectsVisible).true;
		expect(Array.from(writeResource(1042, { effectsVisible: false }))).eql([0]);
	});

	it('reads obsolete display info (1007) if there is no newer display info (1077)', () => {
		const old = new Uint8Array(Buffer.from('0000ffff000000000000006401000000ffff00000000000000320100', 'hex'));
		expect(readResource(1007, old).alphaChannelDisplayInfo).eql([
			{ color: { r: 255, g: 0, b: 0 }, opacity: 1, kind: 'protected' },
			{ color: { r: 255, g: 0, b: 0 }, opacity: 0.5, kind: 'protected' },
		]);

		// newer resource is used regardless of the order
		const newer = new Uint8Array(Buffer.from('00000001' + '00000000ffff00000000' + '0032' + '00', 'hex'));
		const target: InternalImageResources = {};
		for (const [id, bytes] of [[1077, newer], [1007, old]] as const) {
			const reader = toReader(bytes);
			resourceHandlersMap[id].read(reader, target, () => reader.view.byteLength - reader.offset, resourceInfo(id));
		}
		expect(target.alphaChannelDisplayInfo).eql([{ color: { r: 0, g: 255, b: 0 }, opacity: 0.5, kind: 'selected' }]);
		expect(resourceHandlersMap[1007].has(target)).false; // written as 1077
	});

	it('reads raw (uncompressed) RGB thumbnail', () => {
		// 2x1 thumbnail, rows padded to 4 bytes
		const header = Buffer.alloc(28);
		header.writeUInt32BE(0, 0); // format: raw RGB
		header.writeUInt32BE(2, 4); // width
		header.writeUInt32BE(1, 8); // height
		header.writeUInt32BE(8, 12); // width bytes
		header.writeUInt32BE(8, 16); // total size
		header.writeUInt32BE(8, 20); // size after compression
		header.writeUInt16BE(24, 24); // bits per pixel
		header.writeUInt16BE(1, 26); // planes
		const bytes = new Uint8Array([...header, 255, 0, 0, 0, 0, 255, 0, 0]);
		const thumbnail = readResource(1036, bytes).thumbnail!;
		expect([thumbnail.width, thumbnail.height]).eql([2, 1]);
		expect(Array.from(thumbnail.getContext('2d')!.getImageData(0, 0, 2, 1).data)).eql([255, 0, 0, 255, 0, 0, 255, 255]);
	});

	it('keeps display info colors in unknown color spaces', () => {
		// spot channel with color space 9009 (Photoshop 2023) and alpha channel with red color
		const bytes = new Uint8Array(Buffer.from('00000001' + '2331356609230f733565' + '0000' + '02' + '0000ffff000000000000' + '0032' + '01', 'hex'));
		const target = readResource(1077, bytes);
		expect(target.alphaChannelDisplayInfo).eql([
			{ rawColor: { colorSpace: 9009, values: [13670, 2339, 3955, 13669] }, opacity: 0, kind: 'spot' },
			{ color: { r: 255, g: 0, b: 0 }, opacity: 0.5, kind: 'protected' },
		]);
		expect(Array.from(writeResource(1077, target))).eql(Array.from(bytes));
	});

	it('writes print style without crop settings like Photoshop', () => {
		const desc = readVersionAndDescriptor(toReader(writeResource(1083, { printStyle: { scale: 1 } })));
		expect(desc.Intr).false;
		expect(desc.PgPs).equal('PgPs.PgPC');
		expect(desc['Scl ']).eql({ units: 'Percent', value: 100 });
		expect(desc.cropWhenPrinting).undefined;
	});

	it('makes transparent color of indexed image transparent', () => {
		const uint16 = (v: number) => [v >> 8, v & 0xff];
		const uint32 = (v: number) => [v >>> 24, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
		const palette = new Array(768).fill(0);
		palette[0] = 255; // red at index 0
		palette[256 + 1] = 255; // green at index 1
		const resource = [...Buffer.from('8BIM', 'latin1'), ...uint16(1047), 0, 0, ...uint32(2), ...uint16(1)];
		const buffer = new Uint8Array([
			...Buffer.from('8BPS', 'latin1'), ...uint16(1), 0, 0, 0, 0, 0, 0, ...uint16(1), ...uint32(1), ...uint32(2), ...uint16(8), ...uint16(2),
			...uint32(768), ...palette,
			...uint32(resource.length), ...resource,
			...uint32(0), // layer and mask info
			...uint16(0), 0, 1, // raw composite image data
		]);
		const psd = readPsd(buffer, { useImageData: true });
		expect(psd.imageResources!.transparencyIndex).equal(1);
		expect(Array.from(psd.imageData!.data)).eql([255, 0, 0, 255, 0, 255, 0, 0]);
	});

	it('reads and writes Photoshop CS3 color samplers', () => {
		const colorSamplers = [{ x: 1.5, y: 2.25, colorSpace: -1, depth: 3 }, { x: 10, y: 20, colorSpace: 0, depth: 1 }];
		expect(writeAndReadImageResources({ colorSamplers }).colorSamplers).eql(colorSamplers);
		// samplers without depth are written in Photoshop 5 format
		expect(writeAndReadImageResources({ colorSamplers: [{ x: 1, y: 2, colorSpace: 0 }] }).colorSamplers).eql([{ x: 1, y: 2, colorSpace: 0 }]);
		expect(resourceHandlersMap[1073].has({ colorSamplers: [{ x: 1, y: 2, colorSpace: 0 }] })).false;
	});

	it('reads color samplers with float positions', () => {
		const writer = createWriter();
		writeUint32(writer, 2); // version
		writeUint32(writer, 1); // count
		writer.view.setFloat32(writer.offset, 2.5); writer.offset += 4; // y
		writer.view.setFloat32(writer.offset, 1.25); writer.offset += 4; // x
		writer.view.setInt16(writer.offset, 7); writer.offset += 2;
		writer.view.setInt16(writer.offset, 5); writer.offset += 2;
		expect(readResource(1073, new Uint8Array(getWriterBuffer(writer))).colorSamplers).eql([{ x: 1.25, y: 2.5, colorSpace: 7, depth: 5 }]);
	});

	it('reads and writes quick mask info, measurement scale and duotone resources', () => {
		const screen = { frequency: 53, frequencyUnits: 'lines/inch' as const, angle: 45, shape: 'diamond' as const, accurateScreens: false, printerDefaultScreens: true };
		const imageResources: ImageResources = {
			quickMaskInfo: { channelId: 3, initiallyEmpty: true },
			measurementScale: new Uint8Array([0, 0, 0, 16, 1, 2, 3, 4]),
			duotoneHalftoneScreens: [screen, { ...screen, angle: 75 }],
			duotoneTransferFunctions: [{ curve: [0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 1000], override: false }],
			duotoneImageInformation: new Uint8Array([1, 2, 3]),
			alternateDuotoneColors: { colors: [{ l: 0.5, a: 0.25, b: -0.5 }], labColors: new Uint8Array([1, 2, 3, 4, 5, 6]) },
		};
		const result = writeAndReadImageResources(imageResources);
		expect(result).deep.include(imageResources);
	});

});
