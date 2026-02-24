import { load } from 'cheerio';
const BASEURL = process.env.BASEURL   || 'https://otakudesu.best';
const mapGenres = (html) => {
    const result = [];
    const genres = html.split('</a>')
        .filter(item => item.trim() !== '')
        .map(item => `${item}</a>`);
    genres.forEach(genre => {
        const $ = load(genre);
        result.push({
            name: $('a').text(),
            slug: $('a').attr('href')?.replace(/^https:\/\/otakudesu\.[a-zA-Z0-9-]+\/genres\//, '').replace('/', ''),
            otakudesu_url: $('a').attr('href')
        });
    });
    return result;
};
export default mapGenres;
