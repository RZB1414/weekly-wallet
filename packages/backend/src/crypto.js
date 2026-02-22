/**
 * Weekly Wallet — Crypto Utilities
 * 
 * Algorithms:
 *   - Password Hashing: scrypt (N=2^17, r=8, p=1) via node:crypto
 *   - Key Derivation: HKDF-SHA256 via Web Crypto API
 *   - Data Encryption: AES-256-GCM via Web Crypto API
 *   - Envelope Encryption: Random DEK wrapped with password-derived + recovery keys
 */

import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function toBase64(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function fromBase64(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function scryptAsync(password, salt, keylen, options) {
    return new Promise((resolve, reject) => {
        scrypt(password, salt, keylen, options, (err, derivedKey) => {
            if (err) reject(err);
            else resolve(derivedKey);
        });
    });
}

// ──────────────────────────────────────────────
// Password Hashing (scrypt)
// ──────────────────────────────────────────────

const SCRYPT_PARAMS = { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const SALT_LENGTH = 32;
const HASH_LENGTH = 64;

/**
 * Hash a password with scrypt. Returns "salt:hash" in base64.
 */
export async function hashPassword(password) {
    const salt = randomBytes(SALT_LENGTH);
    const hash = await scryptAsync(password, salt, HASH_LENGTH, SCRYPT_PARAMS);
    return `${toBase64(salt)}:${toBase64(hash)}`;
}

/**
 * Verify a password against a stored "salt:hash".
 */
export async function verifyPassword(password, stored) {
    const [saltB64, hashB64] = stored.split(':');
    const salt = fromBase64(saltB64);
    const expectedHash = fromBase64(hashB64);
    const actualHash = await scryptAsync(password, salt, HASH_LENGTH, SCRYPT_PARAMS);
    return timingSafeEqual(Buffer.from(expectedHash), Buffer.from(actualHash));
}

// ──────────────────────────────────────────────
// HKDF Key Derivation (Web Crypto)
// ──────────────────────────────────────────────

/**
 * Derive a 256-bit AES key using HKDF-SHA256.
 * @param {string} material - Input keying material (password, secret, etc.)
 * @param {string} salt     - Salt string
 * @param {string} info     - Context/info string
 * @returns {Promise<CryptoKey>} AES-GCM wrapping key
 */
export async function deriveKey(material, salt, info) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
        'raw',
        enc.encode(material),
        'HKDF',
        false,
        ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        {
            name: 'HKDF',
            hash: 'SHA-256',
            salt: enc.encode(salt),
            info: enc.encode(info),
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        true, // extractable for wrapping operations
        ['encrypt', 'decrypt']
    );
}

// ──────────────────────────────────────────────
// AES-256-GCM Encrypt / Decrypt
// ──────────────────────────────────────────────

/**
 * Encrypt plaintext with AES-256-GCM. Returns "iv:ciphertext" in base64.
 */
export async function encryptData(plaintext, cryptoKey) {
    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        enc.encode(plaintext)
    );
    return `${toBase64(iv)}:${toBase64(ciphertext)}`;
}

/**
 * Decrypt "iv:ciphertext" back to plaintext.
 */
export async function decryptData(encrypted, cryptoKey) {
    const [ivB64, ctB64] = encrypted.split(':');
    const iv = fromBase64(ivB64);
    const ciphertext = fromBase64(ctB64);
    const plainBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        ciphertext
    );
    return new TextDecoder().decode(plainBuffer);
}

// ──────────────────────────────────────────────
// Envelope Encryption — DEK Management
// ──────────────────────────────────────────────

/**
 * Generate a random 256-bit Data Encryption Key (DEK).
 * Returns raw bytes as base64.
 */
export function generateDEK() {
    const dek = crypto.getRandomValues(new Uint8Array(32));
    return toBase64(dek);
}

/**
 * Wrap (encrypt) a DEK with a wrapping key. Returns "iv:wrappedDek" in base64.
 */
export async function wrapKey(dekBase64, wrappingKey) {
    const dekBytes = fromBase64(dekBase64);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const wrapped = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        wrappingKey,
        dekBytes
    );
    return `${toBase64(iv)}:${toBase64(wrapped)}`;
}

/**
 * Unwrap (decrypt) a wrapped DEK. Returns raw DEK as base64.
 */
export async function unwrapKey(wrappedStr, wrappingKey) {
    const [ivB64, wrappedB64] = wrappedStr.split(':');
    const iv = fromBase64(ivB64);
    const wrapped = fromBase64(wrappedB64);
    const dekBytes = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        wrappingKey,
        wrapped
    );
    return toBase64(dekBytes);
}

/**
 * Import a raw DEK (base64) as a CryptoKey for data encryption/decryption.
 */
export async function importDEK(dekBase64) {
    const dekBytes = fromBase64(dekBase64);
    return crypto.subtle.importKey(
        'raw',
        dekBytes,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

// ──────────────────────────────────────────────
// Password Reset Token
// ──────────────────────────────────────────────

/**
 * Generate a secure random token for password reset (URL-safe).
 */
export function generateResetToken() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ──────────────────────────────────────────────
// Short Codes & Recovery Secrets
// ──────────────────────────────────────────────

/**
 * Generate a 6-digit numeric code for Telegram linking & password reset.
 */
export function generateShortCode() {
    const array = crypto.getRandomValues(new Uint8Array(4));
    const num = ((array[0] << 24) | (array[1] << 16) | (array[2] << 8) | array[3]) >>> 0;
    return String(num % 900000 + 100000); // Always 6 digits: 100000-999999
}

/**
 * Generate a secure random Recovery Key for zero-knowledge data recovery.
 */
export function generateRecoverySecret() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return `pw-rec-${hex.slice(0, 8)}-${hex.slice(8, 16)}-${hex.slice(16, 24)}-${hex.slice(24)}`;
}

