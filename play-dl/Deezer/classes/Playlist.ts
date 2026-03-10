import { request } from '../../Request';
import { DeezerTrack } from './Track';
import { DeezerImage, DeezerUser } from './types';

/**
 * Class for Deezer Playlists
 */
export class DeezerPlaylist {
    /**
     * The id of the playlist
     */
    id: number;
    /**
     * The title of the playlist
     */
    title: string;
    /**
     * Whether the playlist is public or private
     */
    public: boolean;
    /**
     * The URL of the playlist on Deezer
     */
    url: string;
    /**
     * Cover picture of the playlist available in four sizes
     */
    picture: DeezerImage;
    /**
     * The date of the playlist's creation
     */
    creationDate: Date;
    /**
     * The type, always `'playlist'`, useful to determine what the deezer function returned
     */
    type: 'track' | 'playlist' | 'album';
    /**
     * The Deezer user that created the playlist
     */
    creator: DeezerUser;
    /**
     * The number of tracks in the playlist
     */
    tracksCount: number;

    /**
     * Signifies that some properties are not populated
     *
     * Partial playlists can be populated by calling {@link DeezerPlaylist.fetch}.
     *
     * `true` for playlists in search results and `false` if the album was fetched directly or expanded.
     */
    partial: boolean;

    /**
     * Description of the playlist
     *
     * `undefined` for partial playlists
     *
     * @see {@link DeezerPlaylist.partial}
     */
    description?: string;
    /**
     * Duration of the playlist in seconds
     *
     * `undefined` for partial playlists
     *
     * @see {@link DeezerPlaylist.partial}
     */
    durationInSec?: number;
    /**
     * `true` if the playlist is the loved tracks playlist
     *
     * `undefined` for partial playlists
     *
     * @see {@link DeezerPlaylist.partial}
     */
    isLoved?: boolean;
    /**
     * Whether multiple users have worked on the playlist
     *
     * `undefined` for partial playlists
     *
     * @see {@link DeezerPlaylist.partial}
     */
    collaborative?: boolean;
    /**
     * The number of fans the playlist has
     *
     * `undefined` for partial playlists
     *
     * @see {@link DeezerPlaylist.partial}
     */
    fans?: number;

    /**
     * The list of tracks in the playlist
     *
     * empty (length === 0) for partial and non public playlists
     *
     * Use {@link DeezerPlaylist.fetch} to populate the tracks and other properties
     *
     * @see {@link DeezerPlaylist.partial}
     * @see {@link DeezerPlaylist.public}
     */
    tracks: DeezerTrack[];

    /**
     * Creates a Deezer playlist from the data in an API response
     * @param data the data to use to create the playlist
     * @param partial Whether the playlist should be partial
     * @see {@link DeezerPlaylist.partial}
     */
    constructor(data: any, partial: boolean) {
        this.id = data.id;
        this.title = data.title;
        this.public = data.public;
        this.url = data.link;
        this.creationDate = new Date(data.creation_date);
        this.type = 'playlist';
        this.tracksCount = data.nb_tracks;
        this.tracks = [];

        this.picture = {
            xl: data.picture_xl,
            big: data.picture_big,
            medium: data.picture_medium,
            small: data.picture_small
        };

        if (data.user) {
            this.creator = {
                id: data.user.id,
                name: data.user.name
            };
        } else {
            this.creator = {
                id: data.creator.id,
                name: data.creator.name
            };
        }

        this.partial = partial;

        if (!partial) {
            this.description = data.description;
            this.durationInSec = data.duration;
            this.isLoved = data.is_loved_track;
            this.collaborative = data.collaborative;
            this.fans = data.fans;

            if (this.public) {
                this.tracks = data.tracks.data.map((track: any) => {
                    return new DeezerTrack(track, true);
                });
            }
        }
    }

    /**
     * Fetches and populates the missing fields, including all tracks.
     *
     * The property {@link DeezerPlaylist.partial} will be `false` if this method finishes successfully.
     *
     * @returns A promise with the same playlist this method was called on.
     */
    async fetch(): Promise<DeezerPlaylist> {
        if (!this.partial && (this.tracks.length === this.tracksCount || !this.public)) {
            return this;
        }

        if (this.partial) {
            const response = await request(`https://api.deezer.com/playlist/${this.id}/`).catch((err: Error) => err);

            if (response instanceof Error) throw response;
            const jsonData = JSON.parse(response);

            this.partial = false;

            this.description = jsonData.description;
            this.durationInSec = jsonData.duration;
            this.isLoved = jsonData.is_loved_track;
            this.collaborative = jsonData.collaborative;
            this.fans = jsonData.fans;

            if (this.public) {
                this.tracks = jsonData.tracks.data.map((track: any) => {
                    return new DeezerTrack(track, true);
                });
            }
        }

        const currentTracksCount = this.tracks.length;
        if (this.public && currentTracksCount !== this.tracksCount) {
            let missing = this.tracksCount - currentTracksCount;

            if (missing > 1000) missing = 1000;

            const promises: Promise<DeezerTrack[]>[] = [];
            for (let i = 1; i <= Math.ceil(missing / 100); i++) {
                promises.push(
                    new Promise(async (resolve, reject) => {
                        const response = await request(
                            `https://api.deezer.com/playlist/${this.id}/tracks?limit=100&index=${i * 100}`
                        ).catch((err) => reject(err));

                        if (typeof response !== 'string') return;
                        const jsonData = JSON.parse(response);
                        const tracks = jsonData.data.map((track: any) => {
                            return new DeezerTrack(track, true);
                        });

                        resolve(tracks);
                    })
                );
            }

            const results = await Promise.allSettled(promises);
            const newTracks: DeezerTrack[] = [];

            for (const result of results) {
                if (result.status === 'fulfilled') {
                    newTracks.push(...result.value);
                } else {
                    throw result.reason;
                }
            }

            this.tracks.push(...newTracks);
        }

        return this;
    }
    /**
     * Fetches all the tracks in the playlist and returns them
     *
     * ```ts
     * const playlist = await play.deezer('playlist url')
     *
     * const tracks = await playlist.all_tracks()
     * ```
     * @returns An array of {@link DeezerTrack}
     */
    async all_tracks(): Promise<DeezerTrack[]> {
        await this.fetch();

        return this.tracks as DeezerTrack[];
    }
    /**
     * Converts instances of this class to JSON data
     * @returns JSON data.
     */
    toJSON() {
        return {
            id: this.id,
            title: this.title,
            public: this.public,
            url: this.url,
            picture: this.picture,
            creationDate: this.creationDate,
            type: this.type,
            creator: this.creator,
            tracksCount: this.tracksCount,
            description: this.description,
            durationInSec: this.durationInSec,
            isLoved: this.isLoved,
            collaborative: this.collaborative,
            fans: this.fans,
            tracks: this.tracks.map((track) => track.toJSON())
        };
    }
}
