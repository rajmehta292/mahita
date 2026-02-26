require('dotenv').config();

const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');

// Initialize Stripe (will fail gracefully if no key)
let stripe;
try {
  if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'sk_test_your_secret_key') {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  } else {
    console.log('⚠️  Stripe not configured. Set STRIPE_SECRET_KEY in .env to enable payments.');
    stripe = null;
  }
} catch (e) {
  console.log('⚠️  Stripe not configured:', e.message);
  stripe = null;
}

const {
  initDatabase,
  getAllCategories, getCategoryBySlug, createCategory, updateCategory, deleteCategory,
  getAllProducts, getProductById, getProductsByCategory, searchProducts,
  createProduct, updateProduct, deleteProduct,
  getAllQuotes, createQuote, updateQuoteStatus,
  getSetting, setSetting, getAllSettings,
  verifyAdmin, getDashboardStats
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Create data and uploads directories
const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'data', 'uploads', 'products');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'data', 'uploads')));
app.use(session({
  secret: 'mahita-jewelry-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  }
});

// Allow images and videos
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and videos are allowed.'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for videos
  fileFilter
});

// Auth middleware
function requireAdmin(req, res, next) {
  if (!req.session.admin) {
    return res.redirect('/admin/login');
  }
  next();
}

// ============================================
// CUSTOMER PAGES
// ============================================

// Homepage
app.get('/', (req, res) => {
  const products = getAllProducts().slice(0, 8);
  const categories = getAllCategories();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mahita Jewelry | Modern Heirlooms, Crafted to Last</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header class="header">
    <div class="header-inner">
      <a href="/" class="logo">
        <img src="/vectorized_nobg.svg" alt="Mahita" style="height: 60px;">
      </a>
      <nav class="nav">
        <a href="/">Home</a>
        <a href="/products">Collection</a>
        <a href="/about">About</a>
        <a href="/contact">Contact</a>
        </nav>
      <div class="nav-actions">
        <form class="search-form" action="/search" method="GET">
        <input type="text" name="q" placeholder="Search..." aria-label="Search">
        <button type="submit"><svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></button>
      </form>
      </div>
    </div>
  </header>

  <section class="hero">
    <div class="container">
      <div class="hero-content">
        <p class="hero-label">Exquisite Indian Jewelry</p>
        <h1>Modern Heirlooms,<br>Crafted to Last</h1>
        <p>Discover our curated collection of timeless pieces that blend traditional craftsmanship with contemporary elegance.</p>
        <a href="/products" class="btn btn-primary">Explore Collection</a>
      </div>
    </div>
  </section>

  <section class="featured-products">
    <div class="container">
      <div class="section-header">
        <h2>Our Collection</h2>
        <p>Each piece tells a story of heritage and craftsmanship</p>
      </div>
      
      ${categories.length > 0 ? `
      <div class="categories-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-lg); margin-bottom: var(--space-2xl);">
        ${categories.slice(0, 4).map(cat => `
          <a href="/category/${cat.slug}" style="display: block; background: var(--color-paper); padding: var(--space-xl); border-radius: var(--radius-md); text-align: center; border: 1px solid var(--color-border); transition: all var(--transition-normal);">
            <h3 style="font-family: var(--font-serif); font-size: 1.25rem; color: var(--color-brand); margin-bottom: var(--space-sm);">${cat.name}</h3>
            <p style="font-size: 0.85rem; color: var(--color-muted);">${cat.description || 'View collection'}</p>
          </a>
        `).join('')}
      </div>
      ` : ''}

      <div class="products-grid">
        ${products.length > 0 ? products.map(prod => {
    const images = prod.images && prod.images.length > 0 ? prod.images : [];
    const imageUrl = images.length > 0 ? (images[0].filename || images[0].url || images[0]) : '';
    return `
          <a href="/product/${prod.id}" class="product-card">
            <div class="product-card-image">
              ${imageUrl ? `<img src="${imageUrl}" alt="${prod.name}" loading="lazy">` : '<div class="product-card-placeholder">💎</div>'}
            </div>
            <div class="product-card-info">
              <p class="product-card-title">${prod.name}</p>
              <p class="product-card-price">${prod.price && prod.price > 0 ? '₹' + prod.price.toLocaleString() : 'Price on request'}</p>
            </div>
          </a>
          `;
  }).join('') : '<p style="text-align: center; grid-column: 1/-1; color: var(--color-muted);">No products available yet.</p>'}
      </div>
      
      ${products.length > 0 ? `<div style="text-align: center; margin-top: var(--space-xl);">
        <a href="/products" class="btn btn-secondary">View All Products</a>
      </div>` : ''}
    </div>
  </section>

  <section class="editorial">
    <div class="container">
      <div class="editorial-grid">
        <div class="editorial-content">
          <h2>Crafted with Love</h2>
          <p>Each piece in our collection is thoughtfully designed and meticulously crafted by skilled artisans who have inherited generations of jewelry-making knowledge.</p>
          <p style="margin-top: var(--space-md);">We believe jewelry is more than an accessory—it's a memory, a celebration, and a treasure to be passed down through generations.</p>
          <a href="/about" class="btn btn-primary" style="margin-top: var(--space-lg);">Learn Our Story</a>
        </div>
        <div class="editorial-image" style="background: linear-gradient(135deg, var(--color-brand-light), var(--color-brand)); display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 6rem; opacity: 0.3;">✨</span>
        </div>
      </div>
    </div>
  </section>

  <footer class="footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <img src="/vectorized_nobg.svg" alt="Mahita" style="height: 40px; filter: brightness(0) invert(1);">
          <p>Exquisite Indian jewelry crafted with traditional artistry and modern elegance.</p>
        </div>
        <div>
          <h4>Shop</h4>
          <ul>
            <li><a href="/products">All Products</a></li>
            ${categories.slice(0, 3).map(cat => `<li><a href="/category/${cat.slug}">${cat.name}</a></li>`).join('')}
          </ul>
        </div>
        <div>
          <h4>Company</h4>
          <ul>
            <li><a href="/about">About Us</a></li>
            <li><a href="/contact">Contact</a></li>
          </ul>
        </div>
        <div>
          <h4>Support</h4>
          <ul>
            <li><a href="/shipping">Shipping</a></li>
            <li><a href="/returns">Returns</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <a href="/admin/login" style="color: #fff; text-decoration: underline;">Admin Login</a> &copy; ${new Date().getFullYear()} Mahita Jewelry. All rights reserved.</p>
        <p>Made with ❤️ in India</p>
      </div>
    </div>
  </footer>
</body>
</html>`;
  res.send(html);
});

// Payment success page
app.get('/payment-success', (req, res) => {
  const sessionId = req.query.session_id;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Successful - Mahita Jewelry</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #FFFEF5; color: #333; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .success-card { background: white; padding: 3rem; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); text-align: center; max-width: 500px; }
    .success-icon { font-size: 4rem; margin-bottom: 1rem; }
    h1 { color: #28a745; margin-bottom: 1rem; }
    p { color: #666; margin-bottom: 2rem; line-height: 1.6; }
    .btn { display: inline-block; padding: 1rem 2rem; background: #8B0000; color: white; text-decoration: none; border-radius: 5px; font-size: 1.1rem; }
    .btn:hover { background: #DC143C; }
  </style>
</head>
<body>
  <div class="success-card">
    <div class="success-icon">✅</div>
    <h1>Payment Successful!</h1>
    <p>Thank you for your purchase. We'll send you a confirmation email with tracking details shortly.</p>
    <a href="/" class="btn">Continue Shopping</a>
  </div>
</body>
</html>`;
  res.send(html);
});

// Products listing
app.get('/products', (req, res) => {
  const products = getAllProducts();
  const categories = getAllCategories();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Collection | Mahita Jewelry</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header class="header">
    <div class="header-inner">
      <a href="/" class="logo">
        <img src="/vectorized_nobg.svg" alt="Mahita" style="height: 60px;">
      </a>
      <nav class="nav">
        <a href="/">Home</a>
        <a href="/products">Collection</a>
        <a href="/about">About</a>
        <a href="/contact">Contact</a>
        </nav>
      <div class="nav-actions">
        <form class="search-form" action="/search" method="GET">
        <input type="text" name="q" placeholder="Search..." aria-label="Search">
        <button type="submit"><svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></button>
      </form>

      </div>
    </div>
  </header>

  <main class="container" style="padding-top: var(--space-2xl);">
    <div class="section-header">
      <h1>Our Collection</h1>
      <p>Discover our curated selection of exquisite jewelry</p>
    </div>
    
    <div class="filters" style="display: flex; gap: var(--space-sm); margin-bottom: var(--space-xl); flex-wrap: wrap;">
      <a href="/products" class="btn btn-primary">All</a>
      ${categories.map(cat => `<a href="/category/${cat.slug}" class="btn btn-secondary">${cat.name}</a>`).join('')}
    </div>
    
    <div class="products-grid">
      ${products.length > 0 ? products.map(prod => {
    const images = prod.images && prod.images.length > 0 ? prod.images : [];
    const imageUrl = images.length > 0 ? (images[0].filename || images[0].url || images[0]) : '';
    return `
        <a href="/product/${prod.id}" class="product-card">
          <div class="product-card-image">
            ${imageUrl ? `<img src="${imageUrl}" alt="${prod.name}" loading="lazy">` : '<div class="product-card-placeholder">💎</div>'}
          </div>
          <div class="product-card-info">
            <p class="product-card-title">${prod.name}</p>
            <p class="product-card-price">${prod.price && prod.price > 0 ? '₹' + prod.price.toLocaleString() : 'Price on request'}</p>
          </div>
        </a>
        `;
  }).join('') : '<p style="text-align: center; grid-column: 1/-1; color: var(--color-muted);">No products available.</p>'}
    </div>
  </main>

  <footer class="footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <img src="/vectorized_nobg.svg" alt="Mahita" style="height: 40px; filter: brightness(0) invert(1);">
          <p>Exquisite Indian jewelry crafted with traditional artistry.</p>
        </div>
        <div>
          <h4>Shop</h4>
          <ul>
            <li><a href="/products">All Products</a></li>
          </ul>
        </div>
        <div>
          <h4>Company</h4>
          <ul>
            <li><a href="/about">About Us</a></li>
            <li><a href="/contact">Contact</a></li>
          </ul>
        </div>
        <div>
          <h4>Support</h4>
          <ul>
            <li><a href="/shipping">Shipping</a></li>
            <li><a href="/returns">Returns</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <a href="/admin/login" style="color: #fff; text-decoration: underline;">Admin Login</a> &copy; ${new Date().getFullYear()} Mahita Jewelry. All rights reserved.</p>
      </div>
    </div>
  </footer>
</body>
</html>`;
  res.send(html);
});

// Category page
app.get('/category/:slug', (req, res) => {
  const category = getCategoryBySlug(req.params.slug);
  if (!category) return res.redirect('/products');

  const products = getProductsByCategory(category.id);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${category.name} | Mahita Jewelry</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header class="header">
    <div class="header-inner">
      <a href="/" class="logo">
        <img src="/vectorized_nobg.svg" alt="Mahita" style="height: 60px;">
      </a>
      <nav class="nav">
        <a href="/">Home</a>
        <a href="/products">Collection</a>
        <a href="/about">About</a>
        <a href="/contact">Contact</a>
        </nav>
      <div class="nav-actions">
        <form class="search-form" action="/search" method="GET">
        <input type="text" name="q" placeholder="Search..." aria-label="Search">
        <button type="submit"><svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></button>
      </form>

      </div>
    </div>
  </header>

  <main class="container" style="padding-top: var(--space-2xl);">
    <div class="section-header">
      <h1>${category.name}</h1>
      <p>${category.description || 'Browse our collection'}</p>
    </div>
    
    <div class="products-grid">
      ${products.length > 0 ? products.map(prod => {
    const images = prod.images && prod.images.length > 0 ? prod.images : [];
    const imageUrl = images.length > 0 ? (images[0].filename || images[0].url || images[0]) : '';
    return `
        <a href="/product/${prod.id}" class="product-card">
          <div class="product-card-image">
            ${imageUrl ? `<img src="${imageUrl}" alt="${prod.name}" loading="lazy">` : '<div class="product-card-placeholder">💎</div>'}
          </div>
          <div class="product-card-info">
            <p class="product-card-title">${prod.name}</p>
            <p class="product-card-price">${prod.price && prod.price > 0 ? '₹' + prod.price.toLocaleString() : 'Price on request'}</p>
          </div>
        </a>
        `;
  }).join('') : '<p style="text-align: center; grid-column: 1/-1; color: var(--color-muted);">No products in this category yet.</p>'}
    </div>
  </main>

  <footer class="footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <img src="/vectorized_nobg.svg" alt="Mahita" style="height: 40px; filter: brightness(0) invert(1);">
          <p>Exquisite Indian jewelry crafted with traditional artistry.</p>
        </div>
        <div>
          <h4>Shop</h4>
          <ul>
            <li><a href="/products">All Products</a></li>
          </ul>
        </div>
        <div>
          <h4>Company</h4>
          <ul>
            <li><a href="/about">About Us</a></li>
            <li><a href="/contact">Contact</a></li>
          </ul>
        </div>
        <div>
          <h4>Support</h4>
          <ul>
            <li><a href="/shipping">Shipping</a></li>
            <li><a href="/returns">Returns</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <a href="/admin/login" style="color: #fff; text-decoration: underline;">Admin Login</a> &copy; ${new Date().getFullYear()} Mahita Jewelry. All rights reserved.</p>
      </div>
    </div>
  </footer>
</body>
</html>`;
  res.send(html);
});

// Product detail page
app.get('/product/:id', (req, res) => {
  const product = getProductById(req.params.id);
  if (!product) return res.redirect('/products');

  const category = product.category_id ? getAllCategories().find(c => c.id === product.category_id) : null;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${product.name} | Mahita Jewelry</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css">
  <style>
    .product-detail-page { padding: var(--space-2xl) 0; }
    .breadcrumb { margin-bottom: var(--space-lg); }
    .breadcrumb a { color: var(--color-muted); font-size: 0.9rem; }
    .breadcrumb span { color: var(--color-muted); margin: 0 var(--space-sm); }
  </style>
</head>
<body>
  <header class="header">
    <div class="header-inner">
      <a href="/" class="logo">
        <img src="/vectorized_nobg.svg" alt="Mahita" style="height: 60px;">
      </a>
      <nav class="nav">
        <a href="/">Home</a>
        <a href="/products">Collection</a>
        <a href="/about">About</a>
        <a href="/contact">Contact</a>
        </nav>
      <div class="nav-actions">
        <form class="search-form" action="/search" method="GET">
        <input type="text" name="q" placeholder="Search..." aria-label="Search">
        <button type="submit"><svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></button>
      </form>

      </div>
    </div>
  </header>
  
  <main class="container product-detail-page">
    <div class="breadcrumb">
      <a href="/">Home</a> <span>›</span> <a href="/products">Collection</a> <span>›</span> ${product.name}
    </div>
    
    <div class="product-detail">
      <div class="product-gallery">
        ${(function () {
      if (!product.images || product.images.length === 0) return '<div class="product-placeholder" style="aspect-ratio: 4/5; background: var(--color-ivory); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; font-size: 6rem; color: var(--color-muted);">💎</div>';
      let html = '<div class="carousel" id="productCarousel"><div class="carousel-track" id="carouselTrack">';
      product.images.forEach(function (img) {
        var isVideo = img.isVideo || (img.mimetype && img.mimetype.startsWith('video/'));
        var src = img.filename || img.url || img;
        if (isVideo) {
          html += '<div class="carousel-slide"><video src="' + src + '" controls></video></div>';
        } else {
          html += '<div class="carousel-slide"><img src="' + src + '" alt="' + product.name + '"></div>';
        }
      });
      html += '</div>';
      if (product.images.length > 1) {
        html += '<button class="carousel-nav carousel-prev" onclick="changeSlide(-1)">‹</button>';
        html += '<button class="carousel-nav carousel-next" onclick="changeSlide(1)">›</button>';
        html += '<div class="carousel-indicators">';
        product.images.forEach(function (_, i) {
          html += '<button class="carousel-indicator ' + (i === 0 ? 'active' : '') + '" onclick="goToSlide(' + i + ')"></button>';
        });
        html += '</div>';
      }
      html += '</div>';
      return html;
    })()}
        <script>
          var currentSlide = 0;
          var track = document.getElementById('carouselTrack');
          var slides = document.querySelectorAll('.carousel-slide');
          var totalSlides = slides.length;
          function updateCarousel() { if (track) track.style.transform = 'translateX(-' + (currentSlide * 100) + '%)'; }
          function changeSlide(dir) { currentSlide = (currentSlide + dir + totalSlides) % totalSlides; updateCarousel(); updateIndicators(); }
          function goToSlide(index) { currentSlide = index; updateCarousel(); updateIndicators(); }
          function updateIndicators() {
            document.querySelectorAll('.carousel-indicator').forEach(function(ind, i) {
              ind.classList.toggle('active', i === currentSlide);
            });
          }
          if (totalSlides > 1) setInterval(function() { changeSlide(1); }, 5000);
        </script>
      </div>
      
      <div class="product-info">
        ${category ? `<p class="product-category">${category.name}</p>` : ''}
        <h1 class="product-title">${product.name}</h1>
        <p class="product-price">${product.price && product.price > 0 ? '₹' + product.price.toLocaleString() : 'Price on request'}</p>
        <p class="product-description">${product.description || 'A beautiful piece from our collection.'}</p>
        
        ${product.cutwise_url ? `<div style="margin: var(--space-lg) 0; padding: var(--space-lg); background: var(--color-ivory); border-radius: var(--radius-md); border: 1px solid var(--color-border);">
          <p style="font-weight: 600; margin-bottom: var(--space-md);">View on Cutwise</p>
          <a href="${product.cutwise_url}" target="_blank" class="btn btn-secondary">View Details →</a>
        </div>` : ''}
        
        <div class="product-actions">
          ${(function () {
      if (product.price && product.price > 0) {
        return '<button class="btn btn-primary" onclick="buyNow()">Buy Now</button>' +
          '<button class="btn btn-secondary" onclick="openQuoteModal()">Request Quote</button>';
      } else {
        return '<button class="btn btn-primary" onclick="openQuoteModal()">Request Quote</button>';
      }
    })()}
        </div>
      </div>
    </div>
  </main>
  
  <div class="modal" id="quoteModal">
    <div class="modal-content">
      <h2>Request a Quote</h2>
      <p style="margin-bottom: var(--space-lg); color: var(--color-muted);">Product: <strong>${product.name}</strong></p>
      
      <div id="quoteForm">
        <div class="form-group">
          <label>Your Name *</label>
          <input type="text" id="customerName" required>
        </div>
        <div class="form-group">
          <label>Email *</label>
          <input type="email" id="customerEmail" required>
        </div>
        <div class="form-group">
          <label>Phone</label>
          <input type="tel" id="customerPhone">
        </div>
        <div class="form-group">
          <label>Message</label>
          <textarea id="customerMessage" placeholder="Any specific requirements?"></textarea>
        </div>
        <div class="modal-buttons">
          <button class="btn btn-primary" onclick="submitQuote()">Submit</button>
          <button class="btn btn-secondary" onclick="closeQuoteModal()">Cancel</button>
        </div>
      </div>
      
      <div class="success-message" id="successMessage">
        <h3>Thank you!</h3>
        <p>Your quote request has been submitted. We'll get back to you soon.</p>
        <button class="btn btn-primary" onclick="closeQuoteModal()" style="margin-top: var(--space-lg);">Close</button>
      </div>
    </div>
  </div>
  
  <script>
    var productId = product.id;
    
    function openQuoteModal() {
      document.getElementById('quoteModal').classList.add('active');
    }
    
    function closeQuoteModal() {
      document.getElementById('quoteModal').classList.remove('active');
      document.getElementById('quoteForm').style.display = 'block';
      document.getElementById('successMessage').classList.remove('show');
      document.getElementById('customerName').value = '';
      document.getElementById('customerEmail').value = '';
      document.getElementById('customerPhone').value = '';
      document.getElementById('customerMessage').value = '';
    }
    
    async function submitQuote() {
      var name = document.getElementById('customerName').value;
      var email = document.getElementById('customerEmail').value;
      var phone = document.getElementById('customerPhone').value;
      var message = document.getElementById('customerMessage').value;
      
      if (!name || !email) {
        alert('Please fill in your name and email.');
        return;
      }
      
      try {
        var res = await fetch('/api/quotes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: productId, name: name, email: email, phone: phone, message: message })
        });
        
        if (res.ok) {
          document.getElementById('quoteForm').style.display = 'none';
          document.getElementById('successMessage').classList.add('show');
        } else {
          alert('Error submitting quote. Please try again.');
        }
      } catch (e) {
        alert('Error submitting quote. Please try again.');
      }
    }
    
    async function buyNow() {
      try {
        var res = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: productId })
        });
        
        var data = await res.json();
        
        if (data.url) {
          window.location.href = data.url;
        } else {
          alert('Error initiating checkout. Please try again.');
        }
      } catch (e) {
        alert('Error initiating checkout. Please try again.');
      }
    }
  </script>

  <footer class="footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <img src="/vectorized_nobg.svg" alt="Mahita" style="height: 40px; filter: brightness(0) invert(1);">
          <p>Exquisite Indian jewelry crafted with traditional artistry.</p>
        </div>
        <div>
          <h4>Shop</h4>
          <ul>
            <li><a href="/products">All Products</a></li>
          </ul>
        </div>
        <div>
          <h4>Company</h4>
          <ul>
            <li><a href="/about">About Us</a></li>
            <li><a href="/contact">Contact</a></li>
          </ul>
        </div>
        <div>
          <h4>Support</h4>
          <ul>
            <li><a href="/shipping">Shipping</a></li>
            <li><a href="/returns">Returns</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <a href="/admin/login" style="color: #fff; text-decoration: underline;">Admin Login</a> &copy; ${new Date().getFullYear()} Mahita Jewelry. All rights reserved.</p>
      </div>
    </div>
  </footer>
</body>
</html>`;
  res.send(html);
});

// Search
app.get('/search', (req, res) => {
  const query = req.query.q || '';
  const products = query ? searchProducts(query) : [];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Search | Mahita Jewelry</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header class="header">
    <div class="header-inner">
      <a href="/" class="logo">
        <img src="/vectorized_nobg.svg" alt="Mahita" style="height: 60px;">
      </a>
      <nav class="nav">
        <a href="/">Home</a>
        <a href="/products">Collection</a>
        <a href="/about">About</a>
        <a href="/contact">Contact</a>
        </nav>
      <div class="nav-actions">
        <form class="search-form" action="/search" method="GET">
        <input type="text" name="q" placeholder="Search..." aria-label="Search">
        <button type="submit"><svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></button>
      </form>

      </div>
    </div>
  </header>

  <main class="container search-page" style="padding-top: var(--space-2xl);">
    <form class="search-bar-large" action="/search" method="GET">
      <input type="text" name="q" placeholder="Search for jewelry..." value="${query}" aria-label="Search">
      <button type="submit">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      </button>
    </form>

    
    <div class="section-header">
      <h1>Search Results</h1>
      <p>${query ? 'Showing results for "' + query + '"' : 'Enter a search term to find products'}</p>
    </div>
    
    ${products.length > 0 ? `
    <div class="products-grid">
      ${products.map(prod => {
    const images = prod.images && prod.images.length > 0 ? prod.images : [];
    const imageUrl = images.length > 0 ? (images[0].filename || images[0].url || images[0]) : '';
    return `
        <a href="/product/${prod.id}" class="product-card">
          <div class="product-card-image">
            ${imageUrl ? `<img src="${imageUrl}" alt="${prod.name}" loading="lazy">` : '<div class="product-card-placeholder">💎</div>'}
          </div>
          <div class="product-card-info">
            <p class="product-card-title">${prod.name}</p>
            <p class="product-card-price">${prod.price && prod.price > 0 ? '₹' + prod.price.toLocaleString() : 'Price on request'}</p>
          </div>
        </a>
        `;
  }).join('')}
    </div>
    ` : query ? '<p style="text-align: center; color: var(--color-muted);">No products found. Try a different search term.</p>' : ''}
  </main>

  <footer class="footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <img src="/vectorized_nobg.svg" alt="Mahita" style="height: 40px; filter: brightness(0) invert(1);">
          <p>Exquisite Indian jewelry crafted with traditional artistry.</p>
        </div>
        <div>
          <h4>Shop</h4>
          <ul>
            <li><a href="/products">All Products</a></li>
          </ul>
        </div>
        <div>
          <h4>Company</h4>
          <ul>
            <li><a href="/about">About Us</a></li>
            <li><a href="/contact">Contact</a></li>
          </ul>
        </div>
        <div>
          <h4>Support</h4>
          <ul>
            <li><a href="/shipping">Shipping</a></li>
            <li><a href="/returns">Returns</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <a href="/admin/login" style="color: #fff; text-decoration: underline;">Admin Login</a> &copy; ${new Date().getFullYear()} Mahita Jewelry. All rights reserved.</p>
      </div>
    </div>
  </footer>
</body>
</html>`;
  res.send(html);
});

// ============================================
// ADMIN PAGES
// ============================================

// Admin login
app.get('/admin/login', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Login - Mahita Jewelry</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css">
  <style>
    :root {
      --admin-bg: #f8f9fa;
      --admin-surface: rgba(255, 255, 255, 0.85);
      --admin-border: rgba(255, 255, 255, 0.4);
      --admin-shadow: 0 8px 32px rgba(139, 0, 0, 0.08);
      --admin-primary: #8B0000;
      --admin-primary-hover: #DC143C;
      --admin-text: #2d3748;
      --admin-text-muted: #718096;
      --admin-radius: 16px;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; 
      background: var(--admin-bg);
      background-image: radial-gradient(circle at top right, rgba(220, 20, 60, 0.05), transparent 400px),
                        radial-gradient(circle at bottom left, rgba(212, 175, 55, 0.05), transparent 400px);
      min-height: 100vh; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
    }
    .login-container { 
      background: var(--admin-surface);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      padding: 3rem; 
      border-radius: var(--admin-radius); 
      border: 1px solid var(--admin-border);
      box-shadow: var(--admin-shadow); 
      width: 100%; 
      max-width: 420px; 
      animation: fadeIn 0.5s ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    h1 { 
      color: var(--admin-primary); 
      margin-bottom: 2rem; 
      text-align: center; 
      font-family: 'Cormorant Garamond', serif; 
      font-size: 2.5rem;
      font-weight: 600;
    }
    .form-group { margin-bottom: 1.5rem; }
    .form-group label { 
      display: block; 
      margin-bottom: 0.5rem; 
      font-weight: 500; 
      font-size: 0.9rem;
      color: var(--admin-text); 
    }
    .form-group input { 
      width: 100%; 
      padding: 0.85rem 1rem; 
      border: 1px solid rgba(0,0,0,0.1); 
      border-radius: 8px; 
      font-size: 1rem; 
      background: white;
      transition: all 0.2s;
    }
    .form-group input:focus { 
      border-color: var(--admin-primary); 
      box-shadow: 0 0 0 3px rgba(139, 0, 0, 0.1);
      outline: none; 
    }
    .btn { 
      width: 100%; 
      padding: 1rem; 
      background: var(--admin-primary); 
      color: white; 
      border: none; 
      border-radius: 8px; 
      font-size: 1rem; 
      font-weight: 500;
      cursor: pointer; 
      transition: all 0.2s; 
      margin-top: 0.5rem;
    }
    .btn:hover { 
      background: var(--admin-primary-hover); 
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(220, 20, 60, 0.2);
    }
    .error { 
      color: #e53e3e; 
      background: #fed7d7;
      padding: 0.75rem;
      border-radius: 8px;
      font-size: 0.9rem;
      margin-bottom: 1.5rem; 
      display: none; 
      text-align: center;
    }
    .back-link { 
      display: block; 
      text-align: center; 
      margin-top: 1.5rem; 
      color: var(--admin-text-muted); 
      text-decoration: none; 
      font-size: 0.9rem;
      transition: color 0.2s;
    }
    .back-link:hover { color: var(--admin-primary); }
  </style>
</head>
<body>
  <div class="login-container">
    <h1>Admin Login</h1>
    <p class="error" id="error">Invalid username or password</p>
    <form id="loginForm">
      <div class="form-group">
        <label>Username</label>
        <input type="text" name="username" required>
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" name="password" required>
      </div>
      <button type="submit" class="btn">Login</button>
    </form>

    <a href="/" class="back-link">Back to Home</a>
  </div>
  <script>
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(formData))
      });
      if (res.ok) { window.location.href = '/admin'; }
      else { document.getElementById('error').style.display = 'block'; }
    });
  </script>
</body>
</html>`;
  res.send(html);
});

// Admin dashboard
app.get('/admin', requireAdmin, (req, res) => {
  const stats = getDashboardStats();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Dashboard - Mahita Jewelry</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css">
  <style>
    :root {
      --admin-bg: #f8f9fa;
      --admin-surface: rgba(255, 255, 255, 0.85);
      --admin-border: rgba(255, 255, 255, 0.4);
      --admin-shadow: 0 8px 32px rgba(139, 0, 0, 0.08);
      --admin-primary: #8B0000;
      --admin-primary-hover: #DC143C;
      --admin-text: #2d3748;
      --admin-text-muted: #718096;
      --admin-radius: 16px;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; 
      background: var(--admin-bg);
      background-image: radial-gradient(circle at top right, rgba(220, 20, 60, 0.05), transparent 400px),
                        radial-gradient(circle at bottom left, rgba(212, 175, 55, 0.05), transparent 400px);
      color: var(--admin-text);
      min-height: 100vh;
    }
    .admin-header { 
      background: var(--admin-surface);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      padding: 1rem 2rem; 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      border-bottom: 1px solid var(--admin-border);
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .admin-logo { font-family: 'Cormorant Garamond', serif; font-size: 1.75rem; font-weight: 600; color: var(--admin-primary); }
    .admin-nav { display: flex; gap: 1.5rem; align-items: center; }
    .admin-nav a { color: var(--admin-text); text-decoration: none; font-size: 0.95rem; font-weight: 500; transition: color 0.2s; }
    .admin-nav a:hover { color: var(--admin-primary); }
    .admin-nav a.active { color: var(--admin-primary); font-weight: 600; }
    .admin-logout { 
      background: rgba(139, 0, 0, 0.1); 
      color: var(--admin-primary) !important; 
      padding: 0.5rem 1rem; 
      border-radius: 8px; 
      text-decoration: none; 
      transition: all 0.2s !important;
    }
    .admin-logout:hover {
      background: var(--admin-primary);
      color: white !important;
    }
    .admin-container { max-width: 1200px; margin: 0 auto; padding: 3rem 2rem; animation: fadeIn 0.4s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .admin-title { color: var(--admin-text); margin-bottom: 2.5rem; font-size: 2.25rem; font-weight: 600; }
    
    .admin-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-bottom: 3rem; }
    .admin-stat-card { 
      background: var(--admin-surface);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      padding: 2rem; 
      border-radius: var(--admin-radius); 
      border: 1px solid var(--admin-border);
      box-shadow: var(--admin-shadow); 
      text-align: center; 
      transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .admin-stat-card:hover { transform: translateY(-5px); }
    .admin-stat-card h3 { color: var(--admin-primary); font-size: 3rem; margin-bottom: 0.5rem; font-weight: 700; line-height: 1; }
    .admin-stat-card p { color: var(--admin-text-muted); font-weight: 500; font-size: 1.1rem; }
    
    .admin-menu { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; }
    .admin-menu-card { 
      background: var(--admin-surface);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      padding: 2.5rem 2rem; 
      border-radius: var(--admin-radius); 
      border: 1px solid var(--admin-border);
      box-shadow: var(--admin-shadow); 
      text-align: center; 
      cursor: pointer; 
      transition: all 0.3s ease; 
      display: flex;
      flex-direction: column;
      align-items: center;
      text-decoration: none;
    }
    .admin-menu-card:hover { 
      transform: translateY(-5px); 
      box-shadow: 0 12px 40px rgba(139, 0, 0, 0.12); 
      border-color: rgba(139, 0, 0, 0.2);
    }
    .admin-menu-card h3 { color: var(--admin-text); margin-bottom: 0.75rem; font-size: 1.4rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem;}
    .admin-menu-card p { color: var(--admin-text-muted); font-size: 0.95rem; line-height: 1.5; }
  </style>
</head>
<body class="admin-body">
  <header class="admin-header">
    <div class="admin-logo">Mahita Admin</div>
    <nav class="admin-nav">
      <a href="/">View Site</a>
      <a href="/admin/products">Products</a>
      <a href="/admin/categories">Categories</a>
      <a href="/admin/quotes">Quotes</a>
      <a href="/admin/settings">Settings</a>
      <a href="/api/admin/logout" class="admin-logout">Logout</a>
    </nav>
  </header>
  
  <main class="admin-container">
    <h1 class="admin-title">Dashboard</h1>
    
    <div class="admin-stats">
      <div class="admin-stat-card">
        <h3>${stats.productsCount}</h3>
        <p>Products</p>
      </div>
      <div class="admin-stat-card">
        <h3>${stats.quotesCount}</h3>
        <p>Pending Quotes</p>
      </div>
      <div class="admin-stat-card">
        <h3>${stats.categoriesCount}</h3>
        <p>Categories</p>
      </div>
    </div>
    
    <div class="admin-menu">
      <a href="/admin/products" class="admin-menu-card">
        <h3>📦 Products</h3>
        <p>Manage your jewelry products</p>
      </a>
      <a href="/admin/categories" class="admin-menu-card">
        <h3>📁 Categories</h3>
        <p>Manage product categories</p>
      </a>
      <a href="/admin/quotes" class="admin-menu-card">
        <h3>📝 Quotes</h3>
        <p>View quote requests</p>
      </a>
      <a href="/admin/settings" class="admin-menu-card">
        <h3>⚙️ Settings</h3>
        <p>Configure email and site</p>
      </a>
    </div>
  </main>
</body>
</html>`;
  res.send(html);
});

// Admin products page
app.get('/admin/products', requireAdmin, (req, res) => {
  const products = getAllProducts(false);
  const categories = getAllCategories();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Products - Mahita Admin</title>
  <style>
    :root {
      --admin-bg: #f8f9fa;
      --admin-surface: rgba(255, 255, 255, 0.85);
      --admin-border: rgba(255, 255, 255, 0.4);
      --admin-shadow: 0 8px 32px rgba(139, 0, 0, 0.08);
      --admin-primary: #8B0000;
      --admin-primary-hover: #DC143C;
      --admin-text: #2d3748;
      --admin-text-muted: #718096;
      --admin-radius: 16px;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; 
      background: var(--admin-bg);
      background-image: radial-gradient(circle at top right, rgba(220, 20, 60, 0.05), transparent 400px),
                        radial-gradient(circle at bottom left, rgba(212, 175, 55, 0.05), transparent 400px);
      color: var(--admin-text);
      min-height: 100vh;
    }
    .header { 
      background: var(--admin-surface);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      padding: 1rem 2rem; 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      border-bottom: 1px solid var(--admin-border);
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .logo { font-family: 'Cormorant Garamond', serif; font-size: 1.75rem; font-weight: 600; color: var(--admin-primary); text-decoration: none;}
    .nav { display: flex; gap: 1.5rem; align-items: center; }
    .nav a { color: var(--admin-text); text-decoration: none; font-size: 0.95rem; font-weight: 500; transition: color 0.2s; }
    .nav a:hover { color: var(--admin-primary); }
    .nav a.active { color: var(--admin-primary); font-weight: 600; }
    .container { max-width: 1200px; margin: 0 auto; padding: 3rem 2rem; animation: fadeIn 0.4s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
    h1 { color: var(--admin-text); font-size: 2.25rem; font-weight: 600; }
    .btn { padding: 0.8rem 1.5rem; background: var(--admin-primary); color: white; text-decoration: none; border-radius: 8px; border: none; cursor: pointer; font-weight: 500; transition: all 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;}
    .btn:hover { background: var(--admin-primary-hover); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(220, 20, 60, 0.2);}
    .table-container { 
      background: var(--admin-surface);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-radius: var(--admin-radius); 
      overflow: hidden; 
      box-shadow: var(--admin-shadow);
      border: 1px solid var(--admin-border);
    }
    table { width: 100%; border-collapse: collapse; }
    th { background: rgba(0,0,0,0.02); color: var(--admin-text-muted); font-weight: 600; text-transform: uppercase; font-size: 0.85rem; padding: 1.25rem 1.5rem; text-align: left; border-bottom: 1px solid var(--admin-border);}
    td { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--admin-border); vertical-align: middle;}
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: rgba(0,0,0,0.01); }
    .actions { display: flex; gap: 0.5rem; }
    .btn-sm { padding: 0.4rem 0.8rem; font-size: 0.85rem; border-radius: 6px; border: none; cursor: pointer; font-weight: 500; transition: all 0.2s; }
    .btn-edit { background: rgba(212, 175, 55, 0.1); color: #B8860B; }
    .btn-edit:hover { background: rgba(212, 175, 55, 0.2); }
    .btn-delete { background: rgba(220, 53, 69, 0.1); color: #dc3545; }
    .btn-delete:hover { background: rgba(220, 53, 69, 0.2); }
    .empty { text-align: center; padding: 4rem 2rem; color: var(--admin-text-muted); font-size: 1.1rem; }
    .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); z-index: 1000; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s; }
    .modal.active { display: flex; opacity: 1;}
    .modal-content { 
      background: white; 
      padding: 2.5rem; 
      border-radius: var(--admin-radius); 
      max-width: 600px; 
      width: 90%; 
      max-height: 90vh; 
      overflow-y: auto; 
      box-shadow: 0 24px 48px rgba(0,0,0,0.2);
      transform: scale(0.95);
      transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .modal.active .modal-content { transform: scale(1); }
    .modal h2 { color: var(--admin-text); margin-bottom: 1.5rem; font-weight: 600; }
    .form-group { margin-bottom: 1.25rem; }
    .form-group label { display: block; margin-bottom: 0.5rem; font-weight: 500; font-size: 0.95rem;}
    .form-group input, .form-group textarea, .form-group select { width: 100%; padding: 0.85rem 1rem; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; font-size: 1rem; transition: all 0.2s; font-family: inherit;}
    .form-group input:focus, .form-group textarea:focus, .form-group select:focus { border-color: var(--admin-primary); box-shadow: 0 0 0 3px rgba(139, 0, 0, 0.1); outline: none; }
    .form-group textarea { min-height: 80px; resize: vertical; }
    .modal-buttons { display: flex; gap: 1rem; margin-top: 2rem; }
    .btn-secondary { background: rgba(0,0,0,0.05); color: var(--admin-text); }
    .btn-secondary:hover { background: rgba(0,0,0,0.1); box-shadow: none; transform: none;}
  </style>
</head>
<body>
  <header class="header">
    <div class="logo">Mahita Admin</div>
    <nav class="nav">
      <a href="/admin">Dashboard</a>
      <a href="/admin/categories">Categories</a>
      <a href="/admin/quotes">Quotes</a>
      <a href="/admin/settings">Settings</a>
      <a href="/">View Site</a>
    </nav>
  </header>
  
  <main class="container">
    <div class="toolbar">
      <h1>Products</h1>
      <button class="btn" onclick="openModal()">+ Add Product</button>
    </div>
    
    <div class="table-container">
      ${products.length > 0 ? `
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Image</th>
            <th>Name</th>
            <th>Category</th>
            <th>Price</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${products.map(p => {
    const cat = categories.find(c => c.id === p.category_id);
    const images = p.images && p.images.length > 0 ? p.images : [];
    const imageUrl = images.length > 0 ? images[0].url : '';
    return `<tr>
              <td>${p.id}</td>
              <td>${imageUrl ? `<img src="${imageUrl}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 5px;">` : '<span style="color: #999;">No image</span>'}</td>
              <td>${p.name}</td>
              <td>${cat?.name || '-'}</td>
              <td>₹${p.price?.toLocaleString() || '-'}</td>
              <td>${p.is_active ? 'Active' : 'Inactive'}</td>
              <td class="actions">
                <button class="btn-sm btn-edit" onclick="editProduct(${p.id}, '${p.name.replace(/'/g, "\\'")}', '${(p.description || '').replace(/'/g, "\\'")}', ${p.category_id}, ${p.price}, '${(p.cutwise_url || '').replace(/'/g, "\\'")}', '${JSON.stringify(images).replace(/'/g, "\\'").replace(/"/g, "&quot;")}')">Edit</button>
                <button class="btn-sm btn-delete" onclick="deleteProduct(${p.id})">Delete</button>
              </td>
            </tr>`;
  }).join('')}
        </tbody>
      </table>
      ` : '<div class="empty">No products yet. Add your first product!</div>'}
    </div>
  </main>
  
  <div class="modal" id="productModal">
    <div class="modal-content">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h2 id="modalTitle">Add Product</h2>
        <button type="button" onclick="closeModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #666;">&times;</button>
      </div>
      <form id="productForm">
        <input type="hidden" id="productId">
        <div class="form-group">
          <label>Product Name *</label>
          <input type="text" id="productName" required>
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea id="productDescription"></textarea>
        </div>
        <div class="form-group">
          <label>Category</label>
          <select id="productCategory">
            <option value="">Select Category</option>
            ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Price (₹)</label>
          <input type="number" id="productPrice">
        </div>
        <div class="form-group">
          <label>Product Media (Images & Videos)</label>
          <div id="mediaUploadArea" style="border: 2px dashed #ccc; padding: 20px; text-align: center; border-radius: 8px; cursor: pointer; margin-bottom: 10px;" onclick="document.getElementById('productMedia').click()">
            <input type="file" id="productMedia" accept="image/*,video/*" multiple style="display: none;" onchange="handleMediaUpload(this)">
            <div style="font-size: 2rem; margin: 0;">📷🎥</div>
            <p>Click to upload images & videos (max 10)</p>
          </div>
          <div id="mediaGallery" style="display: flex; flex-wrap: wrap; gap: 10px;"></div>
        </div>
        <div class="form-group">
          <label>Cutwise Widget URL</label>
          <input type="text" id="productCutwise" placeholder="https://cutwise.com/jewelry/1816063">
          <small>Paste a Cutwise product URL to embed the widget</small>
        </div>
        <div class="modal-buttons">
          <button type="submit" class="btn">Save Product</button>
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        </div>
      </form>
    </div>
  </div>
  
  <script>
    let editingId = null;
    
    function openModal() {
      editingId = null;
      document.getElementById('modalTitle').textContent = 'Add Product';
      document.getElementById('productForm').reset();
      document.getElementById('productId').value = '';
      // Reset media gallery
      document.getElementById('mediaGallery').innerHTML = '';
      document.getElementById('productMedia').value = '';
      currentMedia = [];
      document.getElementById('productModal').classList.add('active');
    }
    
    let currentMedia = [];
    
    function editProduct(id, name, desc, catId, price, cutwiseUrl, images) {
      editingId = id;
      document.getElementById('modalTitle').textContent = 'Edit Product';
      document.getElementById('productId').value = id;
      document.getElementById('productName').value = name;
      document.getElementById('productDescription').value = desc;
      document.getElementById('productCategory').value = catId || '';
      document.getElementById('productPrice').value = price || '';
      document.getElementById('productCutwise').value = cutwiseUrl || '';
      
      // Handle media gallery - images may be a JSON string or array
      try {
        currentMedia = typeof images === 'string' ? JSON.parse(images) : (images || []);
      } catch(e) {
        currentMedia = [];
      }
      renderMediaGallery();
      document.getElementById('productMedia').value = '';
      
      document.getElementById('productModal').classList.add('active');
    }
    
    function renderMediaGallery() {
      const gallery = document.getElementById('mediaGallery');
      gallery.innerHTML = currentMedia.map(function(media, index) {
        var mediaHtml = media.isVideo 
          ? '<video src="' + media.url + '" style="width: 100%; height: 100%; object-fit: cover;"></video>'
          : '<img src="' + media.url + '" style="width: 100%; height: 100%; object-fit: cover;">';
        return '<div style="position: relative; width: 100px; height: 40px; border-radius: 8px; overflow: hidden; border: 2px solid #ddd;">' + mediaHtml + '<button onclick="removeMedia(' + index + ')" style="position: absolute; top: 2px; right: 2px; background: red; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 12px;">×</button></div>';
      }).join('');
    }
    
    function removeMedia(index) {
      currentMedia.splice(index, 1);
      renderMediaGallery();
    }
    
    async function handleMediaUpload(input) {
      const files = input.files;
      if (!files || files.length === 0) return;
      
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }
      
      try {
        const res = await fetch('/api/admin/upload', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (data.success && data.files) {
          data.files.forEach(file => {
            currentMedia.push({
              url: file.filename,
              isVideo: file.isVideo
            });
          });
          renderMediaGallery();
        } else {
          alert('Error uploading files');
        }
      } catch (err) {
        alert('Error uploading files');
      }
    }
    
    function closeModal() {
      document.getElementById('productModal').classList.remove('active');
    }
    
    document.getElementById('productForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        name: document.getElementById('productName').value,
        description: document.getElementById('productDescription').value,
        categoryId: document.getElementById('productCategory').value,
        price: document.getElementById('productPrice').value,
        cutwiseUrl: document.getElementById('productCutwise').value,
        images: currentMedia
      };
      
      const url = editingId ? '/api/admin/products/' + editingId : '/api/admin/products';
      const method = editingId ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (res.ok) { window.location.reload(); }
      else { alert('Error saving product'); }
    });
    
    async function deleteProduct(id) {
      if (!confirm('Are you sure you want to delete this product?')) return;
      const res = await fetch('/api/admin/products/' + id, { method: 'DELETE' });
      if (res.ok) { window.location.reload(); }
      else { alert('Error deleting product'); }
    }
  </script>
</body>
</html>`;
  res.send(html);
});

// Admin categories page
app.get('/admin/categories', requireAdmin, (req, res) => {
  const categories = getAllCategories();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Categories - Mahita Admin</title>
  <style>
    :root {
      --admin-bg: #f8f9fa;
      --admin-surface: rgba(255, 255, 255, 0.85);
      --admin-border: rgba(255, 255, 255, 0.4);
      --admin-shadow: 0 8px 32px rgba(139, 0, 0, 0.08);
      --admin-primary: #8B0000;
      --admin-primary-hover: #DC143C;
      --admin-text: #2d3748;
      --admin-text-muted: #718096;
      --admin-radius: 16px;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; 
      background: var(--admin-bg);
      background-image: radial-gradient(circle at top right, rgba(220, 20, 60, 0.05), transparent 400px),
                        radial-gradient(circle at bottom left, rgba(212, 175, 55, 0.05), transparent 400px);
      color: var(--admin-text);
      min-height: 100vh;
    }
    .header { 
      background: var(--admin-surface);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      padding: 1rem 2rem; 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      border-bottom: 1px solid var(--admin-border);
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .logo { font-family: 'Cormorant Garamond', serif; font-size: 1.75rem; font-weight: 600; color: var(--admin-primary); text-decoration: none;}
    .nav { display: flex; gap: 1.5rem; align-items: center; }
    .nav a { color: var(--admin-text); text-decoration: none; font-size: 0.95rem; font-weight: 500; transition: color 0.2s; }
    .nav a:hover { color: var(--admin-primary); }
    .nav a.active { color: var(--admin-primary); font-weight: 600; }
    .container { max-width: 900px; margin: 0 auto; padding: 3rem 2rem; animation: fadeIn 0.4s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
    h1 { color: var(--admin-text); font-size: 2.25rem; font-weight: 600; }
    .btn { padding: 0.8rem 1.5rem; background: var(--admin-primary); color: white; text-decoration: none; border-radius: 8px; border: none; cursor: pointer; font-weight: 500; transition: all 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;}
    .btn:hover { background: var(--admin-primary-hover); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(220, 20, 60, 0.2);}
    .card { 
      background: var(--admin-surface);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      padding: 1.5rem 2rem; 
      border-radius: var(--admin-radius); 
      margin-bottom: 1.25rem; 
      box-shadow: var(--admin-shadow); 
      border: 1px solid var(--admin-border);
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .card:hover { transform: translateY(-2px); box-shadow: 0 12px 24px rgba(139, 0, 0, 0.1); }
    .card h3 { color: var(--admin-text); margin-bottom: 0.25rem; font-size: 1.25rem; font-weight: 600;}
    .card p { color: var(--admin-text-muted); font-size: 0.95rem; line-height: 1.5; margin-bottom: 0.5rem;}
    .actions { display: flex; gap: 0.5rem; }
    .btn-sm { padding: 0.4rem 0.8rem; font-size: 0.85rem; border-radius: 6px; border: none; cursor: pointer; font-weight: 500; transition: all 0.2s; }
    .btn-edit { background: rgba(212, 175, 55, 0.1); color: #B8860B; }
    .btn-edit:hover { background: rgba(212, 175, 55, 0.2); }
    .btn-delete { background: rgba(220, 53, 69, 0.1); color: #dc3545; }
    .btn-delete:hover { background: rgba(220, 53, 69, 0.2); }
    .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); z-index: 1000; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s; }
    .modal.active { display: flex; opacity: 1;}
    .modal-content { 
      background: white; 
      padding: 2.5rem; 
      border-radius: var(--admin-radius); 
      max-width: 500px; 
      width: 90%; 
      box-shadow: 0 24px 48px rgba(0,0,0,0.2);
      transform: scale(0.95);
      transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .modal.active .modal-content { transform: scale(1); }
    .modal h2 { color: var(--admin-text); margin-bottom: 1.5rem; font-weight: 600; }
    .form-group { margin-bottom: 1.25rem; }
    .form-group label { display: block; margin-bottom: 0.5rem; font-weight: 500; font-size: 0.95rem;}
    .form-group input, .form-group textarea { width: 100%; padding: 0.85rem 1rem; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; font-size: 1rem; transition: all 0.2s; font-family: inherit;}
    .form-group input:focus, .form-group textarea:focus { border-color: var(--admin-primary); box-shadow: 0 0 0 3px rgba(139, 0, 0, 0.1); outline: none; }
    .form-group textarea { min-height: 80px; resize: vertical; }
    .modal-buttons { display: flex; gap: 1rem; margin-top: 2rem; }
    .btn-secondary { background: rgba(0,0,0,0.05); color: var(--admin-text); }
    .btn-secondary:hover { background: rgba(0,0,0,0.1); box-shadow: none; transform: none;}
  </style>
</head>
<body>
  <header class="header">
    <div class="logo">Mahita Admin</div>
    <nav class="nav">
      <a href="/admin">Dashboard</a>
      <a href="/admin/products">Products</a>
      <a href="/admin/quotes">Quotes</a>
      <a href="/admin/settings">Settings</a>
      <a href="/">View Site</a>
    </nav>
  </header>
  
  <main class="container">
    <div class="toolbar">
      <h1>Categories</h1>
      <button class="btn" onclick="openModal()">+ Add Category</button>
    </div>
    
    ${categories.map(cat => `
    <div class="card">
      <div>
        <h3>${cat.name}</h3>
        <p>${cat.description || ''}</p>
        <small style="color: #999;">Slug: ${cat.slug}</small>
      </div>
      <div class="actions">
        <button class="btn-sm btn-edit" onclick="editCategory(${cat.id}, '${cat.name.replace(/'/g, "\\'")}', '${(cat.description || '').replace(/'/g, "\\'")}')">Edit</button>
        <button class="btn-sm btn-delete" onclick="deleteCategory(${cat.id})">Delete</button>
      </div>
    </div>
    `).join('')}
  </main>
  
  <div class="modal" id="categoryModal">
    <div class="modal-content">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h2 id="modalTitle">Add Category</h2>
        <button type="button" onclick="closeModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #666;">&times;</button>
      </div>
      <form id="categoryForm">
        <input type="hidden" id="categoryId">
        <div class="form-group">
          <label>Category Name *</label>
          <input type="text" id="categoryName" required>
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea id="categoryDescription"></textarea>
        </div>
        <div class="modal-buttons">
          <button type="submit" class="btn">Save</button>
          <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        </div>
      </form>

    </div>
  </div>
  
  <script>
    let editingId = null;
    
    function openModal() {
      editingId = null;
      document.getElementById('modalTitle').textContent = 'Add Category';
      document.getElementById('categoryForm').reset();
      document.getElementById('categoryId').value = '';
      document.getElementById('categoryModal').classList.add('active');
    }
    
    function editCategory(id, name, desc) {
      editingId = id;
      document.getElementById('modalTitle').textContent = 'Edit Category';
      document.getElementById('categoryId').value = id;
      document.getElementById('categoryName').value = name;
      document.getElementById('categoryDescription').value = desc;
      document.getElementById('categoryModal').classList.add('active');
    }
    
    function closeModal() {
      document.getElementById('categoryModal').classList.remove('active');
    }
    
    document.getElementById('categoryForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        name: document.getElementById('categoryName').value,
        description: document.getElementById('categoryDescription').value
      };
      
      const url = editingId ? '/api/admin/categories/' + editingId : '/api/admin/categories';
      const method = editingId ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (res.ok) { window.location.reload(); }
      else { alert('Error saving category'); }
    });
    
    async function deleteCategory(id) {
      if (!confirm('Delete this category?')) return;
      const res = await fetch('/api/admin/categories/' + id, { method: 'DELETE' });
      if (res.ok) { window.location.reload(); }
      else { alert('Error deleting category'); }
    }
  </script>
</body>
</html>`;
  res.send(html);
});

// Admin quotes page
app.get('/admin/quotes', requireAdmin, (req, res) => {
  const quotes = getAllQuotes();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quotes - Mahita Admin</title>
  <style>
    :root {
      --admin-bg: #f8f9fa;
      --admin-surface: rgba(255, 255, 255, 0.85);
      --admin-border: rgba(255, 255, 255, 0.4);
      --admin-shadow: 0 8px 32px rgba(139, 0, 0, 0.08);
      --admin-primary: #8B0000;
      --admin-primary-hover: #DC143C;
      --admin-text: #2d3748;
      --admin-text-muted: #718096;
      --admin-radius: 16px;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; 
      background: var(--admin-bg);
      background-image: radial-gradient(circle at top right, rgba(220, 20, 60, 0.05), transparent 400px),
                        radial-gradient(circle at bottom left, rgba(212, 175, 55, 0.05), transparent 400px);
      color: var(--admin-text);
      min-height: 100vh;
    }
    .header { 
      background: var(--admin-surface);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      padding: 1rem 2rem; 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      border-bottom: 1px solid var(--admin-border);
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .logo { font-family: 'Cormorant Garamond', serif; font-size: 1.75rem; font-weight: 600; color: var(--admin-primary); text-decoration: none;}
    .nav { display: flex; gap: 1.5rem; align-items: center; }
    .nav a { color: var(--admin-text); text-decoration: none; font-size: 0.95rem; font-weight: 500; transition: color 0.2s; }
    .nav a:hover { color: var(--admin-primary); }
    .nav a.active { color: var(--admin-primary); font-weight: 600; }
    .container { max-width: 1200px; margin: 0 auto; padding: 3rem 2rem; animation: fadeIn 0.4s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    h1 { color: var(--admin-text); font-size: 2.25rem; font-weight: 600; margin-bottom: 2.5rem; }
    .quotes-grid { display: grid; gap: 1.5rem; }
    .quote-card { 
      background: var(--admin-surface);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      padding: 2rem; 
      border-radius: var(--admin-radius); 
      box-shadow: var(--admin-shadow); 
      border: 1px solid var(--admin-border);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .quote-card:hover { transform: translateY(-3px); box-shadow: 0 16px 32px rgba(139, 0, 0, 0.1); }
    .quote-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
    .quote-header h3 { color: var(--admin-text); font-size: 1.35rem; font-weight: 600; margin-bottom: 0.25rem;}
    .status { padding: 0.35rem 0.85rem; border-radius: 20px; font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;}
    .status.pending { background: rgba(133, 100, 4, 0.1); color: #856404; }
    .status.contacted { background: rgba(0, 64, 133, 0.1); color: #004085; }
    .status.completed { background: rgba(21, 87, 36, 0.1); color: #155724; }
    .status.cancelled { background: rgba(114, 28, 36, 0.1); color: #721c24; }
    .quote-details { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; }
    .detail label { color: var(--admin-text-muted); font-size: 0.85rem; font-weight: 500;}
    .detail p { margin-top: 0.35rem; font-size: 1rem; color: var(--admin-text);}
    .detail p a { color: var(--admin-primary); text-decoration: none; }
    .detail p a:hover { text-decoration: underline; }
    .quote-message { margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px dashed var(--admin-border); }
    .quote-message label { color: var(--admin-text-muted); font-size: 0.85rem; font-weight: 500;}
    .quote-message p { margin-top: 0.5rem; font-style: italic; color: var(--admin-text); line-height: 1.5;}
    .actions { margin-top: 1.5rem; display: flex; gap: 0.75rem; }
    .btn { padding: 0.6rem 1.25rem; border: none; border-radius: 8px; cursor: pointer; font-size: 0.9rem; font-weight: 500; transition: all 0.2s; }
    .btn-contacted { background: rgba(0, 64, 133, 0.1); color: #004085; }
    .btn-contacted:hover { background: rgba(0, 64, 133, 0.2); }
    .btn-completed { background: rgba(21, 87, 36, 0.1); color: #155724; }
    .btn-completed:hover { background: rgba(21, 87, 36, 0.2); }
    .empty { text-align: center; padding: 4rem 2rem; color: var(--admin-text-muted); font-size: 1.1rem; }
  </style>
</head>
<body>
  <header class="header">
    <div class="logo">Mahita Admin</div>
    <nav class="nav">
      <a href="/admin">Dashboard</a>
      <a href="/admin/products">Products</a>
      <a href="/admin/categories">Categories</a>
      <a href="/admin/settings">Settings</a>
      <a href="/">View Site</a>
    </nav>
  </header>
  
  <main class="container">
    <h1>Quote Requests</h1>
    
    ${quotes.length > 0 ? `
    <div class="quotes-grid">
      ${quotes.map(q => `
      <div class="quote-card">
        <div class="quote-header">
          <div>
            <h3>${q.product_name || 'Unknown Product'}</h3>
            <small style="color: #999;">${new Date(q.created_at).toLocaleString()}</small>
          </div>
          <span class="status ${q.status}">${q.status}</span>
        </div>
        <div class="quote-details">
          <div class="detail">
            <label>Customer Name</label>
            <p>${q.customer_name}</p>
          </div>
          <div class="detail">
            <label>Email</label>
            <p><a href="mailto:${q.customer_email}">${q.customer_email}</a></p>
          </div>
          <div class="detail">
            <label>Phone</label>
            <p>${q.customer_phone || '-'}</p>
          </div>
        </div>
        ${q.customer_message ? `
        <div class="quote-message">
          <label>Message</label>
          <p>${q.customer_message}</p>
        </div>
        ` : ''}
        <div class="actions">
          <button class="btn btn-contacted" onclick="updateStatus(${q.id}, 'contacted')">Mark Contacted</button>
          <button class="btn btn-completed" onclick="updateStatus(${q.id}, 'completed')">Mark Completed</button>
        </div>
      </div>
      `).join('')}
    </div>
    ` : '<div class="empty">No quote requests yet.</div>'}
  </main>
  
  <script>
    async function updateStatus(id, status) {
      const res = await fetch('/api/admin/quotes/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) { window.location.reload(); }
    }
  </script>
</body>
</html>`;
  res.send(html);
});

// Admin settings page
app.get('/admin/settings', requireAdmin, (req, res) => {
  const settings = getAllSettings();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Settings - Mahita Admin</title>
  <style>
    :root {
      --admin-bg: #f8f9fa;
      --admin-surface: rgba(255, 255, 255, 0.85);
      --admin-border: rgba(255, 255, 255, 0.4);
      --admin-shadow: 0 8px 32px rgba(139, 0, 0, 0.08);
      --admin-primary: #8B0000;
      --admin-primary-hover: #DC143C;
      --admin-text: #2d3748;
      --admin-text-muted: #718096;
      --admin-radius: 16px;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; 
      background: var(--admin-bg);
      background-image: radial-gradient(circle at top right, rgba(220, 20, 60, 0.05), transparent 400px),
                        radial-gradient(circle at bottom left, rgba(212, 175, 55, 0.05), transparent 400px);
      color: var(--admin-text);
      min-height: 100vh;
    }
    .header { 
      background: var(--admin-surface);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      padding: 1rem 2rem; 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      border-bottom: 1px solid var(--admin-border);
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .logo { font-family: 'Cormorant Garamond', serif; font-size: 1.75rem; font-weight: 600; color: var(--admin-primary); text-decoration: none;}
    .nav { display: flex; gap: 1.5rem; align-items: center; }
    .nav a { color: var(--admin-text); text-decoration: none; font-size: 0.95rem; font-weight: 500; transition: color 0.2s; }
    .nav a:hover { color: var(--admin-primary); }
    .nav a.active { color: var(--admin-primary); font-weight: 600; }
    .container { max-width: 600px; margin: 0 auto; padding: 3rem 2rem; animation: fadeIn 0.4s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    h1 { color: var(--admin-text); font-size: 2.25rem; font-weight: 600; margin-bottom: 2rem; text-align: center; }
    .card { 
      background: var(--admin-surface);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      padding: 2.5rem; 
      border-radius: var(--admin-radius); 
      box-shadow: var(--admin-shadow); 
      border: 1px solid var(--admin-border);
    }
    .form-group { margin-bottom: 1.5rem; }
    .form-group label { display: block; margin-bottom: 0.5rem; font-weight: 500; font-size: 0.95rem; color: var(--admin-text);}
    .form-group input { width: 100%; padding: 0.85rem 1rem; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; font-size: 1rem; transition: all 0.2s; font-family: inherit;}
    .form-group input:focus { border-color: var(--admin-primary); box-shadow: 0 0 0 3px rgba(139, 0, 0, 0.1); outline: none; }
    .form-group small { color: var(--admin-text-muted); display: block; margin-top: 0.4rem; font-size: 0.85rem;}
    .btn { width: 100%; padding: 1rem; background: var(--admin-primary); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem; font-weight: 600; transition: all 0.2s; margin-top: 1rem;}
    .btn:hover { background: var(--admin-primary-hover); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(220, 20, 60, 0.2);}
    .success { background: rgba(21, 87, 36, 0.1); color: #155724; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; display: none; text-align: center; font-weight: 500;}
  </style>
</head>
<body>
  <header class="header">
    <div class="logo">Mahita Admin</div>
    <nav class="nav">
      <a href="/admin">Dashboard</a>
      <a href="/admin/products">Products</a>
      <a href="/admin/categories">Categories</a>
      <a href="/admin/quotes">Quotes</a>
      <a href="/">View Site</a>
    </nav>
  </header>
  
  <main class="container">
    <h1>Settings</h1>
    
    <div class="card">
      <div class="success" id="successMessage">Settings saved successfully!</div>
      
      <form id="settingsForm">
        <div class="form-group">
          <label>Notification Email</label>
          <input type="email" id="notificationEmail" value="${settings.notification_email || ''}" placeholder="your@email.com">
          <small>Quotes will be sent to this email address</small>
        </div>
        
        <div class="form-group">
          <label>SMTP Host</label>
          <input type="text" id="smtpHost" value="${settings.smtp_host || ''}" placeholder="smtp.gmail.com">
        </div>
        
        <div class="form-group">
          <label>SMTP Port</label>
          <input type="number" id="smtpPort" value="${settings.smtp_port || '587'}" placeholder="587">
        </div>
        
        <div class="form-group">
          <label>SMTP Username</label>
          <input type="text" id="smtpUser" value="${settings.smtp_user || ''}" placeholder="your@email.com">
        </div>
        
        <div class="form-group">
          <label>SMTP Password</label>
          <input type="password" id="smtpPass" value="${settings.smtp_pass || ''}" placeholder="App password">
          <small>For Gmail, use an App Password (not your regular password)</small>
        </div>
        
        <button type="submit" class="btn">Save Settings</button>
      </form>

    </div>
  </main>
  
  <script>
    document.getElementById('settingsForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const settings = {
        notification_email: document.getElementById('notificationEmail').value,
        smtp_host: document.getElementById('smtpHost').value,
        smtp_port: document.getElementById('smtpPort').value,
        smtp_user: document.getElementById('smtpUser').value,
        smtp_pass: document.getElementById('smtpPass').value
      };
      
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      
      if (res.ok) {
        document.getElementById('successMessage').style.display = 'block';
        setTimeout(() => { document.getElementById('successMessage').style.display = 'none'; }, 3000);
      } else {
        alert('Error saving settings');
      }
    });
  </script>
</body>
</html>`;
  res.send(html);
});

// ============================================
// API ROUTES
// ============================================

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const admin = verifyAdmin(username, password);
  if (admin) {
    req.session.admin = admin;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Admin logout
app.get('/api/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// Products API
app.get('/api/products', (req, res) => {
  res.json(getAllProducts());
});

app.get('/api/products/:id', (req, res) => {
  const product = getProductById(req.params.id);
  if (product) res.json(product);
  else res.status(404).json({ error: 'Product not found' });
});

app.post('/api/admin/products', requireAdmin, (req, res) => {
  const { name, description, categoryId, price, cutwiseUrl, images } = req.body;
  const id = createProduct(name, description, categoryId ? parseInt(categoryId) : null, price ? parseFloat(price) : null, images || [], cutwiseUrl);
  res.json({ success: true, id });
});

app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
  const { name, description, categoryId, price, cutwiseUrl, images } = req.body;
  updateProduct(req.params.id, name, description, categoryId ? parseInt(categoryId) : null, price ? parseFloat(price) : null, images || [], cutwiseUrl);
  res.json({ success: true });
});

app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  deleteProduct(req.params.id);
  res.json({ success: true });
});

// Categories API
app.get('/api/categories', (req, res) => {
  res.json(getAllCategories());
});

app.post('/api/admin/categories', requireAdmin, (req, res) => {
  const { name, description } = req.body;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const id = createCategory(name, slug, description);
  res.json({ success: true, id });
});

app.put('/api/admin/categories/:id', requireAdmin, (req, res) => {
  const { name, description } = req.body;
  updateCategory(req.params.id, name, description);
  res.json({ success: true });
});

app.delete('/api/admin/categories/:id', requireAdmin, (req, res) => {
  deleteCategory(req.params.id);
  res.json({ success: true });
});

// Quotes API
app.post('/api/quotes', async (req, res) => {
  const { productId, name, email, phone, message } = req.body;

  const id = createQuote(productId ? parseInt(productId) : null, name, email, phone, message);

  // Send email notification
  const settings = getAllSettings();
  if (settings.notification_email && settings.smtp_host) {
    try {
      const transporter = nodemailer.createTransport({
        host: settings.smtp_host,
        port: parseInt(settings.smtp_port) || 587,
        secure: false,
        auth: {
          user: settings.smtp_user,
          pass: settings.smtp_pass
        }
      });

      const product = productId ? getProductById(productId) : null;

      await transporter.sendMail({
        from: settings.smtp_user,
        to: settings.notification_email,
        subject: `New Quote Request - ${product?.name || 'Product'}`,
        html: `
          <h2>New Quote Request</h2>
          <p><strong>Product:</strong> ${product?.name || 'General Inquiry'}</p>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
          <p><strong>Message:</strong> ${message || 'No message'}</p>
        `
      });
    } catch (e) {
      console.error('Email error:', e.message);
    }
  }

  res.json({ success: true, id });
});

app.get('/api/admin/quotes', requireAdmin, (req, res) => {
  res.json(getAllQuotes());
});

app.put('/api/admin/quotes/:id', requireAdmin, (req, res) => {
  const { status } = req.body;
  updateQuoteStatus(req.params.id, status);
  res.json({ success: true });
});

// Settings API
app.get('/api/admin/settings', requireAdmin, (req, res) => {
  const settings = getAllSettings();
  delete settings.smtp_pass;
  res.json(settings);
});

app.put('/api/admin/settings', requireAdmin, (req, res) => {
  const settings = req.body;
  Object.entries(settings).forEach(([key, value]) => {
    if (value) setSetting(key, value);
  });
  res.json({ success: true });
});

// Media upload (multiple images/videos)
app.post('/api/admin/upload', requireAdmin, upload.array('files', 10), (req, res) => {
  if (req.files && req.files.length > 0) {
    const files = req.files.map(file => ({
      filename: '/uploads/' + file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      isVideo: file.mimetype.startsWith('video/')
    }));
    res.json({ success: true, files: files });
  } else {
    res.status(400).json({ error: 'No files uploaded' });
  }
});

// Serve uploaded files
app.get('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(__dirname, 'data', 'uploads', 'products', filename);
  res.sendFile(filepath, (err) => {
    if (err) {
      console.error('Error serving file:', err);
      res.status(404).send('File not found');
    }
  });
});

// Stripe checkout endpoint
app.post('/api/create-checkout-session', async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Payments not configured. Please contact the administrator.' });
  }

  try {
    const { productId, quantity = 1 } = req.body;
    const product = getProductById(productId);

    if (!product || !product.price || product.price <= 0) {
      return res.status(400).json({ error: 'Product not available for purchase' });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'inr',
          product_data: {
            name: product.name,
            description: product.description ? product.description.substring(0, 500) : 'Mahita Jewelry',
            images: product.images && product.images.length > 0
              ? [product.images[0].filename ? 'http://localhost:3000' + product.images[0].filename : product.images[0].url]
              : []
          },
          unit_amount: Math.round(product.price * 100) // Stripe uses paise
        },
        quantity: parseInt(quantity)
      }],
      mode: 'payment',
      success_url: req.headers.origin + '/payment-success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: req.headers.origin + '/products/' + productId,
      metadata: {
        productId: product.id,
        productName: product.name
      }
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Stripe error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stripe webhook endpoint (for handling payment success)
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Payments not configured' });
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET || 'whsec_your_webhook_secret');
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log('Payment successful for:', session.metadata.productName);
    // TODO: Send confirmation email, update inventory, etc.
  }

  res.json({ received: true });
});

// Get Stripe publishable key
app.get('/api/stripe-config', (req, res) => {
  if (!stripe) {
    return res.json({ publishableKey: null });
  }
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null
  });
});

// Start server
async function start() {
  await initDatabase();
  console.log('Database initialized');

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Mahita Jewelry server running on http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin`);
    console.log(`Login: nirav / kothari_n`);
  });
}

start().catch(console.error);
