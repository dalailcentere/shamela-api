// ============================================================
// 📋 كود جاهز للصق في Lovable - المكتبة الإسلامية
// ============================================================
// 
// الخطوات:
// 1. انشر الخادم على Railway أولاً (راجع LOVABLE_INTEGRATION.md)
// 2. استبدل SHAMELA_API_URL برابط Railway الخاص بك
// 3. انسخ هذا الكود إلى مشروع Lovable
//
// ============================================================

// ==================== الإعدادات ====================
// غيّر هذا الرابط إلى رابط Railway الخاص بك
const SHAMELA_API_URL = 'http://localhost:3001'; // أو https://your-app.up.railway.app

// ==================== أنواع البيانات ====================
interface Book {
  id: number;
  name: string;
  author?: string;
  category?: string;
  isDownloaded?: boolean;
}

interface SearchResult {
  books: Book[];
  authors: { id: number; name: string; death_text?: string }[];
}

interface BookPage {
  id: number;
  part?: string;
  page: number;
  content: string;
}

interface BookContent {
  pages: BookPage[];
  titles: any[];
  totalPages: number;
}

// ==================== دوال API ====================

/**
 * البحث في المكتبة
 */
export async function searchShamela(query: string): Promise<SearchResult> {
  try {
    const response = await fetch(
      `${SHAMELA_API_URL}/api/search?q=${encodeURIComponent(query)}`
    );
    const data = await response.json();
    return data.results || { books: [], authors: [] };
  } catch (error) {
    console.error('خطأ في البحث:', error);
    return { books: [], authors: [] };
  }
}

/**
 * جلب قائمة الكتب
 */
export async function getBooks(params?: {
  search?: string;
  category?: number;
  limit?: number;
  offset?: number;
}): Promise<{ books: Book[]; total: number }> {
  try {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.category) query.set('category', params.category.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());

    const response = await fetch(`${SHAMELA_API_URL}/api/books?${query}`);
    const data = await response.json();
    return { books: data.data || [], total: data.total || 0 };
  } catch (error) {
    console.error('خطأ:', error);
    return { books: [], total: 0 };
  }
}

/**
 * جلب تفاصيل كتاب
 */
export async function getBookDetails(bookId: number) {
  try {
    const response = await fetch(`${SHAMELA_API_URL}/api/books/${bookId}`);
    const data = await response.json();
    return data.data || null;
  } catch (error) {
    console.error('خطأ:', error);
    return null;
  }
}

/**
 * جلب محتوى كتاب (الصفحات والفهرس)
 */
export async function getBookContent(bookId: number): Promise<BookContent | null> {
  try {
    const response = await fetch(`${SHAMELA_API_URL}/api/books/${bookId}/content`);
    const data = await response.json();
    return data.data || null;
  } catch (error) {
    console.error('خطأ:', error);
    return null;
  }
}

/**
 * تحميل/مزامنة كتاب
 */
export async function downloadBook(bookId: number): Promise<boolean> {
  try {
    const response = await fetch(
      `${SHAMELA_API_URL}/api/sync/book/${bookId}`,
      { method: 'POST' }
    );
    const data = await response.json();
    return data.success || false;
  } catch (error) {
    console.error('خطأ:', error);
    return false;
  }
}

/**
 * مزامنة البيانات الأساسية (أول مرة)
 */
export async function syncMasterData() {
  try {
    const response = await fetch(
      `${SHAMELA_API_URL}/api/sync/master`,
      { method: 'POST' }
    );
    return response.json();
  } catch (error) {
    console.error('خطأ:', error);
    return { success: false };
  }
}

/**
 * جلب الإحصائيات
 */
export async function getStats() {
  try {
    const response = await fetch(`${SHAMELA_API_URL}/api/stats`);
    const data = await response.json();
    return data.stats || { books: 0, authors: 0, categories: 0 };
  } catch (error) {
    console.error('خطأ:', error);
    return { books: 0, authors: 0, categories: 0 };
  }
}

// ==================== React Hooks ====================

import { useState, useEffect, useCallback } from 'react';

/**
 * Hook للبحث في المكتبة
 */
export function useShamelaSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult>({ books: [], authors: [] });
  const [isLoading, setIsLoading] = useState(false);

  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults({ books: [], authors: [] });
      return;
    }

    setIsLoading(true);
    try {
      const data = await searchShamela(searchQuery);
      setResults(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query) search(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  return { query, setQuery, results, isLoading, search };
}

/**
 * Hook لجلب كتاب مع محتواه
 */
export function useBook(bookId: number | null) {
  const [book, setBook] = useState<any>(null);
  const [content, setContent] = useState<BookContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookId) return;

    const loadBook = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // جلب تفاصيل الكتاب
        const bookData = await getBookDetails(bookId);
        setBook(bookData);

        // محاولة جلب المحتوى
        if (bookData?.hasContent) {
          const contentData = await getBookContent(bookId);
          setContent(contentData);
        }
      } catch (err) {
        setError('فشل في جلب الكتاب');
      } finally {
        setIsLoading(false);
      }
    };

    loadBook();
  }, [bookId]);

  const download = async () => {
    if (!bookId) return false;
    setIsLoading(true);
    const success = await downloadBook(bookId);
    if (success) {
      // إعادة جلب المحتوى
      const contentData = await getBookContent(bookId);
      setContent(contentData);
    }
    setIsLoading(false);
    return success;
  };

  return { book, content, isLoading, error, download };
}

// ==================== مكونات React ====================

/**
 * مكون البحث الفوري
 */
export function ShamelaSearchBox({ onSelect }: { onSelect?: (book: Book) => void }) {
  const { query, setQuery, results, isLoading } = useShamelaSearch();

  return (
    <div className="relative w-full max-w-md" dir="rtl">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ابحث في المكتبة الإسلامية..."
        className="w-full px-4 py-3 pr-10 rounded-lg border border-gray-300 
                   focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
      
      {isLoading && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent 
                          rounded-full animate-spin" />
        </div>
      )}

      {results.books.length > 0 && (
        <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-lg 
                        border border-gray-200 max-h-80 overflow-y-auto z-50">
          {results.books.map((book) => (
            <button
              key={book.id}
              onClick={() => onSelect?.(book)}
              className="w-full px-4 py-3 text-right hover:bg-emerald-50 
                         border-b border-gray-100 last:border-0"
            >
              <p className="font-medium text-gray-900">{book.name}</p>
              {book.author && (
                <p className="text-sm text-gray-500">{book.author}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * مكون عرض قائمة الكتب
 */
export function ShamelaBooksList() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const loadBooks = async () => {
      setLoading(true);
      const data = await getBooks({ limit: 20, offset: (page - 1) * 20 });
      setBooks(data.books);
      setTotal(data.total);
      setLoading(false);
    };
    loadBooks();
  }, [page]);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent 
                        rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div dir="rtl">
      <p className="mb-4 text-gray-600">
        إجمالي الكتب: {total.toLocaleString('ar-SA')}
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {books.map((book) => (
          <div
            key={book.id}
            className="p-4 bg-white rounded-lg shadow border border-gray-100 
                       hover:shadow-lg transition-shadow"
          >
            <h3 className="font-bold text-gray-900 mb-2">{book.name}</h3>
            {book.author && (
              <p className="text-sm text-gray-600">{book.author}</p>
            )}
            {book.category && (
              <span className="inline-block mt-2 px-2 py-1 bg-emerald-100 
                             text-emerald-700 text-xs rounded">
                {book.category}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex justify-center gap-2 mt-6">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="px-4 py-2 bg-gray-100 rounded disabled:opacity-50"
        >
          السابق
        </button>
        <span className="px-4 py-2">صفحة {page}</span>
        <button
          onClick={() => setPage(p => p + 1)}
          disabled={page * 20 >= total}
          className="px-4 py-2 bg-gray-100 rounded disabled:opacity-50"
        >
          التالي
        </button>
      </div>
    </div>
  );
}

// ==================== مثال الاستخدام ====================
/*

// في App.tsx أو أي صفحة:

import { ShamelaSearchBox, ShamelaBooksList, syncMasterData } from './shamela';

function MyApp() {
  const [selectedBook, setSelectedBook] = useState(null);

  // مزامنة البيانات عند أول تحميل
  useEffect(() => {
    syncMasterData();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">المكتبة الإسلامية</h1>
      
      <ShamelaSearchBox onSelect={(book) => setSelectedBook(book)} />
      
      <div className="mt-8">
        <ShamelaBooksList />
      </div>
    </div>
  );
}

*/
