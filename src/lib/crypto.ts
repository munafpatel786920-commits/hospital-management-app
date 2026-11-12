/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LicenseDuration } from "../types";

/**
 * Computes SHA-256 hash of a string using Web Crypto API.
 */
export async function sha256(text: string): Promise<string> {
  const normalized = text.trim().toUpperCase();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Synchronous hash fallback for instantaneous client state lookups.
 * Combines DJB2 + FNV-1a to produce a 64-character deterministic hex string.
 */
export function fastHash(text: string): string {
  const str = text.trim().toUpperCase();
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const part1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const part2 = (h2 >>> 0).toString(16).padStart(8, "0");
  // Repeat to 64 chars
  return (part1 + part2 + part1 + part2 + part1 + part2 + part1 + part2).slice(0, 64);
}

/**
 * Generates an Activation Key with prefix CMX-XXXX-XXXX-XXXX.
 * Format: CMX-XXXX-XXXX-XXXX (16 chars + hyphens)
 */
export function generateActivationKeyCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed ambiguous chars 0, O, 1, I
  const getRandomChunk = (len: number) => {
    let res = "";
    for (let i = 0; i < len; i++) {
      const idx = Math.floor(Math.random() * chars.length);
      res += chars[idx];
    }
    return res;
  };
  return `CMX-${getRandomChunk(4)}-${getRandomChunk(4)}-${getRandomChunk(4)}`;
}

/**
 * Masks an activation key for secure display: e.g. "CMX-••••-••••-9F2A"
 */
export function maskActivationKey(key: string): string {
  const clean = key.trim().toUpperCase();
  const parts = clean.split("-");
  if (parts.length === 4) {
    return `${parts[0]}-••••-••••-${parts[3]}`;
  }
  if (clean.length > 8) {
    return `${clean.slice(0, 4)}••••${clean.slice(-4)}`;
  }
  return "••••••••";
}

/**
 * Computes expiration ISO string from duration and start date.
 */
export function calculateExpiryDate(duration: LicenseDuration, fromDate: Date = new Date()): string | null {
  if (duration === "lifetime") {
    return null; // No expiration for lifetime
  }

  const d = new Date(fromDate.getTime());
  switch (duration) {
    case "1_month":
      d.setMonth(d.getMonth() + 1);
      break;
    case "3_months":
      d.setMonth(d.getMonth() + 3);
      break;
    case "6_months":
      d.setMonth(d.getMonth() + 6);
      break;
    case "1_year":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d.toISOString();
}

/**
 * Formats duration into user-friendly text.
 */
export function formatDurationLabel(duration: LicenseDuration): string {
  switch (duration) {
    case "1_month":
      return "1 Month";
    case "3_months":
      return "3 Months";
    case "6_months":
      return "6 Months";
    case "1_year":
      return "1 Year";
    case "lifetime":
      return "Lifetime (Permanent)";
    default:
      return duration;
  }
}
