const express = require('express');
const router = express.Router();
const {
  addComment,
  getComments,
  getCommentReplies,
  likeComment,
  unlikeComment,
  isCommentLiked,
  reportComment,
  deleteComment,
  getAnimeAverageRating,
  getAnimeReviews,
  addAnimeRating,
  getAnimeRating
} = require('../models/database');

function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Login required' });
  }
  next();
}

// Get comments for anime or episode
router.get('/:animeSlug', async (req, res) => {
  try {
    const { animeSlug } = req.params;
    const { episode, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const episodeNumber = episode ? parseInt(episode) : null;
    const comments = await getComments(animeSlug, episodeNumber, parseInt(limit), offset);
    
    // Get user's like status for each comment if logged in
    if (req.session.userId) {
      for (let comment of comments) {
        comment.isLiked = await isCommentLiked(req.session.userId, comment.id);
      }
    }
    
    res.json({
      success: true,
      comments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: comments.length === parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Get replies for a comment
router.get('/:animeSlug/replies/:commentId', async (req, res) => {
  try {
    const { commentId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const replies = await getCommentReplies(parseInt(commentId), parseInt(limit), offset);
    
    // Get user's like status for each reply if logged in
    if (req.session.userId) {
      for (let reply of replies) {
        reply.isLiked = await isCommentLiked(req.session.userId, reply.id);
      }
    }
    
    res.json({
      success: true,
      replies,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: replies.length === parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get replies error:', error);
    res.status(500).json({ error: 'Failed to fetch replies' });
  }
});

// Add a new comment
router.post('/:animeSlug', requireLogin, async (req, res) => {
  try {
    const { animeSlug } = req.params;
    const { content, episode, parentId } = req.body;
    
    if (!content || content.trim().length < 3) {
      return res.status(400).json({ error: 'Comment must be at least 3 characters long' });
    }
    
    if (content.length > 1000) {
      return res.status(400).json({ error: 'Comment is too long (max 1000 characters)' });
    }
    
    const episodeNumber = episode ? parseInt(episode) : null;
    const parentCommentId = parentId ? parseInt(parentId) : null;
    
    const commentId = await addComment(
      req.session.userId,
      animeSlug,
      episodeNumber,
      parentCommentId,
      content.trim()
    );
    
    res.json({
      success: true,
      commentId,
      message: 'Comment added successfully'
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Like/unlike a comment
router.post('/:animeSlug/like/:commentId', requireLogin, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { action } = req.body; // 'like' or 'unlike'
    
    if (action === 'like') {
      await likeComment(req.session.userId, parseInt(commentId));
    } else if (action === 'unlike') {
      await unlikeComment(req.session.userId, parseInt(commentId));
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Like comment error:', error);
    res.status(500).json({ error: 'Failed to update like status' });
  }
});

// Report a comment
router.post('/:animeSlug/report/:commentId', requireLogin, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { reason, description } = req.body;
    
    if (!reason) {
      return res.status(400).json({ error: 'Report reason is required' });
    }
    
    await reportComment(req.session.userId, parseInt(commentId), reason, description || '');
    
    res.json({
      success: true,
      message: 'Comment reported successfully'
    });
  } catch (error) {
    console.error('Report comment error:', error);
    res.status(500).json({ error: 'Failed to report comment' });
  }
});

// Delete a comment (only by the author)
router.delete('/:animeSlug/:commentId', requireLogin, async (req, res) => {
  try {
    const { commentId } = req.params;
    
    const deleted = await deleteComment(parseInt(commentId), req.session.userId);
    
    if (deleted === 0) {
      return res.status(404).json({ error: 'Comment not found or not authorized' });
    }
    
    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// Get anime ratings and reviews
router.get('/:animeSlug/ratings', async (req, res) => {
  try {
    const { animeSlug } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const [averageRating, reviews] = await Promise.all([
      getAnimeAverageRating(animeSlug),
      getAnimeReviews(animeSlug, parseInt(limit), offset)
    ]);
    
    // Get user's rating if logged in
    let userRating = null;
    if (req.session.userId) {
      userRating = await getAnimeRating(req.session.userId, animeSlug);
    }
    
    res.json({
      success: true,
      averageRating,
      userRating,
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: reviews.length === parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get ratings error:', error);
    res.status(500).json({ error: 'Failed to fetch ratings' });
  }
});

// Add or update anime rating
router.post('/:animeSlug/rate', requireLogin, async (req, res) => {
  try {
    const { animeSlug } = req.params;
    const { rating, review } = req.body;
    
    if (!rating || rating < 1 || rating > 10) {
      return res.status(400).json({ error: 'Rating must be between 1 and 10' });
    }
    
    if (review && review.length > 2000) {
      return res.status(400).json({ error: 'Review is too long (max 2000 characters)' });
    }
    
    await addAnimeRating(req.session.userId, animeSlug, parseInt(rating), review || null);
    
    res.json({
      success: true,
      message: 'Rating saved successfully'
    });
  } catch (error) {
    console.error('Add rating error:', error);
    res.status(500).json({ error: 'Failed to save rating' });
  }
});

module.exports = router;
