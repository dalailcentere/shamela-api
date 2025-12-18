# 🚀 دليل نشر خادم المكتبة الشاملة على Railway

## ✅ الطريقة السهلة (بدون CLI) - 5 دقائق

### الخطوة 1: إنشاء حساب Railway
1. اذهب إلى **https://railway.app**
2. انقر **"Login"** → **"Login with GitHub"**
3. وافق على الأذونات

### الخطوة 2: إنشاء مشروع جديد
1. من Dashboard، انقر **"New Project"**
2. اختر **"Deploy from GitHub repo"**

### الخطوة 3: رفع الكود إلى GitHub

#### إذا لم يكن لديك repo:

```bash
# 1. فك ضغط الملف
unzip shamela_complete_solution.zip
cd shamela_test

# 2. إنشاء repo على GitHub
# اذهب إلى https://github.com/new
# اسم الـ repo: shamela-api
# اجعله Public

# 3. رفع الكود
git init
git add .
git commit -m "Initial commit - Shamela API Server"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/shamela-api.git
git push -u origin main
```

### الخطوة 4: ربط GitHub بـ Railway
1. في Railway، اختر الـ repo الذي أنشأته
2. Railway سيكتشف الإعدادات تلقائياً
3. انقر **"Deploy Now"**

### الخطوة 5: الحصول على الرابط
1. انتظر اكتمال النشر (2-3 دقائق)
2. انقر على **"Settings"** → **"Networking"**
3. انقر **"Generate Domain"**
4. ستحصل على رابط مثل:
   ```
   https://shamela-api-production.up.railway.app
   ```

### الخطوة 6: اختبار API
```bash
# اختبار سريع
curl https://YOUR-URL.up.railway.app/api/stats

# البحث
curl "https://YOUR-URL.up.railway.app/api/search?q=صحيح البخاري"
```

---

## 🔧 الطريقة المتقدمة (باستخدام CLI)

### تثبيت Railway CLI

```bash
# macOS
brew install railway

# Linux/WSL
curl -fsSL https://railway.app/install.sh | sh

# Windows (PowerShell)
iwr -useb https://railway.app/install.sh | iex

# npm (كل الأنظمة)
npm install -g @railway/cli
```

### النشر

```bash
# 1. تسجيل الدخول
railway login

# 2. الدخول لمجلد المشروع
cd shamela_test

# 3. إنشاء مشروع جديد
railway init

# 4. النشر
railway up

# 5. الحصول على الرابط
railway domain
```

---

## ⚙️ إعدادات مهمة (Environment Variables)

Railway يضبط المنفذ تلقائياً، لكن يمكنك إضافة:

| المتغير | القيمة | الوصف |
|---------|--------|-------|
| `PORT` | 3001 | (يُضبط تلقائياً) |
| `NODE_ENV` | production | بيئة الإنتاج |

---

## 🔗 استخدام API في Lovable

بعد الحصول على الرابط، أعطِ Lovable هذا الـ prompt:

```
استخدم API خارجي للمكتبة الشاملة على الرابط:
https://YOUR-URL.up.railway.app

Endpoints:
- GET /api/search?q=... - البحث
- GET /api/books - قائمة الكتب
- GET /api/books/:id - تفاصيل كتاب
- GET /api/books/:id/content - محتوى كتاب
- GET /api/categories - الأقسام
- POST /api/sync/master - مزامنة البيانات

الكود:
const API = 'https://YOUR-URL.up.railway.app';
const res = await fetch(`${API}/api/search?q=${query}`);
const data = await res.json();
```

---

## 🆓 معلومات التكلفة

Railway يقدم **$5 مجاني شهرياً** وهو كافي لهذا الخادم:
- ~500 ساعة تشغيل/شهر
- 512MB RAM
- 1GB تخزين

---

## ❓ حل المشاكل الشائعة

### المشكلة: فشل البناء
```
error: better-sqlite3 build failed
```
**الحل**: تأكد من وجود ملف `nixpacks.toml` مع:
```toml
[phases.setup]
nixPkgs = ["python3", "gcc", "gnumake"]
```

### المشكلة: 502 Bad Gateway
**الحل**: تأكد أن server.js يستخدم:
```javascript
const PORT = process.env.PORT || 3001;
```

### المشكلة: CORS Error
**الحل**: الكود يتضمن CORS بالفعل، لكن تأكد من:
```javascript
app.use(cors());
```

---

## 📞 الدعم

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway

---

✅ **بعد النشر، الخادم سيحتوي على:**
- 8,500+ كتاب
- 2,100+ مؤلف
- 35 قسم
- بحث فوري
- API كامل
