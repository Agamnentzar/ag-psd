import { LayerEffectsInfo, LayerEffectsBevelInfo, LayerEffectsInnerGlowInfo, LayerEffectsOuterGlowInfo, LayerEffectsShadowInfo, LayerEffectsSolidFillInfo } from './psd';
import { readColor } from './helpers';
import { PsdReader } from './psdReader';
import { PsdWriter } from './psdWriter';

function readBlendMode(reader: PsdReader) {
	reader.checkSignature('8BIM');
	return reader.readSignature();
}

function readShadowInfo(reader: PsdReader): LayerEffectsShadowInfo {
	let size = reader.readUint32();
	let version = reader.readUint32();

	if (size !== 41 && size !== 51)
		throw new Error(`Invalid effects shadow info size: ${size}`);

	if (version !== 0 && version !== 2)
		throw new Error(`Invalid effects shadow info version: ${version}`);

	let blur = reader.readInt32();
	let intensity = reader.readInt32();
	let angle = reader.readInt32();
	let distance = reader.readInt32();
	let color = readColor(reader);
	let blendMode = readBlendMode(reader);
	let enabled = !!reader.readUint8();
	let useAngleInAllEffects = !!reader.readUint8();
	let opacity = reader.readUint8();
	let nativeColor = size >= 51 ? readColor(reader) : undefined;

	return { blur, intensity, angle, distance, color, blendMode, enabled, useAngleInAllEffects, opacity, nativeColor };
}

function readOuterGlowInfo(reader: PsdReader): LayerEffectsOuterGlowInfo {
	let size = reader.readUint32();
	let version = reader.readUint32();

	if (size !== 32 && size !== 42)
		throw new Error(`Invalid effects outer glow info size: ${size}`);

	if (version !== 0 && version !== 2)
		throw new Error(`Invalid effects outer glow info version: ${version}`);

	let blur = reader.readUint32();
	let intensity = reader.readUint32();
	let color = readColor(reader);
	let blendMode = readBlendMode(reader);
	let enabled = !!reader.readUint8();
	let opacity = reader.readUint8();
	let nativeColor = size >= 42 ? readColor(reader) : undefined;

	return { blur, intensity, color, blendMode, enabled, opacity, nativeColor };
}

function readInnerGlowInfo(reader: PsdReader): LayerEffectsInnerGlowInfo {
	let size = reader.readUint32();
	let version = reader.readUint32();

	if (size !== 33 && size !== 43)
		throw new Error(`Invalid effects inner glow info size: ${size}`);

	if (version !== 0 && version !== 2)
		throw new Error(`Invalid effects inner glow info version: ${version}`);

	let blur = reader.readUint32();
	let intensity = reader.readUint32();
	let color = readColor(reader);
	let blendMode = readBlendMode(reader);
	let enabled = !!reader.readUint8();
	let opacity = reader.readUint8();

	let invert = size >= 43 ? !!reader.readUint8() : undefined;
	let nativeColor = size >= 43 ? readColor(reader) : undefined;

	return { blur, intensity, color, blendMode, enabled, opacity, invert, nativeColor };
}

function readBevelInfo(reader: PsdReader): LayerEffectsBevelInfo {
	let size = reader.readUint32();
	let version = reader.readUint32();

	if (size !== 58 && size !== 78)
		throw new Error(`Invalid effects bevel info size: ${size}`);

	if (version !== 0 && version !== 2)
		throw new Error(`Invalid effects bevel info version: ${version}`);

	let angle = reader.readUint32();
	let strength = reader.readUint32();
	let blur = reader.readUint32();
	let highlightBlendMode = readBlendMode(reader);
	let shadowBlendMode = readBlendMode(reader);
	let highlightColor = readColor(reader);
	let shadowColor = readColor(reader);
	let bevelStyle = reader.readUint8();
	let highlightOpacity = reader.readUint8();
	let shadowOpacity = reader.readUint8();
	let enabled = !!reader.readUint8();
	let useAngleInAllEffects = !!reader.readUint8();
	let up = !!reader.readUint8();

	let realHighlightColor = size >= 78 ? readColor(reader) : undefined;
	let realShadowColor = size >= 78 ? readColor(reader) : undefined;

	return {
		angle, strength, blur, highlightBlendMode, shadowBlendMode, highlightColor, shadowColor,
		bevelStyle, highlightOpacity, shadowOpacity, enabled, useAngleInAllEffects, up,
		realHighlightColor, realShadowColor
	};
}

function readSolidFillInfo(reader: PsdReader): LayerEffectsSolidFillInfo {
	let size = reader.readUint32();
	let version = reader.readUint32();

	if (size !== 34)
		throw new Error(`Invalid effects solid fill info size: ${size}`);

	if (version !== 2)
		throw new Error(`Invalid effects solid fill info version: ${version}`);

	let blendMode = readBlendMode(reader);
	let color = readColor(reader);
	let opacity = reader.readUint8();
	let enabled = !!reader.readUint8();
	let nativeColor = readColor(reader);

	return { blendMode, color, opacity, enabled, nativeColor };
}

export function readEffects(reader: PsdReader) {
	let version = reader.readUint16();

	if (version !== 0)
		throw new Error(`Invalid effects layer version: ${version}`);

	let effectsCount = reader.readUint16();
	let effects: LayerEffectsInfo = <any>{};

	for (let i = 0; i < effectsCount; i++) {
		reader.checkSignature('8BIM');
		let type = reader.readSignature();

		switch (type) {
			case 'cmnS': // common state (see See Effects layer, common state info)
				let size = reader.readUint32();
				let version = reader.readUint32();
				let visible = !!reader.readUint8();
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

export function writeEffects(writer: PsdWriter, effects: LayerEffectsInfo) {
	throw new Error('Not implemented');
}
