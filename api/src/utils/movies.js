import { load } from 'cheerio';
import axios from 'axios';
import pagination from '../lib/pagination.js';
const ANOBOY = process.env.ANOBOY || 'https://ww3.anoboy.app';
const movies = async (page = 1) => {
    console.log(`${ANOBOY}/category/anime-movie/page/${page}`);
    const { data } = await axios.get(`${ANOBOY}/category/anime-movie/page/${page}`);
    const $ = load(data);
    const movies = [];
    $('a[rel="bookmark"]').each((index, element) => {
        const $ = load(element);
        const animex = $('a[rel="bookmark"]').attr('href')?.replace(ANOBOY, '').split('/');
        movies.push({
            title: $('a[rel="bookmark"]').attr('title'),
            years: animex[1],
            month: animex[2],
            slug: animex[3],
            poster: ANOBOY + $('amp-img').attr('src'),
            otakudesu_url: $('a[rel="bookmark"]').attr('href')
        });
    });
    
    return {
        movies,
        pagination: pagination($('.wp-pagenavi').toString(), true)
    }
};
export default movies;
