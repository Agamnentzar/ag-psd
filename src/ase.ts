import { createReader, readFloat32, readSignature, readUint16, readUint32, readUnicodeStringWithLength } from './psdReader';

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

export function readAse(buffer: ArrayBufferView): Ase {
  const reader = createReader(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const signature = readSignature(reader); // ASEF
  if (signature !== 'ASEF') throw new Error('Invalid signature');
  const versionMajor = readUint16(reader); // 1
  const versionMinor = readUint16(reader); // 0
  if (versionMajor !== 1 || versionMinor !== 0) throw new Error('Invalid version');
  const blocksCount = readUint32(reader);
  const colorTypes: AseColorType[] = ['global', 'spot', 'normal'];
  const ase: Ase = { colors: [] };
  let group: Ase | AseGroup = ase;

  for (let i = 0; i < blocksCount; i++) {
    const type = readUint16(reader);
    const length = readUint32(reader);
    const end = reader.offset + length;

    switch (type) {
      case 0x0001: { // color
        const nameLength = readUint16(reader);
        const name = readUnicodeStringWithLength(reader, nameLength);
        const colorMode = readSignature(reader);
        let color: any;
        switch (colorMode) {
          case 'RGB ':
            color = {
              r: readFloat32(reader),
              g: readFloat32(reader),
              b: readFloat32(reader),
              type: colorTypes[readUint16(reader)],
            };
            break;
          case 'CMYK':
            color = {
              c: readFloat32(reader),
              m: readFloat32(reader),
              y: readFloat32(reader),
              k: readFloat32(reader),
              type: colorTypes[readUint16(reader)],
            };
            break;
          case 'Gray':
            color = {
              k: readFloat32(reader),
              type: colorTypes[readUint16(reader)],
            };
            break;
          case 'LAB ':
            color = {
              l: readFloat32(reader),
              a: readFloat32(reader),
              b: readFloat32(reader),
              type: colorTypes[readUint16(reader)],
            };
            break;
          default:
            throw new Error('Invalid color mode');
        }
        group.colors.push({ name, color });
        break;
      }
      case 0xC001: { // group start
        const nameLength = readUint16(reader);
        const name = readUnicodeStringWithLength(reader, nameLength);
        ase.colors.push(group = { name, colors: [] });
        break;
      }
      case 0xC002: // group end
        group = ase;
        break;
      default:
        throw new Error('Invalid block type');
    }

    reader.offset = end;
  }

  return ase;
}
