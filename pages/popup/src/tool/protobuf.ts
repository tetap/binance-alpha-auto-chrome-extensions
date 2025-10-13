// Base32 编码函数（RFC 4648）
export const base32Encode = (bytes: Uint8Array) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let output = '';
  let buffer = 0,
    bitsLeft = 0;

  for (let i = 0; i < bytes.length; i++) {
    buffer = (buffer << 8) | bytes[i];
    bitsLeft += 8;
    while (bitsLeft >= 5) {
      const index = (buffer >> (bitsLeft - 5)) & 0x1f;
      output += alphabet[index];
      bitsLeft -= 5;
    }
  }

  if (bitsLeft > 0) {
    const index = (buffer << (5 - bitsLeft)) & 0x1f;
    output += alphabet[index];
  }

  // 可选：填充 "="，Google Authenticator 不需要
  return output;
};

export const readVarint = (bytes: Uint8Array, offset: number) => {
  let result = 0,
    shift = 0,
    pos = offset;
  while (true) {
    const b = bytes[pos++];
    result |= (b & 0x7f) << shift;
    if (!(b & 0x80)) break;
    shift += 7;
  }
  return { value: result, length: pos - offset };
};

export const parseMigrationQRCode = (qrURL: string) => {
  const base64Data = new URL(qrURL).searchParams.get('data');
  if (!base64Data) throw new Error('二维码内容错误，请重新扫描');
  const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

  const accounts: { secretBytes?: Uint8Array; name?: string; issuer?: string }[] = [];
  let pos = 0;
  while (pos < bytes.length) {
    const tag = bytes[pos++];
    const field = tag >> 3,
      wireType = tag & 0x7;

    if (field === 1 && wireType === 2) {
      // otp_parameters
      const lenInfo = readVarint(bytes, pos);
      const len = lenInfo.value;
      pos += lenInfo.length;
      const paramBytes = bytes.slice(pos, pos + len);
      pos += len;

      let pPos = 0;
      const account: { secretBytes?: Uint8Array; name?: string; issuer?: string } = {};
      while (pPos < paramBytes.length) {
        const t = paramBytes[pPos++];
        const f = t >> 3,
          w = t & 0x7;

        if (w === 2) {
          // string / bytes
          const lInfo = readVarint(paramBytes, pPos);
          const l = lInfo.value;
          pPos += lInfo.length;
          const raw = paramBytes.slice(pPos, pPos + l);
          pPos += l;

          if (f === 1) account.secretBytes = raw; // 保留原始 bytes
          if (f === 2) account.name = new TextDecoder().decode(raw);
          if (f === 3) account.issuer = new TextDecoder().decode(raw);
        }
      }
      accounts.push(account);
    } else {
      if (wireType === 2) {
        const lInfo = readVarint(bytes, pos);
        pos += lInfo.length + lInfo.value;
      }
    }
  }
  return accounts;
};
