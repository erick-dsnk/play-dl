import { DeezerImage } from './types';

/**
 * Class representing a Deezer artist
 */
export class DeezerArtist {
    /**
     * The id of the artist
     */
    id: number;
    /**
     * The name of the artist
     */
    name: string;
    /**
     * The URL of the artist on Deezer
     */
    url: string;

    /**
     * The picture of the artist available in four sizes
     */
    picture?: DeezerImage;
    /**
     * The of the artist on the track
     */
    role?: string;

    constructor(data: any) {
        this.id = data.id;
        this.name = data.name;

        this.url = data.link ? data.link : `https://www.deezer.com/artist/${data.id}/`;

        if (data.picture_xl)
            this.picture = {
                xl: data.picture_xl,
                big: data.picture_big,
                medium: data.picture_medium,
                small: data.picture_small
            };

        if (data.role) this.role = data.role;
    }
}
