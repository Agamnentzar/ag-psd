import { LayerEffectsInfo, BevelStyle, LayerEffectShadow } from './psd';
import { readColor, writeColor, toBlendMode, fromBlendMode } from './helpers';
import { PsdReader, checkSignature, readSignature, skipBytes, readUint16, readUint8, readUint32, readFixedPoint32 } from './psdReader';
import { PsdWriter, writeSignature, writeUint16, writeZeros, writeFixedPoint32, writeUint8, writeUint32 } from './psdWriter';

const bevelStyles: BevelStyle[] = [
	undefined as any, 'outer bevel', 'inner bevel', 'emboss', 'pillow emboss', 'stroke emboss'
];

function readBlendMode(reader: PsdReader) {
	checkSignature(reader, '8BIM');
	return toBlendMode[readSignature(reader)] || 'normal';
}

function writeBlendMode(writer: PsdWriter, mode: string | undefined) {
	writeSignature(writer, '8BIM');
	writeSignature(writer, fromBlendMode[mode!] || 'norm');
}

function readFixedPoint8(reader: PsdReader) {
	return readUint8(reader) / 0xff;
}

function writeFixedPoint8(writer: PsdWriter, value: number) {
	writeUint8(writer, Math.round(value * 0xff) | 0);
}

export function readEffects(reader: PsdReader) {
	const version = readUint16(reader);

	if (version !== 0)
		throw new Error(`Invalid effects layer version: ${version}`);

	const effectsCount = readUint16(reader);
	const effects: LayerEffectsInfo = <any>{};

	for (let i = 0; i < effectsCount; i++) {
		checkSignature(reader, '8BIM');
		const type = readSignature(reader);

		switch (type) {
			case 'cmnS': { // common state (see See Effects layer, common state info)
				const size = readUint32(reader);
				const version = readUint32(reader);
				const visible = !!readUint8(reader);
				skipBytes(reader, 2);

				if (size !== 7 || version !== 0 || !visible) throw new Error(`Invalid effects common state`);
				break;
			}
			case 'dsdw': // drop shadow (see See Effects layer, drop shadow and inner shadow info)
			case 'isdw': { // inner shadow (see See Effects layer, drop shadow and inner shadow info)
				const blockSize = readUint32(reader);
				const version = readUint32(reader);

				if (blockSize !== 41 && blockSize !== 51) throw new Error(`Invalid shadow size: ${blockSize}`);
				if (version !== 0 && version !== 2) throw new Error(`Invalid shadow version: ${version}`);

				const size = readFixedPoint32(reader);
				readFixedPoint32(reader); // intensity
				const angle = readFixedPoint32(reader);
				const distance = readFixedPoint32(reader);
				const color = readColor(reader);
				const blendMode = readBlendMode(reader);
				const enabled = !!readUint8(reader);
				const useGlobalLight = !!readUint8(reader);
				const opacity = readFixedPoint8(reader);
				if (blockSize >= 51) readColor(reader); // native color
				const shadowInfo: LayerEffectShadow = {
					size: { units: 'Pixels', value: size },
					distance: { units: 'Pixels', value: distance },
					angle, color, blendMode, enabled, useGlobalLight, opacity
				};

				if (type === 'dsdw') {
					effects.dropShadow = shadowInfo;
				} else {
					effects.innerShadow = shadowInfo;
				}
				break;
			}
			case 'oglw': { // outer glow (see See Effects layer, outer glow info)
				const blockSize = readUint32(reader);
				const version = readUint32(reader);

				if (blockSize !== 32 && blockSize !== 42) throw new Error(`Invalid outer glow size: ${blockSize}`);
				if (version !== 0 && version !== 2) throw new Error(`Invalid outer glow version: ${version}`);

				const size = readFixedPoint32(reader);
				readFixedPoint32(reader); // intensity
				const color = readColor(reader);
				const blendMode = readBlendMode(reader);
				const enabled = !!readUint8(reader);
				const opacity = readFixedPoint8(reader);
				if (blockSize >= 42) readColor(reader); // native color

				effects.outerGlow = {
					size: { units: 'Pixels', value: size },
					color, blendMode, enabled, opacity
				};
				break;
			}
			case 'iglw': { // inner glow (see See Effects layer, inner glow info)
				const blockSize = readUint32(reader);
				const version = readUint32(reader);

				if (blockSize !== 32 && blockSize !== 43) throw new Error(`Invalid inner glow size: ${blockSize}`);
				if (version !== 0 && version !== 2) throw new Error(`Invalid inner glow version: ${version}`);

				const size = readFixedPoint32(reader);
				readFixedPoint32(reader); // intensity
				const color = readColor(reader);
				const blendMode = readBlendMode(reader);
				const enabled = !!readUint8(reader);
				const opacity = readFixedPoint8(reader);

				if (blockSize >= 43) {
					readUint8(reader); // inverted
					readColor(reader); // native color
				}

				effects.innerGlow = {
					size: { units: 'Pixels', value: size },
					color, blendMode, enabled, opacity
				};
				break;
			}
			case 'bevl': { // bevel (see See Effects layer, bevel info)
				const blockSize = readUint32(reader);
				const version = readUint32(reader);

				if (blockSize !== 58 && blockSize !== 78) throw new Error(`Invalid bevel size: ${blockSize}`);
				if (version !== 0 && version !== 2) throw new Error(`Invalid bevel version: ${version}`);

				const angle = readFixedPoint32(reader);
				const strength = readFixedPoint32(reader);
				const size = readFixedPoint32(reader);
				const highlightBlendMode = readBlendMode(reader);
				const shadowBlendMode = readBlendMode(reader);
				const highlightColor = readColor(reader);
				const shadowColor = readColor(reader);
				const style = bevelStyles[readUint8(reader)] || 'inner bevel';
				const highlightOpacity = readFixedPoint8(reader);
				const shadowOpacity = readFixedPoint8(reader);
				const enabled = !!readUint8(reader);
				const useGlobalLight = !!readUint8(reader);
				const direction = readUint8(reader) ? 'down' : 'up';

				if (blockSize >= 78) {
					readColor(reader); // real highlight color
					readColor(reader); // real shadow color
				}

				effects.bevel = {
					size: { units: 'Pixels', value: size },
					angle, strength, highlightBlendMode, shadowBlendMode, highlightColor, shadowColor,
					style, highlightOpacity, shadowOpacity, enabled, useGlobalLight, direction,
				};
				break;
			}
			case 'sofi': { // solid fill (Photoshop 7.0) (see See Effects layer, solid fill (added in Photoshop 7.0))
				const size = readUint32(reader);
				const version = readUint32(reader);

				if (size !== 34) throw new Error(`Invalid effects solid fill info size: ${size}`);
				if (version !== 2) throw new Error(`Invalid effects solid fill info version: ${version}`);

				const blendMode = readBlendMode(reader);
				const color = readColor(reader);
				const opacity = readFixedPoint8(reader);
				const enabled = !!readUint8(reader);
				readColor(reader); // native color

				effects.solidFill = { blendMode, color, opacity, enabled };
				break;
			}
			default:
				throw new Error(`Invalid effect type: '${type}'`);
		}
	}

	return effects;
}

function writeShadowInfo(writer: PsdWriter, shadow: LayerEffectShadow) {
	writeUint32(writer, 51);
	writeUint32(writer, 2);
	writeFixedPoint32(writer, shadow.size?.value || 0);
	writeFixedPoint32(writer, 0); // intensity
	writeFixedPoint32(writer, shadow.angle || 0);
	writeFixedPoint32(writer, shadow.distance?.value || 0);
	writeColor(writer, shadow.color);
	writeBlendMode(writer, shadow.blendMode);
	writeUint8(writer, shadow.enabled ? 1 : 0);
	writeUint8(writer, shadow.useGlobalLight ? 1 : 0);
	writeFixedPoint8(writer, shadow.opacity ?? 1);
	writeColor(writer, shadow.color); // native color
}

export function writeEffects(writer: PsdWriter, effects: LayerEffectsInfo) {
	writeUint16(writer, 0);

	let count = 1;
	if (effects.dropShadow) count++;
	if (effects.innerShadow) count++;
	if (effects.outerGlow) count++;
	if (effects.innerGlow) count++;
	if (effects.bevel) count++;
	if (effects.solidFill) count++;

	writeUint16(writer, count);

	writeSignature(writer, '8BIM');
	writeSignature(writer, 'cmnS');
	writeUint32(writer, 7); // size
	writeUint32(writer, 0); // version
	writeUint8(writer, 1); // visible
	writeZeros(writer, 2);

	if (effects.dropShadow) {
		writeSignature(writer, '8BIM');
		writeSignature(writer, 'dsdw');
		writeShadowInfo(writer, effects.dropShadow);
	}

	if (effects.innerShadow) {
		writeSignature(writer, '8BIM');
		writeSignature(writer, 'isdw');
		writeShadowInfo(writer, effects.innerShadow);
	}

	if (effects.outerGlow) {
		writeSignature(writer, '8BIM');
		writeSignature(writer, 'oglw');
		writeUint32(writer, 42);
		writeUint32(writer, 2);
		writeFixedPoint32(writer, effects.outerGlow.size?.value || 0);
		writeFixedPoint32(writer, 0); // intensity
		writeColor(writer, effects.outerGlow.color);
		writeBlendMode(writer, effects.outerGlow.blendMode);
		writeUint8(writer, effects.outerGlow.enabled ? 1 : 0);
		writeFixedPoint8(writer, effects.outerGlow.opacity || 0);
		writeColor(writer, effects.outerGlow.color);
	}

	if (effects.innerGlow) {
		writeSignature(writer, '8BIM');
		writeSignature(writer, 'iglw');
		writeUint32(writer, 43);
		writeUint32(writer, 2);
		writeFixedPoint32(writer, effects.innerGlow.size?.value || 0);
		writeFixedPoint32(writer, 0); // intensity
		writeColor(writer, effects.innerGlow.color);
		writeBlendMode(writer, effects.innerGlow.blendMode);
		writeUint8(writer, effects.innerGlow.enabled ? 1 : 0);
		writeFixedPoint8(writer, effects.innerGlow.opacity || 0);
		writeUint8(writer, 0); // inverted
		writeColor(writer, effects.innerGlow.color);
	}

	if (effects.bevel) {
		writeSignature(writer, '8BIM');
		writeSignature(writer, 'bevl');
		writeUint32(writer, 78);
		writeUint32(writer, 2);
		writeFixedPoint32(writer, effects.bevel.angle || 0);
		writeFixedPoint32(writer, effects.bevel.strength || 0);
		writeFixedPoint32(writer, effects.bevel.size?.value || 0);
		writeBlendMode(writer, effects.bevel.highlightBlendMode);
		writeBlendMode(writer, effects.bevel.shadowBlendMode);
		writeColor(writer, effects.bevel.highlightColor);
		writeColor(writer, effects.bevel.shadowColor);
		const style = bevelStyles.indexOf(effects.bevel.style!);
		writeUint8(writer, style <= 0 ? 1 : style);
		writeFixedPoint8(writer, effects.bevel.highlightOpacity || 0);
		writeFixedPoint8(writer, effects.bevel.shadowOpacity || 0);
		writeUint8(writer, effects.bevel.enabled ? 1 : 0);
		writeUint8(writer, effects.bevel.useGlobalLight ? 1 : 0);
		writeUint8(writer, effects.bevel.direction === 'down' ? 1 : 0);
		writeColor(writer, effects.bevel.highlightColor);
		writeColor(writer, effects.bevel.shadowColor);
	}

	if (effects.solidFill) {
		writeSignature(writer, '8BIM');
		writeSignature(writer, 'sofi');
		writeUint32(writer, 34);
		writeUint32(writer, 2);
		writeBlendMode(writer, effects.solidFill.blendMode);
		writeColor(writer, effects.solidFill.color);
		writeFixedPoint8(writer, effects.solidFill.opacity || 0);
		writeUint8(writer, effects.solidFill.enabled ? 1 : 0);
		writeColor(writer, effects.solidFill.color);
	}
}
