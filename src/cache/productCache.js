import { config } from '../config/env.js';

class ProductCache {
  constructor() {
    this.cache = new Map();
    this.categoryTotals = new Map();
  }

  get(id) {
    const item = this.cache.get(id);
    if (!item) return null;

    // Check if stock is still fresh within the 2-second rule
    const now = Date.now();
    if (now - item.cachedAt > config.stockCacheTtlMs) {
      return null; // Expired stock, force DB refresh
    }

    return {
      id: item.id,
      name: item.name,
      category: item.category,
      price: item.price,
      stock: item.stock,
    };
  }

  set(product) {
    this.cache.set(product.id, {
      id: product.id,
      name: product.name,
      category: product.category,
      price: product.price,
      stock: product.stock,
      cachedAt: Date.now(),
    });
  }

  updateStock(id, newStock) {
    const item = this.cache.get(id);
    if (item) {
      item.stock = newStock;
      item.cachedAt = Date.now();
    }
  }

  delete(id) {
    this.cache.delete(id);
  }

  clear() {
    this.cache.clear();
    this.categoryTotals.clear();
  }
}

export const productCache = new ProductCache();
