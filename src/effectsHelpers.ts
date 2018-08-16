import { LayerEffectsInfo, LayerEffectsBevelInfo, LayerEffectsInnerGlowInfo, LayerEffectsOuterGlowInfo, LayerEffectsShadowInfo, LayerEffectsSolidFillInfo } from './psd';
import { readColor } from './helpers';
import { PsdReader } from './psdReader';
import { PsdWriter } from './psdWriter';

function readBlendMode(reader: PsdReader) {
	reader.checkSignature('8BIM');
	return reader.readSignature();
}

function readShadowInfo(reader: PsdReader): LayerEffectsShadowInfo {
	const size = reader.readUint32();
	const version = reader.readUint32();

	if (size !== 41 && size !== 51)
		throw new Error(`Invalid effects shadow info size: ${size}`);

	if (version !== 0 && version !== 2)
		throw new Error(`Invalid effects shadow info version: ${version}`);

	const blur = reader.readInt32();
	const intensity = reader.readInt32();
	const angle = reader.readInt32();
	const distance = reader.readInt32();
	const color = readColor(reader);
	const blendMode = readBlendMode(reader);
	const enabled = !!reader.readUint8();
	const useAngleInAllEffects = !!reader.readUint8();
	const opacity = reader.readUint8();
	const nativeColor = size >= 51 ? readColor(reader) : undefined;

	return { blur, intensity, angle, distance, color, blendMode, enabled, useAngleInAllEffects, opacity, nativeColor };
}

function readOuterGlowInfo(reader: PsdReader): LayerEffectsOuterGlowInfo {
	const size = reader.readUint32();
	const version = reader.readUint32();

	if (size !== 32 && size !== 42)
		throw new Error(`Invalid effects outer glow info size: ${size}`);

	if (version !== 0 && version !== 2)
		throw new Error(`Invalid effects outer glow info version: ${version}`);

	const blur = reader.readUint32();
	const intensity = reader.readUint32();
	const color = readColor(reader);
	const blendMode = readBlendMode(reader);
	const enabled = !!reader.readUint8();
	const opacity = reader.readUint8();
	const nativeColor = size >= 42 ? readColor(reader) : undefined;

	return { blur, intensity, color, blendMode, enabled, opacity, nativeColor };
}

function readInnerGlowInfo(reader: PsdReader): LayerEffectsInnerGlowInfo {
	const size = reader.readUint32();
	const version = reader.readUint32();

	if (size !== 33 && size !== 43)
		throw new Error(`Invalid effects inner glow info size: ${size}`);

	if (version !== 0 && version !== 2)
		throw new Error(`Invalid effects inner glow info version: ${version}`);

	const blur = reader.readUint32();
	const intensity = reader.readUint32();
	const color = readColor(reader);
	const blendMode = readBlendMode(reader);
	const enabled = !!reader.readUint8();
	const opacity = reader.readUint8();

	const invert = size >= 43 ? !!reader.readUint8() : undefined;
	const nativeColor = size >= 43 ? readColor(reader) : undefined;

	return { blur, intensity, color, blendMode, enabled, opacity, invert, nativeColor };
}

function readBevelInfo(reader: PsdReader): LayerEffectsBevelInfo {
	const size = reader.readUint32();
	const version = reader.readUint32();

	if (size !== 58 && size !== 78)
		throw new Error(`Invalid effects bevel info size: ${size}`);

	if (version !== 0 && version !== 2)
		throw new Error(`Invalid effects bevel info version: ${version}`);

	const angle = reader.readUint32();
	const strength = reader.readUint32();
	const blur = reader.readUint32();
	const highlightBlendMode = readBlendMode(reader);
	const shadowBlendMode = readBlendMode(reader);
	const highlightColor = readColor(reader);
	const shadowColor = readColor(reader);
	const bevelStyle = reader.readUint8();
	const highlightOpacity = reader.readUint8();
	const shadowOpacity = reader.readUint8();
	const enabled = !!reader.readUint8();
	const useAngleInAllEffects = !!reader.readUint8();
	const up = !!reader.readUint8();

	const realHighlightColor = size >= 78 ? readColor(reader) : undefined;
	const realShadowColor = size >= 78 ? readColor(reader) : undefined;

	return {
		angle, strength, blur, highlightBlendMode, shadowBlendMode, highlightColor, shadowColor,
		bevelStyle, highlightOpacity, shadowOpacity, enabled, useAngleInAllEffects, up,
		realHighlightColor, realShadowColor
	};
}

function readSolidFillInfo(reader: PsdReader): LayerEffectsSolidFillInfo {
	const size = reader.readUint32();
	const version = reader.readUint32();

	if (size !== 34)
		throw new Error(`Invalid effects solid fill info size: ${size}`);

	if (version !== 2)
		throw new Error(`Invalid effects solid fill info version: ${version}`);

	const blendMode = readBlendMode(reader);
	const color = readColor(reader);
	const opacity = reader.readUint8();
	const enabled = !!reader.readUint8();
	const nativeColor = readColor(reader);

	return { blendMode, color, opacity, enabled, nativeColor };
}

export function readEffects(reader: PsdReader) {
	const version = reader.readUint16();

	if (version !== 0)
		throw new Error(`Invalid effects layer version: ${version}`);

	const effectsCount = reader.readUint16();
	const effects: LayerEffectsInfo = <any>{};

	for (let i = 0; i < effectsCount; i++) {
		reader.checkSignature('8BIM');
		const type = reader.readSignature();

		switch (type) {
			case 'cmnS': // common state (see See Effects layer, common state info)
				const size = reader.readUint32();
				const version = reader.readUint32();
				const visible = !!reader.readUint8();
				reader.skip(2);

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
