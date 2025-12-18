# 🔗 دليل تكامل المكتبة الشاملة مع Lovable

## المشكلة الأصلية

Lovable يستخدم **Supabase Edge Functions** التي تعمل بـ **Deno**.
مكتبة `better-sqlite3` **لا تعمل في Deno** لأنها تحتاج native bindings.

**النتيجة**: API الشاملة يُرجع ملفات SQLite، لكن Edge Functions لا تستطيع قراءتها!

---

## الحل: خادم وسيط (Middleware Server)

بدلاً من محاولة قراءة SQLite في Edge Functions، نستخدم **خادم Node.js وسيط**:

```
Lovable ──► خادم Node.js ──► API الشاملة
           (يقرأ SQLite)
           (يُرجع JSON)
```

---

## خطوات التنفيذ

### الخطوة 1: نشر الخادم على Railway

1. **إنشاء حساب على Railway**
   - اذهب إلى: https://railway.app
   - سجل دخول بـ GitHub

2. **إنشاء مشروع جديد**
   ```bash
   # في مجلد shamela_test
   git init
   git add .
   git commit -m "Initial commit"
   ```

3. **ربط بـ Railway**
   ```bash
   # تثبيت Railway CLI
   npm install -g @railway/cli
   
   # تسجيل الدخول
   railway login
   
   # إنشاء مشروع
   railway init
   
   # النشر
   railway up
   ```

4. **الحصول على الرابط**
   - بعد النشر، ستحصل على رابط مثل:
   - `https://shamela-api-production.up.railway.app`

### الخطوة 2: تحديث Lovable

في مشروع Lovable، أنشئ ملف `.env`:

```env
VITE_SHAMELA_API_URL=https://shamela-api-production.up.railway.app
```

### الخطوة 3: استبدال Edge Functions

بدلاً من Edge Functions المعقدة، استخدم استدعاء API بسيط:

```typescript
// src/lib/shamela.ts

const SHAMELA_API = import.meta.env.VITE_SHAMELA_API_URL || 'http://localhost:3001';

export async function searchBooks(query: string) {
  const response = await fetch(`${SHAMELA_API}/api/search?q=${encodeURIComponent(query)}`);
  const data = await response.json();
  return data.results;
}

export async function getBookContent(bookId: number) {
  const response = await fetch(`${SHAMELA_API}/api/books/${bookId}/content`);
  const data = await response.json();
  return data.data;
}

export async function syncMaster() {
  const response = await fetch(`${SHAMELA_API}/api/sync/master`, { method: 'POST' });
  return response.json();
}
```

### الخطوة 4: استخدام في React

```tsx
// src/hooks/useShamelaSearch.ts
import { useState } from 'react';
import { searchBooks } from '../lib/shamela';

export function useShamelaSearch() {
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const search = async (query: string) => {
    setIsLoading(true);
    try {
      const data = await searchBooks(query);
      setResults(data.books || []);
    } catch (error) {
      console.error('خطأ في البحث:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return { results, isLoading, search };
}
```

---

## API المتاحة من الخادم

| المسار | الطريقة | الوصف |
|--------|---------|-------|
| `/api/categories` | GET | قائمة الأقسام |
| `/api/authors` | GET | قائمة المؤلفين |
| `/api/books` | GET | قائمة الكتب |
| `/api/books?search=...` | GET | البحث في الكتب |
| `/api/books/:id` | GET | تفاصيل كتاب |
| `/api/books/:id/content` | GET | محتوى كتاب |
| `/api/search?q=...` | GET | بحث شامل |
| `/api/sync/master` | POST | مزامنة البيانات |
| `/api/sync/book/:id` | POST | تحميل كتاب |

---

## مثال كامل للبحث في Lovable

```tsx
import { useState, useEffect } from 'react';

const SHAMELA_API = 'https://your-railway-url.up.railway.app';

function SearchComponent() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${SHAMELA_API}/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.results?.books || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div dir="rtl">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ابحث في المكتبة..."
      />
      <button onClick={handleSearch} disabled={loading}>
        {loading ? 'جارٍ البحث...' : 'بحث'}
      </button>
      
      <div>
        {results.map((book) => (
          <div key={book.id}>
            <h3>{book.name}</h3>
            <p>{book.author}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## البدائل الأخرى

### البديل 1: sql.js في Edge Functions (بطيء)

```typescript
// قد يعمل لكن بطيء ومحدود الذاكرة
import initSqlJs from 'https://esm.sh/sql.js@1.10.0';
```

### البديل 2: تخزين في Supabase Database

1. شغّل الخادم محلياً
2. صدّر البيانات إلى JSON
3. استورد إلى Supabase Database
4. ابحث مباشرة في Supabase

```sql
-- إنشاء جدول الكتب
CREATE TABLE shamela_books (
  id INTEGER PRIMARY KEY,
  name TEXT,
  author TEXT,
  category TEXT,
  bibliography TEXT
);

-- إنشاء فهرس للبحث
CREATE INDEX idx_books_name ON shamela_books USING gin(to_tsvector('arabic', name));
```

---

## الخلاصة

| الطريقة | السهولة | الأداء | التكلفة |
|---------|---------|--------|---------|
| **خادم Railway** ⭐ | سهل | ممتاز | مجاني |
| sql.js في Edge | متوسط | بطيء | مجاني |
| Supabase Database | متقدم | ممتاز | مجاني |

**التوصية**: استخدم **خادم Railway** - أسهل وأسرع حل!
