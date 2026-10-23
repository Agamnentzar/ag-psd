import { expect } from 'chai';
import { readEffects, writeEffects } from '../effectsHelpers';
import { createWriter, getWriterBuffer } from '../psdWriter';
import { createReader } from '../psdReader';

describe('effectsHelpers', () => {
	it('round-trips default opacity and bevel style', () => {
		const writer = createWriter();
		writeEffects(writer, {
			outerGlow: { enabled: true },
			bevel: { enabled: true },
		});
		const buffer = getWriterBuffer(writer);
		const effects = readEffects(createReader(buffer));

		expect(effects.disabled).undefined;
		expect(effects.outerGlow!.opacity).equal(1);
		expect(effects.bevel!.style).equal('inner bevel');
		expect(effects.bevel!.highlightOpacity).equal(1);
		expect(effects.bevel!.shadowOpacity).equal(1);
	});

	it('reads hidden effects common state without throwing', () => {
		const writer = createWriter();
		writeEffects(writer, { outerGlow: { enabled: true } });
		const buffer = new Uint8Array(getWriterBuffer(writer));
		buffer[20] = 0; // cmnS visible flag

		const effects = readEffects(createReader(buffer.buffer));

		expect(effects.outerGlow).not.undefined;
	});
});
