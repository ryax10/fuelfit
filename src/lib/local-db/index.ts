"use client";
import { useState, useEffect, useCallback } from "react";
export type { Product, Customer, Order, OrderItem, CartItem, InventoryMovement, CashMovement, LocalDB } from "./types";
export { getDB, updateDB } from "./store";
export {
  getProducts, getVisibleProducts, getProductById, getProductBySlug, createProduct, updateProduct, toggleProductVisibility,
  getCart, addToCart, updateCartQty, removeFromCart, clearCart, getCartTotal, getCartCount,
  getCartMay, addToCartMay, updateCartMayQty, removeFromCartMay, clearCartMay, getCartMayItemPrices, getCartMayTotal, getCartMayCount,
  getOrders, getOrderById, getOrderItems, getOrdersByCustomerPhone, createOrder, confirmOrder, cancelOrder,
  getCustomers, getCustomerById, getCustomerByPhone, getPendingWholesalers, getDuplicateWarnings,
  registerWholesaler, approveWholesaler, rejectWholesaler, resolveDuplicate,
  logoutMayorista,
  getCashMovements, getCashBalance, getCashBalanceByCaja, addCashMovement,
  getInventoryMovements, getDashboardMetrics,
  buildOrderWhatsApp, buildOrderWhatsAppURL, copyOrderText,
} from "./services";

export function useDB<T>(getter: () => T): T {
  const [data, setData] = useState<T>(getter);
  useEffect(() => {
    const handler = () => setData(getter());
    window.addEventListener("fullvip-db-change", handler);
    window.addEventListener("storage", handler);
    return () => { window.removeEventListener("fullvip-db-change", handler); window.removeEventListener("storage", handler); };
  }, [getter]);
  return data;
}
