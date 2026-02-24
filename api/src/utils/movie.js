import { load } from 'cheerio';
import axios from 'axios';
import {getDownloadLink, getToken, getContent, getWt, listFiles} from 'gofile-downloader';
const ANOBOY = process.env.ANOBOY || 'https://ww3.anoboy.app';
const movie = async (slug) => {
    console.log(`${ANOBOY}${slug}`);
    const { data } = await axios.get(`${ANOBOY}${slug}`);
    const $ = load(data);
    const movie = {};
    const sinopsi = [];
    movie.title = $('.unduhan h3').text().toLowerCase().split('sub')[0];
    movie.poster = ANOBOY + $('.unduhan amp-img').attr('src');

    const downloadUrls = {
        '480p': [],
        '720p': [],
        '1080p': []
    };
    $('.download .ud .udl').each((index, element) => {
        const $$ = load(element);
        const label = $$.text().trim().toLowerCase();
        const link = $$('a').attr('href');
        console.log(label, link);

        if (!link) return;

        if (label.includes('480')) {
            if(link !== 'none') downloadUrls['480p'].push(link);
        } else if (label.includes('720')) {
            if(link !== 'none') downloadUrls['720p'].push(link);
        } else if (label.includes('1k')) {
            if(link !== 'none') downloadUrls['1080p'].push(link);
        }
    });
    movie.download_urls = downloadUrls;
    var stream =  downloadUrls['480p'].map((item) => item.includes('mp4upload') ? item : null).filter((item) => item !== null)[0];
    movie.stream_url = stream;

    return movie;
};
export default movie;
