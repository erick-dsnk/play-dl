import { request } from '../../Request';
import { DeezerArtist } from './Artist';
import { DeezerTrack } from './Track';
import { DeezerGenre, DeezerImage } from './types';

/**
 * Class for Deezer Albums
 */
export class DeezerAlbum {
    /**
     * The id of the album
     */
    id: number;
    /**
     * The title of the album
     */
    title: string;
    /**
     * The URL to the album on Deezer
     */
    url: string;
    /**
     * The record type of the album (e.g. EP, ALBUM, etc ...)
     */
    recordType: string;
    /**
     * `true` if the album contains any explicit lyrics
     */
    explicit: boolean;
    /**
     * The artist of the album
     */
    artist: DeezerArtist;
    /**
     * The album cover available in four sizes
     */
    cover: DeezerImage;
    /**
     * The type, always `'album'`, useful to determine what the deezer function returned
     */
    type: 'track' | 'playlist' | 'album';
    /**
     * The number of tracks in the album
     */
    tracksCount: number;

    /**
     * Signifies that some properties are not populated
     *
     * Partial albums can be populated by calling {@link DeezerAlbum.fetch}.
     *
     * `true` for albums in search results and `false` if the album was fetched directly or expanded.
     */
    partial: boolean;

    /**
     * The **u**niversal **p**roduct **c**ode of the album
     *
     * `undefined` for partial albums
     *
     * @see {@link DeezerAlbum.partial}
     */
    upc?: string;
    /**
     * The duration of the album in seconds
     *
     * `undefined` for partial albums
     *
     * @see {@link DeezerAlbum.partial}
     */
    durationInSec?: number;
    /**
     * The number of fans the album has
     *
     * `undefined` for partial albums
     *
     * @see {@link DeezerAlbum.partial}
     */
    numberOfFans?: number;
    /**
     * The release date of the album
     *
     * `undefined` for partial albums
     *
     * @see {@link DeezerAlbum.partial}
     */
    releaseDate?: Date;
    /**
     * Whether the album is available
     *
     * `undefined` for partial albums
     *
     * @see {@link DeezerAlbum.partial}
     */
    available?: boolean;
    /**
     * The list of genres present in this album
     *
     * `undefined` for partial albums
     *
     * @see {@link DeezerAlbum.partial}
     */
    genres?: DeezerGenre[];
    /**
     * The contributors to the album
     *
     * `undefined` for partial albums
     *
     * @see {@link DeezerAlbum.partial}
     */
    contributors?: DeezerArtist[];

    /**
     * The list of tracks in the album
     *
     * empty (length === 0) for partial albums
     *
     * Use {@link DeezerAlbum.fetch} to populate the tracks and other properties
     *
     * @see {@link DeezerAlbum.partial}
     */
    tracks: DeezerTrack[];

    /**
     * Creates a Deezer album from the data in an API response
     * @param data the data to use to create the album
     * @param partial Whether the album should be partial
     * @see {@link DeezerAlbum.partial}
     */
    constructor(data: any, partial: boolean) {
        this.id = data.id;
        this.title = data.title;
        this.url = data.link;
        this.recordType = data.record_type;
        this.explicit = data.explicit_lyrics;
        this.artist = new DeezerArtist(data.artist);
        this.type = 'album';
        this.tracksCount = data.nb_tracks;
        this.contributors = [];
        this.genres = [];
        this.tracks = [];
        this.cover = {
            xl: data.cover_xl,
            big: data.cover_big,
            medium: data.cover_medium,
            small: data.cover_small
        };

        this.partial = partial;

        if (!partial) {
            this.upc = data.upc;
            this.durationInSec = data.duration;
            this.numberOfFans = data.fans;
            this.releaseDate = new Date(data.release_date);
            this.available = data.available;

            data.contributors.forEach((contributor: any) => {
                this.contributors?.push(new DeezerArtist(contributor));
            });

            data.genres.data.forEach((genre: any) => {
                this.genres?.push({
                    name: genre.name,
                    picture: {
                        xl: `${genre.picture}?size=xl`,
                        big: `${genre.picture}?size=big`,
                        medium: `${genre.picture}?size=medium`,
                        small: `${genre.picture}?size=small`
                    }
                });
            });

            const trackAlbum: any = {
                id: this.id,
                title: this.title,
                cover_xl: this.cover.xl,
                cover_big: this.cover.big,
                cover_medium: this.cover.medium,
                cover_small: this.cover.small,
                release_date: data.release_date
            };
            data.tracks.data.forEach((track: any) => {
                track.album = trackAlbum;
                this.tracks.push(new DeezerTrack(track, true));
            });
        }
    }

    /**
     * Fetches and populates the missing fields including all tracks.
     *
     * The property {@link DeezerAlbum.partial} will be `false` if this method finishes successfully.
     *
     * @returns A promise with the same album this method was called on.
     */
    async fetch(): Promise<DeezerAlbum> {
        if (!this.partial) return this;

        const response = await request(`https://api.deezer.com/album/${this.id}/`).catch((err: Error) => err);

        if (response instanceof Error) throw response;
        const jsonData = JSON.parse(response);

        this.partial = false;

        this.upc = jsonData.upc;
        this.durationInSec = jsonData.duration;
        this.numberOfFans = jsonData.fans;
        this.releaseDate = new Date(jsonData.release_date);
        this.available = jsonData.available;
        this.contributors = [];
        this.genres = [];
        this.tracks = [];

        jsonData.contributors.forEach((contributor: any) => {
            this.contributors?.push(new DeezerArtist(contributor));
        });

        jsonData.genres.data.forEach((genre: any) => {
            this.genres?.push({
                name: genre.name,
                picture: {
                    xl: `${genre.picture}?size=xl`,
                    big: `${genre.picture}?size=big`,
                    medium: `${genre.picture}?size=medium`,
                    small: `${genre.picture}?size=small`
                }
            });
        });

        const trackAlbum: any = {
            id: this.id,
            title: this.title,
            cover_xl: this.cover.xl,
            cover_big: this.cover.big,
            cover_medium: this.cover.medium,
            cover_small: this.cover.small,
            release_date: jsonData.release_date
        };
        jsonData.tracks.data.forEach((track: any) => {
            track.album = trackAlbum;
            this.tracks.push(new DeezerTrack(track, true));
        });

        return this;
    }
    /**
     * Fetches all the tracks in the album and returns them
     *
     * ```ts
     * const album = await play.deezer('album url')
     *
     * const tracks = await album.all_tracks()
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
            url: this.url,
            recordType: this.recordType,
            explicit: this.explicit,
            artist: this.artist,
            cover: this.cover,
            type: this.type,
            upc: this.upc,
            tracksCount: this.tracksCount,
            durationInSec: this.durationInSec,
            numberOfFans: this.numberOfFans,
            releaseDate: this.releaseDate,
            available: this.available,
            genres: this.genres,
            contributors: this.contributors,
            tracks: this.tracks.map((track) => track.toJSON())
        };
    }
}
