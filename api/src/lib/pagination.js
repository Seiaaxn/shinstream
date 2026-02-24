import { load } from 'cheerio';
const pagination = (html, anoboy = false) => {
    console.log('isAnoboy', anoboy);
    const $ = load(html);
    const current_page = anoboy ? parseInt($('.wp-pagenavi .current').text()) : parseInt($('.pagination .pagenavix .page-numbers.current').text());
    const last_visible_page = anoboy ?  parseInt($('.wp-pagenavi .page.larger:last').text()) : parseInt($('.pagination .pagenavix .page-numbers:last').prev('a.page-numbers').text());
    const next_page = current_page < last_visible_page ? current_page + 1 : null;
    const previous_page = current_page > 1 ? current_page - 1 : null;
    const has_next_page = current_page < last_visible_page;
    const has_previous_page = current_page > 1;
    if (!current_page)
        return false;
    return {
        current_page,
        last_visible_page: current_page < last_visible_page ? last_visible_page : current_page,
        has_next_page,
        next_page,
        has_previous_page,
        previous_page
    };
};
export default pagination;
