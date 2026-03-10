import { URL } from 'node:url';
import { request_content_length, request_stream } from '../Request';
import { StreamType } from '../common/types';
import { LiveStream, Stream } from './classes/LiveStream';
import { SeekStream } from './classes/SeekStream';
import { InfoData, StreamInfoData } from './utils/constants';
import { parseAudioFormats } from './utils/format';
import { video_stream_info } from './utils/videoInfo';

export { parseAudioFormats } from './utils/format';
export { StreamType };

export interface StreamOptions {
    seek?: number;
    quality?: number;
    language?: string;
    htmldata?: boolean;
    precache?: number;
    discordPlayerCompatibility?: boolean;
}
/**
 * Type for YouTube Stream
 */
export type YouTubeStream = Stream | LiveStream | SeekStream;
/**
 * Stream command for YouTube
 * @param url YouTube URL
 * @param options lets you add quality for stream
 * @returns Stream class with type and stream for playing.
 */
export async function stream(url: string, options: StreamOptions = {}): Promise<YouTubeStream> {
    const info = await video_stream_info(url, { htmldata: options.htmldata, language: options.language });
    return await stream_from_info(info, options);
}
/**
 * Stream command for YouTube using info from video_info or decipher_info function.
 * @param info video_info data
 * @param options lets you add quality for stream
 * @returns Stream class with type and stream for playing.
 */
export async function stream_from_info(
    info: InfoData | StreamInfoData,
    options: StreamOptions = {}
): Promise<YouTubeStream> {
    if (info.format.length === 0)
        throw new Error('Upcoming and premiere videos that are not currently live cannot be streamed.');
    if (options.quality && !Number.isInteger(options.quality)) throw new Error('Quality must be set to an integer.');

    const final: any[] = [];
    if (
        info.LiveStreamData.isLive === true &&
        info.LiveStreamData.dashManifestUrl !== null &&
        info.video_details.durationInSec === 0
    ) {
        return new LiveStream(
            info.LiveStreamData.dashManifestUrl,
            info.format[info.format.length - 1].targetDurationSec as number,
            info.video_details.url,
            options.precache
        );
    }

    const audioFormat = parseAudioFormats(info.format);
    if (typeof options.quality !== 'number') options.quality = audioFormat.length - 1;
    else if (options.quality <= 0) options.quality = 0;
    else if (options.quality >= audioFormat.length) options.quality = audioFormat.length - 1;
    if (audioFormat.length !== 0) final.push(audioFormat[options.quality]);
    else final.push(info.format[info.format.length - 1]);
    let type: StreamType =
        final[0].codec === 'opus' && final[0].container === 'webm' ? StreamType.WebmOpus : StreamType.Arbitrary;
    await request_stream(`https://${new URL(final[0].url).host}/generate_204`);
    if (type === StreamType.WebmOpus) {
        if (!options.discordPlayerCompatibility) {
            options.seek ??= 0;
            if (options.seek >= info.video_details.durationInSec || options.seek < 0)
                throw new Error(`Seeking beyond limit. [ 0 - ${info.video_details.durationInSec - 1}]`);
            return new SeekStream(
                final[0].url,
                info.video_details.durationInSec,
                final[0].indexRange.end,
                Number(final[0].contentLength),
                Number(final[0].bitrate),
                info.video_details.url,
                options
            );
        } else if (options.seek) throw new Error('Can not seek with discordPlayerCompatibility set to true.');
    }

    let contentLength;
    if (final[0].contentLength) {
        contentLength = Number(final[0].contentLength);
    } else {
        contentLength = await request_content_length(final[0].url);
    }

    return new Stream(
        final[0].url,
        type,
        info.video_details.durationInSec,
        contentLength,
        info.video_details.url,
        options
    );
}
