import { create } from 'zustand';
import { fetchDevPostList, fetchDevPost, fetchDevDiscussionCounts, fetchSeriesInfo, fetchSeriesEpisode } from '../api/github';

const useDevStore = create((set, get) => ({
  posts: [],
  currentPost: null,
  currentSeries: null,
  loading: false,
  error: null,
  selectedCategory: 'all',
  searchQuery: '',
  commentCounts: {},

  loadPosts: async () => {
    if (get().posts.length > 0 || get().loading) return;
    set({ loading: true, error: null });
    try {
      const [posts, commentCounts] = await Promise.all([
        fetchDevPostList(),
        fetchDevDiscussionCounts(),
      ]);
      set({ posts, commentCounts, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  loadPost: async (category, slug, seriesSlug = null) => {
    const cached = get().currentPost;
    const cacheKey = seriesSlug ? `${category}/${seriesSlug}/${slug}` : `${category}/${slug}`;
    if (cached && cached._cacheKey === cacheKey) return;
    set({ loading: true, error: null, currentPost: null });
    try {
      const post = seriesSlug
        ? await fetchSeriesEpisode(category, seriesSlug, slug)
        : await fetchDevPost(category, slug);
      set({ currentPost: { ...post, _cacheKey: cacheKey }, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  loadSeries: async (category, seriesSlug) => {
    const cached = get().currentSeries;
    if (cached && cached.slug === seriesSlug && cached.category === category) return;
    set({ loading: true, error: null, currentSeries: null });
    try {
      const series = await fetchSeriesInfo(category, seriesSlug);
      set({ currentSeries: series, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  setCategory: (category) => set({ selectedCategory: category }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  clearPost: () => set({ currentPost: null }),
  clearSeries: () => set({ currentSeries: null }),

  refreshPosts: () => {
    set({ posts: [] });
    get().loadPosts();
  },

  getFilteredPosts: () => {
    const { posts, selectedCategory, searchQuery } = get();
    return posts.filter((post) => {
      const matchCategory =
        selectedCategory === 'all' || post.category === selectedCategory;
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !searchQuery ||
        (post.title || '').toLowerCase().includes(q) ||
        (post.description || '').toLowerCase().includes(q) ||
        (post.tags || []).some((tag) => tag.toLowerCase().includes(q));
      return matchCategory && matchSearch;
    });
  },

  getCategories: () => {
    const { posts } = get();
    const categories = [...new Set(posts.map((p) => p.category).filter(Boolean))];
    return ['all', ...categories.sort()];
  },

  getPostNav: (category, slug) => {
    const filteredPosts = get().getFilteredPosts();
    const currentIndex = filteredPosts.findIndex(
      (p) => p.slug === slug && p.category === category,
    );
    if (currentIndex === -1) return { prev: null, next: null };

    return {
      prev: currentIndex > 0 ? filteredPosts[currentIndex - 1] : null,
      next: currentIndex < filteredPosts.length - 1 ? filteredPosts[currentIndex + 1] : null,
    };
  },
}));

export default useDevStore;
