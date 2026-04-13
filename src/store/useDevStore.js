import { create } from 'zustand';
import { fetchDevPostList, fetchDevPost, fetchDevDiscussionCounts, fetchSeriesInfo, fetchSeriesEpisode, fetchVisibility } from '../api/github';

let visibilityLoading = false;

const useDevStore = create((set, get) => ({
  posts: [],
  visibility: {},
  currentPost: null,
  currentSeries: null,
  loading: false,
  error: null,
  selectedCategory: 'all',
  searchQuery: '',
  commentCounts: {},
  loadedAt: null,

  loadPosts: async () => {
    const { posts, loading, loadedAt } = get();
    const stale = !loadedAt || Date.now() - loadedAt > 60 * 1000;
    if ((posts.length > 0 && !stale) || loading) return;
    set({ loading: true, error: null });
    try {
      const [posts, commentCounts, visibility] = await Promise.all([
        fetchDevPostList(),
        fetchDevDiscussionCounts(),
        fetchVisibility(),
      ]);
      set({ posts, commentCounts, visibility, loading: false, loadedAt: Date.now() });
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
    set({ posts: [], loadedAt: null });
    get().loadPosts();
  },

  // loadPost() 중에도 loading flag와 무관하게 visibility만 독립적으로 로드
  loadVisibility: async () => {
    const { visibility } = get();
    if (Object.keys(visibility).length > 0 || visibilityLoading) return;
    visibilityLoading = true;
    try {
      const vis = await fetchVisibility();
      set({ visibility: vis });
    } catch { /* silent */ } finally {
      visibilityLoading = false;
    }
  },


  getFilteredPosts: (showAll = false) => {
    const { posts, visibility, selectedCategory, searchQuery } = get();
    return posts.filter((post) => {
      const key = `${post.category}/${post.slug}`;
      if (!showAll && visibility[key] === false) return false;
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
    const { visibility } = get();
    const publicPosts = get().posts.filter((p) => {
      const key = `${p.category}/${p.slug}`;
      return visibility[key] !== false;
    });
    const categories = [...new Set(publicPosts.map((p) => p.category).filter(Boolean))];
    return ['all', ...categories.sort()];
  },

  getPostNav: (category, slug) => {
    const filteredPosts = get().getFilteredPosts().filter((p) => !p.isSeries);
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
