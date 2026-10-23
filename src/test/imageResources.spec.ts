import { expect } from 'chai';
import { toReader, writeDescriptorId, writeDescriptorClass, writeDescriptorKey } from './common';
import { readVersionAndDescriptor } from '../descriptor';
import { createWriter, getWriterBuffer, writeInt32, writeSignature, writeUint32, writeUnicodeStringWithPadding } from '../psdWriter';
import { resourceHandlersMap, InternalImageResources } from '../imageResources';
import { writePsdBuffer, readPsd } from '../index';
import { ImageResources, Psd } from '../psd';

function writeResource(key: number, target: InternalImageResources) {
	const writer = createWriter();
	resourceHandlersMap[key].write(writer, target, 0);
	return new Uint8Array(getWriterBuffer(writer));
}

function readResource(key: number, buffer: Uint8Array) {
	const reader = toReader(buffer);
	const target: InternalImageResources = {};
	resourceHandlersMap[key].read(reader, target, () => reader.view.byteLength - reader.offset);
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
		const written = readResource(1088, writeResource(1088, { pathSelectionState: values })).pathSelectionState!;
		const [infos] = Object.getOwnPropertySymbols(written).map(key => (written as any)[key]);
		expect(written).eql(values);
		expect(infos.map((i: any) => i.type)).eql(['Enmr', 'Enmr', 'name', 'name', 'name']);
	});

	it('preserves path selection state reference classes', () => {
		// Photoshop writes enumerated references with 'Path' class and names with 'Lyr ' class
		const writer = createWriter();
		writeUint32(writer, 16);
		writeDescriptorClass(writer, '', 'null');
		writeUint32(writer, 1);
		writeDescriptorKey(writer, 'null', 'obj ');
		writeInt32(writer, 2);
		writeSignature(writer, 'Enmr'); writeDescriptorClass(writer, '', 'Path'); writeDescriptorId(writer, 'Ordn'); writeDescriptorId(writer, 'Trgt');
		writeSignature(writer, 'name'); writeDescriptorClass(writer, '', 'Lyr '); writeUnicodeStringWithPadding(writer, 'Work.Path');
		const bytes = new Uint8Array(getWriterBuffer(writer));

		const target = readResource(1088, bytes);
		expect(target.pathSelectionState).eql(['Ordn.Trgt', 'Work.Path']);
		expect(Array.from(writeResource(1088, target))).eql(Array.from(bytes));

		// items added to array read from the file use the same classes
		target.pathSelectionState!.push('Ordn.Trgt', 'Shape 1');
		const desc = readVersionAndDescriptor(toReader(writeResource(1088, target)));
		expect(desc.null).eql(['Ordn.Trgt', 'Work.Path', 'Ordn.Trgt', 'Shape 1']);
		const written = readResource(1088, writeResource(1088, target)).pathSelectionState!;
		const [infos] = Object.getOwnPropertySymbols(written).map(key => (written as any)[key]);
		expect(infos.map((i: any) => `${i.type} ${i.classID}`)).eql(['Enmr Path', 'name Lyr ', 'Enmr Path', 'name Lyr ']);
	});
});
