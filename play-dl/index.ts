import { getPlatform } from './common/url';
import {
    deezer,
    Deezer,
    DeezerAlbum,
    DeezerPlaylist,
    DeezerTrack,
    dz_advanced_track_search,
    dz_search,
    dz_validate
} from './Deezer';
import {
    getFreeClientID,
    so_search,
    stream as so_stream,
    stream_from_info as so_stream_info,
    so_validate,
    soundcloud,
    SoundCloud,
    SoundCloudPlaylist,
    SoundCloudStream,
    SoundCloudTrack
} from './SoundCloud';
import {
    is_expired,
    refreshToken,
    sp_search,
    sp_validate,
    spotify,
    Spotify,
    SpotifyAlbum,
    SpotifyPlaylist,
    SpotifyTrack
} from './Spotify';
import { setToken } from './token';
import {
    decipher_info,
    extractID,
    InfoData,
    playlist_info,
    video_basic_info,
    video_info,
    YouTube,
    YouTubeChannel,
    YouTubePlayList,
    YouTubeStream,
    YouTubeVideo,
    yt_validate
} from './YouTube';

enum AudioPlayerStatus {
    Idle = 'idle',
    Buffering = 'buffering',
    Paused = 'paused',
    Playing = 'playing',
    AutoPaused = 'autopaused'
}

interface SearchOptions {
    limit?: number;
    source?: {
        youtube?: 'video' | 'playlist' | 'channel';
        spotify?: 'album' | 'playlist' | 'track';
        soundcloud?: 'tracks' | 'playlists' | 'albums';
        deezer?: 'track' | 'playlist' | 'album';
    };
    fuzzy?: boolean;
    language?: string;
    /**
     * !!! Before enabling this for public servers, please consider using Discord features like NSFW channels as not everyone in your server wants to see NSFW images. !!!
     * Unblurred images will likely have different dimensions than specified in the {@link YouTubeThumbnail} objects.
     */
    unblurNSFWThumbnails?: boolean;
}

import { EventEmitter } from 'stream';
import { authorization } from './authorization';
import { yt_search } from './YouTube/search';
import { StreamOptions, stream as yt_stream, stream_from_info as yt_stream_info } from './YouTube/stream';

async function stream(url: string, options: { seek?: number } & StreamOptions): Promise<YouTubeStream>;
async function stream(url: string, options?: StreamOptions): Promise<YouTubeStream | SoundCloudStream>;
/**
 * Creates a Stream [ YouTube or SoundCloud ] class from a url for playing.
 *
 * Example
 * ```ts
 * const source = await play.stream('youtube video URL') // YouTube Video Stream
 *
 * const source = await play.stream('soundcloud track URL') // SoundCloud Track Stream
 *
 * const source = await play.stream('youtube video URL', { seek : 45 }) // Seeks 45 seconds (approx.) in YouTube Video Stream
 *
 * const resource = createAudioResource(source.stream, {
 *      inputType : source.type
 * }) // Use discordjs voice createAudioResource function.
 * ```
 * @param url Video / Track URL
 * @param options
 *
 *  - `number` seek : No of seconds to seek in stream.
 *  - `string` language : Sets language of searched content [ YouTube search only. ], e.g. "en-US"
 *  - `number` quality : Quality number. [ 0 = Lowest, 1 = Medium, 2 = Highest ]
 *  - `boolean` htmldata : given data is html data or not
 *  - `number` precache : No of segments of data to store before looping [YouTube Live Stream only]. [ Defaults to 3 ]
 *  - `boolean` discordPlayerCompatibility : Conversion of Webm to Opus [ Defaults to false ]
 * @returns A {@link YouTubeStream} or {@link SoundCloudStream} Stream to play
 */
async function stream(url: string, options: StreamOptions = {}): Promise<YouTubeStream | SoundCloudStream> {
    const url_ = url.trim();
    if (url_.length === 0) throw new Error('Stream URL has a length of 0. Check your url again.');
    if (options.htmldata) return await yt_stream(url_, options);
    const platform = getPlatform(url_);
    if (platform === 'spotify' || platform === 'deezer') {
        throw new Error(
            `Streaming from ${
                platform === 'spotify' ? 'Spotify' : 'Deezer'
            } is not supported. Please use search() to find a similar track on YouTube or SoundCloud instead.`
        );
    }
    if (platform === 'soundcloud') return await so_stream(url_, options);
    return await yt_stream(url_, options);
}

async function search(query: string, options: { source: { deezer: 'album' } } & SearchOptions): Promise<DeezerAlbum[]>;
async function search(
    query: string,
    options: { source: { deezer: 'playlist' } } & SearchOptions
): Promise<DeezerPlaylist[]>;
async function search(query: string, options: { source: { deezer: 'track' } } & SearchOptions): Promise<DeezerTrack[]>;
async function search(
    query: string,
    options: { source: { soundcloud: 'albums' } } & SearchOptions
): Promise<SoundCloudPlaylist[]>;
async function search(
    query: string,
    options: { source: { soundcloud: 'playlists' } } & SearchOptions
): Promise<SoundCloudPlaylist[]>;
async function search(
    query: string,
    options: { source: { soundcloud: 'tracks' } } & SearchOptions
): Promise<SoundCloudTrack[]>;
async function search(
    query: string,
    options: { source: { spotify: 'album' } } & SearchOptions
): Promise<SpotifyAlbum[]>;
async function search(
    query: string,
    options: { source: { spotify: 'playlist' } } & SearchOptions
): Promise<SpotifyPlaylist[]>;
async function search(
    query: string,
    options: { source: { spotify: 'track' } } & SearchOptions
): Promise<SpotifyTrack[]>;
async function search(
    query: string,
    options: { source: { youtube: 'channel' } } & SearchOptions
): Promise<YouTubeChannel[]>;
async function search(
    query: string,
    options: { source: { youtube: 'playlist' } } & SearchOptions
): Promise<YouTubePlayList[]>;
async function search(
    query: string,
    options: { source: { youtube: 'video' } } & SearchOptions
): Promise<YouTubeVideo[]>;
async function search(query: string, options: { limit: number } & SearchOptions): Promise<YouTubeVideo[]>;
async function search(query: string, options?: SearchOptions): Promise<YouTubeVideo[]>;
/**
 * Searches through a particular source and gives respective info.
 * 
 * Example
 * ```ts
 * const searched = await play.search('Rick Roll', { source : { youtube : "video" } }) // YouTube Video Search
 * 
 * const searched = await play.search('Rick Roll', { limit : 1 }) // YouTube Video Search but returns only 1 video.
 * 
 * const searched = await play.search('Rick Roll', { source : { spotify : "track" } }) // Spotify Track Search
 * 
 * const searched = await play.search('Rick Roll', { source : { soundcloud : "tracks" } }) // SoundCloud Track Search
 * 
 * const searched = await play.search('Rick Roll', { source : { deezer : "track" } }) // Deezer Track Search
 * ```
 * @param query string to search.
 * @param options
 * 
 *  - `number` limit : No of searches you want to have.
 *  - `string` language : Sets language of searched content [ YouTube search only. ], e.g. "en-US"
 *  - `boolean` unblurNSFWThumbnails : Unblurs NSFW thumbnails. Defaults to `false` [ YouTube search only. ]
 *              !!! Before enabling this for public servers, please consider using Discord features like NSFW channels as not everyone in your server wants to see NSFW images. !!!
 *              Unblurred images will likely have different dimensions than specified in the {@link YouTubeThumbnail} objects.
 *  - `boolean` fuzzy : Whether the search should be fuzzy or only return exact matches. Defaults to `true`. [ for `Deezer` Only ]
 *  - `Object` source : Contains type of source and type of result you want to have
 * ```ts
 *      - youtube : 'video' | 'playlist' | 'channel';
        - spotify : 'album' | 'playlist' | 'track';
        - soundcloud : 'tracks' | 'playlists' | 'albums';
        - deezer : 'track' | 'playlist' | 'album';
    ```
 * @returns Array of {@link YouTube} or {@link Spotify} or {@link SoundCloud} or {@link Deezer} type
 */
async function search(
    query: string,
    options: SearchOptions = {}
): Promise<YouTube[] | Spotify[] | SoundCloud[] | Deezer[]> {
    if (!options.source) options.source = { youtube: 'video' };
    const query_ = encodeURIComponent(query.trim());
    if (options.source.youtube)
        return await yt_search(query_, {
            limit: options.limit,
            type: options.source.youtube,
            language: options.language,
            unblurNSFWThumbnails: options.unblurNSFWThumbnails
        });
    else if (options.source.spotify) return await sp_search(query_, options.source.spotify, options.limit);
    else if (options.source.soundcloud) return await so_search(query_, options.source.soundcloud, options.limit);
    else if (options.source.deezer)
        return await dz_search(query_, { limit: options.limit, type: options.source.deezer, fuzzy: options.fuzzy });
    else throw new Error('Not possible to reach Here LOL. Easter Egg of play-dl if someone get this.');
}

async function stream_from_info(info: SoundCloudTrack, options?: StreamOptions): Promise<SoundCloudStream>;
async function stream_from_info(info: InfoData, options?: StreamOptions): Promise<YouTubeStream>;
/**
 * Creates a Stream [ YouTube or SoundCloud ] class from video or track info for playing.
 *
 * Example
 * ```ts
 * const info = await video_info('youtube URL')
 * const source = await play.stream_from_info(info) // YouTube Video Stream
 *
 * const soundInfo = await play.soundcloud('SoundCloud URL')
 * const source = await play.stream_from_info(soundInfo) // SoundCloud Track Stream
 *
 * const source = await play.stream_from_info(info, { seek : 45 }) // Seeks 45 seconds (approx.) in YouTube Video Stream
 *
 * const resource = createAudioResource(source.stream, {
 *      inputType : source.type
 * }) // Use discordjs voice createAudioResource function.
 * ```
 * @param info YouTube video info OR SoundCloud track Class
 * @param options
 *
 *  - `number` seek : No of seconds to seek in stream.
 *  - `string` language : Sets language of searched content [ YouTube search only. ], e.g. "en-US"
 *  - `number` quality : Quality number. [ 0 = Lowest, 1 = Medium, 2 = Highest ]
 *  - `boolean` htmldata : given data is html data or not
 *  - `number` precache : No of segments of data to store before looping [YouTube Live Stream only]. [ Defaults to 3 ]
 *  - `boolean` discordPlayerCompatibility : Conversion of Webm to Opus[ Defaults to false ]
 * @returns A {@link YouTubeStream} or {@link SoundCloudStream} Stream to play
 */
async function stream_from_info(
    info: InfoData | SoundCloudTrack,
    options: StreamOptions = {}
): Promise<YouTubeStream | SoundCloudStream> {
    if (info instanceof SoundCloudTrack) return await so_stream_info(info, options);
    else return await yt_stream_info(info, options);
}
/**
 * Validates url that play-dl supports.
 *
 * - `so` - SoundCloud
 * - `sp` - Spotify
 * - `dz` - Deezer
 * - `yt` - YouTube
 * @param url URL
 * @returns
 * ```ts
 * 'so_playlist' / 'so_track' | 'sp_track' | 'sp_album' | 'sp_playlist' | 'dz_track' | 'dz_playlist' | 'dz_album' | 'yt_video' | 'yt_playlist' | 'search' | false
 * ```
 */
async function validate(
    url: string
): Promise<
    | 'so_playlist'
    | 'so_track'
    | 'sp_track'
    | 'sp_album'
    | 'sp_playlist'
    | 'dz_track'
    | 'dz_playlist'
    | 'dz_album'
    | 'yt_video'
    | 'yt_playlist'
    | 'search'
    | false
> {
    let check;
    const url_ = url.trim();
    if (!url_.startsWith('https')) return 'search';
    const platform = getPlatform(url_);
    if (platform === 'spotify') {
        check = sp_validate(url_);
        return check !== false ? (('sp_' + check) as 'sp_track' | 'sp_album' | 'sp_playlist') : false;
    }
    if (platform === 'soundcloud') {
        check = await so_validate(url_);
        return check !== false ? (('so_' + check) as 'so_playlist' | 'so_track') : false;
    }
    if (platform === 'deezer') {
        check = await dz_validate(url_);
        return check !== false ? (('dz_' + check) as 'dz_track' | 'dz_playlist' | 'dz_album') : false;
    }
    if (platform === 'youtube') {
        check = yt_validate(url_);
        return check !== false ? (('yt_' + check) as 'yt_video' | 'yt_playlist') : false;
    }
    return false;
}
/**
 * Attaches paused, playing, autoPaused Listeners to discordjs voice AudioPlayer.
 *
 * Useful if you don't want extra data to be downloaded by play-dl.
 * @param player discordjs voice AudioPlayer
 * @param resource A {@link YouTubeStream} or {@link SoundCloudStream}
 */
function attachListeners(player: EventEmitter, resource: YouTubeStream | SoundCloudStream) {
    // cleanup existing listeners if they are still registered
    type listenerType = (...args: any[]) => void;

    const listeners = player.listeners(AudioPlayerStatus.Idle);
    for (const cleanup of listeners) {
        if ((cleanup as any).__playDlAttachedListener) {
            cleanup();
            player.removeListener(AudioPlayerStatus.Idle, cleanup as listenerType);
        }
    }

    const pauseListener = () => resource.pause();
    const resumeListener = () => resource.resume();
    const idleListener = () => {
        player.removeListener(AudioPlayerStatus.Paused, pauseListener);
        player.removeListener(AudioPlayerStatus.AutoPaused, pauseListener);
        player.removeListener(AudioPlayerStatus.Playing, resumeListener);
    };
    pauseListener.__playDlAttachedListener = true;
    resumeListener.__playDlAttachedListener = true;
    idleListener.__playDlAttachedListener = true;
    player.on(AudioPlayerStatus.Paused, pauseListener);
    player.on(AudioPlayerStatus.AutoPaused, pauseListener);
    player.on(AudioPlayerStatus.Playing, resumeListener);
    player.once(AudioPlayerStatus.Idle, idleListener);
}

// Export Main Commands
export {
    attachListeners,
    authorization,
    decipher_info,
    deezer,
    DeezerAlbum,
    DeezerPlaylist,
    DeezerTrack,
    dz_advanced_track_search,
    dz_validate,
    extractID,
    getFreeClientID,
    InfoData,
    is_expired,
    playlist_info,
    refreshToken,
    search,
    setToken,
    so_validate,
    soundcloud,
    SoundCloudPlaylist,
    SoundCloudStream,
    SoundCloudTrack,
    sp_validate,
    spotify,
    SpotifyAlbum,
    SpotifyPlaylist,
    SpotifyTrack,
    stream,
    stream_from_info,
    validate,
    video_basic_info,
    video_info,
    YouTubeChannel,
    YouTubePlayList,
    YouTubeVideo,
    yt_validate
};

// Export Types
    export { Deezer, SoundCloud, Spotify, YouTube, YouTubeStream };

// Export Default
export default {
    DeezerAlbum,
    DeezerPlaylist,
    DeezerTrack,
    SoundCloudPlaylist,
    SoundCloudStream,
    SoundCloudTrack,
    SpotifyAlbum,
    SpotifyPlaylist,
    SpotifyTrack,
    YouTubeChannel,
    YouTubePlayList,
    YouTubeVideo,
    attachListeners,
    authorization,
    decipher_info,
    deezer,
    dz_advanced_track_search,
    dz_validate,
    extractID,
    getFreeClientID,
    is_expired,
    playlist_info,
    refreshToken,
    search,
    setToken,
    so_validate,
    soundcloud,
    spotify,
    sp_validate,
    stream,
    stream_from_info,
    validate,
    video_basic_info,
    video_info,
    yt_validate
};
