import { toRgba } from "@mantine/core";

/**
 * Convert a hex color to an rgba color.
 * 
 * @param {string} hex - The hex color.
 * @param {number} opacity - The opacity.
 * @returns {string} The rgba color.
 */
export function hexToRgba(hex: string, opacity: number): string {
  const { r, g, b } = toRgba(hex);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Format a file size.
 * 
 * @param {number} bytes - The file size in bytes.
 * @returns {string} The formatted file size.
 */
export const formatFileSize = (bytes: number): string => {
    if (bytes >= 1e9) return (bytes / 1e9).toFixed(2) + ' GB';
    if (bytes >= 1e6) return (bytes / 1e6).toFixed(2) + ' MB';
    if (bytes >= 1e3) return (bytes / 1e3).toFixed(2) + ' KB';
    return bytes + ' bytes';
};

/**
 * Format a time.
 * 
 * @param {number} epochSeconds - The time in seconds.
 * @returns {string} The formatted time.
 */
export const formatDate = (epochSeconds: number): string => {
    const date = new Date(epochSeconds * 1000);
    return date.toLocaleString("sv-SE", { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};