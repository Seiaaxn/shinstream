import { load } from 'cheerio';
const BASEURL = process.env.BASEURL   || 'https://otakudesu.best';
const scrapeGenreLists = (html) => {
    const $ = load(html);
    const result = [];
    const genres = $('#venkonten .vezone ul.genres li a').toString()
        .split('</a>')
        .filter((el) => el.trim() !== '')
        .map((el) => `${el}</a>`);
    genres.forEach((genre) => {
        const $ = load(genre);
        result.push({
            name: $('a').text(),
            slug: $('a').attr('href')?.replace('/genres/', '').replace('/', ''),
            otakudesu_url: `${BASEURL}${$('a').attr('href')}`
        });
    });
    return result;
};
export default scrapeGenreLists;
