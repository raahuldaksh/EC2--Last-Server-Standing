import { getDatabase } from '../db/connection.js';
import { productCache } from '../cache/productCache.js';
import { productNotFoundError, productExistsError } from '../utils/errors.js';

let stmts = null;

function getStatements() {
  if (stmts) return stmts;
  const db = getDatabase();
  stmts = {
    insertProduct: db.prepare(
      'INSERT INTO products (id, name, category, price, stock) VALUES (?, ?, ?, ?, ?)'
    ),
    getProductById: db.prepare(
      'SELECT id, name, category, price, stock FROM products WHERE id = ?'
    ),
    countCategory: db.prepare(
      'SELECT COUNT(*) AS total FROM products WHERE category = ?'
    ),
    listCategory: db.prepare(
      'SELECT id, name, category, price, stock FROM products WHERE category = ? ORDER BY price ASC, id ASC LIMIT ? OFFSET ?'
    ),
  };
  return stmts;
}

export function createProduct({ id, name, category, price, stock }) {
  const { insertProduct } = getStatements();

  try {
    insertProduct.run(id, name, category, price, stock);
  } catch (err) {
    if (err.message && (err.message.includes('UNIQUE constraint failed') || err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY')) {
      throw productExistsError();
    }
    throw err;
  }

  const created = { id, name, category, price, stock };
  productCache.set(created);
  return created;
}

export function getProductById(id) {
  // Check fast in-memory cache first
  const cached = productCache.get(id);
  if (cached) {
    return cached;
  }

  const { getProductById: queryStmt } = getStatements();
  const row = queryStmt.get(id);

  if (!row) {
    throw productNotFoundError();
  }

  const product = {
    id: row.id,
    name: row.name,
    category: row.category,
    price: row.price,
    stock: row.stock,
  };

  return productCache.set(product);
}

export function listProductsByCategory({ category, page = 1, limit = 20 }) {
  const { countCategory, listCategory } = getStatements();

  const totalRow = countCategory.get(category);
  const total = totalRow ? totalRow.total : 0;

  if (total === 0) {
    return {
      items: [],
      page,
      limit,
      total: 0,
    };
  }

  const offset = (page - 1) * limit;

  if (offset >= total) {
    return {
      items: [],
      page,
      limit,
      total,
    };
  }

  const rows = listCategory.all(category, limit, offset);
  const items = rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    price: r.price,
    stock: r.stock,
  }));

  return {
    items,
    page,
    limit,
    total,
  };
}
