import { create } from 'zustand';
import { fetchDevPostList, fetchDevPost, fetchDevDiscussionCounts } from '../api/github';

const useDevStore = create((set, get) => ({
  posts: [],
  currentPost: null,
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

  loadPost: async (category, slug) => {
    const cached = get().currentPost;
    if (cached && cached.slug === slug && cached.category === category) return;
    set({ loading: true, error: null, currentPost: null });
    try {
      const post = await fetchDevPost(category, slug);
      set({ currentPost: post, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  setCategory: (category) => set({ selectedCategory: category }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  clearPost: () => set({ currentPost: null }),

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
    const categories = [
      ...new Set(posts.map((p) => p.category).filter(Boolean)),
    ];
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
