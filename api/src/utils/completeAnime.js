import axios from 'axios';
import { load } from 'cheerio';
import pagination from '../lib/pagination.js';
import scrapeCompleteAnime from '../lib/scrapeCompleteAnime.js';
const BASEURL = process.env.BASEURL   || 'https://otakudesu.best';
const completeAnime = async (page = 1) => {
    const { data } = await axios.get(`${BASEURL}/complete-anime/page/${page}`);
    const $ = load(data);
    const completeAnimeEls = $('.venutama .rseries .rapi .venz ul li').toString();
    const completeAnimeData = scrapeCompleteAnime(completeAnimeEls);
    const paginationData = pagination($('.pagination').toString());
    return {
        paginationData,
        completeAnimeData
    };
};
export default completeAnime;
