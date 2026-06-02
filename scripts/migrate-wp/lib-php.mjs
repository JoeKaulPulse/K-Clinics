// Minimal PHP unserialize() — enough for Contact Form 7 DB (db7) form_value
// blobs: handles N, b, i, d, s, a and O (objects treated as maps). Parses over
// a UTF-8 buffer so the byte-length prefixes on strings line up with multibyte
// (e.g. Cyrillic) content. Returns null on anything it can't parse.

export function phpUnserialize(input) {
  const buf = Buffer.from(String(input ?? ''), 'utf8');
  let i = 0;
  const code = (ch) => ch.charCodeAt(0);
  const expect = (ch) => { if (buf[i] !== code(ch)) throw new Error(`expected '${ch}' at ${i}`); i++; };
  const readUntil = (ch) => { let j = i; while (j < buf.length && buf[j] !== code(ch)) j++; const s = buf.toString('utf8', i, j); i = j; return s; };

  function parse() {
    const type = String.fromCharCode(buf[i]);
    if (type === 'N') { i += 2; return null; }      // N;
    i++; expect(':');
    if (type === 'b') { const v = buf[i] === code('1'); i++; expect(';'); return v; }
    if (type === 'i') { const s = readUntil(';'); expect(';'); return parseInt(s, 10); }
    if (type === 'd') { const s = readUntil(';'); expect(';'); return parseFloat(s); }
    if (type === 's') {
      const len = parseInt(readUntil(':'), 10); expect(':'); expect('"');
      const s = buf.toString('utf8', i, i + len); i += len; expect('"'); expect(';');
      return s;
    }
    if (type === 'a') {
      const n = parseInt(readUntil(':'), 10); expect(':'); expect('{');
      const obj = {};
      for (let k = 0; k < n; k++) { const key = parse(); obj[key] = parse(); }
      expect('}'); return obj;
    }
    if (type === 'O') {
      const len = parseInt(readUntil(':'), 10); expect(':'); expect('"'); i += len; expect('"'); expect(':');
      const n = parseInt(readUntil(':'), 10); expect(':'); expect('{');
      const obj = {};
      for (let k = 0; k < n; k++) { const key = parse(); obj[key] = parse(); }
      expect('}'); return obj;
    }
    throw new Error(`unknown type '${type}' at ${i}`);
  }
  try { return parse(); } catch { return null; }
}
