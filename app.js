const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const multer = require('multer'); // 1. استدعاء مكتبة الرفع
const app = express();

// --- إعدادات Multer (تخزين الصور) ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/images/'); // تأكد أن الفولدر ده موجود عندك
    },
    filename: function (req, file, cb) {
        // تسمية الصورة برقم فريد عشان ميتكررش
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// إعدادات المحرك والقوالب
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json()); // مهم جداً لفهم بيانات الـ JSON
app.use(express.urlencoded({ extended: true })); // مهم جداً لفهم بيانات الفورم

// إعداد الجلسات (Sessions)
app.use(session({
    secret: 'OD-Book-Secret-Key-2026',
    resave: false,
    saveUninitialized: true
}));

// --- الدوال المساعدة لقراءة وحفظ البيانات ---

const getBooks = () => {
    try {
        const data = fs.readFileSync(path.join(__dirname, 'data', 'books.json'), 'utf8');
        return JSON.parse(data);
    } catch (err) { return []; }
};

const saveBooks = (books) => {
    fs.writeFileSync(path.join(__dirname, 'data', 'books.json'), JSON.stringify(books, null, 2));
};

const getUsers = () => {
    try {
        const data = fs.readFileSync(path.join(__dirname, 'data', 'users.json'), 'utf8');
        return JSON.parse(data);
    } catch (err) { return []; }
};

// --- Middleware (حراس الصفحات) ---
const isAdmin = (req, res, next) => {
    if (req.session.isLoggedIn && req.session.role === 'admin') {
        next();
    } else {
        res.redirect('/login');
    }
};

// --- المسارات (Routes) ---

// 1. الصفحة الرئيسية
app.get('/', (req, res) => {
    const books = getBooks();
    res.render('index', { 
        books: books,
        isLoggedIn: req.session.isLoggedIn || false,
        user: req.session.userData || null,
        role: req.session.role || null
    });
});

// 2. صفحة تفاصيل الكتاب
app.get('/book/:id', (req, res) => {
    const books = getBooks();
    const book = books.find(b => b.id == req.params.id);
    if (book) {
        res.render('book-details', { 
            book: book,
            isLoggedIn: req.session.isLoggedIn || false 
        });
    } else {
        res.status(404).send('الكتاب غير موجود');
    }
});

// 3. تسجيل الدخول
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const users = getUsers();

    if (username === "nour" && password === "12345") {
        req.session.isLoggedIn = true;
        req.session.role = 'admin';
        req.session.userData = { username: "نور (المدير)" };
        return res.redirect('/admin');
    }

    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        req.session.isLoggedIn = true;
        req.session.role = 'user';
        req.session.userData = user;
        return res.redirect('/');
    }
    res.render('login', { error: 'بيانات الدخول غير صحيحة يا بطل!' });
});

// 4. إنشاء حساب
app.get('/register', (req, res) => {
    res.render('register', { error: null });
});

app.post('/register', (req, res) => {
    const users = getUsers();
    const { username, password } = req.body;
    
    if (users.find(u => u.username === username)) {
        return res.render('register', { error: 'الاسم ده موجود قبل كدة!' });
    }

    users.push({ username, password, plan: 'free' });
    fs.writeFileSync(path.join(__dirname, 'data', 'users.json'), JSON.stringify(users, null, 2));
    res.redirect('/login');
});

// 5. تسجيل الخروج
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// 6. لوحة تحكم الأدمن والرفع
app.get('/admin', isAdmin, (req, res) => {
    const books = getBooks();
    res.render('admin-dashboard', { books: books });
});

app.get('/admin/add', isAdmin, (req, res) => {
    res.render('add-book');
});

// تعديل مسار الإضافة لاستقبال الصورة
app.post('/admin/add', isAdmin, upload.single('bookImage'), (req, res) => {
    const books = getBooks();
    
    // حل مشكلة الـ undefined: Multer بيحط البيانات في req.body والملف في req.file
    const newBook = {
        id: Date.now(),
        title: req.body.title,
        author: req.body.author,
        category: req.body.category || "روايات",
        // هنا بنسجل اسم الملف اللي Multer حفظه فعلياً
        img: req.file ? req.file.filename : 'default.jpg', 
        desc: req.body.desc,
        audio: req.body.audio || ""
    };
    
    books.push(newBook);
    saveBooks(books);
    res.redirect('/admin');
});

app.post('/admin/delete/:id', isAdmin, (req, res) => {
    let books = getBooks();
    books = books.filter(b => b.id != req.params.id);
    saveBooks(books);
    res.redirect('/admin');
});

// المسارات الإضافية
app.get('/books', (req, res) => {
    const books = getBooks();
    res.render('books', { books: books });
});

app.get('/about', (req, res) => {
    res.render('about');
});

app.get('/category/:name', (req, res) => {
    const categoryName = req.params.name;
    const allBooks = getBooks();
    const filteredBooks = allBooks.filter(b => b.category === categoryName);
    res.render('category-page', { 
        books: filteredBooks, 
        categoryTitle: categoryName,
        isLoggedIn: req.session.isLoggedIn || false 
    });
});

// تشغيل السيرفر
const PORT = process.env.PORT || 3000; // Render بيستخدم PORT متغير
app.listen(PORT, () => {
    console.log(`🚀 السيرفر شغال على بورت ${PORT}`);
});