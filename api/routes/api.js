import { Router } from 'express';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import handler from '../handler/handler.js';
const api = Router();
api.get('/', (_, res) => {
    console.log('test');

    const totalMem = os.totalmem() / (1024 * 1024 * 1024);
    const freeMem = os.freemem() / (1024 * 1024 * 1024);

    const platform = os.platform();
    const release = os.release();
    const arch = os.arch();

    let diskInfo = {};
    try {
      const df = execSync('df -h /').toString();
      const lines = df.trim().split('\n');
      const parts = lines[1].split(/\s+/);
      diskInfo = {
        size: parts[1],
        used: parts[2],
        avail: parts[3],
        usePercent: parts[4],
        mount: parts[5],
      };
    } catch {
      diskInfo = { error: 'df command failed or not available' };
    }

    res.status(200).json({
      status: 'OK',
      message: 'Srcaper API otakudesu',
      system: {
        ram: {
          totalGB: totalMem.toFixed(2),
          freeGB: freeMem.toFixed(2),
        },
        os: {
          platform,
          release,
          arch,
        },
        disk: diskInfo,
      },
    });
});
api.get('/home', handler.homeHandler);
api.get('/search/:keyword', handler.searchAnimeHandler);
api.get('/ongoing-anime/:page?', handler.ongoingAnimeHandler);
api.get('/complete-anime/:page?', handler.completeAnimeHandler);
api.get('/anime/:slug', handler.singleAnimeHandler);
api.get('/anime/:slug/episodes', handler.episodesHandler);
api.get('/anime/:slug/episodes/:episode', handler.episodeByEpisodeNumberHandler);
api.get('/episode/:slug', handler.episodeByEpisodeSlugHandler);
api.get('/batch/:slug', handler.batchByBatchSlugHandler);
api.get('/anime/:slug/batch', handler.batchHandler);
api.get('/genres', handler.genreListsHandler);
api.get('/genres/:slug/:page?', handler.animeByGenreHandler);
api.get('/movies/:page', handler.moviesHandler);
api.get('/movies/:year/:month/:slug', handler.singleMovieHandler);

export default api;
        
