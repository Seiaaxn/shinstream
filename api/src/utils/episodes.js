import axios from 'axios';
import scrapeAnimeEpisodes from '../lib/scrapeAnimeEpisodes.js';
const BASEURL = process.env.BASEURL   || 'https://otakudesu.best';
const episodes = async (slug) => {
    const { data } = await axios.get(`${BASEURL}/anime/${slug}`);
    const result = scrapeAnimeEpisodes(data);
    return result;
};
export default episodes;
