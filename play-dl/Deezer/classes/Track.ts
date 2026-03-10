import { request } from '../../Request';
import { DeezerArtist } from './Artist';
import { DeezerTrackAlbum } from './TrackAlbum';

/**
 * Class representing a Deezer track
 */
export class DeezerTrack {
    /**
     * The id of the track
     */
    id: number;
    /**
     * The title of the track
     */
    title: string;
    /**
     * A shorter version of the title
     */
    shortTitle: string;
    /**
     * The URL of the track on Deezer
     */
    url: string;
    /**
     * The duration of the track in seconds
     */
    durationInSec: number;
    /**
     * The rank of the track
     */
    rank: number;
    /**
     * `true` if the track contains any explicit lyrics
     */
    explicit: boolean;
    /**
     * URL to a file containing the first 30 seconds of the track
     */
    previewURL: string;
    /**
     * The artist of the track
     */
    artist: DeezerArtist;
    /**
     * The album that this track is in
     */
    album: DeezerTrackAlbum;
    /**
     * The type, always `'track'`, useful to determine what the deezer function returned
     */
    type: 'track' | 'playlist' | 'album';

    /**
     * Signifies that some properties are not populated
     *
     * Partial tracks can be populated by calling {@link DeezerTrack.fetch}.
     *
     * `true` for tracks in search results and `false` if the track was fetched directly or expanded.
     */
    partial: boolean;

    /**
     * The position of the track in the album
     *
     * `undefined` for partial tracks
     *
     * @see {@link DeezerTrack.partial}
     */
    trackPosition?: number;
    /**
     * The number of the disk the track is on
     *
     * `undefined` for partial tracks
     *
     * @see {@link DeezerTrack.partial}
     */
    diskNumber?: number;
    /**
     * The release date
     *
     * `undefined` for partial tracks
     *
     * @see {@link DeezerTrack.partial}
     */
    releaseDate?: Date;
    /**
     * The number of beats per minute
     *
     * `undefined` for partial tracks
     *
     * @see {@link DeezerTrack.partial}
     */
    bpm?: number;
    /**
     * The gain of the track
     *
     * `undefined` for partial tracks
     *
     * @see {@link DeezerTrack.partial}
     */
    gain?: number;
    /**
     * The artists that have contributed to the track
     *
     * `undefined` for partial tracks
     *
     * @see {@link DeezerTrack.partial}
     */
    contributors?: DeezerArtist[];

    /**
     * Creates a Deezer track from the data in an API response
     * @param data the data to use to create the track
     * @param partial Whether the track should be partial
     * @see {@link DeezerTrack.partial}
     */
    constructor(data: any, partial: boolean) {
        this.id = data.id;
        this.title = data.title;
        this.shortTitle = data.title_short;
        this.url = data.link;
        this.durationInSec = data.duration;
        this.rank = data.rank;
        this.explicit = data.explicit_lyrics;
        this.previewURL = data.preview;
        this.artist = new DeezerArtist(data.artist);
        this.album = new DeezerTrackAlbum(data.album);
        this.type = 'track';

        this.partial = partial;

        if (!partial) {
            this.trackPosition = data.track_position;
            this.diskNumber = data.disk_number;
            this.releaseDate = new Date(data.release_date);
            this.bpm = data.bpm;
            this.gain = data.gain;
            this.contributors = [];

            data.contributors.forEach((contributor: any) => {
                this.contributors?.push(new DeezerArtist(contributor));
            });
        }
    }

    /**
     * Fetches and populates the missing fields
     *
     * The property {@link DeezerTrack.partial} will be `false` if this method finishes successfully.
     *
     * @returns A promise with the same track this method was called on.
     */
    async fetch(): Promise<DeezerTrack> {
        if (!this.partial) return this;

        const response = await request(`https://api.deezer.com/track/${this.id}/`).catch((err: Error) => err);

        if (response instanceof Error) throw response;
        const jsonData = JSON.parse(response);

        this.partial = false;

        this.trackPosition = jsonData.track_position;
        this.diskNumber = jsonData.disk_number;
        this.releaseDate = new Date(jsonData.release_date);
        this.bpm = jsonData.bpm;
        this.gain = jsonData.gain;
        this.contributors = [];

        jsonData.contributors.forEach((contributor: any) => {
            this.contributors?.push(new DeezerArtist(contributor));
        });

        return this;
    }
    /**
     * Converts instances of this class to JSON data
     * @returns JSON data.
     */
    toJSON() {
        return {
            id: this.id,
            title: this.title,
            shortTitle: this.shortTitle,
            url: this.url,
            durationInSec: this.durationInSec,
            rank: this.rank,
            explicit: this.explicit,
            previewURL: this.previewURL,
            artist: this.artist,
            album: this.album,
            type: this.type,
            trackPosition: this.trackPosition,
            diskNumber: this.diskNumber,
            releaseDate: this.releaseDate,
            bpm: this.bpm,
            gain: this.gain,
            contributors: this.contributors
        };
    }
}
