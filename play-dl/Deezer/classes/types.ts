/**
 * Interface representing an image on Deezer
 * available in four sizes
 */
export interface DeezerImage {
    /**
     * The largest version of the image
     */
    xl: string;
    /**
     * The second largest version of the image
     */
    big: string;
    /**
     * The second smallest version of the image
     */
    medium: string;
    /**
     * The smallest version of the image
     */
    small: string;
}

/**
 * Interface representing a Deezer genre
 */
export interface DeezerGenre {
    /**
     * The name of the genre
     */
    name: string;
    /**
     * The thumbnail of the genre available in four sizes
     */
    picture: DeezerImage;
}

/**
 * Interface representing a Deezer user account
 */
export interface DeezerUser {
    /**
     * The id of the user
     */
    id: number;
    /**
     * The name of the user
     */
    name: string;
}
