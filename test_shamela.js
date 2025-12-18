/**
 * 🕌 اختبار شامل لـ API المكتبة الشاملة
 * 
 * هذا السكريبت يختبر:
 * 1. جلب بيانات Master (الأقسام، الكتب، المؤلفين)
 * 2. جلب كتاب معين بمحتواه
 * 3. معالجة ملفات SQLite المضغوطة
 * 
 * الاستخدام:
 * npm install
 * node test_shamela.js
 */

import fetch from 'node-fetch';
import AdmZip from 'adm-zip';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// ==================== الإعدادات ====================
const CONFIG = {
    API_KEY: "a81267-6a3bfd-15ea5d-47baac-33c9c2",
    BASE_URL: "https://dev.shamela.ws/api/v1",
    DATA_DIR: "./shamela_data",
    CACHE_DIR: "./shamela_cache"
};

// ==================== الدوال المساعدة ====================

/**
 * إنشاء المجلدات المطلوبة
 */
function ensureDirectories() {
    [CONFIG.DATA_DIR, CONFIG.CACHE_DIR].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`📁 تم إنشاء مجلد: ${dir}`);
        }
    });
}

/**
 * قراءة إصدار محفوظ
 */
function getSavedVersion(type) {
    const versionFile = path.join(CONFIG.CACHE_DIR, `${type}_version.json`);
    if (fs.existsSync(versionFile)) {
        return JSON.parse(fs.readFileSync(versionFile, 'utf8'));
    }
    return { version: 0, major: 0, minor: 0 };
}

/**
 * حفظ إصدار
 */
function saveVersion(type, versionData) {
    const versionFile = path.join(CONFIG.CACHE_DIR, `${type}_version.json`);
    fs.writeFileSync(versionFile, JSON.stringify(versionData, null, 2));
}

/**
 * تحميل ملف مضغوط
 */
async function downloadZip(url, savePath) {
    console.log(`⬇️ جاري التحميل: ${url.substring(0, 80)}...`);
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`فشل التحميل: ${response.status}`);
    }
    
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(savePath, Buffer.from(buffer));
    
    const sizeMB = (buffer.byteLength / 1024 / 1024).toFixed(2);
    console.log(`✅ تم التحميل: ${sizeMB} MB`);
    
    return savePath;
}

/**
 * فك ضغط وقراءة ملفات SQLite
 */
function extractAndReadSQLite(zipPath) {
    console.log(`📦 جاري فك الضغط: ${zipPath}`);
    
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();
    const results = {};
    
    for (const entry of entries) {
        if (entry.entryName.endsWith('.db')) {
            const tableName = entry.entryName.replace('.db', '');
            const dbBuffer = entry.getData();
            
            // حفظ ملف SQLite مؤقتاً
            const tempDbPath = path.join(CONFIG.CACHE_DIR, entry.entryName);
            fs.writeFileSync(tempDbPath, dbBuffer);
            
            // قراءة البيانات
            const db = new Database(tempDbPath);
            const rows = db.prepare(`SELECT * FROM ${tableName}`).all();
            db.close();
            
            // معالجة القيم الخاصة (#)
            const processedRows = rows.map(row => {
                const processed = {};
                for (const [key, value] of Object.entries(row)) {
                    // # تعني "لم يتغير" - نتجاهلها في الاستيراد الأول
                    processed[key] = value === '#' ? null : value;
                }
                return processed;
            });
            
            results[tableName] = processedRows;
            console.log(`   📄 ${tableName}: ${processedRows.length} سجل`);
            
            // حذف الملف المؤقت
            fs.unlinkSync(tempDbPath);
        }
    }
    
    return results;
}

// ==================== وظائف API ====================

/**
 * جلب بيانات Master (الأقسام، الكتب، المؤلفين)
 */
async function fetchMaster() {
    console.log("\n" + "=".repeat(60));
    console.log("🕌 جلب بيانات Master من المكتبة الشاملة");
    console.log("=".repeat(60));
    
    const savedVersion = getSavedVersion('master');
    console.log(`📌 الإصدار المحفوظ: ${savedVersion.version}`);
    
    const url = `${CONFIG.BASE_URL}/patches/master?api_key=${CONFIG.API_KEY}&version=${savedVersion.version}`;
    console.log(`📡 طلب: ${url.substring(0, 80)}...`);
    
    try {
        const response = await fetch(url);
        console.log(`📊 الحالة: ${response.status}`);
        
        if (response.status === 204) {
            console.log("✅ البيانات محدثة - لا توجد تحديثات جديدة");
            return null;
        }
        
        if (!response.ok) {
            throw new Error(`خطأ في الاستجابة: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("\n📥 الرد من السيرفر:");
        console.log(`   - رابط الملف: ${data.patch_url ? '✅ متوفر' : '❌ غير متوفر'}`);
        console.log(`   - الإصدار الجديد: ${data.Version}`);
        
        if (data.patch_url) {
            // تحميل وفك ضغط الملف
            const zipPath = path.join(CONFIG.CACHE_DIR, 'master.zip');
            await downloadZip(data.patch_url, zipPath);
            
            const masterData = extractAndReadSQLite(zipPath);
            
            // حفظ البيانات كـ JSON
            const jsonPath = path.join(CONFIG.DATA_DIR, 'master.json');
            fs.writeFileSync(jsonPath, JSON.stringify(masterData, null, 2));
            console.log(`💾 تم حفظ البيانات في: ${jsonPath}`);
            
            // حفظ الإصدار
            saveVersion('master', { version: data.Version });
            
            // إحصائيات
            console.log("\n📊 إحصائيات Master:");
            if (masterData.category) console.log(`   - الأقسام: ${masterData.category.length}`);
            if (masterData.book) console.log(`   - الكتب: ${masterData.book.length}`);
            if (masterData.author) console.log(`   - المؤلفين: ${masterData.author.length}`);
            
            return masterData;
        }
        
    } catch (error) {
        console.error(`❌ خطأ: ${error.message}`);
        throw error;
    }
}

/**
 * جلب كتاب معين
 */
async function fetchBook(bookId) {
    console.log("\n" + "=".repeat(60));
    console.log(`📚 جلب كتاب رقم: ${bookId}`);
    console.log("=".repeat(60));
    
    const savedVersion = getSavedVersion(`book_${bookId}`);
    console.log(`📌 الإصدار المحفوظ: Major=${savedVersion.major}, Minor=${savedVersion.minor}`);
    
    const url = `${CONFIG.BASE_URL}/patches/book-updates/${bookId}?api_key=${CONFIG.API_KEY}&major_release=${savedVersion.major}&minor_release=${savedVersion.minor}`;
    console.log(`📡 طلب: ${url.substring(0, 80)}...`);
    
    try {
        const response = await fetch(url);
        console.log(`📊 الحالة: ${response.status}`);
        
        if (response.status === 204) {
            console.log("✅ الكتاب محدث - لا توجد تحديثات");
            return null;
        }
        
        if (!response.ok) {
            throw new Error(`خطأ في الاستجابة: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("\n📥 الرد من السيرفر:");
        console.log(`   - Major Release URL: ${data.major_release_url ? '✅' : '❌'}`);
        console.log(`   - Minor Release URL: ${data.minor_release_url ? '✅' : '❌'}`);
        console.log(`   - Major: ${data.major_release}, Minor: ${data.minor_release}`);
        
        let bookData = { pages: [], titles: [] };
        
        // تحميل Major Release إذا وجد
        if (data.major_release_url) {
            console.log("\n📦 تحميل Major Release...");
            const majorZipPath = path.join(CONFIG.CACHE_DIR, `book_${bookId}_major.zip`);
            await downloadZip(data.major_release_url, majorZipPath);
            
            const majorData = extractAndReadSQLite(majorZipPath);
            if (majorData.page) bookData.pages = majorData.page;
            if (majorData.title) bookData.titles = majorData.title;
        }
        
        // تحميل Minor Release إذا وجد (باتش/تحديثات)
        if (data.minor_release_url) {
            console.log("\n📦 تحميل Minor Release (تحديثات)...");
            const minorZipPath = path.join(CONFIG.CACHE_DIR, `book_${bookId}_minor.zip`);
            await downloadZip(data.minor_release_url, minorZipPath);
            
            const minorData = extractAndReadSQLite(minorZipPath);
            // تطبيق التحديثات على البيانات الموجودة
            if (minorData.page) {
                minorData.page.forEach(update => {
                    if (update.is_deleted === '1' || update.is_deleted === 1) {
                        bookData.pages = bookData.pages.filter(p => p.id !== update.id);
                    } else {
                        const existingIndex = bookData.pages.findIndex(p => p.id === update.id);
                        if (existingIndex >= 0) {
                            // تحديث السجل الموجود
                            Object.keys(update).forEach(key => {
                                if (update[key] !== '#' && update[key] !== null) {
                                    bookData.pages[existingIndex][key] = update[key];
                                }
                            });
                        } else {
                            bookData.pages.push(update);
                        }
                    }
                });
            }
        }
        
        // حفظ الكتاب كـ JSON
        const bookDir = path.join(CONFIG.DATA_DIR, 'books');
        if (!fs.existsSync(bookDir)) fs.mkdirSync(bookDir, { recursive: true });
        
        const bookPath = path.join(bookDir, `${bookId}.json`);
        fs.writeFileSync(bookPath, JSON.stringify(bookData, null, 2));
        console.log(`💾 تم حفظ الكتاب في: ${bookPath}`);
        
        // حفظ الإصدار
        saveVersion(`book_${bookId}`, {
            major: data.major_release,
            minor: data.minor_release
        });
        
        // إحصائيات
        console.log("\n📊 إحصائيات الكتاب:");
        console.log(`   - عدد الصفحات: ${bookData.pages.length}`);
        console.log(`   - عدد العناوين: ${bookData.titles.length}`);
        
        // عرض أول صفحة كمثال
        if (bookData.pages.length > 0) {
            const firstPage = bookData.pages[0];
            console.log("\n📄 مثال - أول صفحة:");
            console.log(`   - الجزء: ${firstPage.part || 'غير محدد'}`);
            console.log(`   - الصفحة: ${firstPage.page}`);
            console.log(`   - المحتوى (أول 200 حرف):`);
            console.log(`     "${(firstPage.content || '').substring(0, 200)}..."`);
        }
        
        return bookData;
        
    } catch (error) {
        console.error(`❌ خطأ: ${error.message}`);
        throw error;
    }
}

/**
 * البحث في الكتب المحملة
 */
function searchBooks(query) {
    console.log("\n" + "=".repeat(60));
    console.log(`🔍 البحث عن: "${query}"`);
    console.log("=".repeat(60));
    
    const masterPath = path.join(CONFIG.DATA_DIR, 'master.json');
    if (!fs.existsSync(masterPath)) {
        console.log("❌ لم يتم تحميل بيانات Master بعد. قم بتشغيل fetchMaster() أولاً");
        return [];
    }
    
    const master = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
    const results = [];
    
    if (master.book) {
        const queryLower = query.toLowerCase();
        const matchingBooks = master.book.filter(book => 
            book.name && book.name.toLowerCase().includes(queryLower)
        );
        
        console.log(`📚 تم العثور على ${matchingBooks.length} كتاب`);
        
        matchingBooks.slice(0, 10).forEach((book, i) => {
            // البحث عن المؤلف
            let authorName = "غير معروف";
            if (book.author && master.author) {
                const authorIds = book.author.split(',').map(id => parseInt(id.trim()));
                const authors = master.author.filter(a => authorIds.includes(a.id));
                if (authors.length > 0) {
                    authorName = authors.map(a => a.name).join(' و ');
                }
            }
            
            // البحث عن القسم
            let categoryName = "غير محدد";
            if (book.category && master.category) {
                const category = master.category.find(c => c.id === book.category);
                if (category) categoryName = category.name;
            }
            
            console.log(`\n${i + 1}. 📖 ${book.name}`);
            console.log(`   المؤلف: ${authorName}`);
            console.log(`   القسم: ${categoryName}`);
            console.log(`   المعرف: ${book.id}`);
            
            results.push({
                id: book.id,
                name: book.name,
                author: authorName,
                category: categoryName
            });
        });
    }
    
    return results;
}

// ==================== التشغيل الرئيسي ====================

async function main() {
    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║     🕌 اختبار API المكتبة الشاملة - دلائل AI              ║");
    console.log("╚════════════════════════════════════════════════════════════╝");
    
    ensureDirectories();
    
    try {
        // 1. جلب Master
        console.log("\n🔄 الخطوة 1: جلب بيانات Master...");
        await fetchMaster();
        
        // 2. البحث في الكتب
        console.log("\n🔄 الخطوة 2: اختبار البحث...");
        searchBooks("صحيح البخاري");
        
        // 3. جلب كتاب معين (الأربعون النووية مثلاً)
        console.log("\n🔄 الخطوة 3: جلب كتاب للاختبار...");
        // يمكنك تغيير الرقم لأي كتاب
        await fetchBook(6387);
        
        console.log("\n" + "=".repeat(60));
        console.log("✅ تم الانتهاء من الاختبار بنجاح!");
        console.log("=".repeat(60));
        console.log("\n📁 البيانات المحفوظة في:");
        console.log(`   - ${CONFIG.DATA_DIR}/master.json`);
        console.log(`   - ${CONFIG.DATA_DIR}/books/`);
        
    } catch (error) {
        console.error("\n❌ فشل الاختبار:", error.message);
        process.exit(1);
    }
}

// تصدير الدوال للاستخدام الخارجي
export { fetchMaster, fetchBook, searchBooks, CONFIG };

// تشغيل إذا كان الملف الرئيسي
main();
