const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'jewelry.db');

let db = null;

// Initialize database
async function initDatabase() {
  const SQL = await initSqlJs();
  
  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  
  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      category_id INTEGER,
      price REAL,
      images TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT,
      customer_message TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Seed default admin user if not exists
  const adminExists = db.exec("SELECT * FROM admin_users WHERE username = 'nirav'");
  if (adminExists.length === 0 || adminExists[0].values.length === 0) {
    const bcrypt = require('bcryptjs');
    const hashedPassword = bcrypt.hashSync('kothari_n', 10);
    db.run("INSERT INTO admin_users (username, password) VALUES (?, ?)", ['nirav', hashedPassword]);
  }
  
  // Seed default categories if none exist
  const categoriesExist = db.exec("SELECT COUNT(*) FROM categories");
  if (categoriesExist.length === 0 || categoriesExist[0].values[0][0] === 0) {
    const defaultCategories = [
      ['Necklaces', 'necklaces', 'Elegant necklaces for every occasion'],
      ['Rings', 'rings', 'Beautiful rings in various designs'],
      ['Earrings', 'earrings', 'Stunning earrings to complement your look'],
      ['Bangles', 'bangles', 'Traditional and modern bangles'],
      ['Bracelets', 'bracelets', 'Beautiful bracelets for women'],
      ['Maang Tikka', 'maang-tikka', 'Traditional maang tikka for bridal wear']
    ];
    
    defaultCategories.forEach((cat, index) => {
      db.run("INSERT INTO categories (name, slug, description, sort_order) VALUES (?, ?, ?, ?)", [cat[0], cat[1], cat[2], index]);
    });
  }
  
  // Seed sample products if none exist
  const productsExist = db.exec("SELECT COUNT(*) FROM products");
  if (productsExist.length === 0 || productsExist[0].values[0][0] === 0) {
    const sampleProducts = [
      ['Gold Necklace', 'A beautiful 22k gold necklace perfect for weddings and celebrations. This exquisite piece features intricate traditional designs.', 1, 85000],
      ['Diamond Ring', 'Elegant diamond ring with certified stones. A timeless piece for special moments.', 2, 125000],
      ['Pearl Earrings', 'Freshwater pearl earrings with gold setting. Perfect for both traditional and modern outfits.', 3, 15000],
      ['Gold Bangles Set', 'Set of 6 gold bangles with traditional motifs. Essential for any bridal collection.', 4, 95000],
      ['Kundan Bracelet', 'Handcrafted Kundan bracelet with meenakari work. A royal piece for special occasions.', 5, 45000],
      ['Maang Tikka', 'Traditional maang tikka with pearl drops. Complete your bridal look with this elegant piece.', 6, 28000]
    ];
    
    sampleProducts.forEach(prod => {
      db.run("INSERT INTO products (name, description, category_id, price, images) VALUES (?, ?, ?, ?, ?)", 
        [prod[0], prod[1], prod[2], prod[3], JSON.stringify([])]);
    });
  }
  
  // Save database
  saveDatabase();
  
  return db;
}

// Save database to file
function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// Get database instance
function getDb() {
  return db;
}

// Helper functions
const dbHelpers = {
  // Categories
  getAllCategories: () => {
    const result = db.exec("SELECT * FROM categories ORDER BY sort_order");
    if (result.length === 0) return [];
    return result[0].values.map(row => ({
      id: row[0], name: row[1], slug: row[2], description: row[3], 
      sort_order: row[4], created_at: row[5]
    }));
  },
  
  getCategoryBySlug: (slug) => {
    const stmt = db.prepare("SELECT * FROM categories WHERE slug = ?");
    stmt.bind([slug]);
    if (stmt.step()) {
      const row = stmt.get();
      stmt.free();
      return { id: row[0], name: row[1], slug: row[2], description: row[3], sort_order: row[4] };
    }
    stmt.free();
    return null;
  },
  
  createCategory: (name, slug, description) => {
    db.run("INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)", [name, slug, description]);
    saveDatabase();
    return db.exec("SELECT last_insert_rowid()")[0].values[0][0];
  },
  
  updateCategory: (id, name, description) => {
    db.run("UPDATE categories SET name = ?, description = ? WHERE id = ?", [name, description, id]);
    saveDatabase();
  },
  
  deleteCategory: (id) => {
    db.run("DELETE FROM categories WHERE id = ?", [id]);
    saveDatabase();
  },
  
  // Products
  getAllProducts: (activeOnly = true) => {
    const query = activeOnly 
      ? "SELECT * FROM products WHERE is_active = 1 ORDER BY created_at DESC"
      : "SELECT * FROM products ORDER BY created_at DESC";
    const result = db.exec(query);
    if (result.length === 0) return [];
    return result[0].values.map(row => ({
      id: row[0], name: row[1], description: row[2], category_id: row[3],
      price: row[4], images: JSON.parse(row[5] || '[]'), is_active: row[6],
      created_at: row[7], updated_at: row[8]
    }));
  },
  
  getProductById: (id) => {
    const stmt = db.prepare("SELECT * FROM products WHERE id = ?");
    stmt.bind([id]);
    if (stmt.step()) {
      const row = stmt.get();
      stmt.free();
      return { 
        id: row[0], name: row[1], description: row[2], category_id: row[3],
        price: row[4], images: JSON.parse(row[5] || '[]'), is_active: row[6],
        created_at: row[7], updated_at: row[8]
      };
    }
    stmt.free();
    return null;
  },
  
  getProductsByCategory: (categoryId) => {
    const result = db.exec("SELECT * FROM products WHERE category_id = ? AND is_active = 1", [categoryId]);
    if (result.length === 0) return [];
    return result[0].values.map(row => ({
      id: row[0], name: row[1], description: row[2], category_id: row[3],
      price: row[4], images: JSON.parse(row[5] || '[]'), is_active: row[6]
    }));
  },
  
  searchProducts: (query) => {
    const searchTerm = `%${query}%`;
    const result = db.exec(
      "SELECT * FROM products WHERE is_active = 1 AND (name LIKE ? OR description LIKE ?)",
      [searchTerm, searchTerm]
    );
    if (result.length === 0) return [];
    return result[0].values.map(row => ({
      id: row[0], name: row[1], description: row[2], category_id: row[3],
      price: row[4], images: JSON.parse(row[5] || '[]'), is_active: row[6]
    }));
  },
  
  createProduct: (name, description, categoryId, price, images = []) => {
    db.run(
      "INSERT INTO products (name, description, category_id, price, images) VALUES (?, ?, ?, ?, ?)",
      [name, description, categoryId, price, JSON.stringify(images)]
    );
    saveDatabase();
    return db.exec("SELECT last_insert_rowid()")[0].values[0][0];
  },
  
  updateProduct: (id, name, description, categoryId, price, images) => {
    db.run(
      "UPDATE products SET name = ?, description = ?, category_id = ?, price = ?, images = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [name, description, categoryId, price, JSON.stringify(images), id]
    );
    saveDatabase();
  },
  
  deleteProduct: (id) => {
    db.run("DELETE FROM products WHERE id = ?", [id]);
    saveDatabase();
  },
  
  // Quotes
  getAllQuotes: () => {
    const result = db.exec(`
      SELECT q.*, p.name as product_name 
      FROM quotes q 
      LEFT JOIN products p ON q.product_id = p.id 
      ORDER BY q.created_at DESC
    `);
    if (result.length === 0) return [];
    return result[0].values.map(row => ({
      id: row[0], product_id: row[1], customer_name: row[2], customer_email: row[3],
      customer_phone: row[4], customer_message: row[5], status: row[6], created_at: row[7],
      product_name: row[8]
    }));
  },
  
  createQuote: (productId, customerName, customerEmail, customerPhone, customerMessage) => {
    db.run(
      "INSERT INTO quotes (product_id, customer_name, customer_email, customer_phone, customer_message) VALUES (?, ?, ?, ?, ?)",
      [productId, customerName, customerEmail, customerPhone, customerMessage]
    );
    saveDatabase();
    return db.exec("SELECT last_insert_rowid()")[0].values[0][0];
  },
  
  updateQuoteStatus: (id, status) => {
    db.run("UPDATE quotes SET status = ? WHERE id = ?", [status, id]);
    saveDatabase();
  },
  
  // Settings
  getSetting: (key) => {
    const stmt = db.prepare("SELECT value FROM settings WHERE key = ?");
    stmt.bind([key]);
    if (stmt.step()) {
      const result = stmt.get();
      stmt.free();
      return result[0];
    }
    stmt.free();
    return null;
  },
  
  setSetting: (key, value) => {
    db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, value]);
    saveDatabase();
  },
  
  getAllSettings: () => {
    const result = db.exec("SELECT * FROM settings");
    if (result.length === 0) return {};
    const settings = {};
    result[0].values.forEach(row => {
      settings[row[0]] = row[1];
    });
    return settings;
  },
  
  // Admin
  verifyAdmin: (username, password) => {
    const bcrypt = require('bcryptjs');
    const stmt = db.prepare("SELECT * FROM admin_users WHERE username = ?");
    stmt.bind([username]);
    if (stmt.step()) {
      const row = stmt.get();
      stmt.free();
      return bcrypt.compareSync(password, row[2]) ? { id: row[0], username: row[1] } : null;
    }
    stmt.free();
    return null;
  },
  
  // Dashboard stats
  getDashboardStats: () => {
    const productsCount = db.exec("SELECT COUNT(*) FROM products")[0]?.values[0][0] || 0;
    const quotesCount = db.exec("SELECT COUNT(*) FROM quotes WHERE status = 'pending'")[0]?.values[0][0] || 0;
    const categoriesCount = db.exec("SELECT COUNT(*) FROM categories")[0]?.values[0][0] || 0;
    
    return { productsCount, quotesCount, categoriesCount };
  }
};

module.exports = { initDatabase, getDb, saveDatabase, ...dbHelpers };
