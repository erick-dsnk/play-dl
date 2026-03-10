const video_id_pattern = /^[a-zA-Z\d_-]{11,12}$/;
const playlist_id_pattern = /^(PL|UU|LL|RD|OL)[a-zA-Z\d_-]{10,}$/;
const video_pattern =
    /^((?:https?:)?\/\/)?(?:(?:www|m|music)\.)?((?:youtube\.com|youtu.be))(\/(?:[\w\-]+\?v=|shorts\/|embed\/|live\/|v\/)?)([\w\-]+)(\S+)?$/;
const playlist_pattern =
    /^((?:https?:)?\/\/)?(?:(?:www|m|music)\.)?((?:youtube\.com|youtu.be))\/(?:(playlist|watch))?(.*)?((\?|\&)list=)(PL|UU|LL|RD|OL)[a-zA-Z\d_-]{10,}(&.*)?$/;

/**
 * Validate YouTube URL or ID.
 *
 * **CAUTION :** If your search word is 11 or 12 characters long, you might get it validated as video ID.
 *
 * To avoid above, add one more condition to yt_validate
 * ```ts
 * if (url.startsWith('https') && yt_validate(url) === 'video') {
 *      // YouTube Video Url.
 * }
 * ```
 * @param url YouTube URL OR ID
 * @returns
 * ```
 * 'playlist' | 'video' | 'search' | false
 * ```
 */
export function yt_validate(url: string): 'playlist' | 'video' | 'search' | false {
    const url_ = url.trim();
    if (url_.indexOf('list=') === -1) {
        if (url_.startsWith('https')) {
            if (url_.match(video_pattern)) {
                let id: string;
                if (url_.includes('youtu.be/')) id = url_.split('youtu.be/')[1].split(/(\?|\/|&)/)[0];
                else if (url_.includes('youtube.com/embed/'))
                    id = url_.split('youtube.com/embed/')[1].split(/(\?|\/|&)/)[0];
                else if (url_.includes('youtube.com/shorts/'))
                    id = url_.split('youtube.com/shorts/')[1].split(/(\?|\/|&)/)[0];
                else id = url_.split('watch?v=')[1]?.split(/(\?|\/|&)/)[0];
                if (id?.match(video_id_pattern)) return 'video';
                else return false;
            } else return false;
        } else {
            if (url_.match(video_id_pattern)) return 'video';
            else if (url_.match(playlist_id_pattern)) return 'playlist';
            else return 'search';
        }
    } else {
        if (!url_.match(playlist_pattern)) return yt_validate(url_.replace(/(\?|\&)list=[^&]*/, ''));
        else return 'playlist';
    }
}

/**
 * Extracts the video ID from a YouTube URL.
 *
 * Will return the value of `urlOrId` if it looks like a video ID.
 * @param urlOrId A YouTube URL or video ID
 * @returns the video ID or `false` if it can't find a video ID.
 */
export function extractVideoId(urlOrId: string): string | false {
    if (urlOrId.startsWith('https://') && urlOrId.match(video_pattern)) {
        let id: string;
        if (urlOrId.includes('youtu.be/')) {
            id = urlOrId.split('youtu.be/')[1].split(/(\?|\/|&)/)[0];
        } else if (urlOrId.includes('youtube.com/embed/')) {
            id = urlOrId.split('youtube.com/embed/')[1].split(/(\?|\/|&)/)[0];
        } else if (urlOrId.includes('youtube.com/shorts/')) {
            id = urlOrId.split('youtube.com/shorts/')[1].split(/(\?|\/|&)/)[0];
        } else if (urlOrId.includes('youtube.com/live/')) {
            id = urlOrId.split('youtube.com/live/')[1].split(/(\?|\/|&)/)[0];
        } else {
            id = (urlOrId.split('watch?v=')[1] ?? urlOrId.split('&v=')[1]).split(/(\?|\/|&)/)[0];
        }

        if (id.match(video_id_pattern)) return id;
    } else if (urlOrId.match(video_id_pattern)) {
        return urlOrId;
    }

    return false;
}

/**
 * Extract ID of YouTube url.
 * @param url ID or url of YouTube
 * @returns ID of video or playlist.
 */
export function extractID(url: string): string {
    const check = yt_validate(url);
    if (!check || check === 'search') throw new Error('This is not a YouTube url or videoId or PlaylistID');
    const url_ = url.trim();
    if (url_.startsWith('https')) {
        if (url_.indexOf('list=') === -1) {
            const video_id = extractVideoId(url_);
            if (!video_id) throw new Error('This is not a YouTube url or videoId or PlaylistID');
            return video_id;
        } else {
            return url_.split('list=')[1].split('&')[0];
        }
    } else return url_;
}
