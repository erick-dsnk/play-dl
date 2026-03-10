import { IncomingMessage } from 'node:http';
import { RequestOptions, request as httpsRequest } from 'node:https';
import { URL } from 'node:url';
import { BrotliDecompress, Deflate, Gunzip, createBrotliDecompress, createDeflate, createGunzip } from 'node:zlib';
import { getRandomUserAgent } from './useragent';

interface RequestOpts extends RequestOptions {
    body?: string;
    method?: 'GET' | 'POST' | 'HEAD';
    cookies?: boolean;
    cookieJar?: { [key: string]: string };
    /** When cookies is true, optionally provide a function to get cookie header string. */
    getCookies?: () => string | undefined;
    /** When cookies is true, optionally called with set-cookie headers from response. */
    onSetCookie?: (headers: string[]) => void;
}

/**
 * Makes an HTTPS request and follows redirects (3xx).
 * @param req_url URL to request
 * @param options Request options
 * @param rejectOn4xx If true, reject when status code > 400
 * @returns The final response after following redirects
 */
async function followRedirects(req_url: string, options: RequestOpts, rejectOn4xx: boolean): Promise<IncomingMessage> {
    const res = await https_getter(req_url, options).catch((err: Error) => err);
    if (res instanceof Error) throw res;
    const status = Number(res.statusCode);
    if (status >= 300 && status < 400) {
        return followRedirects(res.headers.location as string, options, rejectOn4xx);
    }
    if (rejectOn4xx && status > 400) {
        throw new Error(`Got ${res.statusCode} from the request`);
    }
    return res;
}

/**
 * Reads the response body and handles gzip/deflate/br decoding.
 */
function readResponseBody(res: IncomingMessage): Promise<string> {
    const data: string[] = [];
    const encoding = res.headers['content-encoding'];
    let decoder: BrotliDecompress | Gunzip | Deflate | undefined;
    if (encoding === 'gzip') decoder = createGunzip();
    else if (encoding === 'br') decoder = createBrotliDecompress();
    else if (encoding === 'deflate') decoder = createDeflate();

    if (decoder) {
        res.pipe(decoder);
        decoder.setEncoding('utf-8');
        decoder.on('data', (c) => data.push(c));
        return new Promise((resolve, reject) => {
            decoder!.on('end', () => resolve(data.join('')));
            decoder!.on('error', reject);
        });
    }
    res.setEncoding('utf-8');
    res.on('data', (c) => data.push(c));
    return new Promise((resolve, reject) => {
        res.on('end', () => resolve(data.join('')));
        res.on('error', reject);
    });
}

/**
 * Main module which play-dl uses to make a request to stream url.
 * @param url URL to make https request to
 * @param options Request options for https request
 * @returns IncomingMessage from the request
 */
export function request_stream(req_url: string, options: RequestOpts = { method: 'GET' }): Promise<IncomingMessage> {
    return followRedirects(req_url, options, false);
}

/**
 * Makes a request and follows redirects if necessary (rejects on 4xx/5xx).
 */
function internalRequest(req_url: string, options: RequestOpts = { method: 'GET' }): Promise<IncomingMessage> {
    return followRedirects(req_url, options, true);
}
/**
 * Main module which play-dl uses to make a request
 * @param url URL to make https request to
 * @param options Request options for https request
 * @returns body of that request
 */
export function request(req_url: string, options: RequestOpts = { method: 'GET' }): Promise<string> {
    return new Promise(async (resolve, reject) => {
        let cookies_added = false;
        if (options.cookies) {
            let cook = options.getCookies?.();
            if (typeof cook === 'string' && cook.length > 0) {
                if (!options.headers) options.headers = {};
                Object.assign(options.headers, { cookie: cook });
                cookies_added = true;
            }
        }
        if (options.cookieJar) {
            const cookies = [];
            for (const cookie of Object.entries(options.cookieJar)) {
                cookies.push(cookie.join('='));
            }

            if (cookies.length !== 0) {
                if (!options.headers) options.headers = {};
                const existingCookies = cookies_added ? `; ${options.headers.cookie}` : '';
                Object.assign(options.headers, { cookie: `${cookies.join('; ')}${existingCookies}` });
            }
        }
        if (options.headers) {
            options.headers = {
                ...options.headers,
                'accept-encoding': 'gzip, deflate, br',
                'user-agent': getRandomUserAgent()
            };
        }
        const res = await internalRequest(req_url, options).catch((err: Error) => err);
        if (res instanceof Error) {
            reject(res);
            return;
        }
        if (res.headers && res.headers['set-cookie']) {
            if (options.cookieJar) {
                for (const cookie of res.headers['set-cookie']) {
                    const parts = cookie.split(';')[0].trim().split('=');
                    options.cookieJar[parts.shift() as string] = parts.join('=');
                }
            }
            if (cookies_added && options.onSetCookie) {
                options.onSetCookie(res.headers['set-cookie']);
            }
        }
        readResponseBody(res).then(resolve).catch(reject);
    });
}

export function request_resolve_redirect(url: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
        let res = await https_getter(url, { method: 'HEAD' }).catch((err: Error) => err);
        if (res instanceof Error) {
            reject(res);
            return;
        }
        const statusCode = Number(res.statusCode);
        if (statusCode < 300) {
            resolve(url);
        } else if (statusCode < 400) {
            const resolved = await request_resolve_redirect(res.headers.location as string).catch((err) => err);
            if (resolved instanceof Error) {
                reject(resolved);
                return;
            }

            resolve(resolved);
        } else {
            reject(new Error(`${res.statusCode}: ${res.statusMessage}, ${url}`));
        }
    });
}

export function request_content_length(url: string): Promise<number> {
    return new Promise(async (resolve, reject) => {
        let res = await https_getter(url, { method: 'HEAD' }).catch((err: Error) => err);
        if (res instanceof Error) {
            reject(res);
            return;
        }
        const statusCode = Number(res.statusCode);
        if (statusCode < 300) {
            resolve(Number(res.headers['content-length']));
        } else if (statusCode < 400) {
            const newURL = await request_resolve_redirect(res.headers.location as string).catch((err) => err);
            if (newURL instanceof Error) {
                reject(newURL);
                return;
            }

            const res2 = await request_content_length(newURL).catch((err) => err);
            if (res2 instanceof Error) {
                reject(res2);
                return;
            }

            resolve(res2);
        } else {
            reject(
                new Error(`Failed to get content length with error: ${res.statusCode}, ${res.statusMessage}, ${url}`)
            );
        }
    });
}

/**
 * Main module that play-dl uses for making a https request
 * @param req_url URL to make https request to
 * @param options Request options for https request
 * @returns Incoming Message from the https request
 */
function https_getter(req_url: string, options: RequestOpts = {}): Promise<IncomingMessage> {
    return new Promise((resolve, reject) => {
        const s = new URL(req_url);
        options.method ??= 'GET';
        const req_options: RequestOptions = {
            host: s.hostname,
            path: s.pathname + s.search,
            headers: options.headers ?? {},
            method: options.method
        };

        const req = httpsRequest(req_options, resolve);
        req.on('error', (err) => {
            reject(err);
        });
        if (options.method === 'POST') req.write(options.body);
        req.end();
    });
}
