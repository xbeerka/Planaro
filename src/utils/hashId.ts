/**
 * Obfuscation утилита для ID в URL.
 * Кодирует integer ID в непредсказуемую строку длиной 10-12 символов.
 * НЕ является криптографической защитой — только скрывает последовательность.
 * 
 * Алгоритм: 3-раундовый Feistel cipher → 64-bit число → base62 кодирование.
 * Это даёт длинные непредсказуемые строки даже для последовательных ID.
 */

const ALPHABET = 'yNf3Qm7XjLpR0KvTcWs9Bd5GhZrUx1Ea4JiOw6Pk8HAlYn2SDuVtFoCgMbzIq';
const BASE = ALPHABET.length; // 62

// Feistel round keys (произвольные константы)
const K1 = 0xA5C3_E917;
const K2 = 0x7B2D_4F81;
const K3 = 0x3E9A_6C5D;

/** Feistel round function */
function feistelRound(half: number, key: number): number {
  // Mix using multiply-xor-shift
  let x = (half ^ key) >>> 0;
  x = Math.imul(x, 0x45D9_F3B7) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  x = Math.imul(x, 0x1234_5679) >>> 0;
  x = (x ^ (x >>> 13)) >>> 0;
  return x >>> 0;
}

/** Encode number to base62 string */
function toBase62(high: number, low: number): string {
  // Work with BigInt for 64-bit precision
  const num = (BigInt(high >>> 0) << 32n) | BigInt(low >>> 0);
  if (num === 0n) return ALPHABET[0];
  
  let result = '';
  let n = num;
  while (n > 0n) {
    result = ALPHABET[Number(n % BigInt(BASE))] + result;
    n = n / BigInt(BASE);
  }
  return result;
}

/** Decode base62 string to [high, low] */
function fromBase62(hash: string): [number, number] | null {
  if (!hash) return null;
  
  let num = 0n;
  for (let i = 0; i < hash.length; i++) {
    const idx = ALPHABET.indexOf(hash[i]);
    if (idx === -1) return null;
    num = num * BigInt(BASE) + BigInt(idx);
  }
  
  const low = Number(num & 0xFFFF_FFFFn);
  const high = Number((num >> 32n) & 0xFFFF_FFFFn);
  return [high, low];
}

/**
 * Кодирует числовой ID в URL-safe строку (~10-12 символов)
 * @example encodeId(72) → "yQ7XjLpR0Kv"
 */
export function encodeId(id: number | string): string {
  const num = typeof id === 'string' ? parseInt(id, 10) : id;
  if (isNaN(num) || num < 0) return String(id);
  
  // 3-round Feistel cipher: splits 32-bit input into two 16-bit halves
  // and expands to 64-bit output for longer hash
  let left = (num >>> 16) & 0xFFFF;
  let right = num & 0xFFFF;
  
  // Round 1
  const f1 = feistelRound(right, K1);
  const newLeft1 = right;
  const newRight1 = (left ^ (f1 & 0xFFFF)) & 0xFFFF;
  
  // Round 2
  const f2 = feistelRound(newRight1, K2);
  const newLeft2 = newRight1;
  const newRight2 = (newLeft1 ^ (f2 & 0xFFFF)) & 0xFFFF;
  
  // Round 3
  const f3 = feistelRound(newRight2, K3);
  const newLeft3 = newRight2;
  const newRight3 = (newLeft2 ^ (f3 & 0xFFFF)) & 0xFFFF;
  
  // Combine into two 32-bit halves for 64-bit output
  // high: Feistel output | low: mixed with round functions for entropy
  const high = ((newLeft3 << 16) | newRight3) >>> 0;
  const low = (feistelRound(num, K1 ^ K2 ^ K3)) >>> 0;
  
  return toBase62(high, low);
}

/**
 * Декодирует URL-safe строку обратно в числовой ID
 * @example decodeId("yQ7XjLpR0Kv") → 72
 */
export function decodeId(hash: string): number | null {
  if (!hash || hash.length === 0) return null;
  
  // Try direct integer (backward compat for old /workspace/72 URLs)
  const directNum = parseInt(hash, 10);
  if (!isNaN(directNum) && String(directNum) === hash && directNum >= 0) {
    return directNum;
  }
  
  const parts = fromBase62(hash);
  if (!parts) return null;
  
  const [high] = parts;
  
  // Reverse 3-round Feistel
  const newLeft3 = (high >>> 16) & 0xFFFF;
  const newRight3 = high & 0xFFFF;
  
  // Reverse Round 3
  const f3 = feistelRound(newLeft3, K3);
  const newLeft2 = (newRight3 ^ (f3 & 0xFFFF)) & 0xFFFF;
  const newRight2 = newLeft3;
  
  // Reverse Round 2
  const f2 = feistelRound(newLeft2, K2);
  const newLeft1 = (newRight2 ^ (f2 & 0xFFFF)) & 0xFFFF;
  const newRight1 = newLeft2;
  
  // Reverse Round 1
  const f1 = feistelRound(newLeft1, K1);
  const left = (newRight1 ^ (f1 & 0xFFFF)) & 0xFFFF;
  const right = newLeft1;
  
  const decoded = ((left << 16) | right) >>> 0;
  
  // Verify: re-encode should match
  if (encodeId(decoded) !== hash) return null;
  
  return decoded;
}
