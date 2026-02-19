const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');

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
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
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
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

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
  <title>Mahita Jewelry - Exquisite Indian Jewelry</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #FFFEF5; color: #333; }
    .header { background: linear-gradient(135deg, #D4AF37 0%, #B8860B 100%); padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 100; }
    .logo { font-size: 1.8rem; font-weight: bold; color: #fff; text-decoration: none; }
    .nav { display: flex; gap: 1.5rem; }
    .nav a { color: #fff; text-decoration: none; font-weight: 500; transition: opacity 0.3s; }
    .nav a:hover { opacity: 0.8; }
    .hero { background: linear-gradient(135deg, #8B0000 0%, #DC143C 100%); color: white; padding: 4rem 2rem; text-align: center; }
    .hero h1 { font-size: 3rem; margin-bottom: 1rem; }
    .hero p { font-size: 1.3rem; opacity: 0.95; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    .section-title { text-align: center; margin-bottom: 2rem; color: #D4AF37; font-size: 2rem; }
    .categories { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 3rem; }
    .category-card { background: white; padding: 1.5rem; border-radius: 10px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1); transition: transform 0.3s; text-decoration: none; color: inherit; }
    .category-card:hover { transform: translateY(-5px); }
    .category-card h3 { color: #8B0000; margin-bottom: 0.5rem; }
    .products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 2rem; }
    .product-card { background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); transition: transform 0.3s; }
    .product-card:hover { transform: translateY(-5px); }
    .product-image { width: 100%; height: 250px; background: linear-gradient(135deg, #f5f5f5, #e0e0e0); display: flex; align-items: center; justify-content: center; color: #999; font-size: 3rem; }
    .product-info { padding: 1.5rem; }
    .product-info h3 { color: #333; margin-bottom: 0.5rem; }
    .product-info p { color: #666; font-size: 0.9rem; margin-bottom: 1rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .product-price { font-size: 1.2rem; color: #D4AF37; font-weight: bold; margin-bottom: 1rem; }
    .btn { display: inline-block; padding: 0.8rem 1.5rem; background: #8B0000; color: white; text-decoration: none; border-radius: 5px; transition: background 0.3s; border: none; cursor: pointer; }
    .btn:hover { background: #DC143C; }
    .footer { background: #333; color: white; padding: 2rem; text-align: center; margin-top: 3rem; }
    .search-bar { display: flex; gap: 0.5rem; }
    .search-bar input { padding: 0.5rem 1rem; border: none; border-radius: 5px; width: 250px; }
    .search-bar button { padding: 0.5rem 1rem; background: #8B0000; color: white; border: none; border-radius: 5px; cursor: pointer; }
  </style>
</head>
<body>
  <header class="header">
    <a href="/" class="logo">Mahita</a>
    <nav class="nav">
      <a href="/">Home</a>
      <a href="/products">Products</a>
      <a href="/admin">Admin</a>
    </nav>
    <form class="search-bar" action="/search" method="GET">
      <input type="text" name="q" placeholder="Search jewelry...">
      <button type="submit">Search</button>
    </form>
  </header>
  
  <section class="hero">
    <h1>Exquisite Indian Jewelry</h1>
    <p>Discover our stunning collection of traditional and modern jewelry</p>
  </section>
  
  <main class="container">
    <h2 class="section-title">Browse by Category</h2>
    <div class="categories">
      ${categories.map(cat => `
        <a href="/category/${cat.slug}" class="category-card">
          <h3>${cat.name}</h3>
          <p>${cat.description || ''}</p>
        </a>
      `).join('')}
    </div>
    
    <h2 class="section-title">Featured Collection</h2>
    <div class="products-grid">
      ${products.map(prod => `
        <div class="product-card">
          <div class="product-image">💎</div>
          <div class="product-info">
            <h3>${prod.name}</h3>
            <p>${prod.description || ''}</p>
            <div class="product-price">₹${prod.price?.toLocaleString() || 'Contact for price'}</div>
            <a href="/product/${prod.id}" class="btn">View Details</a>
          </div>
        </div>
      `).join('')}
    </div>
  </main>
  
  <footer class="footer">
    <p>&copy; ${new Date().getFullYear()} Mahita Jewelry. All rights reserved.</p>
  </footer>
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
  <title>All Products - Mahita Jewelry</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #FFFEF5; color: #333; }
    .header { background: linear-gradient(135deg, #D4AF37 0%, #B8860B 100%); padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 100; }
    .logo { font-size: 1.8rem; font-weight: bold; color: #fff; text-decoration: none; }
    .nav { display: flex; gap: 1.5rem; }
    .nav a { color: #fff; text-decoration: none; font-weight: 500; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    h1 { color: #D4AF37; margin-bottom: 2rem; }
    .filters { display: flex; gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap; }
    .filter-btn { padding: 0.5rem 1rem; background: white; border: 2px solid #D4AF37; border-radius: 5px; cursor: pointer; transition: all 0.3s; text-decoration: none; color: #333; }
    .filter-btn.active, .filter-btn:hover { background: #D4AF37; color: white; }
    .products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 2rem; }
    .product-card { background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
    .product-image { width: 100%; height: 250px; background: linear-gradient(135deg, #f5f5f5, #e0e0e0); display: flex; align-items: center; justify-content: center; color: #999; font-size: 3rem; }
    .product-info { padding: 1.5rem; }
    .product-info h3 { margin-bottom: 0.5rem; }
    .product-info p { color: #666; font-size: 0.9rem; margin-bottom: 1rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .product-price { font-size: 1.2rem; color: #D4AF37; font-weight: bold; margin-bottom: 1rem; }
    .btn { display: inline-block; padding: 0.8rem 1.5rem; background: #8B0000; color: white; text-decoration: none; border-radius: 5px; }
    .back-link { display: inline-block; margin-bottom: 1rem; color: #D4AF37; text-decoration: none; }
  </style>
</head>
<body>
  <header class="header">
    <a href="/" class="logo">Mahita</a>
    <nav class="nav">
      <a href="/">Home</a>
      <a href="/products">Products</a>
      <a href="/admin">Admin</a>
    </nav>
  </header>
  
  <main class="container">
    <a href="/" class="back-link">← Back to Home</a>
    <h1>Our Collection</h1>
    <div class="filters">
      <a href="/products" class="filter-btn active">All</a>
      ${categories.map(cat => `<a href="/category/${cat.slug}" class="filter-btn">${cat.name}</a>`).join('')}
    </div>
    <div class="products-grid">
      ${products.map(prod => `
        <div class="product-card">
          <div class="product-image">💎</div>
          <div class="product-info">
            <h3>${prod.name}</h3>
            <p>${prod.description || ''}</p>
            <div class="product-price">₹${prod.price?.toLocaleString() || 'Contact for price'}</div>
            <a href="/product/${prod.id}" class="btn">View Details</a>
          </div>
        </div>
      `).join('')}
    </div>
  </main>
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
  <title>${category.name} - Mahita Jewelry</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #FFFEF5; color: #333; }
    .header { background: linear-gradient(135deg, #D4AF37 0%, #B8860B 100%); padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 100; }
    .logo { font-size: 1.8rem; font-weight: bold; color: #fff; text-decoration: none; }
    .nav { display: flex; gap: 1.5rem; }
    .nav a { color: #fff; text-decoration: none; font-weight: 500; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    h1 { color: #D4AF37; margin-bottom: 1rem; }
    .category-desc { color: #666; margin-bottom: 2rem; font-size: 1.1rem; }
    .products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 2rem; }
    .product-card { background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
    .product-image { width: 100%; height: 250px; background: linear-gradient(135deg, #f5f5f5, #e0e0e0); display: flex; align-items: center; justify-content: center; color: #999; font-size: 3rem; }
    .product-info { padding: 1.5rem; }
    .product-info h3 { margin-bottom: 0.5rem; }
    .product-info p { color: #666; font-size: 0.9rem; margin-bottom: 1rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .product-price { font-size: 1.2rem; color: #D4AF37; font-weight: bold; margin-bottom: 1rem; }
    .btn { display: inline-block; padding: 0.8rem 1.5rem; background: #8B0000; color: white; text-decoration: none; border-radius: 5px; }
    .back-link { display: inline-block; margin-bottom: 1rem; color: #D4AF37; text-decoration: none; }
  </style>
</head>
<body>
  <header class="header">
    <a href="/" class="logo">Mahita</a>
    <nav class="nav">
      <a href="/">Home</a>
      <a href="/products">Products</a>
      <a href="/admin">Admin</a>
    </nav>
  </header>
  
  <main class="container">
    <a href="/products" class="back-link">← Back to Products</a>
    <h1>${category.name}</h1>
    <p class="category-desc">${category.description || ''}</p>
    <div class="products-grid">
      ${products.length > 0 ? products.map(prod => `
        <div class="product-card">
          <div class="product-image">💎</div>
          <div class="product-info">
            <h3>${prod.name}</h3>
            <p>${prod.description || ''}</p>
            <div class="product-price">₹${prod.price?.toLocaleString() || 'Contact for price'}</div>
            <a href="/product/${prod.id}" class="btn">View Details</a>
          </div>
        </div>
      `).join('') : '<p>No products in this category yet.</p>'}
    </div>
  </main>
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
  <title>${product.name} - Mahita Jewelry</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #FFFEF5; color: #333; }
    .header { background: linear-gradient(135deg, #D4AF37 0%, #B8860B 100%); padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 100; }
    .logo { font-size: 1.8rem; font-weight: bold; color: #fff; text-decoration: none; }
    .nav { display: flex; gap: 1.5rem; }
    .nav a { color: #fff; text-decoration: none; font-weight: 500; }
    .container { max-width: 1000px; margin: 0 auto; padding: 2rem; }
    .product-detail { display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; background: white; padding: 2rem; border-radius: 15px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    @media (max-width: 768px) { .product-detail { grid-template-columns: 1fr; } }
    .product-image { width: 100%; height: 400px; background: linear-gradient(135deg, #f5f5f5, #e0e0e0); display: flex; align-items: center; justify-content: center; color: #999; font-size: 6rem; border-radius: 10px; }
    .product-info h1 { color: #8B0000; margin-bottom: 0.5rem; }
    .category { color: #D4AF37; font-size: 0.9rem; margin-bottom: 1rem; }
    .price { font-size: 2rem; color: #D4AF37; font-weight: bold; margin: 1rem 0; }
    .description { color: #666; line-height: 1.8; margin-bottom: 2rem; }
    .btn { display: inline-block; padding: 1rem 2rem; background: #8B0000; color: white; text-decoration: none; border-radius: 5px; font-size: 1.1rem; border: none; cursor: pointer; transition: background 0.3s; }
    .btn:hover { background: #DC143C; }
    .back-link { display: inline-block; margin-bottom: 1rem; color: #D4AF37; text-decoration: none; }
    .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center; }
    .modal.active { display: flex; }
    .modal-content { background: white; padding: 2rem; border-radius: 15px; max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto; }
    .modal h2 { color: #8B0000; margin-bottom: 1.5rem; }
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
    .form-group input, .form-group textarea { width: 100%; padding: 0.8rem; border: 2px solid #ddd; border-radius: 5px; font-size: 1rem; }
    .form-group textarea { min-height: 100px; resize: vertical; }
    .modal-buttons { display: flex; gap: 1rem; margin-top: 1.5rem; }
    .btn-secondary { background: #666; }
    .success-message { display: none; color: #28a745; text-align: center; padding: 2rem; }
    .success-message.show { display: block; }
  </style>
</head>
<body>
  <header class="header">
    <a href="/" class="logo">Mahita</a>
    <nav class="nav">
      <a href="/">Home</a>
      <a href="/products">Products</a>
      <a href="/admin">Admin</a>
    </nav>
  </header>
  
  <main class="container">
    <a href="/products" class="back-link">← Back to Products</a>
    
    <div class="product-detail">
      <div class="product-image">💎</div>
      <div class="product-info">
        <p class="category">${category ? category.name : 'Uncategorized'}</p>
        <h1>${product.name}</h1>
        <p class="price">₹${product.price?.toLocaleString() || 'Contact for price'}</p>
        <p class="description">${product.description || 'No description available.'}</p>
        <button class="btn" onclick="openQuoteModal()">Request Quote</button>
      </div>
    </div>
  </main>
  
  <div class="modal" id="quoteModal">
    <div class="modal-content">
      <h2>Request a Quote</h2>
      <p style="margin-bottom: 1rem; color: #666;">Product: <strong>${product.name}</strong></p>
      
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
          <textarea id="customerMessage" placeholder="Any specific requirements or questions?"></textarea>
        </div>
        <div class="modal-buttons">
          <button class="btn" onclick="submitQuote()">Submit Request</button>
          <button class="btn btn-secondary" onclick="closeQuoteModal()">Cancel</button>
        </div>
      </div>
      
      <div class="success-message" id="successMessage">
        <h3>Thank you!</h3>
        <p>Your quote request has been submitted. We'll get back to you soon.</p>
        <button class="btn" onclick="closeQuoteModal()" style="margin-top: 1rem;">Close</button>
      </div>
    </div>
  </div>
  
  <script>
    const productId = ${product.id};
    
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
      const name = document.getElementById('customerName').value;
      const email = document.getElementById('customerEmail').value;
      const phone = document.getElementById('customerPhone').value;
      const message = document.getElementById('customerMessage').value;
      
      if (!name || !email) {
        alert('Please fill in your name and email.');
        return;
      }
      
      try {
        const res = await fetch('/api/quotes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId, name, email, phone, message })
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
  </script>
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
  <title>Search Results - Mahita Jewelry</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #FFFEF5; color: #333; }
    .header { background: linear-gradient(135deg, #D4AF37 0%, #B8860B 100%); padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 100; }
    .logo { font-size: 1.8rem; font-weight: bold; color: #fff; text-decoration: none; }
    .nav { display: flex; gap: 1.5rem; }
    .nav a { color: #fff; text-decoration: none; font-weight: 500; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    h1 { color: #D4AF37; margin-bottom: 1rem; }
    .products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 2rem; }
    .product-card { background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
    .product-image { width: 100%; height: 250px; background: linear-gradient(135deg, #f5f5f5, #e0e0e0); display: flex; align-items: center; justify-content: center; color: #999; font-size: 3rem; }
    .product-info { padding: 1.5rem; }
    .product-info h3 { margin-bottom: 0.5rem; }
    .product-info p { color: #666; font-size: 0.9rem; margin-bottom: 1rem; }
    .product-price { font-size: 1.2rem; color: #D4AF37; font-weight: bold; margin-bottom: 1rem; }
    .btn { display: inline-block; padding: 0.8rem 1.5rem; background: #8B0000; color: white; text-decoration: none; border-radius: 5px; }
    .no-results { text-align: center; padding: 3rem; color: #666; }
  </style>
</head>
<body>
  <header class="header">
    <a href="/" class="logo">Mahita</a>
    <nav class="nav">
      <a href="/">Home</a>
      <a href="/products">Products</a>
      <a href="/admin">Admin</a>
    </nav>
  </header>
  
  <main class="container">
    <h1>Search Results for "${query}"</h1>
    ${products.length > 0 ? `
    <div class="products-grid">
      ${products.map(prod => `
        <div class="product-card">
          <div class="product-image">💎</div>
          <div class="product-info">
            <h3>${prod.name}</h3>
            <p>${prod.description || ''}</p>
            <div class="product-price">₹${prod.price?.toLocaleString() || 'Contact for price'}</div>
            <a href="/product/${prod.id}" class="btn">View Details</a>
          </div>
        </div>
      `).join('')}
    </div>
    ` : '<div class="no-results"><p>No products found. Try a different search term.</p></div>'}
  </main>
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
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #D4AF37 0%, #B8860B 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .login-container { background: white; padding: 2rem; border-radius: 15px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); width: 100%; max-width: 400px; }
    h1 { color: #8B0000; margin-bottom: 1.5rem; text-align: center; }
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
    .form-group input { width: 100%; padding: 0.8rem; border: 2px solid #ddd; border-radius: 5px; font-size: 1rem; }
    .btn { width: 100%; padding: 1rem; background: #8B0000; color: white; border: none; border-radius: 5px; font-size: 1rem; cursor: pointer; }
    .btn:hover { background: #DC143C; }
    .error { color: red; margin-bottom: 1rem; display: none; }
    .back-link { display: block; text-align: center; margin-top: 1rem; color: #666; text-decoration: none; }
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
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5; }
    .header { background: linear-gradient(135deg, #8B0000 0%, #DC143C 100%); padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; }
    .logo { font-size: 1.5rem; font-weight: bold; color: #fff; }
    .nav { display: flex; gap: 1.5rem; }
    .nav a { color: #fff; text-decoration: none; opacity: 0.9; }
    .nav a:hover { opacity: 1; }
    .logout { background: rgba(255,255,255,0.2); padding: 0.5rem 1rem; border-radius: 5px; color: white; text-decoration: none; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    h1 { color: #333; margin-bottom: 2rem; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
    .stat-card { background: white; padding: 1.5rem; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
    .stat-card h3 { color: #D4AF37; font-size: 2.5rem; margin-bottom: 0.5rem; }
    .stat-card p { color: #666; }
    .menu { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; }
    .menu-card { background: white; padding: 2rem; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; cursor: pointer; transition: transform 0.3s; }
    .menu-card:hover { transform: translateY(-5px); }
    .menu-card h3 { color: #8B0000; margin-bottom: 0.5rem; }
    .menu-card p { color: #666; }
    .menu-card a { display: block; color: inherit; text-decoration: none; }
  </style>
</head>
<body>
  <header class="header">
    <div class="logo">Mahita Admin</div>
    <nav class="nav">
      <a href="/">View Site</a>
      <a href="/admin/products">Products</a>
      <a href="/admin/categories">Categories</a>
      <a href="/admin/quotes">Quotes</a>
      <a href="/admin/settings">Settings</a>
      <a href="/api/admin/logout" class="logout">Logout</a>
    </nav>
  </header>
  
  <main class="container">
    <h1>Dashboard</h1>
    
    <div class="stats">
      <div class="stat-card">
        <h3>${stats.productsCount}</h3>
        <p>Products</p>
      </div>
      <div class="stat-card">
        <h3>${stats.quotesCount}</h3>
        <p>Pending Quotes</p>
      </div>
      <div class="stat-card">
        <h3>${stats.categoriesCount}</h3>
        <p>Categories</p>
      </div>
    </div>
    
    <div class="menu">
      <a href="/admin/products" class="menu-card">
        <h3>📦 Products</h3>
        <p>Manage your jewelry products</p>
      </a>
      <a href="/admin/categories" class="menu-card">
        <h3>📁 Categories</h3>
        <p>Manage product categories</p>
      </a>
      <a href="/admin/quotes" class="menu-card">
        <h3>📝 Quotes</h3>
        <p>View quote requests</p>
      </a>
      <a href="/admin/settings" class="menu-card">
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
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5; }
    .header { background: linear-gradient(135deg, #8B0000 0%, #DC143C 100%); padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; }
    .logo { font-size: 1.5rem; font-weight: bold; color: #fff; }
    .nav { display: flex; gap: 1.5rem; }
    .nav a { color: #fff; text-decoration: none; opacity: 0.9; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
    h1 { color: #333; }
    .btn { padding: 0.8rem 1.5rem; background: #8B0000; color: white; text-decoration: none; border-radius: 5px; border: none; cursor: pointer; }
    .table-container { background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    table { width: 100%; border-collapse: collapse; }
    th { background: #D4AF37; color: white; padding: 1rem; text-align: left; }
    td { padding: 1rem; border-bottom: 1px solid #eee; }
    .actions { display: flex; gap: 0.5rem; }
    .btn-sm { padding: 0.5rem 1rem; font-size: 0.9rem; }
    .btn-edit { background: #D4AF37; }
    .btn-delete { background: #dc3545; }
    .empty { text-align: center; padding: 3rem; color: #666; }
    .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center; }
    .modal.active { display: flex; }
    .modal-content { background: white; padding: 2rem; border-radius: 15px; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto; }
    .modal h2 { color: #8B0000; margin-bottom: 1.5rem; }
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
    .form-group input, .form-group textarea, .form-group select { width: 100%; padding: 0.8rem; border: 2px solid #ddd; border-radius: 5px; font-size: 1rem; }
    .form-group textarea { min-height: 100px; }
    .modal-buttons { display: flex; gap: 1rem; margin-top: 1.5rem; }
    .btn-secondary { background: #666; }
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
            return `<tr>
              <td>${p.id}</td>
              <td>${p.name}</td>
              <td>${cat?.name || '-'}</td>
              <td>₹${p.price?.toLocaleString() || '-'}</td>
              <td>${p.is_active ? 'Active' : 'Inactive'}</td>
              <td class="actions">
                <button class="btn-sm btn-edit" onclick="editProduct(${p.id}, '${p.name.replace(/'/g, "\\'")}', '${(p.description || '').replace(/'/g, "\\'")}', ${p.category_id}, ${p.price})">Edit</button>
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
      <h2 id="modalTitle">Add Product</h2>
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
      document.getElementById('productModal').classList.add('active');
    }
    
    function editProduct(id, name, desc, catId, price) {
      editingId = id;
      document.getElementById('modalTitle').textContent = 'Edit Product';
      document.getElementById('productId').value = id;
      document.getElementById('productName').value = name;
      document.getElementById('productDescription').value = desc;
      document.getElementById('productCategory').value = catId || '';
      document.getElementById('productPrice').value = price || '';
      document.getElementById('productModal').classList.add('active');
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
        price: document.getElementById('productPrice').value
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
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5; }
    .header { background: linear-gradient(135deg, #8B0000 0%, #DC143C 100%); padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; }
    .logo { font-size: 1.5rem; font-weight: bold; color: #fff; }
    .nav { display: flex; gap: 1.5rem; }
    .nav a { color: #fff; text-decoration: none; opacity: 0.9; }
    .container { max-width: 800px; margin: 0 auto; padding: 2rem; }
    .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
    h1 { color: #333; }
    .btn { padding: 0.8rem 1.5rem; background: #8B0000; color: white; text-decoration: none; border-radius: 5px; border: none; cursor: pointer; }
    .card { background: white; padding: 1.5rem; border-radius: 10px; margin-bottom: 1rem; box-shadow: 0 2px 10px rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center; }
    .card h3 { color: #8B0000; }
    .card p { color: #666; }
    .actions { display: flex; gap: 0.5rem; }
    .btn-sm { padding: 0.5rem 1rem; font-size: 0.9rem; }
    .btn-edit { background: #D4AF37; }
    .btn-delete { background: #dc3545; }
    .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center; }
    .modal.active { display: flex; }
    .modal-content { background: white; padding: 2rem; border-radius: 15px; max-width: 500px; width: 90%; }
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
    .form-group input, .form-group textarea { width: 100%; padding: 0.8rem; border: 2px solid #ddd; border-radius: 5px; }
    .modal-buttons { display: flex; gap: 1rem; margin-top: 1.5rem; }
    .btn-secondary { background: #666; }
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
      <h2 id="modalTitle">Add Category</h2>
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
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5; }
    .header { background: linear-gradient(135deg, #8B0000 0%, #DC143C 100%); padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; }
    .logo { font-size: 1.5rem; font-weight: bold; color: #fff; }
    .nav { display: flex; gap: 1.5rem; }
    .nav a { color: #fff; text-decoration: none; opacity: 0.9; }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    h1 { color: #333; margin-bottom: 2rem; }
    .quotes-grid { display: grid; gap: 1.5rem; }
    .quote-card { background: white; padding: 1.5rem; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .quote-header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem; }
    .quote-header h3 { color: #8B0000; }
    .status { padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.85rem; }
    .status.pending { background: #fff3cd; color: #856404; }
    .status.contacted { background: #cce5ff; color: #004085; }
    .status.completed { background: #d4edda; color: #155724; }
    .status.cancelled { background: #f8d7da; color: #721c24; }
    .quote-details { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
    .detail label { color: #999; font-size: 0.85rem; }
    .detail p { margin-top: 0.2rem; }
    .quote-message { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #eee; }
    .actions { margin-top: 1rem; display: flex; gap: 0.5rem; }
    .btn { padding: 0.5rem 1rem; border: none; border-radius: 5px; cursor: pointer; font-size: 0.9rem; }
    .btn-contacted { background: #cce5ff; color: #004085; }
    .btn-completed { background: #d4edda; color: #155724; }
    .empty { text-align: center; padding: 3rem; color: #666; }
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
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5; }
    .header { background: linear-gradient(135deg, #8B0000 0%, #DC143C 100%); padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; }
    .logo { font-size: 1.5rem; font-weight: bold; color: #fff; }
    .nav { display: flex; gap: 1.5rem; }
    .nav a { color: #fff; text-decoration: none; opacity: 0.9; }
    .container { max-width: 600px; margin: 0 auto; padding: 2rem; }
    h1 { color: #333; margin-bottom: 2rem; }
    .card { background: white; padding: 2rem; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .form-group { margin-bottom: 1.5rem; }
    .form-group label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
    .form-group input { width: 100%; padding: 0.8rem; border: 2px solid #ddd; border-radius: 5px; font-size: 1rem; }
    .form-group small { color: #666; display: block; margin-top: 0.3rem; }
    .btn { padding: 1rem 2rem; background: #8B0000; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 1rem; }
    .success { background: #d4edda; color: #155724; padding: 1rem; border-radius: 5px; margin-bottom: 1rem; display: none; }
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
  const { name, description, categoryId, price } = req.body;
  const id = createProduct(name, description, categoryId ? parseInt(categoryId) : null, price ? parseFloat(price) : null);
  res.json({ success: true, id });
});

app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
  const { name, description, categoryId, price } = req.body;
  updateProduct(req.params.id, name, description, categoryId ? parseInt(categoryId) : null, price ? parseFloat(price) : null, []);
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

// Image upload
app.post('/api/admin/upload', requireAdmin, upload.single('image'), (req, res) => {
  if (req.file) {
    res.json({ success: true, filename: '/uploads/' + req.file.filename });
  } else {
    res.status(400).json({ error: 'No file uploaded' });
  }
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
