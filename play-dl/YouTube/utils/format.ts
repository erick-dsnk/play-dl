/**
 * Function to convert seconds to [hour : minutes : seconds] format
 * @param seconds seconds to convert
 * @returns [hour : minutes : seconds] format
 */
export function parseSeconds(seconds: number): string {
    const d = Number(seconds);
    const h = Math.floor(d / 3600);
    const m = Math.floor((d % 3600) / 60);
    const s = Math.floor((d % 3600) % 60);

    const hDisplay = h > 0 ? (h < 10 ? `0${h}` : h) + ':' : '';
    const mDisplay = m > 0 ? (m < 10 ? `0${m}` : m) + ':' : '00:';
    const sDisplay = s > 0 ? (s < 10 ? `0${s}` : s) : '00';
    return hDisplay + mDisplay + sDisplay;
}

/**
 * Parse duration string (e.g. "1:30" or "1:00:00") to seconds.
 */
export function parseDuration(text: string): number {
    if (!text) return 0;
    const split = text.split(':');

    switch (split.length) {
        case 2:
            return parseInt(split[0]) * 60 + parseInt(split[1]);

        case 3:
            return parseInt(split[0]) * 60 * 60 + parseInt(split[1]) * 60 + parseInt(split[2]);

        default:
            return 0;
    }
}

/**
 * Command to find audio formats from given format array
 * @param formats Formats to search from
 * @returns Audio Formats array
 */
export function parseAudioFormats(formats: any[]) {
    const result: any[] = [];
    formats.forEach((format) => {
        const type = format.mimeType as string;
        if (type.startsWith('audio')) {
            format.codec = type.split('codecs="')[1].split('"')[0];
            format.container = type.split('audio/')[1].split(';')[0];
            result.push(format);
        }
    });
    return result;
}
