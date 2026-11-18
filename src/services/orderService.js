import crypto from 'node:crypto';
import { getDatabase } from '../db/connection.js';
import { productCache } from '../cache/productCache.js';
import {
  productNotFoundError,
  alreadyPurchasedError,
  soldOutError,
} from '../utils/errors.js';

let stmts = null;
let purchaseTx = null;

function getStatements() {
  if (stmts) return stmts;
  const db = getDatabase();

  stmts = {
    getProduct: db.prepare('SELECT id, stock FROM products WHERE id = ?'),
    checkExistingOrder: db.prepare(
      'SELECT 1 FROM orders WHERE user_id = ? AND product_id = ?'
    ),
    decrementStock: db.prepare(
      'UPDATE products SET stock = stock - 1 WHERE id = ? AND stock > 0'
    ),
    incrementStock: db.prepare(
      'UPDATE products SET stock = stock + 1 WHERE id = ?'
    ),
    insertOrder: db.prepare(
      'INSERT INTO orders (order_id, user_id, product_id) VALUES (?, ?, ?)'
    ),
    getUserOrders: db.prepare(
      'SELECT order_id AS orderId, product_id AS productId FROM orders WHERE user_id = ?'
    ),
  };

  purchaseTx = db.transaction((userId, productId, orderId) => {
    // 1. Check product existence
    const product = stmts.getProduct.get(productId);
    if (!product) {
      return { error: productNotFoundError() };
    }

    // 2. Check if user already purchased
    const existing = stmts.checkExistingOrder.get(userId, productId);
    if (existing) {
      return { error: alreadyPurchasedError() };
    }

    // 3. Check stock availability
    if (product.stock <= 0) {
      return { error: soldOutError() };
    }

    // 4. Atomic conditional decrement
    const updateResult = stmts.decrementStock.run(productId);
    if (updateResult.changes === 0) {
      return { error: soldOutError() };
    }

    // 5. Insert order record
    try {
      stmts.insertOrder.run(orderId, userId, productId);
    } catch (err) {
      // Catch concurrent duplicate insertion
      if (
        err.message &&
        (err.message.includes('UNIQUE constraint failed') ||
          err.code === 'SQLITE_CONSTRAINT_UNIQUE')
      ) {
        stmts.incrementStock.run(productId);
        return { error: alreadyPurchasedError() };
      }
      throw err;
    }

    return {
      success: true,
      remainingStock: product.stock - 1,
    };
  });

  return stmts;
}

export function purchaseOrder(userId, productId) {
  getStatements();
  const orderId = 'o_' + crypto.randomBytes(6).toString('hex');

  const result = purchaseTx(userId, productId, orderId);

  if (result.error) {
    throw result.error;
  }

  // Update in-memory cache stock immediately
  productCache.updateStock(productId, result.remainingStock);

  return {
    orderId,
    userId,
    productId,
  };
}

export function getUserOrders(userId) {
  const { getUserOrders: queryStmt } = getStatements();
  const rows = queryStmt.all(userId);

  return {
    userId,
    orders: rows.map((r) => ({
      orderId: r.orderId,
      productId: r.productId,
    })),
  };
}
