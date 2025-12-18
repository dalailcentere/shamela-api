// اختبار API المكتبة الشاملة
const API_KEY = "a81267-6a3bfd-15ea5d-47baac-33c9c2";
const BASE_URL = "https://dev.shamela.ws/api/v1";

async function testMasterAPI() {
    console.log("🔍 اختبار جلب Master من API الشاملة...\n");
    
    const url = `${BASE_URL}/patches/master?api_key=${API_KEY}&version=0`;
    console.log("📡 URL:", url);
    
    try {
        const response = await fetch(url);
        console.log("📊 Status:", response.status);
        console.log("📊 Headers:", Object.fromEntries(response.headers.entries()));
        
        if (response.status === 204) {
            console.log("✅ البيانات محدثة - لا يوجد تحديثات جديدة");
            return;
        }
        
        if (response.ok) {
            const data = await response.json();
            console.log("\n✅ الرد من السيرفر:");
            console.log(JSON.stringify(data, null, 2));
            
            if (data.patch_url) {
                console.log("\n📦 رابط الملف المضغوط:", data.patch_url);
                console.log("📌 رقم الإصدار:", data.Version);
            }
            return data;
        } else {
            const text = await response.text();
            console.log("❌ خطأ:", text);
        }
    } catch (error) {
        console.log("❌ خطأ في الاتصال:", error.message);
    }
}

async function testBookAPI(bookId = 6387) {
    console.log(`\n🔍 اختبار جلب كتاب ${bookId}...\n`);
    
    const url = `${BASE_URL}/patches/book-updates/${bookId}?api_key=${API_KEY}&major_release=0&minor_release=0`;
    console.log("📡 URL:", url);
    
    try {
        const response = await fetch(url);
        console.log("📊 Status:", response.status);
        
        if (response.status === 204) {
            console.log("✅ الكتاب محدث - لا يوجد تحديثات");
            return;
        }
        
        if (response.ok) {
            const data = await response.json();
            console.log("\n✅ الرد من السيرفر:");
            console.log(JSON.stringify(data, null, 2));
            return data;
        } else {
            const text = await response.text();
            console.log("❌ خطأ:", text);
        }
    } catch (error) {
        console.log("❌ خطأ في الاتصال:", error.message);
    }
}

// تشغيل الاختبارات
(async () => {
    await testMasterAPI();
    await testBookAPI();
})();
