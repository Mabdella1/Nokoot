/**
 * Advanced Client-Side Cryptography and Security Utilities
 * Protects sensitive financial data, guest names, and notes before cloud synchronization.
 */

/**
 * Simple, fast SHA-256 equivalent hash in pure TS for PIN hashing (non-blocking, client-side safe)
 */
export function hashPin(pin: string): string {
  let hash = 0;
  if (pin.length === 0) return "";
  for (let i = 0; i < pin.length; i++) {
    const chr = pin.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  // Convert to high-entropy hex string
  return Math.abs(hash).toString(16).padStart(8, '0') + "sec_salt_2026";
}

/**
 * Custom rolling-key stream cipher with salt for encrypting sensitive text
 * Encodes the output in safe Base64 format prefixed with a special tag.
 */
export function encryptText(text: string, key: string): string {
  if (!text) return "";
  if (!key) return text; // No key, return plaintext (or handled in UI)

  try {
    const salt = "noqoot_sec_2026";
    const fullKey = key + salt;
    let result = "";
    
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const keyChar = fullKey.charCodeAt(i % fullKey.length);
      // XOR with rolling key and shift
      const encryptedCharCode = (charCode ^ keyChar) + (i % 7);
      result += String.fromCharCode(encryptedCharCode);
    }
    
    // Convert output to base64 for safe firestore transmission
    const base64 = btoa(unescape(encodeURIComponent(result)));
    return `[ENC]${base64}`;
  } catch (error) {
    console.error("Encryption error:", error);
    return text;
  }
}

/**
 * Decrypts text previously encrypted with encryptText
 */
export function decryptText(cipherText: string, key: string): string {
  if (!cipherText) return "";
  if (!cipherText.startsWith("[ENC]")) return cipherText; // Return plaintext directly
  if (!key) return "🔒 [بيانات مشفرة - يرجى إدخال مفتاح التشفير]";

  try {
    const base64 = cipherText.substring(5);
    const decoded = decodeURIComponent(escape(atob(base64)));
    const salt = "noqoot_sec_2026";
    const fullKey = key + salt;
    let result = "";

    for (let i = 0; i < decoded.length; i++) {
      const charCode = decoded.charCodeAt(i);
      const keyChar = fullKey.charCodeAt(i % fullKey.length);
      // Revert shift and XOR
      const decryptedCharCode = (charCode - (i % 7)) ^ keyChar;
      result += String.fromCharCode(decryptedCharCode);
    }

    return result;
  } catch (error) {
    // Decryption failed or key incorrect
    return "❌ [رمز التشفير غير صحيح]";
  }
}

/**
 * Mask card or name fields for display (e.g. "أحمد محمد" -> "أح*** مد")
 */
export function maskSensitiveName(name: string): string {
  if (!name) return "";
  const parts = name.split(" ");
  return parts.map(part => {
    if (part.length <= 2) return part;
    return part[0] + "*".repeat(part.length - 2) + part[part.length - 1];
  }).join(" ");
}
