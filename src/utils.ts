import { toRgba } from "@mantine/core";
import { invoke } from "@tauri-apps/api/tauri";
import { FileInfo, User } from "./interfaces";

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
	if (bytes >= 1e9) return (bytes / 1e9).toFixed(2) + " GB";
	if (bytes >= 1e6) return (bytes / 1e6).toFixed(2) + " MB";
	if (bytes >= 1e3) return (bytes / 1e3).toFixed(2) + " KB";
	return bytes + " bytes";
};

/**
 * Format a time.
 * Uses year-month-day, 12-hour time with AM/PM.
 *
 * @param {number} epochSeconds - The time in seconds.
 * @returns {string} The formatted time.
 */
export const formatDate = (epochSeconds: number): string => {
	const date = new Date(epochSeconds * 1000);
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");
	const ampm = date.getHours() >= 12 ? "PM" : "AM";
	const formattedTime = (parseInt(hours) % 12) + ":" + minutes + " " + ampm;
	return `${year}-${month}-${day}, ${formattedTime}`;
};

/**
 * Get an icon based on the file extension.
 *
 * @param {string} extension - The file extension.
 * @returns {string} The icon.
 */
export const getIconByFileExtension = (extension: string): string => {
    const icons: { [key: string]: string[] } = {
        "📄": ["txt", "pdf", "json", "xml"],			// Text files
        "🖼️": ["jpg", "png", "gif"],					// Image files
        "🎵": ["mp3", "wav"],							// Audio files
        "🎥": ["mp4", "mov", "avi"],					// Video files
        "📦": ["zip", "tar", "gz"],						// Archive files
        "🛠️": ["exe", "msi"],							// Executable files
        "📝": ["html", "css", "js", "ts", "md", "doc", "docx"], 		// Documents and Web languages
        "💻": ["py", "java", "c", "cpp", "cs", "rb", "php", "go", "rs", "swift", "kt", "dart"], // Programming languages
    };

    for (const icon in icons) {
        if (icons[icon].includes(extension)) {
            return icon;
        }
    }

    return "";
};


export const fetchFiles = (user: User, path: string[], setFiles: (files: FileInfo[]) => void, setLoading: (loading: boolean) => void, setError: (error: string | null) => void) => {
    if (user) {
        setLoading(true);
        const fullPath = path.length === 0 ? '' : path.join('/');
        invoke<FileInfo[]>('connect_to_pi', { userName: user.name.toLowerCase(), path: fullPath })
            .then((files) => {
                setFiles(files);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to connect to the Raspberry Pi:', err);
                setError(err);
                setLoading(false);
            });
    }
};
