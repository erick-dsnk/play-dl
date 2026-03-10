import { URLSearchParams } from 'node:url';
import { VideoChapter, YouTubeVideo } from '../classes/Video';
import { request } from './../../Request/index';
import { format_decipher } from './cipher';
import { DEFAULT_API_KEY, InfoData, StreamInfoData } from './constants';
import { cookieHeaders, getCookies } from './cookie';
import { parseAudioFormats, parseSeconds } from './format';
import { extractVideoId } from './validate';

const youtubeCookieOptions = {
    getCookies,
    onSetCookie: (headers: string[]) => cookieHeaders(headers)
};

export interface InfoOptions {
    htmldata?: boolean;
    language?: string;
}

async function acceptViewerDiscretion(
    videoId: string,
    cookieJar: { [key: string]: string },
    body: string,
    extractRelated: boolean
): Promise<{ streamingData: any; relatedVideos?: any }> {
    const apiKey =
        body.split('INNERTUBE_API_KEY":"')[1]?.split('"')[0] ??
        body.split('innertubeApiKey":"')[1]?.split('"')[0] ??
        DEFAULT_API_KEY;
    const sessionToken =
        body.split('"XSRF_TOKEN":"')[1]?.split('"')[0].replaceAll('\\u003d', '=') ??
        body.split('"xsrf_token":"')[1]?.split('"')[0].replaceAll('\\u003d', '=');
    if (!sessionToken)
        throw new Error(`Unable to extract XSRF_TOKEN to accept the viewer discretion popup for video: ${videoId}.`);

    const verificationResponse = await request(
        `https://www.youtube.com/youtubei/v1/verify_age?key=${apiKey}&prettyPrint=false`,
        {
            method: 'POST',
            body: JSON.stringify({
                context: {
                    client: {
                        utcOffsetMinutes: 0,
                        gl: 'US',
                        hl: 'en',
                        clientName: 'WEB',
                        clientVersion:
                            body.split('"INNERTUBE_CONTEXT_CLIENT_VERSION":"')[1]?.split('"')[0] ??
                            body.split('"innertube_context_client_version":"')[1]?.split('"')[0] ??
                            '<some version>'
                    },
                    user: {},
                    request: {}
                },
                nextEndpoint: {
                    urlEndpoint: {
                        url: `/watch?v=${videoId}&has_verified=1`
                    }
                },
                setControvercy: true
            }),
            cookies: true,
            cookieJar,
            ...youtubeCookieOptions
        }
    );

    const endpoint = JSON.parse(verificationResponse).actions[0].navigateAction.endpoint;

    const videoPage = await request(`https://www.youtube.com/${endpoint.urlEndpoint.url}&pbj=1`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams([
            ['command', JSON.stringify(endpoint)],
            ['session_token', sessionToken]
        ]).toString(),
        cookies: true,
        cookieJar,
        ...youtubeCookieOptions
    });

    if (videoPage.includes('<h1>Something went wrong</h1>'))
        throw new Error(`Unable to accept the viewer discretion popup for video: ${videoId}`);

    const videoPageData = JSON.parse(videoPage);

    if (videoPageData[2].playerResponse.playabilityStatus.status !== 'OK')
        throw new Error(
            `While getting info from url after trying to accept the discretion popup for video ${videoId}\n${
                videoPageData[2].playerResponse.playabilityStatus.errorScreen.playerErrorMessageRenderer?.reason
                    .simpleText ??
                videoPageData[2].playerResponse.playabilityStatus.errorScreen.playerKavRenderer?.reason.simpleText
            }`
        );

    const streamingData = videoPageData[2].playerResponse.streamingData;

    if (extractRelated)
        return {
            streamingData,
            relatedVideos: videoPageData[3].response.contents.twoColumnWatchNextResults.secondaryResults
        };

    return { streamingData };
}

async function getAndroidFormats(videoId: string, cookieJar: { [key: string]: string }, body: string): Promise<any[]> {
    const apiKey =
        body.split('INNERTUBE_API_KEY":"')[1]?.split('"')[0] ??
        body.split('innertubeApiKey":"')[1]?.split('"')[0] ??
        DEFAULT_API_KEY;

    const response = await request(`https://www.youtube.com/youtubei/v1/player?key=${apiKey}&prettyPrint=false`, {
        method: 'POST',
        body: JSON.stringify({
            context: {
                client: {
                    clientName: 'ANDROID',
                    clientVersion: '16.49',
                    hl: 'en',
                    timeZone: 'UTC',
                    utcOffsetMinutes: 0
                }
            },
            videoId: videoId,
            playbackContext: { contentPlaybackContext: { html5Preference: 'HTML5_PREF_WANTS' } },
            contentCheckOk: true,
            racyCheckOk: true
        }),
        cookies: true,
        cookieJar,
        ...youtubeCookieOptions
    });

    return JSON.parse(response).streamingData.formats;
}

/**
 * Basic function to get data from a YouTube url or ID.
 *
 * Example
 * ```ts
 * const video = await play.video_basic_info('youtube video url')
 *
 * const res = ... // Any https package get function.
 *
 * const video = await play.video_basic_info(res.body, { htmldata : true })
 * ```
 * @param url YouTube url or ID or html body data
 * @param options Video Info Options
 *  - `boolean` htmldata : given data is html data or not
 * @returns Video Basic Info {@link InfoData}.
 */
export async function video_basic_info(url: string, options: InfoOptions = {}): Promise<InfoData> {
    if (typeof url !== 'string') throw new Error('url parameter is not a URL string or a string of HTML');
    const url_ = url.trim();
    let body: string;
    const cookieJar: { [key: string]: string } = {};
    if (options.htmldata) {
        body = url_;
    } else {
        const video_id = extractVideoId(url_);
        if (!video_id) throw new Error('This is not a YouTube Watch URL');
        const new_url = `https://www.youtube.com/watch?v=${video_id}&has_verified=1`;
        body = await request(new_url, {
            headers: {
                'accept-language': options.language || 'en-US;q=0.9'
            },
            cookies: true,
            cookieJar,
            ...youtubeCookieOptions
        });
    }
    if (body.indexOf('Our systems have detected unusual traffic from your computer network.') !== -1)
        throw new Error('Captcha page: YouTube has detected that you are a bot!');
    const player_data = body
        .split('var ytInitialPlayerResponse = ')?.[1]
        ?.split(';</script>')[0]
        .split(/(?<=}}});\s*(var|const|let)\s/)[0];
    if (!player_data) throw new Error('Initial Player Response Data is undefined.');
    const initial_data = body
        .split('var ytInitialData = ')?.[1]
        ?.split(';</script>')[0]
        .split(/;\s*(var|const|let)\s/)[0];
    if (!initial_data) throw new Error('Initial Response Data is undefined.');
    const player_response = JSON.parse(player_data);
    const initial_response = JSON.parse(initial_data);
    const vid = player_response.videoDetails;

    let discretionAdvised = false;
    let upcoming = false;
    if (player_response.playabilityStatus.status !== 'OK') {
        if (player_response.playabilityStatus.status === 'CONTENT_CHECK_REQUIRED') {
            if (options.htmldata)
                throw new Error(
                    `Accepting the viewer discretion is not supported when using htmldata, video: ${vid.videoId}`
                );
            discretionAdvised = true;
            const cookies =
                initial_response.topbar.desktopTopbarRenderer.interstitial?.consentBumpV2Renderer.agreeButton
                    .buttonRenderer.command.saveConsentAction;
            if (cookies) {
                Object.assign(cookieJar, {
                    VISITOR_INFO1_LIVE: cookies.visitorCookie,
                    CONSENT: cookies.consentCookie
                });
            }

            const updatedValues = await acceptViewerDiscretion(vid.videoId, cookieJar, body, true);
            player_response.streamingData = updatedValues.streamingData;
            initial_response.contents.twoColumnWatchNextResults.secondaryResults = updatedValues.relatedVideos;
        } else if (player_response.playabilityStatus.status === 'LIVE_STREAM_OFFLINE') upcoming = true;
        else
            throw new Error(
                `While getting info from url\n${
                    player_response.playabilityStatus.errorScreen.playerErrorMessageRenderer?.reason.simpleText ??
                    player_response.playabilityStatus.errorScreen.playerKavRenderer?.reason.simpleText ??
                    player_response.playabilityStatus.reason
                }`
            );
    }
    const ownerInfo =
        initial_response.contents.twoColumnWatchNextResults.results?.results?.contents[1]?.videoSecondaryInfoRenderer
            ?.owner?.videoOwnerRenderer;
    const badge = ownerInfo?.badges?.[0]?.metadataBadgeRenderer?.style?.toLowerCase();
    const html5player = `https://www.youtube.com${body.split('"jsUrl":"')[1].split('"')[0]}`;
    const related: string[] = [];
    initial_response.contents.twoColumnWatchNextResults.secondaryResults.secondaryResults.results.forEach(
        (res: any) => {
            if (res.compactVideoRenderer)
                related.push(`https://www.youtube.com/watch?v=${res.compactVideoRenderer.videoId}`);
            if (res.itemSectionRenderer?.contents)
                res.itemSectionRenderer.contents.forEach((x: any) => {
                    if (x.compactVideoRenderer)
                        related.push(`https://www.youtube.com/watch?v=${x.compactVideoRenderer.videoId}`);
                });
        }
    );
    const microformat = player_response.microformat.playerMicroformatRenderer;
    const musicInfo = initial_response.engagementPanels
        .find(
            (item: any) =>
                item?.engagementPanelSectionListRenderer?.panelIdentifier == 'engagement-panel-structured-description'
        )
        ?.engagementPanelSectionListRenderer.content.structuredDescriptionContentRenderer.items.find(
            (el: any) => el.videoDescriptionMusicSectionRenderer
        )?.videoDescriptionMusicSectionRenderer.carouselLockups;

    const music: any[] = [];
    if (musicInfo) {
        musicInfo.forEach((x: any) => {
            if (!x.carouselLockupRenderer) return;
            const row = x.carouselLockupRenderer;

            const song =
                row.videoLockup?.compactVideoRenderer.title.simpleText ??
                row.videoLockup?.compactVideoRenderer.title.runs?.find((x: any) => x.text)?.text;
            const metadata = row.infoRows?.map((info: any) => [
                info.infoRowRenderer.title.simpleText.toLowerCase(),
                (info.infoRowRenderer.expandedMetadata ?? info.infoRowRenderer.defaultMetadata)?.runs
                    ?.map((i: any) => i.text)
                    .join('') ??
                    info.infoRowRenderer.defaultMetadata?.simpleText ??
                    info.infoRowRenderer.expandedMetadata?.simpleText ??
                    ''
            ]);
            const contents = Object.fromEntries(metadata ?? {});
            const id =
                row.videoLockup?.compactVideoRenderer.navigationEndpoint?.watchEndpoint.videoId ??
                row.infoRows
                    ?.find((x: any) => x.infoRowRenderer.title.simpleText.toLowerCase() == 'song')
                    ?.infoRowRenderer.defaultMetadata.runs?.find((x: any) => x.navigationEndpoint)?.navigationEndpoint
                    .watchEndpoint?.videoId;

            music.push({
                song,
                url: id ? `https://www.youtube.com/watch?v=${id}` : null,
                ...contents
            });
        });
    }
    const rawChapters =
        initial_response.playerOverlays.playerOverlayRenderer.decoratedPlayerBarRenderer?.decoratedPlayerBarRenderer.playerBar?.multiMarkersPlayerBarRenderer.markersMap?.find(
            (m: any) => m.key === 'DESCRIPTION_CHAPTERS'
        )?.value?.chapters;
    const chapters: VideoChapter[] = [];
    if (rawChapters) {
        for (const { chapterRenderer } of rawChapters) {
            chapters.push({
                title: chapterRenderer.title.simpleText,
                timestamp: parseSeconds(chapterRenderer.timeRangeStartMillis / 1000),
                seconds: chapterRenderer.timeRangeStartMillis / 1000,
                thumbnails: chapterRenderer.thumbnail.thumbnails
            });
        }
    }
    let upcomingDate;
    if (upcoming) {
        if (microformat.liveBroadcastDetails.startTimestamp)
            upcomingDate = new Date(microformat.liveBroadcastDetails.startTimestamp);
        else {
            const timestamp =
                player_response.playabilityStatus.liveStreamability.liveStreamabilityRenderer.offlineSlate
                    .liveStreamOfflineSlateRenderer.scheduledStartTime;
            upcomingDate = new Date(parseInt(timestamp) * 1000);
        }
    }

    const likeRenderer = initial_response.contents.twoColumnWatchNextResults.results.results.contents
        .find((content: any) => content.videoPrimaryInfoRenderer)
        ?.videoPrimaryInfoRenderer.videoActions.menuRenderer.topLevelButtons?.find(
            (button: any) =>
                button.toggleButtonRenderer?.defaultIcon.iconType === 'LIKE' ||
                button.segmentedLikeDislikeButtonRenderer?.likeButton.toggleButtonRenderer?.defaultIcon.iconType ===
                    'LIKE'
        );

    const video_details = new YouTubeVideo({
        id: vid.videoId,
        title: vid.title,
        description: vid.shortDescription,
        duration: Number(vid.lengthSeconds),
        duration_raw: parseSeconds(vid.lengthSeconds),
        uploadedAt: microformat.publishDate,
        liveAt: microformat.liveBroadcastDetails?.startTimestamp,
        upcoming: upcomingDate,
        thumbnails: vid.thumbnail.thumbnails,
        channel: {
            name: vid.author,
            id: vid.channelId,
            url: `https://www.youtube.com/channel/${vid.channelId}`,
            verified: Boolean(badge?.includes('verified')),
            artist: Boolean(badge?.includes('artist')),
            icons: ownerInfo?.thumbnail?.thumbnails || undefined
        },
        views: vid.viewCount,
        tags: vid.keywords,
        likes: parseInt(
            likeRenderer?.toggleButtonRenderer?.defaultText.accessibility?.accessibilityData.label.replace(
                /\D+/g,
                ''
            ) ??
                likeRenderer?.segmentedLikeDislikeButtonRenderer?.likeButton.toggleButtonRenderer?.defaultText.accessibility?.accessibilityData.label.replace(
                    /\D+/g,
                    ''
                ) ??
                0
        ),
        live: vid.isLiveContent,
        private: vid.isPrivate,
        discretionAdvised,
        music,
        chapters
    });
    let format = [];
    if (!upcoming) {
        format.push(...(player_response.streamingData.formats ?? []));
        format.push(...(player_response.streamingData.adaptiveFormats ?? []));

        if (parseAudioFormats(format).length === 0 && !options.htmldata) {
            format = await getAndroidFormats(vid.videoId, cookieJar, body);
        }
    }
    const LiveStreamData = {
        isLive: video_details.live,
        dashManifestUrl: player_response.streamingData?.dashManifestUrl ?? null,
        hlsManifestUrl: player_response.streamingData?.hlsManifestUrl ?? null
    };
    return {
        LiveStreamData,
        html5player,
        format,
        video_details,
        related_videos: related
    };
}

/**
 * Gets the data required for streaming from YouTube url, ID or html body data and deciphers it.
 *
 * Internal function used by {@link stream} instead of {@link video_info}
 * because it only extracts the information required for streaming.
 *
 * @param url YouTube url or ID or html body data
 * @param options Video Info Options
 *  - `boolean` htmldata : given data is html data or not
 * @returns Deciphered Video Info {@link StreamInfoData}.
 */
export async function video_stream_info(url: string, options: InfoOptions = {}): Promise<StreamInfoData> {
    if (typeof url !== 'string') throw new Error('url parameter is not a URL string or a string of HTML');
    let body: string;
    const cookieJar: { [key: string]: string } = {};
    if (options.htmldata) {
        body = url;
    } else {
        const video_id = extractVideoId(url);
        if (!video_id) throw new Error('This is not a YouTube Watch URL');
        const new_url = `https://www.youtube.com/watch?v=${video_id}&has_verified=1`;
        body = await request(new_url, {
            headers: { 'accept-language': 'en-US,en;q=0.9' },
            cookies: true,
            cookieJar,
            ...youtubeCookieOptions
        });
    }
    if (body.indexOf('Our systems have detected unusual traffic from your computer network.') !== -1)
        throw new Error('Captcha page: YouTube has detected that you are a bot!');
    const player_data = body
        .split('var ytInitialPlayerResponse = ')?.[1]
        ?.split(';</script>')[0]
        .split(/(?<=}}});\s*(var|const|let)\s/)[0];
    if (!player_data) throw new Error('Initial Player Response Data is undefined.');
    const player_response = JSON.parse(player_data);
    let upcoming = false;
    if (player_response.playabilityStatus.status !== 'OK') {
        if (player_response.playabilityStatus.status === 'CONTENT_CHECK_REQUIRED') {
            if (options.htmldata)
                throw new Error(
                    `Accepting the viewer discretion is not supported when using htmldata, video: ${player_response.videoDetails.videoId}`
                );

            const initial_data = body
                .split('var ytInitialData = ')?.[1]
                ?.split(';</script>')[0]
                .split(/;\s*(var|const|let)\s/)[0];
            if (!initial_data) throw new Error('Initial Response Data is undefined.');

            const cookies =
                JSON.parse(initial_data).topbar.desktopTopbarRenderer.interstitial?.consentBumpV2Renderer.agreeButton
                    .buttonRenderer.command.saveConsentAction;
            if (cookies) {
                Object.assign(cookieJar, {
                    VISITOR_INFO1_LIVE: cookies.visitorCookie,
                    CONSENT: cookies.consentCookie
                });
            }

            const updatedValues = await acceptViewerDiscretion(
                player_response.videoDetails.videoId,
                cookieJar,
                body,
                false
            );
            player_response.streamingData = updatedValues.streamingData;
        } else if (player_response.playabilityStatus.status === 'LIVE_STREAM_OFFLINE') upcoming = true;
        else
            throw new Error(
                `While getting info from url\n${
                    player_response.playabilityStatus.errorScreen.playerErrorMessageRenderer?.reason.simpleText ??
                    player_response.playabilityStatus.errorScreen.playerKavRenderer?.reason.simpleText ??
                    player_response.playabilityStatus.reason
                }`
            );
    }
    const html5player = `https://www.youtube.com${body.split('"jsUrl":"')[1].split('"')[0]}`;
    const duration = Number(player_response.videoDetails.lengthSeconds);
    const video_details = {
        url: `https://www.youtube.com/watch?v=${player_response.videoDetails.videoId}`,
        durationInSec: (duration < 0 ? 0 : duration) || 0
    };
    let format = [];
    if (!upcoming) {
        format.push(...(player_response.streamingData.formats ?? []));
        format.push(...(player_response.streamingData.adaptiveFormats ?? []));

        if (parseAudioFormats(format).length === 0 && !options.htmldata) {
            format = await getAndroidFormats(player_response.videoDetails.videoId, cookieJar, body);
        }
    }

    const LiveStreamData = {
        isLive: player_response.videoDetails.isLiveContent,
        dashManifestUrl: player_response.streamingData?.dashManifestUrl ?? null,
        hlsManifestUrl: player_response.streamingData?.hlsManifestUrl ?? null
    };
    return await decipher_info(
        {
            LiveStreamData,
            html5player,
            format,
            video_details
        },
        true
    );
}

/**
 * Gets data from YouTube url or ID or html body data and deciphers it.
 * ```
 * video_basic_info + decipher_info = video_info
 * ```
 *
 * Example
 * ```ts
 * const video = await play.video_info('youtube video url')
 *
 * const res = ... // Any https package get function.
 *
 * const video = await play.video_info(res.body, { htmldata : true })
 * ```
 * @param url YouTube url or ID or html body data
 * @param options Video Info Options
 *  - `boolean` htmldata : given data is html data or not
 * @returns Deciphered Video Info {@link InfoData}.
 */
export async function video_info(url: string, options: InfoOptions = {}): Promise<InfoData> {
    const data = await video_basic_info(url.trim(), options);
    return await decipher_info(data);
}

/**
 * Function uses data from video_basic_info and deciphers it if it contains signatures.
 * @param data Data - {@link InfoData}
 * @param audio_only `boolean` - To decipher only audio formats only.
 * @returns Deciphered Video Info {@link InfoData}
 */
export async function decipher_info<T extends InfoData | StreamInfoData>(
    data: T,
    audio_only: boolean = false
): Promise<T> {
    if (
        data.LiveStreamData.isLive === true &&
        data.LiveStreamData.dashManifestUrl !== null &&
        data.video_details.durationInSec === 0
    ) {
        return data;
    } else if (data.format.length > 0 && (data.format[0].signatureCipher || data.format[0].cipher)) {
        if (audio_only) data.format = parseAudioFormats(data.format);
        data.format = await format_decipher(data.format, data.html5player);
        return data;
    } else return data;
}
