import axios from 'axios';
import scrapeSingleAnime from '../lib/scrapeSingleAnime.js';
const BASEURL = process.env.BASEURL   || 'https://otakudesu.best';
const anime = async (slug) => {
    const { data } = await axios.get(`${BASEURL}/anime/${slug}`);
    const result = scrapeSingleAnime(data);
    return result;
};
export default anime;
