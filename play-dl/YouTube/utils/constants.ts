import { YouTubeVideo } from '../classes/Video';

export const DEFAULT_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

export interface LiveStreamData {
    isLive: boolean;
    dashManifestUrl: string | null;
    hlsManifestUrl: string | null;
}

export interface formatData {
    itag: number;
    mimeType: string;
    bitrate: number;
    width: number;
    height: number;
    lastModified: string;
    contentLength: string;
    quality: string;
    fps: number;
    qualityLabel: string;
    projectionType: string;
    averageBitrate: number;
    audioQuality: string;
    approxDurationMs: string;
    audioSampleRate: string;
    audioChannels: number;
    url: string;
    signatureCipher: string;
    cipher: string;
    loudnessDb: number;
    targetDurationSec: number;
}

export interface InfoData {
    LiveStreamData: LiveStreamData;
    html5player: string;
    format: Partial<formatData>[];
    video_details: YouTubeVideo;
    related_videos: string[];
}

export interface StreamInfoData {
    LiveStreamData: LiveStreamData;
    html5player: string;
    format: Partial<formatData>[];
    video_details: Pick<YouTubeVideo, 'url' | 'durationInSec'>;
}
