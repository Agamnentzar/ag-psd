import { createReader, PsdReader, readFloat32, readSignature, readUint16, readUint32, readUnicodeStringWithLength } from './psdReader';

export type AseColorType = 'global' | 'spot' | 'normal';

export interface AseColor {
  name: string;
  color: {
    r: number;
    g: number;
    b: number;
    type: AseColorType;
  } | {
    c: number;
    m: number;
    y: number;
    k: number;
    type: AseColorType;
  } | {
    k: number;
    type: AseColorType;
  } | {
    l: number;
    a: number;
    b: number;
    type: AseColorType;
  };
}

export interface AseGroup {
  name: string;
  colors: AseColor[];
}

export interface Ase {
  colors: (AseGroup | AseColor)[];
}

export interface ReadAseOptions {
  logMissingFeatures?: boolean;
  /** Throw on unsupported or invalid blocks instead of skipping them */
  throwForMissingFeatures?: boolean;
}

export function readAse(buffer: ArrayBufferView, options: ReadAseOptions = {}): Ase {
  const reader = createReader(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const signature = readSignature(reader); // ASEF
  if (signature !== 'ASEF') throw new Error('Invalid signature');
  const versionMajor = readUint16(reader); // 1
  readUint16(reader); // minor version: 0
  if (versionMajor !== 1) throw new Error('Invalid version');
  const blocksCount = readUint32(reader);
  const ase: Ase = { colors: [] };
  let group: Ase | AseGroup = ase;

  for (let i = 0; i < blocksCount && reader.offset + 6 <= reader.view.byteLength; i++) {
    const type = readUint16(reader);
    const length = readUint32(reader);
    const end = Math.min(reader.offset + length, reader.view.byteLength);
    // block reader, so invalid lengths can't make us read data of following blocks
    const block = createReader(reader.view.buffer, reader.view.byteOffset + reader.offset, end - reader.offset);

    try {
      switch (type) {
        case 0x0001: { // color
          const color = readAseColor(block);
          if (color) {
            group.colors.push(color);
          } else {
            if (options.throwForMissingFeatures) throw new Error('Unsupported color mode');
            options.logMissingFeatures && reader.log('Skipped color with unsupported color mode');
          }
          break;
        }
        case 0xC001: { // group start
          const nameLength = readUint16(block);
          const name = readUnicodeStringWithLength(block, nameLength);
          ase.colors.push(group = { name, colors: [] });
          break;
        }
        case 0xC002: // group end
          group = ase;
          break;
        default:
          if (options.throwForMissingFeatures) throw new Error(`Invalid block type: ${type}`);
          options.logMissingFeatures && reader.log(`Skipped unknown block type: ${type}`);
      }
    } catch (e) {
      if (options.throwForMissingFeatures) throw e;
      options.logMissingFeatures && reader.log(`Skipped invalid block: ${(e as Error).message}`);
    }

    reader.offset = end;
  }

  return ase;
}

function readAseColor(reader: PsdReader): AseColor | undefined {
  const nameLength = readUint16(reader);
  const name = readUnicodeStringWithLength(reader, nameLength);
  const colorMode = readSignature(reader);
  // NaN and infinite values are replaced with 0
  const value = () => {
    const v = readFloat32(reader);
    return isFinite(v) ? v : 0;
  };
  // color type is sometimes missing, unknown types are treated as process (normal) colors
  const colorType = () => {
    const index = reader.offset + 2 <= reader.view.byteLength ? readUint16(reader) : 2;
    return colorTypes[index] || 'normal';
  };

  switch (colorMode) {
    case 'RGB ': return { name, color: { r: value(), g: value(), b: value(), type: colorType() } };
    case 'CMYK': return { name, color: { c: value(), m: value(), y: value(), k: value(), type: colorType() } };
    case 'Gray': return { name, color: { k: value(), type: colorType() } };
    case 'LAB ': return { name, color: { l: value(), a: value(), b: value(), type: colorType() } };
    default: return undefined;
  }
}

const colorTypes: AseColorType[] = ['global', 'spot', 'normal'];
