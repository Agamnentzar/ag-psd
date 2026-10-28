import { toByteArray } from 'base64-js';
import { expect } from 'chai';
import {
	readDescriptorStructure, writeDescriptorStructure, readVersionAndDescriptor, writeVersionAndDescriptor,
	parseColor, serializeColor, serializeEffects, parseEffects, serializeTrackList, parseTrackList,
	parseVectorContent, serializeVectorContent, DescriptorReferenceItem,
} from '../descriptor';
import { createReader } from '../psdReader';
import {
	createWriter, getWriterBuffer, getWriterBufferNoCopy, PsdWriter, writeFloat32, writeFloat64, writeInt32, writeSignature,
	writeUint32, writeUint8, writeUnicodeStringWithPadding,
} from '../psdWriter';
import { compareBuffers, toReader, writeDescriptorId, writeDescriptorClass, writeDescriptorKey } from './common';
import { Color, EffectContour, LayerEffectsInfo, TimelineTrack, VectorContent } from '../psd';

const tests = [
	'AAAAAQAAAAAAAG51bGwAAAADAAAAAFNjbCBVbnRGI1ByY0BZAAAAAAAAAAAADm1hc3RlckZYU3dpdGNoYm9vbAEAAAAAR3JGbE9iamMAAAABAAAAAAAAR3JGbAAAAAsAAAAAZW5hYmJvb2wBAAAAAE1kICBlbnVtAAAAAEJsbk0AAAAATnJtbAAAAABPcGN0VW50RiNQcmNAVoAAAAAAAAAAAABHcmFkT2JqYwAAAAkARwByAGEAZABpAGUAbgB0AAAAAAAAR3JkbgAAAAUAAAAATm0gIFRFWFQAAAA0ACQAJAAkAC8ARABlAGYAYQB1AGwAdABHAHIAYQBkAGkAZQBuAHQALwBCAGwAdQBlAFIAZQBkAFkAZQBsAGwAbwB3AD0AQgBsAHUAZQAsACAAUgBlAGQALAAgAFkAZQBsAGwAbwB3AAAAAAAAR3JkRmVudW0AAAAAR3JkRgAAAABDc3RTAAAAAEludHJkb3ViQLAAAAAAAAAAAAAAQ2xyc1ZsTHMAAAADT2JqYwAAAAEAAAAAAABDbHJ0AAAABAAAAABDbHIgT2JqYwAAAAEAAAAAAABSR0JDAAAAAwAAAABSZCAgZG91YkAjJNsswAAAAAAAAEdybiBkb3ViAAAAAAAAAAAAAAAAQmwgIGRvdWJAZkAACaAAAAAAAABUeXBlZW51bQAAAABDbHJ5AAAAAFVzclMAAAAATGN0bmxvbmcAAAAAAAAAAE1kcG5sb25nAAAAMk9iamMAAAABAAAAAAAAQ2xydAAAAAQAAAAAQ2xyIE9iamMAAAABAAAAAAAAUkdCQwAAAAMAAAAAUmQgIGRvdWJAb+AAAAAAAAAAAABHcm4gZG91YgAAAAAAAAAAAAAAAEJsICBkb3ViP5foF+gAAAAAAAAAVHlwZWVudW0AAAAAQ2xyeQAAAABVc3JTAAAAAExjdG5sb25nAAAIAAAAAABNZHBubG9uZwAAADJPYmpjAAAAAQAAAAAAAENscnQAAAAEAAAAAENsciBPYmpjAAAAAQAAAAAAAFJHQkMAAAADAAAAAFJkICBkb3ViQG/gAAAAAAAAAAAAR3JuIGRvdWJAb4AAAGAAAAAAAABCbCAgZG91YgAAAAAAAAAAAAAAAFR5cGVlbnVtAAAAAENscnkAAAAAVXNyUwAAAABMY3RubG9uZwAAEAAAAAAATWRwbmxvbmcAAAAyAAAAAFRybnNWbExzAAAAAk9iamMAAAABAAAAAAAAVHJuUwAAAAMAAAAAT3BjdFVudEYjUHJjQFkAAAAAAAAAAAAATGN0bmxvbmcAAAAAAAAAAE1kcG5sb25nAAAAMk9iamMAAAABAAAAAAAAVHJuUwAAAAMAAAAAT3BjdFVudEYjUHJjQFkAAAAAAAAAAAAATGN0bmxvbmcAABAAAAAAAE1kcG5sb25nAAAAMgAAAABBbmdsVW50RiNBbmdAVoAAAAAAAAAAAABUeXBlZW51bQAAAABHcmRUAAAAAFJkbCAAAAAAUnZyc2Jvb2wAAAAAAER0aHJib29sAQAAAABBbGduYm9vbAEAAAAAU2NsIFVudEYjUHJjQFwAAAAAAAAAAAAAT2ZzdE9iamMAAAABAAAAAAAAUG50IAAAAAIAAAAASHJ6blVudEYjUHJjAAAAAAAAAAAAAAAAVnJ0Y1VudEYjUHJjAAAAAAAAAAA=',
	'AAAAAQAAAAAAAG51bGwAAAAEAAAAAFNjbCBVbnRGI1ByY0BZAAAAAAAAAAAADm1hc3RlckZYU3dpdGNoYm9vbAEAAAAAR3JGbE9iamMAAAABAAAAAAAAR3JGbAAAAAsAAAAAZW5hYmJvb2wBAAAAAE1kICBlbnVtAAAAAEJsbk0AAAAATnJtbAAAAABPcGN0VW50RiNQcmNAWQAAAAAAAAAAAABHcmFkT2JqYwAAAAkARwByAGEAZABpAGUAbgB0AAAAAAAAR3JkbgAAAAkAAAAATm0gIFRFWFQAAAAHAEMAdQBzAHQAbwBtAAAAAAAAR3JkRmVudW0AAAAAR3JkRgAAAABDbE5zAAAAAFNoVHJib29sAAAAAABWY3RDYm9vbAEAAAAAQ2xyU2VudW0AAAAAQ2xyUwAAAABMYkNsAAAAAFJuZFNsb25nApeQHAAAAABTbXRobG9uZwAACAAAAAAATW5tIFZsTHMAAAAEbG9uZwAAAABsb25nAAAAAGxvbmcAAAAAbG9uZwAAAAAAAAAATXhtIFZsTHMAAAAEbG9uZwAAAGRsb25nAAAAZGxvbmcAAABkbG9uZwAAAGQAAAAAQW5nbFVudEYjQW5nQFaAAAAAAAAAAAAAVHlwZWVudW0AAAAAR3JkVAAAAABMbnIgAAAAAFJ2cnNib29sAAAAAABEdGhyYm9vbAAAAAAAQWxnbmJvb2wBAAAAAFNjbCBVbnRGI1ByY0BZAAAAAAAAAAAAAE9mc3RPYmpjAAAAAQAAAAAAAFBudCAAAAACAAAAAEhyem5VbnRGI1ByYwAAAAAAAAAAAAAAAFZydGNVbnRGI1ByYwAAAAAAAAAAAAAAAENoRlhPYmpjAAAAAQAAAAAAAENoRlgAAAAKAAAAAGVuYWJib29sAQAAAABNZCAgZW51bQAAAABCbG5NAAAAAE1sdHAAAAAAQ2xyIE9iamMAAAABAAAAAAAAUkdCQwAAAAMAAAAAUmQgIGRvdWJAaYAABmAAAAAAAABHcm4gZG91YkBXAAAI4AAAAAAAAEJsICBkb3ViQFcAAAjgAAAAAAAAQW50QWJvb2wAAAAAAEludnJib29sAQAAAABPcGN0VW50RiNQcmNASQAAAAAAAAAAAABsYWdsVW50RiNBbmdAMwAAAAAAAAAAAABEc3RuVW50RiNQeGxAJgAAAAAAAAAAAABibHVyVW50RiNQeGxALAAAAAAAAAAAAABNcGdTT2JqYwAAAAEAAAAAAABTaHBDAAAAAgAAAABObSAgVEVYVAAAAAkARwBhAHUAcwBzAGkAYQBuAAAAAAAAQ3J2IFZsTHMAAAAJT2JqYwAAAAEAAAAAAABDclB0AAAAAgAAAABIcnpuZG91YgAAAAAAAAAAAAAAAFZydGNkb3ViAAAAAAAAAABPYmpjAAAAAQAAAAAAAENyUHQAAAACAAAAAEhyem5kb3ViQEAAAAAAAAAAAAAAVnJ0Y2RvdWJAHAAAAAAAAE9iamMAAAABAAAAAAAAQ3JQdAAAAAIAAAAASHJ6bmRvdWJAUAAAAAAAAAAAAABWcnRjZG91YkBDAAAAAAAAT2JqYwAAAAEAAAAAAABDclB0AAAAAgAAAABIcnpuZG91YkBYAAAAAAAAAAAAAFZydGNkb3ViQFlAAAAAAABPYmpjAAAAAQAAAAAAAENyUHQAAAACAAAAAEhyem5kb3ViQGAAAAAAAAAAAAAAVnJ0Y2RvdWJAZMAAAAAAAE9iamMAAAABAAAAAAAAQ3JQdAAAAAIAAAAASHJ6bmRvdWJAY+AAAAAAAAAAAABWcnRjZG91YkBqIAAAAAAAT2JqYwAAAAEAAAAAAABDclB0AAAAAgAAAABIcnpuZG91YkBn4AAAAAAAAAAAAFZydGNkb3ViQG1gAAAAAABPYmpjAAAAAQAAAAAAAENyUHQAAAACAAAAAEhyem5kb3ViQGvgAAAAAAAAAAAAVnJ0Y2RvdWJAbwAAAAAAAE9iamMAAAABAAAAAAAAQ3JQdAAAAAIAAAAASHJ6bmRvdWJAb+AAAAAAAAAAAABWcnRjZG91YkBv4AAAAAAA',
	'AAAAAQAAAAAAAG51bGwAAAADAAAAAFNjbCBVbnRGI1ByY0BZAAAAAAAAAAAADm1hc3RlckZYU3dpdGNoYm9vbAEAAAAARHJTaE9iamMAAAABAAAAAAAARHJTaAAAAA0AAAAAZW5hYmJvb2wBAAAAAE1kICBlbnVtAAAAAEJsbk0AAAAATWx0cAAAAABDbHIgT2JqYwAAAAEAAAAAAABSR0JDAAAAAwAAAABSZCAgZG91YkBiAAAN4AAAAAAAAEdybiBkb3ViQE0U6yLAAAAAAAAAQmwgIGRvdWJATRTrIsAAAAAAAABPcGN0VW50RiNQcmNAUsAAAAAAAAAAAAB1Z2xnYm9vbAEAAAAAbGFnbFVudEYjQW5nQF4AAAAAAAAAAAAARHN0blVudEYjUHhsQBQAAAAAAAAAAAAAQ2ttdFVudEYjUHhsQAAAAAAAAAAAAAAAYmx1clVudEYjUHhsQBQAAAAAAAAAAAAATm9zZVVudEYjUHJjAAAAAAAAAAAAAAAAQW50QWJvb2wAAAAAAFRyblNPYmpjAAAAAQAAAAAAAFNocEMAAAACAAAAAE5tICBURVhUAAAABwBMAGkAbgBlAGEAcgAAAAAAAENydiBWbExzAAAAAk9iamMAAAABAAAAAAAAQ3JQdAAAAAIAAAAASHJ6bmRvdWIAAAAAAAAAAAAAAABWcnRjZG91YgAAAAAAAAAAT2JqYwAAAAEAAAAAAABDclB0AAAAAgAAAABIcnpuZG91YkBv4AAAAAAAAAAAAFZydGNkb3ViQG/gAAAAAAAAAAANbGF5ZXJDb25jZWFsc2Jvb2wB',
	'AAAAAQAAAAAAAG51bGwAAAADAAAAAFNjbCBVbnRGI1ByY0BZAAAAAAAAAAAADm1hc3RlckZYU3dpdGNoYm9vbAEAAAAASXJTaE9iamMAAAABAAAAAAAASXJTaAAAAAwAAAAAZW5hYmJvb2wBAAAAAE1kICBlbnVtAAAAAEJsbk0AAAAATWx0cAAAAABDbHIgT2JqYwAAAAEAAAAAAABSR0JDAAAAAwAAAABSZCAgZG91YkBJGOcmwAAAAAAAAEdybiBkb3ViQGkAAAbgAAAAAAAAQmwgIGRvdWJAUPRLrwAAAAAAAABPcGN0VW50RiNQcmNAT4AAAAAAAAAAAAB1Z2xnYm9vbAAAAAAAbGFnbFVudEYjQW5nQE6AAAAAAAAAAAAARHN0blVudEYjUHhsQCwAAAAAAAAAAAAAQ2ttdFVudEYjUHhsQCYAAAAAAAAAAAAAYmx1clVudEYjUHhsQBAAAAAAAAAAAAAATm9zZVVudEYjUHJjAAAAAAAAAAAAAAAAQW50QWJvb2wAAAAAAFRyblNPYmpjAAAAAQAAAAAAAFNocEMAAAACAAAAAE5tICBURVhUAAAABwBMAGkAbgBlAGEAcgAAAAAAAENydiBWbExzAAAAAk9iamMAAAABAAAAAAAAQ3JQdAAAAAIAAAAASHJ6bmRvdWIAAAAAAAAAAAAAAABWcnRjZG91YgAAAAAAAAAAT2JqYwAAAAEAAAAAAABDclB0AAAAAgAAAABIcnpuZG91YkBv4AAAAAAAAAAAAFZydGNkb3ViQG/gAAAAAAA=',
	'AAAAAQAAAAAAAG51bGwAAAAEAAAAAFNjbCBVbnRGI1ByY0BZAAAAAAAAAAAADm1hc3RlckZYU3dpdGNoYm9vbAEAAAAAT3JHbE9iamMAAAABAAAAAAAAT3JHbAAAAAwAAAAAZW5hYmJvb2wBAAAAAE1kICBlbnVtAAAAAEJsbk0AAAAAU2NybgAAAABDbHIgT2JqYwAAAAEAAAAAAABSR0JDAAAAAwAAAABSZCAgZG91YkBv4AAAAAAAAAAAAEdybiBkb3ViQFdAAAigAAAAAAAAQmwgIGRvdWJAbE2yQ6AAAAAAAABPcGN0VW50RiNQcmNAUsAAAAAAAAAAAABHbHdUZW51bQAAAABCRVRFAAAAAFNmQkwAAAAAQ2ttdFVudEYjUHhsAAAAAAAAAAAAAAAAYmx1clVudEYjUHhsQBQAAAAAAAAAAAAATm9zZVVudEYjUHJjAAAAAAAAAAAAAAAAU2hkTlVudEYjUHJjAAAAAAAAAAAAAAAAQW50QWJvb2wAAAAAAFRyblNPYmpjAAAAAQAAAAAAAFNocEMAAAACAAAAAE5tICBURVhUAAAABwBMAGkAbgBlAGEAcgAAAAAAAENydiBWbExzAAAAAk9iamMAAAABAAAAAAAAQ3JQdAAAAAIAAAAASHJ6bmRvdWIAAAAAAAAAAAAAAABWcnRjZG91YgAAAAAAAAAAT2JqYwAAAAEAAAAAAABDclB0AAAAAgAAAABIcnpuZG91YkBv4AAAAAAAAAAAAFZydGNkb3ViQG/gAAAAAAAAAAAASW5wclVudEYjUHJjQEkAAAAAAAAAAAAASXJHbE9iamMAAAABAAAAAAAASXJHbAAAAA0AAAAAZW5hYmJvb2wBAAAAAE1kICBlbnVtAAAAAEJsbk0AAAAATnJtbAAAAABDbHIgT2JqYwAAAAEAAAAAAABSR0JDAAAAAwAAAABSZCAgZG91YkBvdaLIAAAAAAAAAEdybiBkb3ViQG91osgAAAAAAAAAQmwgIGRvdWJAb3WiyAAAAAAAAABPcGN0VW50RiNQcmNAUsAAAAAAAAAAAABHbHdUZW51bQAAAABCRVRFAAAAAFNmQkwAAAAAQ2ttdFVudEYjUHhsQAAAAAAAAAAAAAAAYmx1clVudEYjUHhsQBAAAAAAAAAAAAAAU2hkTlVudEYjUHJjQCIAAAAAAAAAAAAATm9zZVVudEYjUHJjQAgAAAAAAAAAAAAAQW50QWJvb2wAAAAAAGdsd1NlbnVtAAAAAElHU3IAAAAAU3JjRQAAAABUcm5TT2JqYwAAAAEAAAAAAABTaHBDAAAAAgAAAABObSAgVEVYVAAAAAcATABpAG4AZQBhAHIAAAAAAABDcnYgVmxMcwAAAAJPYmpjAAAAAQAAAAAAAENyUHQAAAACAAAAAEhyem5kb3ViAAAAAAAAAAAAAAAAVnJ0Y2RvdWIAAAAAAAAAAE9iamMAAAABAAAAAAAAQ3JQdAAAAAIAAAAASHJ6bmRvdWJAb+AAAAAAAAAAAABWcnRjZG91YkBv4AAAAAAAAAAAAElucHJVbnRGI1ByY0BJAAAAAAAA',
	'AAAAAQAAAAAAAG51bGwAAAADAAAAAFNjbCBVbnRGI1ByY0BZAAAAAAAAAAAADm1hc3RlckZYU3dpdGNoYm9vbAEAAAAAZWJibE9iamMAAAABAAAAAAAAZWJibAAAABQAAAAAZW5hYmJvb2wBAAAAAGhnbE1lbnVtAAAAAEJsbk0AAAAAU2NybgAAAABoZ2xDT2JqYwAAAAEAAAAAAABSR0JDAAAAAwAAAABSZCAgZG91YkBv4AAAAAAAAAAAAEdybiBkb3ViQG/gAAAAAAAAAAAAQmwgIGRvdWJAb+AAAAAAAAAAAABoZ2xPVW50RiNQcmNAUsAAAAAAAAAAAABzZHdNZW51bQAAAABCbG5NAAAAAE1sdHAAAAAAc2R3Q09iamMAAAABAAAAAAAAUkdCQwAAAAMAAAAAUmQgIGRvdWI/PEccgAAAAAAAAABHcm4gZG91Yj88RxyAAAAAAAAAAEJsICBkb3ViPzxHHIAAAAAAAAAAc2R3T1VudEYjUHJjQFLAAAAAAAAAAAAAYnZsVGVudW0AAAAAYnZsVAAAAABTZkJMAAAAAGJ2bFNlbnVtAAAAAEJFU2wAAAAASW5yQgAAAAB1Z2xnYm9vbAEAAAAAbGFnbFVudEYjQW5nQF4AAAAAAAAAAAAATGFsZFVudEYjQW5nQD4AAAAAAAAAAAAAc3JnUlVudEYjUHJjQFkAAAAAAAAAAAAAYmx1clVudEYjUHhsQBQAAAAAAAAAAAAAYnZsRGVudW0AAAAAQkVTcwAAAABJbiAgAAAAAFRyblNPYmpjAAAAAQAAAAAAAFNocEMAAAACAAAAAE5tICBURVhUAAAABwBMAGkAbgBlAGEAcgAAAAAAAENydiBWbExzAAAAAk9iamMAAAABAAAAAAAAQ3JQdAAAAAIAAAAASHJ6bmRvdWIAAAAAAAAAAAAAAABWcnRjZG91YgAAAAAAAAAAT2JqYwAAAAEAAAAAAABDclB0AAAAAgAAAABIcnpuZG91YkBv4AAAAAAAAAAAAFZydGNkb3ViQG/gAAAAAAAAAAAOYW50aWFsaWFzR2xvc3Nib29sAAAAAABTZnRuVW50RiNQeGwAAAAAAAAAAAAAAAh1c2VTaGFwZWJvb2wAAAAACnVzZVRleHR1cmVib29sAA==',
	'AAAAAQAAAAAAAG51bGwAAAADAAAAAFNjbCBVbnRGI1ByY0BZAAAAAAAAAAAADm1hc3RlckZYU3dpdGNoYm9vbAAAAAAAU29GaU9iamMAAAABAAAAAAAAU29GaQAAAAQAAAAAZW5hYmJvb2wBAAAAAE1kICBlbnVtAAAAAEJsbk0AAAAATnJtbAAAAABPcGN0VW50RiNQcmNAWQAAAAAAAAAAAABDbHIgT2JqYwAAAAEAAAAAAABSR0JDAAAAAwAAAABSZCAgZG91YkBFB/gK4AAAAAAAAEdybiBkb3ViQFbXaIkgAAAAAAAAQmwgIGRvdWJAZaAACkAAAA==',
];

function writeDesc(value: any, classID = 'null', root = '') {
	const writer = createWriter();
	writeDescriptorStructure(writer, value._name ?? '', classID, value, root);
	return new Uint8Array(getWriterBuffer(writer));
}

const testReader = createReader(new ArrayBuffer(0));
const logReader = { ...createReader(new ArrayBuffer(0)), logMissingFeatures: true };
const testWriter = createWriter();

function readDesc(buffer: Uint8Array, includeClass = true) {
	return readDescriptorStructure(toReader(buffer), includeClass);
}

function roundTripDesc(value: any, classID = 'null', root = '') {
	return readDesc(writeDesc(value, classID, root));
}

function buildDesc(classID: string, count: number, body: (writer: PsdWriter) => void) {
	const writer = createWriter();
	writeDescriptorClass(writer, '', classID);
	writeUint32(writer, count);
	body(writer);
	return new Uint8Array(getWriterBuffer(writer));
}

describe('descriptor', () => {
	describe('reads and writes', () => {
		tests.forEach((value, index) => it(`test ${index}`, () => {
			const expected = toByteArray(value);
			const reader = createReader(expected.buffer, expected.byteOffset, expected.byteLength);
			const struct = readDescriptorStructure(reader, false);
			const writer = createWriter();
			writeDescriptorStructure(writer, '', 'null', struct, 'null');
			const actual = getWriterBufferNoCopy(writer);

			// require('fs').writeFileSync('expected.bin', Buffer.from(expected));
			// require('fs').writeFileSync('actual.bin', Buffer.from(actual));
			compareBuffers(Buffer.from(actual), Buffer.from(expected), `descriptorReadWrite`);
		}));
	});

describe('descriptor types', () => {
	it('writes perspective warp filter', () => {
		const Fltr = {
			_name: 'Perspective Warp',
			_classID: 'perspectiveWarpTransform',
			vertices: [
				{ _name: '', _classID: 'Pnt ', Hrzn: { units: 'Pixels', value: 1.5 }, Vrtc: { units: 'Pixels', value: 2 } },
				{ _name: '', _classID: 'Pnt ', Hrzn: { units: 'Pixels', value: 3 }, Vrtc: { units: 'Pixels', value: 4 } },
			],
			warpedVertices: [
				{ _name: '', _classID: 'Pnt ', Hrzn: { units: 'Pixels', value: 5 }, Vrtc: { units: 'Pixels', value: 6 } },
			],
			quads: [{ _name: '', _classID: 'quadIndices', indices: [0, 1, 2, 3] }],
		};
		expect(roundTripDesc(Fltr, Fltr._classID)).eql(Fltr);
	});

	it('writes oil paint filter', () => {
		const Fltr = {
			_name: 'Oil Paint',
			_classID: 'oilPaint',
			lightingOn: true,
			stylization: 2.5,
			cleanliness: 5.2,
			brushScale: 1.1,
			microBrush: 0.5,
			LghD: -60,
			specularity: 1.3,
		};
		expect(roundTripDesc(Fltr, Fltr._classID)).eql(Fltr);
	});

	it('writes curves filter with mapping', () => {
		const Fltr = {
			_name: 'Curves',
			_classID: 'Crvs',
			presetKind: 'presetKindType.presetKindCustom',
			Adjs: [
				{ _name: '', _classID: 'CrvA', Chnl: ['Chnl.Cmps'], Mpng: [0, 10, 255] },
				{
					_name: '', _classID: 'CrvA', Chnl: ['Chnl.Rd  '],
					'Crv ': [{ _name: '', _classID: 'Pnt ', Hrzn: 0, Vrtc: 0, Cnty: true }, { _name: '', _classID: 'Pnt ', Hrzn: 255, Vrtc: 255 }],
				},
			],
		};
		expect(roundTripDesc(Fltr, Fltr._classID)).eql(Fltr);
	});

	it('writes hsb/hsl filter', () => {
		const Fltr = { _name: 'HSB/HSL', _classID: 'HsbP', Inpt: 'ClrS.RGBC', Otpt: 'ClrS.HSBl' };
		expect(roundTripDesc(Fltr, Fltr._classID)).eql(Fltr);
	});

	it('writes pixel source descriptor', () => {
		const alias = 'abc\x00\x01\xff\x80';
		const desc = {
			_name: '',
			_classID: 'PixelSource',
			pixelSourceType: 1986285651,
			descVersion: 1,
			origin: { _name: '', _classID: 'null', Hrzn: 0, Vrtc: -24 },
			interpretation: {
				_name: '',
				_classID: 'footageInterpretation',
				Vrsn: 1,
				interpretAlpha: 'alphaInterpretation.straight',
				profile: new Uint8Array([1, 2, 3]),
			},
			frameReader: {
				_name: '',
				_classID: 'FrameReader',
				frameReaderType: 1364477522,
				descVersion: 1,
				'Lnk ': {
					_name: '',
					_classID: 'ExternalFileLink',
					descVersion: 2,
					'Nm  ': 'video.mp4',
					fullPath: 'file:///video.mp4',
					originalPath: '/video.mp4',
					alis: alias,
					relPath: '../video.mp4',
				},
				mediaDescriptor: 'ImporterMPEG',
			},
			showAlteredVideo: true,
		};

		const bytes = writeDesc(desc, 'PixelSource');
		const result = readDesc(bytes);
		expect({ ...result, interpretation: { ...result.interpretation, profile: Array.from(result.interpretation.profile) } })
			.eql({ ...desc, interpretation: { ...desc.interpretation, profile: [1, 2, 3] } });

		// origin without class is written as 'null' class with integer values
		const { _classID, _name, ...origin } = desc.origin;
		const bytes2 = writeDesc({ ...desc, origin }, 'PixelSource');
		expect(Array.from(bytes2)).eql(Array.from(bytes));
	});

	it('writes pattern content with linked flag', () => {
		const desc = { Ptrn: { 'Nm  ': 'pattern', Idnt: 'id' }, Lnkd: true };
		expect(roundTripDesc(desc, 'null')).eql({ _name: '', _classID: 'null', ...desc, Ptrn: { _name: '', _classID: 'Ptrn', ...desc.Ptrn } });
	});

	it('writes alpha, Inpt, Otpt and LghD fields based on value outside of their descriptors', () => {
		expect(roundTripDesc({ alpha: 0.5, Inpt: 2.5, Otpt: 1.5, LghD: 0.25 })).eql({ _name: '', _classID: 'null', alpha: 0.5, Inpt: 2.5, Otpt: 1.5, LghD: 0.25 });
	});

	it('writes list items of unknown fields based on value', () => {
		expect(roundTripDesc({ unknownList: [0.5, 1.25] })).eql({ _name: '', _classID: 'null', unknownList: [0.5, 1.25] });
		expect(roundTripDesc({ unknownList: [true, false] })).eql({ _name: '', _classID: 'null', unknownList: [true, false] });
	});

	it('skips undefined values', () => {
		const result = roundTripDesc({ 'Nm  ': 'a', comment: undefined, Vrsn: 1 });
		expect(result).eql({ _name: '', _classID: 'null', 'Nm  ': 'a', Vrsn: 1 });
	});

	it('reads and writes comp, type, GlbC, alis, UnFl, GlbO and ObAr types', () => {
		const bytes = buildDesc('null', 8, writer => {
			writeDescriptorKey(writer, 'cmpx', 'comp'); writeUint32(writer, 1); writeUint32(writer, 0xffffffff);
			writeDescriptorKey(writer, 'typx', 'type'); writeDescriptorClass(writer, 'name', 'Lyr ');
			writeDescriptorKey(writer, 'glbc', 'GlbC'); writeDescriptorClass(writer, '', 'Dcmn');
			writeDescriptorKey(writer, 'alis', 'alis'); writeInt32(writer, 3); writeUint8(writer, 0); writeUint8(writer, 0xff); writeUint8(writer, 65);
			writeDescriptorKey(writer, 'unfl', 'UnFl'); writeSignature(writer, '#Prc'); writeFloat32(writer, 12.5);
			writeDescriptorKey(writer, 'glbo', 'GlbO'); writeDescriptorClass(writer, '', 'null'); writeUint32(writer, 1); writeDescriptorKey(writer, 'Vrsn', 'long'); writeInt32(writer, 3);
			writeDescriptorKey(writer, 'lst2', 'VlLs'); writeInt32(writer, 1); writeSignature(writer, 'UnFl'); writeSignature(writer, '#Pxl'); writeFloat32(writer, 2);
			writeDescriptorKey(writer, 'meshPoints', 'ObAr');
			writeInt32(writer, 16); writeUnicodeStringWithPadding(writer, ''); writeDescriptorId(writer, 'customClass');
			writeInt32(writer, 2);
			writeDescriptorId(writer, 'Hrzn'); writeSignature(writer, 'UnFl'); writeSignature(writer, '#Prc'); writeInt32(writer, 1); writeFloat64(writer, 1.5);
			writeDescriptorId(writer, 'Vrtc'); writeSignature(writer, 'UnFl'); writeSignature(writer, '#Pxl'); writeInt32(writer, 1); writeFloat64(writer, 2.5);
		});

		const desc = readDesc(bytes);
		expect(desc.cmpx).eql({ low: 1, high: 0xffffffff });
		expect(desc.typx).eql({ name: 'name', classID: 'Lyr ' });
		expect(desc.glbc).eql({ name: '', classID: 'Dcmn' });
		expect(desc.alis).equal('\x00\xffA');
		expect(desc.unfl).eql({ units: 'Percent', value: 12.5 });
		expect(desc.glbo).eql({ _name: '', _classID: 'null', Vrsn: 3 });
		expect(desc.lst2).eql([{ units: 'Pixels', value: 2 }]);
		expect(desc.meshPoints).eql([{ type: 'Hrzn', values: [1.5] }, { type: 'Vrtc', values: [2.5] }]);

		// written using types matching the values (GlbC as type, UnFl as UntF, GlbO as Objc)
		expect(readDesc(writeDesc(desc))).eql(desc);
	});

	it('reads references as values', () => {
		const bytes = buildDesc('null', 1, writer => {
			writeDescriptorKey(writer, 'null', 'obj ');
			writeInt32(writer, 8);
			writeSignature(writer, 'prop'); writeDescriptorClass(writer, '', 'Prpr'); writeDescriptorId(writer, 'Lefx');
			writeSignature(writer, 'Clss'); writeDescriptorClass(writer, '', 'Dcmn');
			writeSignature(writer, 'Enmr'); writeDescriptorClass(writer, '', 'Lyr '); writeDescriptorId(writer, 'Ordn'); writeDescriptorId(writer, 'Trgt');
			writeSignature(writer, 'rele'); writeDescriptorClass(writer, '', 'Lyr '); writeUint32(writer, 3);
			writeSignature(writer, 'Idnt'); writeInt32(writer, 5);
			writeSignature(writer, 'indx'); writeInt32(writer, 6);
			writeSignature(writer, 'name'); writeDescriptorClass(writer, '', 'Path'); writeUnicodeStringWithPadding(writer, 'My.Path');
			writeSignature(writer, 'name'); writeDescriptorClass(writer, '', 'Lyr '); writeUnicodeStringWithPadding(writer, 'Layer 1');
		});

		const desc = readDesc(bytes);
		expect(desc.null).eql(['Lefx', { name: '', classID: 'Dcmn' }, 'Ordn.Trgt', 3, 5, 6, 'My.Path', 'Layer 1']);
		expect(roundTripDesc(desc).null).eql(desc.null);
	});

	it('writes references with explicit types and classes', () => {
		const bytes = buildDesc('null', 1, writer => {
			writeDescriptorKey(writer, 'null', 'obj ');
			writeInt32(writer, 7);
			writeSignature(writer, 'prop'); writeDescriptorClass(writer, '', 'Prpr'); writeDescriptorId(writer, 'Lefx');
			writeSignature(writer, 'Clss'); writeDescriptorClass(writer, '', 'Dcmn');
			writeSignature(writer, 'Enmr'); writeDescriptorClass(writer, '', 'Lyr '); writeDescriptorId(writer, 'Ordn'); writeDescriptorId(writer, 'Trgt');
			writeSignature(writer, 'rele'); writeDescriptorClass(writer, '', 'Lyr '); writeUint32(writer, 3);
			writeSignature(writer, 'indx'); writeInt32(writer, 6);
			writeSignature(writer, 'name'); writeDescriptorClass(writer, '', 'Path'); writeUnicodeStringWithPadding(writer, 'My.Path');
			writeSignature(writer, 'Idnt'); writeInt32(writer, 5);
		});

		const items: DescriptorReferenceItem[] = [
			{ type: 'prop', _name: '', _classID: 'Prpr', keyID: 'Lefx' },
			{ type: 'Clss', _name: '', _classID: 'Dcmn' },
			{ type: 'Enmr', _name: '', _classID: 'Lyr ', typeID: 'Ordn', enumValue: 'Trgt' },
			{ type: 'rele', _name: '', _classID: 'Lyr ', value: 3 },
			{ type: 'indx', value: 6 },
			{ type: 'name', _name: '', _classID: 'Path', value: 'My.Path' },
		];
		expect(Array.from(writeDesc({ null: [...items, 5] }))).eql(Array.from(bytes));
	});

	it('writes changed reference items', () => {
		const bytes = buildDesc('null', 1, writer => {
			writeDescriptorKey(writer, 'null', 'obj ');
			writeInt32(writer, 1);
			writeSignature(writer, 'name'); writeDescriptorClass(writer, '', 'Path'); writeUnicodeStringWithPadding(writer, 'a');
		});

		const desc = readDesc(bytes);
		desc.null[0] = 'My.Path'; // changed value, falls back to default handling
		expect(readDesc(writeDesc(desc)).null).eql(['My.Path']);
	});
});

describe('colors', () => {
	it('converts colors to documented ranges', () => {
		expect(parseColor({ _name: '', _classID: 'HSBC', 'H   ': { units: 'Angle', value: 180 }, Strt: 50, Brgh: 100 }))
			.eql({ h: 0.5, s: 0.5, b: 1 });
		expect(parseColor({ _name: '', _classID: 'CMYC', 'Cyn ': 100, Mgnt: 0, 'Ylw ': 20, Blck: 50 }))
			.eql({ c: 255, m: 0, y: 51, k: 127.5 });
		expect(parseColor({ _name: '', _classID: 'Grsc', 'Gry ': 100 })).eql({ k: 255 });
		expect(parseColor({ _name: '', _classID: 'LbCl', Lmnc: 50, 'A   ': -128, 'B   ': 127 })).eql({ l: 0.5, a: -1, b: 1 });

		expect(serializeColor({ h: 0.5, s: 0.5, b: 1 })).eql({ _name: '', _classID: 'HSBC', 'H   ': { units: 'Angle', value: 180 }, Strt: 50, Brgh: 100 });
		expect(serializeColor({ c: 255, m: 0, y: 51, k: 127.5 })).eql({ _name: '', _classID: 'CMYC', 'Cyn ': 100, Mgnt: 0, 'Ylw ': 20, Blck: 50 });
		expect(serializeColor({ k: 255 })).eql({ _name: '', _classID: 'Grsc', 'Gry ': 100 });
		expect(serializeColor({ l: 0.5, a: -1, b: 1 })).eql({ _name: '', _classID: 'LbCl', Lmnc: 50, 'A   ': -128, 'B   ': 127 });
	});

	it('writes gray and lab colors as doubles', () => {
		const colors: Color[] = [{ k: 127.5 }, { l: 0.255, a: -0.5, b: 0.25 }, { c: 47, m: 255, y: 194, k: 22 }, { h: 0.1, s: 0.33, b: 0.7 }];

		for (const color of colors) {
			const bytes = writeDesc({ 'Clr ': serializeColor(color) });
			const result = parseColor(readDesc(bytes)['Clr ']);
			for (const key of Object.keys(color)) {
				expect((result as any)[key]).closeTo((color as any)[key], 1e-9, `${JSON.stringify(color)} ${key}`);
			}
		}

		const bytes = writeDesc({ 'Clr ': serializeColor({ k: 127.5 }) });
		expect(Buffer.from(bytes).toString('latin1')).contains('Gry doub');
		const bytes2 = writeDesc({ 'Clr ': serializeColor({ l: 0.5, a: 0.5, b: 0.5 }) });
		expect(Buffer.from(bytes2).toString('latin1')).contains('Lmncdoub');
		expect(Buffer.from(bytes2).toString('latin1')).contains('LbCl');
	});

	it('writes unmodified colors with exact original values', () => {
		const original = { _name: '', _classID: 'CMYC', 'Cyn ': 0, Mgnt: 30.2, 'Ylw ': 99.99999776482582, Blck: 8.63 } as const;
		const color = parseColor(original as any);
		const serialized = serializeColor(color);
		expect(serialized).eql(original);

		// modified color is converted
		(color as any).c = 255;
		expect((serializeColor(color) as any)['Cyn ']).equal(100);
	});

	it('writes hsb color without hue precision errors', () => {
		const original = { _name: '', _classID: 'HSBC', 'H   ': { units: 'Angle', value: 1.9 }, Strt: 50, Brgh: 100 } as const;
		expect(serializeColor(parseColor(original as any))).eql(original);
	});

	it('reads book colors without color values as black', () => {
		const original = { _name: '', _classID: 'BkCl', 'Bk  ': 'PANTONE+ Solid Coated', 'Nm  ': 'PANTONE 185 C', bookID: 3060, bookKey: new Uint8Array([1, 2]) };
		const desc = readDesc(writeDesc({ 'Clr ': original }))['Clr '];
		expect(desc).eql(original);
		expect(parseColor(desc)).eql({ r: 0, g: 0, b: 0, book: { book: 'PANTONE+ Solid Coated', name: 'PANTONE 185 C', bookID: 3060, bookKey: '' } });
	});

	it('reads and writes book colors', () => {
		const original = {
			_name: '', _classID: 'CMYC', 'Cyn ': 37.17, Mgnt: 71.36, 'Ylw ': 27.44, Blck: 2.25,
			'Bk  ': 'PANTONE+ Solid Coated', 'Nm  ': 'PANTONE 688 C', bookID: 3060, bookKey: new Uint8Array([48, 52, 50, 53, 83, 67]),
		};
		const desc = readDesc(writeDesc({ 'Clr ': original }))['Clr '];
		const color = parseColor(desc);
		expect(color.book).eql({ book: 'PANTONE+ Solid Coated', name: 'PANTONE 688 C', bookID: 3060, bookKey: '0425SC' });
		expect(readDesc(writeDesc({ 'Clr ': serializeColor(color) }))['Clr ']).eql(original);
	});
});

describe('effects', () => {
	it('round-trips both bevel contours', () => {
		const contour = (name: string): EffectContour => ({ name, curve: [{ x: 0, y: 0 }, { x: 255, y: 255 }] });
		const effects: LayerEffectsInfo = {
			bevel: { enabled: true, useShape: true, contour: contour('gloss'), shapeContour: contour('shape') },
		};
		const info = serializeEffects(effects, testWriter, false);
		expect((info.ebbl as any).TrnS['Nm  ']).equal('gloss');
		expect((info.ebbl as any).MpgS['Nm  ']).equal('shape');
		const bevel = parseEffects(info, testReader).bevel!;
		expect(bevel.contour!.name).equal('gloss');
		expect(bevel.shapeContour!.name).equal('shape');
	});

	it('round-trips gradient color stop type', () => {
		const effects: LayerEffectsInfo = {
			gradientOverlay: [{
				enabled: true,
				gradient: {
					type: 'solid', name: 'g',
					colorStops: [
						{ location: 0, midpoint: 0.5, color: { r: 0, g: 0, b: 0 }, type: 'foreground' },
						{ location: 1, midpoint: 0.5, color: { r: 255, g: 255, b: 255 } },
					],
					opacityStops: [{ location: 0, midpoint: 0.5, opacity: 1 }],
				},
			}],
		};
		const info = serializeEffects(effects, testWriter, false);
		expect((info.GrFl as any).Grad.Clrs.map((s: any) => s.Type)).eql(['Clry.FrgC', 'Clry.UsrS']);
		const gradient = parseEffects(info, testReader).gradientOverlay![0].gradient as any;
		expect(gradient.colorStops[0].type).equal('foreground');
		expect(gradient.colorStops[1].type).undefined;

		// color stop without color
		delete (info.GrFl as any).Grad.Clrs[0]['Clr '];
		expect((parseEffects(info, testReader).gradientOverlay![0].gradient as any).colorStops[0].color).eql({ r: 0, g: 0, b: 0 });
	});

	it('reads unknown gradient color stop type as user color', () => {
		const effects: LayerEffectsInfo = {
			gradientOverlay: [{
				enabled: true,
				gradient: {
					type: 'solid', name: 'g',
					colorStops: [{ location: 0, midpoint: 0.5, color: { r: 0, g: 0, b: 0 } }],
					opacityStops: [{ location: 0, midpoint: 0.5, opacity: 1 }],
				},
			}],
		};
		const info = serializeEffects(effects, testWriter, false);
		(info.GrFl as any).Grad.Clrs[0].Type = 'Clry.Xxxx';
		const parsed = parseEffects(info, testReader);
		expect((parsed.gradientOverlay![0].gradient as any).colorStops[0].type).undefined;
		expect((serializeEffects(parsed, testWriter, false).GrFl as any).Grad.Clrs[0].Type).equal('Clry.UsrS');
	});

	it('round-trips pattern fill scale and angle', () => {
		const content: VectorContent = { type: 'pattern', name: 'p', id: 'id', scale: 0.47, angle: -171 };
		const { descriptor } = serializeVectorContent(content);
		expect(parseVectorContent(readDesc(writeDesc(descriptor)) as any)).eql(content);
	});

	it('round-trips exact gradient fill scale and offset', () => {
		const content: VectorContent = {
			type: 'solid', name: 'g', style: 'linear', scale: 1.00136, offset: { x: -0.02375, y: -0.003125 },
			colorStops: [{ location: 0, midpoint: 0.5, color: { r: 0, g: 0, b: 0 } }],
			opacityStops: [{ location: 0, midpoint: 0.5, opacity: 1 }],
		};
		const { descriptor } = serializeVectorContent(content);
		const result = parseVectorContent(readDesc(writeDesc(descriptor)) as any) as any;
		expect(result.scale).equal(1.00136);
		expect(result.offset).eql({ x: -0.02375, y: -0.003125 });
	});

	it('reads stroke size stored as number (old Photoshop versions)', () => {
		const effects = parseEffects({
			FrFX: {
				enab: true, Styl: 'FStl.OutF', PntT: 'FrFl.SClr', 'Md  ': 'BlnM.Nrml', Opct: { units: 'Percent', value: 100 }, 'Sz  ': 3,
				'Clr ': { _name: '', _classID: 'RGBC', 'Rd  ': 255, 'Grn ': 0, 'Bl  ': 0 },
			},
		} as any, testReader);
		expect(effects.stroke![0].size).eql({ units: 'Pixels', value: 3 });
	});

	it('round-trips glow gradient interpolation method', () => {
		const effects: LayerEffectsInfo = { outerGlow: { enabled: true, interpolationMethod: 'classic' } };
		const info = serializeEffects(effects, testWriter, false);
		expect((info.OrGl as any).gradientsInterpolationMethod).equal('gradientInterpolationMethodType.Gcls');
		expect((info.OrGl as any).gs99).undefined;
		expect(parseEffects(readDesc(writeDesc(info)) as any, logReader).outerGlow!.interpolationMethod).equal('classic');
	});

	it('writes pattern overlay angle as Angl', () => {
		const effects: LayerEffectsInfo = {
			patternOverlay: { enabled: true, angle: 45, pattern: { name: 'p', id: 'id' } } as any,
		};
		const info = serializeEffects(effects, testWriter, false);
		expect((info.patternFill as any).Angl).eql({ units: 'Angle', value: 45 });
		expect((info.patternFill as any).lagl).undefined;
		expect((parseEffects(info, testReader).patternOverlay as any).angle).equal(45);
	});

	it('ignores undefined effects when counting modifying effects', () => {
		const effects: LayerEffectsInfo = {
			dropShadow: [{ enabled: true }],
			outerGlow: undefined,
			innerGlow: null as any,
			bevel: { enabled: true },
		};
		const info = serializeEffects(effects, testWriter, true);
		expect(info.numModifyingFX).equal(2);
	});

	it('writes gradient stop locations independent of smoothness', () => {
		const effects: LayerEffectsInfo = {
			gradientOverlay: [{
				enabled: true,
				gradient: {
					type: 'solid',
					name: 'g',
					smoothness: 0.5,
					colorStops: [{ color: { r: 0, g: 0, b: 0 }, location: 0, midpoint: 0.5 }, { color: { r: 255, g: 255, b: 255 }, location: 0.5, midpoint: 0.5 }],
					opacityStops: [{ opacity: 1, location: 0.25, midpoint: 0.5 }],
				},
			}],
		};
		const info: any = serializeEffects(effects, testWriter, false);
		expect(info.GrFl.Grad.Intr).equal(2048);
		expect(info.GrFl.Grad.Clrs[1].Lctn).equal(2048);
		expect(info.GrFl.Grad.Trns[0].Lctn).equal(1024);

		const gradient: any = parseEffects(info, testReader).gradientOverlay![0].gradient;
		expect(gradient.smoothness).equal(0.5);
		expect(gradient.colorStops[1].location).equal(0.5);
		expect(gradient.opacityStops[0].location).equal(0.25);
	});

	it('rounds noise gradient min/max values', () => {
		const effects: LayerEffectsInfo = {
			gradientOverlay: [{
				enabled: true,
				gradient: { type: 'noise', name: 'n', roughness: 0.5, colorModel: 'rgb', randomSeed: 1, min: [0.29, 0, 0, 0], max: [0.57, 1, 1, 1] },
			}],
		};
		const info: any = serializeEffects(effects, testWriter, false);
		expect(info.GrFl.Grad['Mnm ']).eql([29, 0, 0, 0]);
		expect(info.GrFl.Grad['Mxm ']).eql([57, 100, 100, 100]);
		const bytes = writeDesc(info);
		expect(readDesc(bytes, false).GrFl.Grad['Mnm ']).eql([29, 0, 0, 0]);
	});
});

describe('timeline', () => {
	it('writes effect params keys separately from track keys', () => {
		const tracks: TimelineTrack[] = [{
			type: 'opacity',
			enabled: true,
			keys: [{ interpolation: 'linear', time: { numerator: 0, denominator: 30 }, selected: false, type: 'opacity', value: 1 }],
			effectParams: {
				fillCanvas: false,
				zoomOrigin: 0,
				keys: [{ interpolation: 'hold', time: { numerator: 10, denominator: 30 }, selected: true, type: 'opacity', value: 0.5 }],
			},
		}];
		const trackList = serializeTrackList(tracks, testWriter);
		const bytes = writeDesc({ trackList });
		const result = parseTrackList(readDesc(bytes, false).trackList, testReader);
		expect(result).eql(tracks);
	});
});

describe('version and descriptor', () => {
	it('round trips through writeVersionAndDescriptor', () => {
		const writer = createWriter();
		writeVersionAndDescriptor(writer, '', 'null', { Vrsn: 1, minOpacity: 28.6 });
		const desc = readVersionAndDescriptor(toReader(new Uint8Array(getWriterBuffer(writer))));
		expect(desc).eql({ Vrsn: 1, minOpacity: 29 }); // long values are rounded
	});
});
});
