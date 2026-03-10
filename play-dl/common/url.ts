/**
 * Supported platform identifiers for URL routing.
 */
export type Platform = 'youtube' | 'soundcloud' | 'spotify' | 'deezer';

/**
 * Detects which platform a URL belongs to.
 * @param url URL to check (will be trimmed)
 * @returns Platform name or null if not recognized
 */
export function getPlatform(url: string): Platform | null {
    const url_ = url.trim();
    if (url_.length === 0) return null;
    try {
        const hostname = url_.startsWith('http') ? new URL(url_).hostname.toLowerCase() : '';
        if (hostname.includes('youtube') || hostname === 'youtu.be') return 'youtube';
        if (hostname.includes('soundcloud') || hostname === 'snd.sc') return 'soundcloud';
        if (hostname.includes('spotify')) return 'spotify';
        if (hostname.includes('deezer')) return 'deezer';
    } catch {
        // Invalid URL
    }
    return null;
}
