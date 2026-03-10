import { URL } from 'node:url';
import { YouTubePlayList } from '../classes/Playlist';
import { YouTubeVideo } from '../classes/Video';
import { request } from './../../Request/index';
import { DEFAULT_API_KEY } from './constants';
import { parseDuration } from './format';

export interface PlaylistOptions {
    incomplete?: boolean;
    language?: string;
}

/**
 * Gets YouTube playlist info from a playlist url.
 *
 * Example
 * ```ts
 * const playlist = await play.playlist_info('youtube playlist url')
 *
 * const playlist = await play.playlist_info('youtube playlist url', { incomplete : true })
 * ```
 * @param url Playlist URL
 * @param options Playlist Info Options
 * - `boolean` incomplete : When this is set to `false` (default) this function will throw an error
 *                          if the playlist contains hidden videos.
 *                          If it is set to `true`, it parses the playlist skipping the hidden videos,
 *                          only visible videos are included in the resulting {@link YouTubePlaylist}.
 *
 * @returns YouTube Playlist
 */
export async function playlist_info(url: string, options: PlaylistOptions = {}): Promise<YouTubePlayList> {
    if (!url || typeof url !== 'string') throw new Error(`Expected playlist url, received ${typeof url}!`);
    let url_ = url.trim();
    if (!url_.startsWith('https')) url_ = `https://www.youtube.com/playlist?list=${url_}`;
    if (url_.indexOf('list=') === -1) throw new Error('This is not a Playlist URL');

    if (url_.includes('music.youtube.com')) {
        const urlObj = new URL(url_);
        urlObj.hostname = 'www.youtube.com';
        url_ = urlObj.toString();
    }

    const body = await request(url_, {
        headers: {
            'accept-language': options.language || 'en-US;q=0.9'
        }
    });
    if (body.indexOf('Our systems have detected unusual traffic from your computer network.') !== -1)
        throw new Error('Captcha page: YouTube has detected that you are a bot!');
    const response = JSON.parse(
        body
            .split('var ytInitialData = ')[1]
            .split(';</script>')[0]
            .split(/;\s*(var|const|let)\s/)[0]
    );
    if (response.alerts) {
        if (response.alerts[0].alertWithButtonRenderer?.type === 'INFO') {
            if (!options.incomplete)
                throw new Error(
                    `While parsing playlist url\n${response.alerts[0].alertWithButtonRenderer.text.simpleText}`
                );
        } else if (response.alerts[0].alertRenderer?.type === 'ERROR')
            throw new Error(`While parsing playlist url\n${response.alerts[0].alertRenderer.text.runs[0].text}`);
        else throw new Error('While parsing playlist url\nUnknown Playlist Error');
    }
    if (response.currentVideoEndpoint) {
        return getWatchPlaylist(response, body, url_);
    } else return getNormalPlaylist(response, body);
}

/**
 * Function to parse Playlist from YouTube search
 * @param data html data of that request
 * @param limit No. of videos to parse
 * @returns Array of YouTubeVideo.
 */
export function getPlaylistVideos(data: any, limit = Infinity): YouTubeVideo[] {
    const videos = [];

    for (let i = 0; i < data.length; i++) {
        if (limit === videos.length) break;
        const info = data[i].playlistVideoRenderer;
        if (!info || !info.shortBylineText) continue;

        videos.push(
            new YouTubeVideo({
                id: info.videoId,
                duration: parseInt(info.lengthSeconds) || 0,
                duration_raw: info.lengthText?.simpleText ?? '0:00',
                thumbnails: info.thumbnail.thumbnails,
                title: info.title.runs[0].text,
                upcoming: info.upcomingEventData?.startTime
                    ? new Date(parseInt(info.upcomingEventData.startTime) * 1000)
                    : undefined,
                channel: {
                    id: info.shortBylineText.runs[0].navigationEndpoint.browseEndpoint.browseId || undefined,
                    name: info.shortBylineText.runs[0].text || undefined,
                    url: `https://www.youtube.com${
                        info.shortBylineText.runs[0].navigationEndpoint.browseEndpoint.canonicalBaseUrl ||
                        info.shortBylineText.runs[0].navigationEndpoint.commandMetadata.webCommandMetadata.url
                    }`,
                    icon: undefined
                }
            })
        );
    }
    return videos;
}

/**
 * Function to get Continuation Token
 * @param data html data of playlist url
 * @returns token
 */
export function getContinuationToken(data: any): string {
    return data.find((x: any) => Object.keys(x)[0] === 'continuationItemRenderer')?.continuationItemRenderer
        .continuationEndpoint?.continuationCommand?.token;
}

function getWatchPlaylist(response: any, body: any, url: string): YouTubePlayList {
    const playlist_details = response.contents.twoColumnWatchNextResults.playlist?.playlist;
    if (!playlist_details) throw new Error('Watch playlist unavailable due to YouTube layout changes.');

    const videos = getWatchPlaylistVideos(playlist_details.contents);
    const API_KEY =
        body.split('INNERTUBE_API_KEY":"')[1]?.split('"')[0] ??
        body.split('innertubeApiKey":"')[1]?.split('"')[0] ??
        DEFAULT_API_KEY;

    const channel = playlist_details.shortBylineText?.runs?.[0];
    const badge = playlist_details.badges?.[0]?.metadataBadgeRenderer?.style.toLowerCase();

    return new YouTubePlayList({
        continuation: {
            api: API_KEY,
            token: getContinuationToken(playlist_details.contents),
            clientVersion:
                body.split('"INNERTUBE_CONTEXT_CLIENT_VERSION":"')[1]?.split('"')[0] ??
                body.split('"innertube_context_client_version":"')[1]?.split('"')[0] ??
                '<some version>'
        },
        id: playlist_details.playlistId || '',
        title: playlist_details.title || '',
        videoCount: parseInt(playlist_details.totalVideos) || 0,
        videos: videos,
        url: url,
        channel: {
            id: channel?.navigationEndpoint?.browseEndpoint?.browseId || null,
            name: channel?.text || null,
            url: `https://www.youtube.com${
                channel?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl ||
                channel?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url
            }`,
            verified: Boolean(badge?.includes('verified')),
            artist: Boolean(badge?.includes('artist'))
        }
    });
}

function getNormalPlaylist(response: any, body: any): YouTubePlayList {
    const json_data =
        response.contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.contents[0]
            .itemSectionRenderer.contents[0].playlistVideoListRenderer.contents;
    const playlist_details = response.sidebar.playlistSidebarRenderer.items;

    const API_KEY =
        body.split('INNERTUBE_API_KEY":"')[1]?.split('"')[0] ??
        body.split('innertubeApiKey":"')[1]?.split('"')[0] ??
        DEFAULT_API_KEY;
    const videos = getPlaylistVideos(json_data, 100);

    const data = playlist_details[0].playlistSidebarPrimaryInfoRenderer;
    if (!data.title.runs || !data.title.runs.length) throw new Error('Failed to Parse Playlist info.');

    const author = playlist_details[1]?.playlistSidebarSecondaryInfoRenderer.videoOwner;
    const views = data.stats.length === 3 ? data.stats[1].simpleText.replace(/\D/g, '') : 0;
    const lastUpdate =
        data.stats
            .find((x: any) => 'runs' in x && x['runs'].find((y: any) => y.text.toLowerCase().includes('last update')))
            ?.runs.pop()?.text ?? null;
    const videosCount = data.stats[0].runs[0].text.replace(/\D/g, '') || 0;

    const res = new YouTubePlayList({
        continuation: {
            api: API_KEY,
            token: getContinuationToken(json_data),
            clientVersion:
                body.split('"INNERTUBE_CONTEXT_CLIENT_VERSION":"')[1]?.split('"')[0] ??
                body.split('"innertube_context_client_version":"')[1]?.split('"')[0] ??
                '<some version>'
        },
        id: data.title.runs[0].navigationEndpoint.watchEndpoint.playlistId,
        title: data.title.runs[0].text,
        videoCount: parseInt(videosCount) || 0,
        lastUpdate: lastUpdate,
        views: parseInt(views) || 0,
        videos: videos,
        url: `https://www.youtube.com/playlist?list=${data.title.runs[0].navigationEndpoint.watchEndpoint.playlistId}`,
        link: `https://www.youtube.com${data.title.runs[0].navigationEndpoint.commandMetadata.webCommandMetadata.url}`,
        channel: author
            ? {
                  name: author.videoOwnerRenderer.title.runs[0].text,
                  id: author.videoOwnerRenderer.title.runs[0].navigationEndpoint.browseEndpoint.browseId,
                  url: `https://www.youtube.com${
                      author.videoOwnerRenderer.navigationEndpoint.commandMetadata.webCommandMetadata.url ||
                      author.videoOwnerRenderer.navigationEndpoint.browseEndpoint.canonicalBaseUrl
                  }`,
                  icons: author.videoOwnerRenderer.thumbnail.thumbnails ?? []
              }
            : {},
        thumbnail: data.thumbnailRenderer.playlistVideoThumbnailRenderer?.thumbnail.thumbnails.length
            ? data.thumbnailRenderer.playlistVideoThumbnailRenderer.thumbnail.thumbnails[
                  data.thumbnailRenderer.playlistVideoThumbnailRenderer.thumbnail.thumbnails.length - 1
              ]
            : null
    });
    return res;
}

function getWatchPlaylistVideos(data: any, limit = Infinity): YouTubeVideo[] {
    const videos: YouTubeVideo[] = [];

    for (let i = 0; i < data.length; i++) {
        if (limit === videos.length) break;
        const info = data[i].playlistPanelVideoRenderer;
        if (!info || !info.shortBylineText) continue;
        const channel_info = info.shortBylineText.runs[0];

        videos.push(
            new YouTubeVideo({
                id: info.videoId,
                duration: parseDuration(info.lengthText?.simpleText) || 0,
                duration_raw: info.lengthText?.simpleText ?? '0:00',
                thumbnails: info.thumbnail.thumbnails,
                title: info.title.simpleText,
                upcoming:
                    info.thumbnailOverlays[0].thumbnailOverlayTimeStatusRenderer?.style === 'UPCOMING' || undefined,
                channel: {
                    id: channel_info.navigationEndpoint.browseEndpoint.browseId || undefined,
                    name: channel_info.text || undefined,
                    url: `https://www.youtube.com${
                        channel_info.navigationEndpoint.browseEndpoint.canonicalBaseUrl ||
                        channel_info.navigationEndpoint.commandMetadata.webCommandMetadata.url
                    }`,
                    icon: undefined
                }
            })
        );
    }

    return videos;
}
