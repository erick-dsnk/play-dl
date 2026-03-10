import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { check_id } from './SoundCloud';
import { SpotifyAuthorize } from './Spotify';

/**
 * Authorization interface for Spotify, SoundCloud and YouTube.
 *
 * Either stores info in `.data` folder or shows relevant data to be used in `setToken` function.
 *
 * ```ts
 * const play = require('play-dl')
 *
 * play.authorization()
 * ```
 *
 * Just run the above command and you will get a interface asking some questions.
 */
export function authorization(): void {
    const ask = createInterface({
        input: process.stdin,
        output: process.stdout
    });
    ask.question('Do you want to save data in a file ? (Yes / No): ', (msg) => {
        let file: boolean;
        if (msg.toLowerCase() === 'yes') file = true;
        else if (msg.toLowerCase() === 'no') file = false;
        else {
            console.log("That option doesn't exist. Try again...");
            ask.close();
            return;
        }
        ask.question('Choose your service - sc (for SoundCloud) / sp (for Spotify)  / yo (for YouTube): ', (msg) => {
            if (msg.toLowerCase().startsWith('sp')) {
                let client_id: string, client_secret: string, redirect_url: string, market: string;
                ask.question('Start by entering your Client ID : ', (id) => {
                    client_id = id;
                    ask.question('Now enter your Client Secret : ', (secret) => {
                        client_secret = secret;
                        ask.question('Enter your Redirect URL now : ', (url) => {
                            redirect_url = url;
                            console.log(
                                '\nIf you would like to know your region code visit : \nhttps://en.wikipedia.org/wiki/ISO_3166-1_alpha-2#Officially_assigned_code_elements \n'
                            );
                            ask.question('Enter your region code (2-letter country code) : ', (mar) => {
                                if (mar.length === 2) market = mar;
                                else {
                                    console.log(
                                        "That doesn't look like a valid region code, IN will be selected as default."
                                    );
                                    market = 'IN';
                                }
                                console.log(
                                    '\nNow open your browser and paste the below url, then authorize it and copy the redirected url. \n'
                                );
                                console.log(
                                    `https://accounts.spotify.com/authorize?client_id=${client_id}&response_type=code&redirect_uri=${encodeURI(
                                        redirect_url
                                    )} \n`
                                );
                                ask.question('Paste the url which you just copied : ', async (url) => {
                                    if (!existsSync('.data')) mkdirSync('.data');
                                    const spotifyData = {
                                        client_id,
                                        client_secret,
                                        redirect_url,
                                        authorization_code: url.split('code=')[1],
                                        market
                                    };
                                    const check = await SpotifyAuthorize(spotifyData, file);
                                    if (check === false) throw new Error('Failed to get access token.');
                                    ask.close();
                                });
                            });
                        });
                    });
                });
            } else if (msg.toLowerCase().startsWith('sc')) {
                if (!file) {
                    console.log('You already had a client ID, just paste that in setToken function.');
                    ask.close();
                    return;
                }
                ask.question('Client ID : ', async (id) => {
                    let client_id = id;
                    if (!client_id) {
                        console.log("You didn't provide a client ID. Try again...");
                        ask.close();
                        return;
                    }
                    if (!existsSync('.data')) mkdirSync('.data');
                    console.log('Validating your client ID, hold on...');
                    if (await check_id(client_id)) {
                        console.log('Client ID has been validated successfully.');
                        writeFileSync('.data/soundcloud.data', JSON.stringify({ client_id }, undefined, 4));
                    } else console.log("That doesn't look like a valid client ID. Retry with a correct client ID.");
                    ask.close();
                });
            } else if (msg.toLowerCase().startsWith('yo')) {
                if (!file) {
                    console.log('You already had cookie, just paste that in setToken function.');
                    ask.close();
                    return;
                }
                ask.question('Cookies : ', (cook: string) => {
                    if (!cook || cook.length === 0) {
                        console.log("You didn't provide a cookie. Try again...");
                        ask.close();
                        return;
                    }
                    if (!existsSync('.data')) mkdirSync('.data');
                    console.log('Cookies has been added successfully.');
                    let cookie: Object = {};
                    cook.split(';').forEach((x) => {
                        const arr = x.split('=');
                        if (arr.length <= 1) return;
                        const key = arr.shift()?.trim() as string;
                        const value = arr.join('=').trim();
                        Object.assign(cookie, { [key]: value });
                    });
                    writeFileSync('.data/youtube.data', JSON.stringify({ cookie }, undefined, 4));
                    ask.close();
                });
            } else {
                console.log("That option doesn't exist. Try again...");
                ask.close();
            }
        });
    });
}
