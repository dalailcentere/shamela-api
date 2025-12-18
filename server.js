/**
 * 🕌 خادم API للمكتبة الإسلامية
 * 
 * يوفر:
 * - /api/categories - قائمة الأقسام
 * - /api/authors - قائمة المؤلفين
 * - /api/books - قائمة الكتب مع البحث والفلترة
 * - /api/books/:id - تفاصيل كتاب
 * - /api/books/:id/content - محتوى كتاب (الصفحات والفهرس)
 * - /api/sync/master - مزامنة بيانات Master
 * - /api/sync/book/:id - مزامنة كتاب معين
 * 
 * الاستخدام:
 * npm install express cors
 * node server.js
 */

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import AdmZip from 'adm-zip';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

// ==================== الإعدادات ====================
const CONFIG = {
    API_KEY: "a81267-6a3bfd-15ea5d-47baac-33c9c2",
    BASE_URL: "https://dev.shamela.ws/api/v1",
    DATA_DIR: "./shamela_data",
    CACHE_DIR: "./shamela_cache",
    PORT: 3001
};

// ==================== تهيئة المجلدات ====================
[CONFIG.DATA_DIR, CONFIG.CACHE_DIR, path.join(CONFIG.DATA_DIR, 'books')].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// ==================== الدوال المساعدة ====================

function loadMasterData() {
    const masterPath = path.join(CONFIG.DATA_DIR, 'master.json');
    if (fs.existsSync(masterPath)) {
        return JSON.parse(fs.readFileSync(masterPath, 'utf8'));
    }
    return { category: [], book: [], author: [] };
}

function loadBookData(bookId) {
    const bookPath = path.join(CONFIG.DATA_DIR, 'books', `${bookId}.json`);
    if (fs.existsSync(bookPath)) {
        return JSON.parse(fs.readFileSync(bookPath, 'utf8'));
    }
    return null;
}

function getSavedVersion(type) {
    const versionFile = path.join(CONFIG.CACHE_DIR, `${type}_version.json`);
    if (fs.existsSync(versionFile)) {
        return JSON.parse(fs.readFileSync(versionFile, 'utf8'));
    }
    return { version: 0, major: 0, minor: 0 };
}

function saveVersion(type, versionData) {
    const versionFile = path.join(CONFIG.CACHE_DIR, `${type}_version.json`);
    fs.writeFileSync(versionFile, JSON.stringify(versionData, null, 2));
}

async function downloadAndExtract(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`فشل التحميل: ${response.status}`);
    
    const buffer = await response.arrayBuffer();
    const zip = new AdmZip(Buffer.from(buffer));
    const entries = zip.getEntries();
    const results = {};
    
    for (const entry of entries) {
        if (entry.entryName.endsWith('.db')) {
            const tableName = entry.entryName.replace('.db', '');
            const dbBuffer = entry.getData();
            const tempDbPath = path.join(CONFIG.CACHE_DIR, `temp_${Date.now()}.db`);
            
            fs.writeFileSync(tempDbPath, dbBuffer);
            const db = new Database(tempDbPath);
            const rows = db.prepare(`SELECT * FROM ${tableName}`).all();
            db.close();
            fs.unlinkSync(tempDbPath);
            
            results[tableName] = rows.map(row => {
                const processed = {};
                for (const [key, value] of Object.entries(row)) {
                    processed[key] = value === '#' ? null : value;
                }
                return processed;
            });
        }
    }
    
    return results;
}

// ==================== مسارات API ====================

// الصفحة الرئيسية
app.get('/', (req, res) => {
    res.json({
        name: "🕌 المكتبة الإسلامية API",
        version: "1.0.0",
        endpoints: {
            categories: "/api/categories",
            authors: "/api/authors",
            books: "/api/books",
            bookDetails: "/api/books/:id",
            bookContent: "/api/books/:id/content",
            syncMaster: "/api/sync/master",
            syncBook: "/api/sync/book/:id",
            search: "/api/search?q=..."
        }
    });
});

// قائمة الأقسام
app.get('/api/categories', (req, res) => {
    const master = loadMasterData();
    const categories = (master.category || [])
        .filter(c => c.is_deleted !== '1' && c.is_deleted !== 1)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(c => ({
            id: c.id,
            name: c.name,
            order: c.order,
            bookCount: (master.book || []).filter(b => b.category === c.id).length
        }));
    
    res.json({
        success: true,
        count: categories.length,
        data: categories
    });
});

// قائمة المؤلفين
app.get('/api/authors', (req, res) => {
    const { search, limit = 50, offset = 0 } = req.query;
    const master = loadMasterData();
    
    let authors = (master.author || [])
        .filter(a => a.is_deleted !== '1' && a.is_deleted !== 1);
    
    // البحث
    if (search) {
        const searchLower = search.toLowerCase();
        authors = authors.filter(a => 
            (a.name && a.name.toLowerCase().includes(searchLower)) ||
            (a.biography && a.biography.toLowerCase().includes(searchLower))
        );
    }
    
    // الترتيب حسب تاريخ الوفاة
    authors.sort((a, b) => (a.death_number || 9999) - (b.death_number || 9999));
    
    // التصفح
    const total = authors.length;
    authors = authors.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    
    // إضافة عدد الكتب
    authors = authors.map(a => ({
        id: a.id,
        name: a.name,
        biography: a.biography,
        death_text: a.death_text,
        death_number: a.death_number,
        bookCount: (master.book || []).filter(b => 
            b.author && b.author.split(',').map(id => parseInt(id.trim())).includes(a.id)
        ).length
    }));
    
    res.json({
        success: true,
        total,
        count: authors.length,
        offset: parseInt(offset),
        limit: parseInt(limit),
        data: authors
    });
});

// قائمة الكتب
app.get('/api/books', (req, res) => {
    const { search, category, author, type, limit = 50, offset = 0 } = req.query;
    const master = loadMasterData();
    
    let books = (master.book || [])
        .filter(b => b.is_deleted !== '1' && b.is_deleted !== 1);
    
    // البحث
    if (search) {
        const searchLower = search.toLowerCase();
        books = books.filter(b => 
            (b.name && b.name.toLowerCase().includes(searchLower)) ||
            (b.bibliography && b.bibliography.toLowerCase().includes(searchLower))
        );
    }
    
    // فلترة حسب القسم
    if (category) {
        books = books.filter(b => b.category === parseInt(category));
    }
    
    // فلترة حسب المؤلف
    if (author) {
        books = books.filter(b => 
            b.author && b.author.split(',').map(id => parseInt(id.trim())).includes(parseInt(author))
        );
    }
    
    // فلترة حسب النوع
    if (type) {
        books = books.filter(b => b.type === parseInt(type));
    }
    
    // الترتيب
    books.sort((a, b) => (a.date || 9999) - (b.date || 9999));
    
    const total = books.length;
    books = books.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    
    // إثراء البيانات
    books = books.map(b => {
        // المؤلف
        let authorName = null;
        if (b.author && master.author) {
            const authorIds = b.author.split(',').map(id => parseInt(id.trim()));
            const authors = master.author.filter(a => authorIds.includes(a.id));
            if (authors.length > 0) {
                authorName = authors.map(a => a.name).join(' و ');
            }
        }
        
        // القسم
        let categoryName = null;
        if (b.category && master.category) {
            const cat = master.category.find(c => c.id === b.category);
            if (cat) categoryName = cat.name;
        }
        
        // هل الكتاب محمل محلياً؟
        const isDownloaded = fs.existsSync(
            path.join(CONFIG.DATA_DIR, 'books', `${b.id}.json`)
        );
        
        return {
            id: b.id,
            name: b.name,
            author: authorName,
            authorIds: b.author,
            category: categoryName,
            categoryId: b.category,
            type: b.type,
            printed: b.printed,
            date: b.date,
            bibliography: b.bibliography,
            isDownloaded
        };
    });
    
    res.json({
        success: true,
        total,
        count: books.length,
        offset: parseInt(offset),
        limit: parseInt(limit),
        data: books
    });
});

// تفاصيل كتاب
app.get('/api/books/:id', (req, res) => {
    const { id } = req.params;
    const master = loadMasterData();
    
    const book = (master.book || []).find(b => b.id === parseInt(id));
    if (!book) {
        return res.status(404).json({ success: false, error: "الكتاب غير موجود" });
    }
    
    // المؤلفون
    let authors = [];
    if (book.author && master.author) {
        const authorIds = book.author.split(',').map(id => parseInt(id.trim()));
        authors = master.author
            .filter(a => authorIds.includes(a.id))
            .map(a => ({
                id: a.id,
                name: a.name,
                death_text: a.death_text
            }));
    }
    
    // القسم
    let category = null;
    if (book.category && master.category) {
        const cat = master.category.find(c => c.id === book.category);
        if (cat) category = { id: cat.id, name: cat.name };
    }
    
    // هل المحتوى متاح؟
    const localBook = loadBookData(id);
    
    // روابط PDF
    let pdfLinks = null;
    try {
        if (book.pdf_links) pdfLinks = JSON.parse(book.pdf_links);
    } catch {}
    
    // معلومات إضافية
    let metadata = null;
    try {
        if (book.metadata) metadata = JSON.parse(book.metadata);
    } catch {}
    
    res.json({
        success: true,
        data: {
            id: book.id,
            name: book.name,
            authors,
            category,
            type: book.type,
            printed: book.printed,
            date: book.date,
            bibliography: book.bibliography,
            version: book.version,
            pdfLinks,
            metadata,
            hasContent: !!localBook,
            pageCount: localBook ? localBook.pages?.length : 0,
            titleCount: localBook ? localBook.titles?.length : 0
        }
    });
});

// محتوى كتاب
app.get('/api/books/:id/content', async (req, res) => {
    const { id } = req.params;
    const { page, part } = req.query;
    
    let bookData = loadBookData(id);
    
    if (!bookData) {
        // محاولة تحميل الكتاب
        try {
            const savedVersion = getSavedVersion(`book_${id}`);
            const url = `${CONFIG.BASE_URL}/patches/book-updates/${id}?api_key=${CONFIG.API_KEY}&major_release=${savedVersion.major}&minor_release=${savedVersion.minor}`;
            
            const response = await fetch(url);
            if (response.status === 204) {
                return res.status(404).json({ success: false, error: "الكتاب غير متاح" });
            }
            
            if (!response.ok) {
                throw new Error(`فشل الجلب: ${response.status}`);
            }
            
            const data = await response.json();
            bookData = { pages: [], titles: [] };
            
            if (data.major_release_url) {
                const majorData = await downloadAndExtract(data.major_release_url);
                if (majorData.page) bookData.pages = majorData.page;
                if (majorData.title) bookData.titles = majorData.title;
            }
            
            if (data.minor_release_url) {
                const minorData = await downloadAndExtract(data.minor_release_url);
                // تطبيق التحديثات...
                if (minorData.page) {
                    minorData.page.forEach(update => {
                        if (update.is_deleted === '1' || update.is_deleted === 1) {
                            bookData.pages = bookData.pages.filter(p => p.id !== update.id);
                        } else {
                            const idx = bookData.pages.findIndex(p => p.id === update.id);
                            if (idx >= 0) {
                                Object.keys(update).forEach(key => {
                                    if (update[key] !== '#' && update[key] !== null) {
                                        bookData.pages[idx][key] = update[key];
                                    }
                                });
                            } else {
                                bookData.pages.push(update);
                            }
                        }
                    });
                }
            }
            
            // حفظ محلياً
            const bookPath = path.join(CONFIG.DATA_DIR, 'books', `${id}.json`);
            fs.writeFileSync(bookPath, JSON.stringify(bookData, null, 2));
            
            saveVersion(`book_${id}`, {
                major: data.major_release,
                minor: data.minor_release
            });
            
        } catch (error) {
            return res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // فلترة حسب الصفحة أو الجزء
    let pages = bookData.pages || [];
    
    if (page) {
        pages = pages.filter(p => p.page === parseInt(page));
    }
    
    if (part) {
        pages = pages.filter(p => p.part === part);
    }
    
    // ترتيب الصفحات
    pages.sort((a, b) => a.id - b.id);
    
    // بناء الفهرس الشجري
    const titles = (bookData.titles || []).sort((a, b) => a.id - b.id);
    const buildTree = (parentId = 0) => {
        return titles
            .filter(t => t.parent === parentId)
            .map(t => ({
                id: t.id,
                content: t.content,
                pageId: t.page,
                children: buildTree(t.id)
            }));
    };
    const titleTree = buildTree();
    
    res.json({
        success: true,
        data: {
            pages: pages.map(p => ({
                id: p.id,
                part: p.part,
                page: p.page,
                content: p.content,
                services: p.services ? JSON.parse(p.services) : null
            })),
            titles: titleTree,
            totalPages: bookData.pages?.length || 0,
            totalTitles: titles.length
        }
    });
});

// البحث الشامل
app.get('/api/search', (req, res) => {
    const { q, type = 'all', limit = 20 } = req.query;
    
    if (!q || q.length < 2) {
        return res.json({ success: true, results: [] });
    }
    
    const master = loadMasterData();
    const queryLower = q.toLowerCase();
    const results = { books: [], authors: [], categories: [] };
    
    // البحث في الكتب
    if (type === 'all' || type === 'books') {
        results.books = (master.book || [])
            .filter(b => 
                b.is_deleted !== '1' && 
                b.name && 
                b.name.toLowerCase().includes(queryLower)
            )
            .slice(0, parseInt(limit))
            .map(b => {
                let authorName = null;
                if (b.author && master.author) {
                    const authorIds = b.author.split(',').map(id => parseInt(id.trim()));
                    const authors = master.author.filter(a => authorIds.includes(a.id));
                    if (authors.length > 0) authorName = authors.map(a => a.name).join(' و ');
                }
                return { id: b.id, name: b.name, author: authorName, type: 'book' };
            });
    }
    
    // البحث في المؤلفين
    if (type === 'all' || type === 'authors') {
        results.authors = (master.author || [])
            .filter(a => 
                a.is_deleted !== '1' && 
                a.name && 
                a.name.toLowerCase().includes(queryLower)
            )
            .slice(0, parseInt(limit))
            .map(a => ({ 
                id: a.id, 
                name: a.name, 
                death_text: a.death_text,
                type: 'author' 
            }));
    }
    
    res.json({
        success: true,
        query: q,
        results
    });
});

// مزامنة Master
app.post('/api/sync/master', async (req, res) => {
    try {
        const savedVersion = getSavedVersion('master');
        const url = `${CONFIG.BASE_URL}/patches/master?api_key=${CONFIG.API_KEY}&version=${savedVersion.version}`;
        
        const response = await fetch(url);
        
        if (response.status === 204) {
            return res.json({ 
                success: true, 
                message: "البيانات محدثة",
                version: savedVersion.version 
            });
        }
        
        if (!response.ok) {
            throw new Error(`خطأ: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.patch_url) {
            const masterData = await downloadAndExtract(data.patch_url);
            
            // دمج مع البيانات الموجودة
            const existingMaster = loadMasterData();
            
            ['category', 'book', 'author'].forEach(table => {
                if (masterData[table]) {
                    masterData[table].forEach(update => {
                        if (update.is_deleted === '1' || update.is_deleted === 1) {
                            existingMaster[table] = (existingMaster[table] || [])
                                .filter(item => item.id !== update.id);
                        } else {
                            const idx = (existingMaster[table] || [])
                                .findIndex(item => item.id === update.id);
                            if (idx >= 0) {
                                Object.keys(update).forEach(key => {
                                    if (update[key] !== '#' && update[key] !== null) {
                                        existingMaster[table][idx][key] = update[key];
                                    }
                                });
                            } else {
                                existingMaster[table] = existingMaster[table] || [];
                                existingMaster[table].push(update);
                            }
                        }
                    });
                }
            });
            
            // حفظ
            const masterPath = path.join(CONFIG.DATA_DIR, 'master.json');
            fs.writeFileSync(masterPath, JSON.stringify(existingMaster, null, 2));
            saveVersion('master', { version: data.Version });
            
            res.json({
                success: true,
                message: "تم التحديث",
                version: data.Version,
                stats: {
                    categories: existingMaster.category?.length || 0,
                    books: existingMaster.book?.length || 0,
                    authors: existingMaster.author?.length || 0
                }
            });
        }
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// مزامنة كتاب
app.post('/api/sync/book/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const savedVersion = getSavedVersion(`book_${id}`);
        const url = `${CONFIG.BASE_URL}/patches/book-updates/${id}?api_key=${CONFIG.API_KEY}&major_release=${savedVersion.major}&minor_release=${savedVersion.minor}`;
        
        const response = await fetch(url);
        
        if (response.status === 204) {
            return res.json({ 
                success: true, 
                message: "الكتاب محدث",
                major: savedVersion.major,
                minor: savedVersion.minor
            });
        }
        
        if (!response.ok) {
            throw new Error(`خطأ: ${response.status}`);
        }
        
        const data = await response.json();
        let bookData = loadBookData(id) || { pages: [], titles: [] };
        
        if (data.major_release_url) {
            // استبدال كامل
            bookData = { pages: [], titles: [] };
            const majorData = await downloadAndExtract(data.major_release_url);
            if (majorData.page) bookData.pages = majorData.page;
            if (majorData.title) bookData.titles = majorData.title;
        }
        
        if (data.minor_release_url) {
            const minorData = await downloadAndExtract(data.minor_release_url);
            // تطبيق التحديثات
            if (minorData.page) {
                minorData.page.forEach(update => {
                    if (update.is_deleted === '1') {
                        bookData.pages = bookData.pages.filter(p => p.id !== update.id);
                    } else {
                        const idx = bookData.pages.findIndex(p => p.id === update.id);
                        if (idx >= 0) {
                            Object.keys(update).forEach(key => {
                                if (update[key] !== '#' && update[key] !== null) {
                                    bookData.pages[idx][key] = update[key];
                                }
                            });
                        } else {
                            bookData.pages.push(update);
                        }
                    }
                });
            }
        }
        
        // حفظ
        const bookPath = path.join(CONFIG.DATA_DIR, 'books', `${id}.json`);
        fs.writeFileSync(bookPath, JSON.stringify(bookData, null, 2));
        saveVersion(`book_${id}`, { major: data.major_release, minor: data.minor_release });
        
        res.json({
            success: true,
            message: "تم التحديث",
            major: data.major_release,
            minor: data.minor_release,
            pageCount: bookData.pages.length,
            titleCount: bookData.titles.length
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// الإحصائيات
app.get('/api/stats', (req, res) => {
    const master = loadMasterData();
    const booksDir = path.join(CONFIG.DATA_DIR, 'books');
    
    let downloadedBooks = 0;
    if (fs.existsSync(booksDir)) {
        downloadedBooks = fs.readdirSync(booksDir).filter(f => f.endsWith('.json')).length;
    }
    
    res.json({
        success: true,
        stats: {
            categories: master.category?.length || 0,
            books: master.book?.length || 0,
            authors: master.author?.length || 0,
            downloadedBooks
        }
    });
});

// ==================== تشغيل الخادم ====================
app.listen(CONFIG.PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║     🕌 خادم المكتبة الإسلامية يعمل على المنفذ ${CONFIG.PORT}         ║
╠════════════════════════════════════════════════════════════╣
║  📡 http://localhost:${CONFIG.PORT}                               ║
║                                                            ║
║  المسارات المتاحة:                                         ║
║  ─────────────────                                         ║
║  GET  /api/categories     - قائمة الأقسام                  ║
║  GET  /api/authors        - قائمة المؤلفين                 ║
║  GET  /api/books          - قائمة الكتب                    ║
║  GET  /api/books/:id      - تفاصيل كتاب                    ║
║  GET  /api/books/:id/content - محتوى كتاب                  ║
║  GET  /api/search?q=...   - البحث                          ║
║  POST /api/sync/master    - مزامنة Master                  ║
║  POST /api/sync/book/:id  - مزامنة كتاب                    ║
║  GET  /api/stats          - الإحصائيات                     ║
╚════════════════════════════════════════════════════════════╝
    `);
});
