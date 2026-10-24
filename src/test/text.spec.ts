import './common';
import { expect } from 'chai';
import { encodeEngineData, decodeEngineData } from '../text';
import { parseEngineData, serializeEngineData } from '../engineData';
import { LayerTextData } from '../psd';

function roundTrip(data: LayerTextData) {
	const encoded = encodeEngineData(data);
	const parsed = parseEngineData(serializeEngineData(encoded), { log() { } });
	return { encoded, decoded: decodeEngineData(parsed) };
}

describe('text', () => {
	it('keeps trailing empty paragraphs', () => {
		const { encoded, decoded } = roundTrip({ text: 'Hello\n\n' });

		expect(encoded.EngineDict.Editor.Text).equal('Hello\r\r\r');
		expect(decoded.text).equal('Hello\n\n');
	});

	it('keeps separate fonts for faux bold/italic (synthetic) variants', () => {
		const { decoded } = roundTrip({
			text: 'abc',
			styleRuns: [
				{ length: 1, style: { font: { name: 'Arial', synthetic: 0 } } },
				{ length: 1, style: { font: { name: 'Arial', synthetic: 1 } } },
				{ length: 1, style: { font: { name: 'Arial', synthetic: 2 } } },
			],
		});

		expect(decoded.styleRuns!.map(r => r.style.font!.synthetic)).eql([0, 1, 2]);
	});

	it('strips only single trailing new line written by photoshop', () => {
		const { decoded } = roundTrip({ text: 'Hello' });

		expect(decoded.text).equal('Hello');
	});

	it('keeps style run lengths consistent with trailing new lines', () => {
		const { decoded } = roundTrip({
			text: 'ab\n\n',
			styleRuns: [
				{ length: 2, style: { fontSize: 10 } },
				{ length: 2, style: { fontSize: 20 } },
			],
		});

		expect(decoded.text).equal('ab\n\n');
		expect(decoded.styleRuns!.map(r => r.length)).eql([2, 2]);
		expect(decoded.styleRuns!.map(r => r.style.fontSize)).eql([10, 20]);
	});

	it('reads style without font as normal style sheet font (not AdobeInvisFont)', () => {
		const { encoded, decoded } = roundTrip({ text: 'Hello', style: { fontSize: 20 } });

		expect(encoded.EngineDict.StyleRun.RunArray[0].StyleSheet.StyleSheetData.Font).undefined;
		expect(decoded.style!.font!.name).equal('MyriadPro-Regular');
	});

	it('round-trips font of the style', () => {
		const font = { name: 'ArialMT', script: 0, type: 1, synthetic: 0 };
		const { decoded } = roundTrip({ text: 'Hello', style: { font } });

		expect(decoded.style!.font).eql(font);
	});

	it('writes and reads gridInfo leadingFillColor', () => {
		const { encoded, decoded } = roundTrip({
			text: 'Hello',
			gridInfo: { isOn: true, color: { r: 255, g: 0, b: 0 }, leadingFillColor: { r: 0, g: 255, b: 0 } },
		});

		expect(encoded.EngineDict.GridInfo.GridColor.Values).eql([1, 1, 0, 0]);
		expect(encoded.EngineDict.GridInfo.GridLeadingFillColor.Values).eql([1, 0, 1, 0]);
		expect(decoded.gridInfo!.isOn).true;
		expect(decoded.gridInfo!.color).eql({ r: 255, g: 0, b: 0 });
		expect(decoded.gridInfo!.leadingFillColor).eql({ r: 0, g: 255, b: 0 });
	});

	it('does not output default gridInfo', () => {
		const { decoded } = roundTrip({ text: 'Hello' });

		expect(decoded.gridInfo).undefined;
	});

	it('writes FRGB and HSB fill colors', () => {
		const frgb = encodeEngineData({ text: 'a', style: { fillColor: { fr: 1, fg: 0.5, fb: 0 } } });
		expect(frgb.EngineDict.StyleRun.RunArray[0].StyleSheet.StyleSheetData.FillColor!.Values).eql([1, 1, 0.5, 0]);

		const hsb = encodeEngineData({ text: 'a', style: { fillColor: { h: 0, s: 1, b: 1 } } });
		expect(hsb.EngineDict.StyleRun.RunArray[0].StyleSheet.StyleSheetData.FillColor!.Values).eql([1, 1, 0, 0]);

		const hsb2 = encodeEngineData({ text: 'a', style: { fillColor: { h: 0.5, s: 1, b: 1 } } });
		expect(hsb2.EngineDict.StyleRun.RunArray[0].StyleSheet.StyleSheetData.FillColor!.Values).eql([1, 0, 1, 1]);
	});

	it('throws clear error for LAB fill color', () => {
		expect(() => encodeEngineData({ text: 'a', style: { fillColor: { l: 0.5, a: 0, b: 0 } } })).throw(/LAB/);
	});

	it('writes style runs when styleRuns is empty array', () => {
		const encoded = encodeEngineData({ text: 'Hello', styleRuns: [] });

		expect(encoded.EngineDict.StyleRun.RunArray.length).equal(1);
		expect(encoded.EngineDict.StyleRun.RunLengthArray).eql([6]);
	});

	it('adjusts run lengths for \\r\\n line endings', () => {
		const encoded = encodeEngineData({
			text: 'ab\r\ncd',
			styleRuns: [
				{ length: 4, style: { fontSize: 10 } },
				{ length: 2, style: { fontSize: 20 } },
			],
		});

		expect(encoded.EngineDict.Editor.Text).equal('ab\rcd\r');
		expect(encoded.EngineDict.StyleRun.RunLengthArray).eql([3, 3]);
		expect(encoded.EngineDict.StyleRun.RunArray.map(r => r.StyleSheet.StyleSheetData.FontSize)).eql([10, 20]);
	});

	it('uses safe defaults for unknown justification and anti-alias', () => {
		const encoded = encodeEngineData({
			text: 'a',
			antiAlias: 'foo' as any,
			paragraphStyle: { justification: 'foo' as any },
		});

		expect(encoded.EngineDict.AntiAlias).equal(4);
		expect(encoded.EngineDict.ParagraphRun.RunArray[0].ParagraphSheet.Properties.Justification).equal(0);
	});

	it('handles out of range justification and font indices when decoding', () => {
		const encoded = encodeEngineData({ text: 'a' });
		encoded.EngineDict.ParagraphRun.RunArray[0].ParagraphSheet.Properties.Justification = 99;
		encoded.EngineDict.StyleRun.RunArray[0].StyleSheet.StyleSheetData.Font = 99;
		const decoded = decodeEngineData(encoded);

		expect(decoded.paragraphStyle!.justification).equal('left');
		expect(decoded.style!.font!.name).equal('MyriadPro-Regular');
	});

	it('keeps style of empty last paragraph', () => {
		const { encoded, decoded } = roundTrip({
			text: 'a\nb\n',
			paragraphStyleRuns: [
				{ length: 2, style: { justification: 'left' } },
				{ length: 2, style: { justification: 'center' } },
				{ length: 0, style: { justification: 'right' } },
			],
		});

		expect(encoded.EngineDict.ParagraphRun.RunLengthArray).eql([2, 2, 1]);
		expect(decoded.paragraphStyleRuns!.map(r => r.length)).eql([2, 2, 0]);
		expect(decoded.paragraphStyleRuns!.map(r => r.style.justification)).eql(['left', 'center', 'right']);
	});
});
