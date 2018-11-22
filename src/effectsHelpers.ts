import {
	LayerEffectsInfo, LayerEffectsBevelInfo, LayerEffectsInnerGlowInfo, LayerEffectsOuterGlowInfo,
	LayerEffectsShadowInfo, LayerEffectsSolidFillInfo
} from './psd';
import { readColor } from './helpers';
import { PsdReader, checkSignature, readSignature, skipBytes, readUint16, readUint8, readUint32, readInt32 } from './psdReader';
import { PsdWriter } from './psdWriter';

function readBlendMode(reader: PsdReader) {
	checkSignature(reader, '8BIM');
	return readSignature(reader);
}

function readShadowInfo(reader: PsdReader): LayerEffectsShadowInfo {
	const size = readUint32(reader);
	const version = readUint32(reader);

	if (size !== 41 && size !== 51)
		throw new Error(`Invalid effects shadow info size: ${size}`);

	if (version !== 0 && version !== 2)
		throw new Error(`Invalid effects shadow info version: ${version}`);

	const blur = readInt32(reader);
	const intensity = readInt32(reader);
	const angle = readInt32(reader);
	const distance = readInt32(reader);
	const color = readColor(reader);
	const blendMode = readBlendMode(reader);
	const enabled = !!readUint8(reader);
	const useAngleInAllEffects = !!readUint8(reader);
	const opacity = readUint8(reader);
	const nativeColor = size >= 51 ? readColor(reader) : undefined;

	return { blur, intensity, angle, distance, color, blendMode, enabled, useAngleInAllEffects, opacity, nativeColor };
}

function readOuterGlowInfo(reader: PsdReader): LayerEffectsOuterGlowInfo {
	const size = readUint32(reader);
	const version = readUint32(reader);

	if (size !== 32 && size !== 42)
		throw new Error(`Invalid effects outer glow info size: ${size}`);

	if (version !== 0 && version !== 2)
		throw new Error(`Invalid effects outer glow info version: ${version}`);

	const blur = readUint32(reader);
	const intensity = readUint32(reader);
	const color = readColor(reader);
	const blendMode = readBlendMode(reader);
	const enabled = !!readUint8(reader);
	const opacity = readUint8(reader);
	const nativeColor = size >= 42 ? readColor(reader) : undefined;

	return { blur, intensity, color, blendMode, enabled, opacity, nativeColor };
}

function readInnerGlowInfo(reader: PsdReader): LayerEffectsInnerGlowInfo {
	const size = readUint32(reader);
	const version = readUint32(reader);

	if (size !== 33 && size !== 43)
		throw new Error(`Invalid effects inner glow info size: ${size}`);

	if (version !== 0 && version !== 2)
		throw new Error(`Invalid effects inner glow info version: ${version}`);

	const blur = readUint32(reader);
	const intensity = readUint32(reader);
	const color = readColor(reader);
	const blendMode = readBlendMode(reader);
	const enabled = !!readUint8(reader);
	const opacity = readUint8(reader);

	const invert = size >= 43 ? !!readUint8(reader) : undefined;
	const nativeColor = size >= 43 ? readColor(reader) : undefined;

	return { blur, intensity, color, blendMode, enabled, opacity, invert, nativeColor };
}

function readBevelInfo(reader: PsdReader): LayerEffectsBevelInfo {
	const size = readUint32(reader);
	const version = readUint32(reader);

	if (size !== 58 && size !== 78)
		throw new Error(`Invalid effects bevel info size: ${size}`);

	if (version !== 0 && version !== 2)
		throw new Error(`Invalid effects bevel info version: ${version}`);

	const angle = readUint32(reader);
	const strength = readUint32(reader);
	const blur = readUint32(reader);
	const highlightBlendMode = readBlendMode(reader);
	const shadowBlendMode = readBlendMode(reader);
	const highlightColor = readColor(reader);
	const shadowColor = readColor(reader);
	const bevelStyle = readUint8(reader);
	const highlightOpacity = readUint8(reader);
	const shadowOpacity = readUint8(reader);
	const enabled = !!readUint8(reader);
	const useAngleInAllEffects = !!readUint8(reader);
	const up = !!readUint8(reader);

	const realHighlightColor = size >= 78 ? readColor(reader) : undefined;
	const realShadowColor = size >= 78 ? readColor(reader) : undefined;

	return {
		angle, strength, blur, highlightBlendMode, shadowBlendMode, highlightColor, shadowColor,
		bevelStyle, highlightOpacity, shadowOpacity, enabled, useAngleInAllEffects, up,
		realHighlightColor, realShadowColor
	};
}

function readSolidFillInfo(reader: PsdReader): LayerEffectsSolidFillInfo {
	const size = readUint32(reader);
	const version = readUint32(reader);

	if (size !== 34)
		throw new Error(`Invalid effects solid fill info size: ${size}`);

	if (version !== 2)
		throw new Error(`Invalid effects solid fill info version: ${version}`);

	const blendMode = readBlendMode(reader);
	const color = readColor(reader);
	const opacity = readUint8(reader);
	const enabled = !!readUint8(reader);
	const nativeColor = readColor(reader);

	return { blendMode, color, opacity, enabled, nativeColor };
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
			case 'cmnS': // common state (see See Effects layer, common state info)
				const size = readUint32(reader);
				const version = readUint32(reader);
				const visible = !!readUint8(reader);
				skipBytes(reader, 2);

				if (size !== 7 || version !== 0 || !visible)
					throw new Error(`Invalid effects common state`);
				break;
			case 'dsdw': // drop shadow (see See Effects layer, drop shadow and inner shadow info)
				effects.dropShadow = readShadowInfo(reader);
				break;
			case 'isdw': // inner shadow (see See Effects layer, drop shadow and inner shadow info)
				effects.innerShadow = readShadowInfo(reader);
				break;
			case 'oglw': // outer glow (see See Effects layer, outer glow info)
				effects.outerGlow = readOuterGlowInfo(reader);
				break;
			case 'iglw': // inner glow (see See Effects layer, inner glow info)
				effects.innerGlow = readInnerGlowInfo(reader);
				break;
			case 'bevl': // bevel (see See Effects layer, bevel info)
				effects.bevel = readBevelInfo(reader);
				break;
			case 'sofi': // solid fill ( Photoshop 7.0) (see See Effects layer, solid fill (added in Photoshop 7.0))
				effects.solidFill = readSolidFillInfo(reader);
				break;
			default:
				throw new Error(`Invalid effect type: '${type}'`);
		}
	}

	return effects;
}

export function writeEffects(_writer: PsdWriter, _effects: LayerEffectsInfo) {
	throw new Error('Not implemented');
}
