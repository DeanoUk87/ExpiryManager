"use client";

import { useState, useEffect, useCallback } from "react";
import type { Product, ProductExpiry } from "@/lib/types";

type ProductWithExpiries = Product & { expiries: ProductExpiry[] };

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function daysUntil(dateStr: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(dateStr + "T00:00:00");
  return Math.round((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function expiryStatusColor(days: number) {
  if (days <= 0) return "text-red-400";
  if (days <= 7) return "text-red-400";
  if (days <= 14) return "text-orange-400";
  if (days <= 30) return "text-yellow-400";
  return "text-emerald-400";
}

export default function ProductsManager() {
  const [products, setProducts] = useState<ProductWithExpiries[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Product form
  const [showProductForm, setShowProductForm] = useState(false);
  const [productForm, setProductForm] = useState({ sku: "", name: "", shopifyProductId: "", shopifyVariantId: "" });
  const [productFormError, setProductFormError] = useState("");
  const [savingProduct, setSavingProduct] = useState(false);

  // Expiry form
  const [expiryModalProduct, setExpiryModalProduct] = useState<ProductWithExpiries | null>(null);
  const [expiryForm, setExpiryForm] = useState({ expiryDate: "", quantity: "", notes: "" });
  const [editingExpiry, setEditingExpiry] = useState<ProductExpiry | null>(null);
  const [expiryFormError, setExpiryFormError] = useState("");
  const [savingExpiry, setSavingExpiry] = useState(false);

  // Delete confirm
  const [deletingProductId, setDeletingProductId] = useState<number | null>(null);
  const [deletingExpiryId, setDeletingExpiryId] = useState<number | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/products");
      const data: Product[] = await res.json();
      const withExpiries = await Promise.all(
        data.map(async (p) => {
          const eRes = await fetch(`/api/products/${p.id}/expiry`);
          const expiries: ProductExpiry[] = await eRes.json();
          return { ...p, expiries };
        })
      );
      setProducts(withExpiries);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleAddProduct = async () => {
    setProductFormError("");
    if (!productForm.sku.trim() || !productForm.name.trim()) {
      setProductFormError("SKU and product name are required.");
      return;
    }
    setSavingProduct(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productForm),
      });
      if (!res.ok) {
        const e = await res.json();
        setProductFormError(e.error || "Failed to save product.");
        return;
      }
      setShowProductForm(false);
      setProductForm({ sku: "", name: "", shopifyProductId: "", shopifyVariantId: "" });
      await fetchProducts();
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (id: number) => {
    setDeletingProductId(id);
    try {
      await fetch(`/api/products/${id}`, { method: "DELETE" });
      await fetchProducts();
    } finally {
      setDeletingProductId(null);
    }
  };

  const openExpiryModal = (product: ProductWithExpiries) => {
    setExpiryModalProduct(product);
    setEditingExpiry(null);
    setExpiryForm({ expiryDate: "", quantity: "", notes: "" });
    setExpiryFormError("");
  };

  const handleEditExpiry = (expiry: ProductExpiry) => {
    setEditingExpiry(expiry);
    setExpiryForm({ expiryDate: expiry.expiryDate, quantity: String(expiry.quantity), notes: expiry.notes || "" });
    setExpiryFormError("");
  };

  const handleSaveExpiry = async () => {
    if (!expiryModalProduct) return;
    setExpiryFormError("");
    if (!expiryForm.expiryDate || !expiryForm.quantity) {
      setExpiryFormError("Expiry date and quantity are required.");
      return;
    }
    if (parseInt(expiryForm.quantity) < 0) {
      setExpiryFormError("Quantity must be 0 or more.");
      return;
    }
    setSavingExpiry(true);
    try {
      let res: Response;
      if (editingExpiry) {
        res = await fetch(`/api/expiry/${editingExpiry.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(expiryForm),
        });
      } else {
        res = await fetch(`/api/products/${expiryModalProduct.id}/expiry`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(expiryForm),
        });
      }
      if (!res.ok) {
        const e = await res.json();
        setExpiryFormError(e.error || "Failed to save expiry.");
        return;
      }
      setEditingExpiry(null);
      setExpiryForm({ expiryDate: "", quantity: "", notes: "" });
      // Refresh expiries for this product
      const eRes = await fetch(`/api/products/${expiryModalProduct.id}/expiry`);
      const expiries: ProductExpiry[] = await eRes.json();
      setExpiryModalProduct({ ...expiryModalProduct, expiries });
      setProducts((prev) =>
        prev.map((p) => (p.id === expiryModalProduct.id ? { ...p, expiries } : p))
      );
    } finally {
      setSavingExpiry(false);
    }
  };

  const handleDeleteExpiry = async (expiryId: number) => {
    if (!expiryModalProduct) return;
    setDeletingExpiryId(expiryId);
    try {
      await fetch(`/api/expiry/${expiryId}`, { method: "DELETE" });
      const eRes = await fetch(`/api/products/${expiryModalProduct.id}/expiry`);
      const expiries: ProductExpiry[] = await eRes.json();
      setExpiryModalProduct({ ...expiryModalProduct, expiries });
      setProducts((prev) =>
        prev.map((p) => (p.id === expiryModalProduct.id ? { ...p, expiries } : p))
      );
    } finally {
      setDeletingExpiryId(null);
    }
  };

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Products</h1>
          <p className="text-gray-400 mt-1">Manage product expiry dates and quantities</p>
        </div>
        <button
          onClick={() => { setShowProductForm(true); setProductFormError(""); }}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + Add Product
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by name or SKU..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-gray-900 border border-gray-800 text-gray-100 rounded-lg px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />

      {/* Add Product Form */}
      {showProductForm && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-4">
          <h2 className="text-white font-semibold">Add New Product</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">SKU *</label>
              <input
                type="text"
                value={productForm.sku}
                onChange={(e) => setProductForm((f) => ({ ...f, sku: e.target.value }))}
                placeholder="e.g. PROD-001"
                className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Product Name *</label>
              <input
                type="text"
                value={productForm.name}
                onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Vitamin C Serum"
                className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Shopify Product ID</label>
              <input
                type="text"
                value={productForm.shopifyProductId}
                onChange={(e) => setProductForm((f) => ({ ...f, shopifyProductId: e.target.value }))}
                placeholder="Optional"
                className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Shopify Variant ID</label>
              <input
                type="text"
                value={productForm.shopifyVariantId}
                onChange={(e) => setProductForm((f) => ({ ...f, shopifyVariantId: e.target.value }))}
                placeholder="Optional"
                className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          {productFormError && <p className="text-red-400 text-sm">{productFormError}</p>}
          <div className="flex gap-3">
            <button
              onClick={handleAddProduct}
              disabled={savingProduct}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {savingProduct ? "Saving..." : "Save Product"}
            </button>
            <button
              onClick={() => setShowProductForm(false)}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Products list */}
      {loading ? (
        <div className="flex items-center justify-center min-h-48">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
          <div className="text-gray-500 text-lg">{search ? "No products match your search" : "No products yet"}</div>
          {!search && (
            <p className="text-gray-600 mt-2 text-sm">Add products to start tracking expiry dates.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((product) => (
            <div key={product.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white">{product.name}</span>
                    <span className="text-xs font-mono bg-gray-800 text-gray-400 px-2 py-0.5 rounded">
                      {product.sku}
                    </span>
                    {product.shopifyProductId && (
                      <span className="text-xs text-gray-500">Shopify: {product.shopifyProductId}</span>
                    )}
                  </div>
                  {/* Expiry summary */}
                  {product.expiries.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {product.expiries.map((e) => {
                        const days = daysUntil(e.expiryDate);
                        return (
                          <span
                            key={e.id}
                            className={`text-xs px-2 py-1 rounded-lg bg-gray-800 ${expiryStatusColor(days)}`}
                          >
                            {formatDate(e.expiryDate)} · qty {e.quantity}
                            {days <= 0 ? " · Expired" : days <= 30 ? ` · ${days}d` : ""}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-gray-500">No expiry dates set</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openExpiryModal(product)}
                    className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-lg transition-colors"
                  >
                    Manage Expiry
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(product.id)}
                    disabled={deletingProductId === product.id}
                    className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {deletingProductId === product.id ? "..." : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Expiry Modal */}
      {expiryModalProduct && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-white font-semibold">{expiryModalProduct.name}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{expiryModalProduct.sku} · Manage expiry batches</p>
              </div>
              <button
                onClick={() => setExpiryModalProduct(null)}
                className="text-gray-400 hover:text-white text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-5 space-y-5">
              {/* Add / Edit expiry form */}
              <div className="bg-gray-800/60 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-medium text-gray-200">
                  {editingExpiry ? "Edit Expiry Batch" : "Add Expiry Batch"}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Expiry Date *</label>
                    <input
                      type="date"
                      value={expiryForm.expiryDate}
                      onChange={(e) => setExpiryForm((f) => ({ ...f, expiryDate: e.target.value }))}
                      className="w-full bg-gray-700 border border-gray-600 text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Quantity *</label>
                    <input
                      type="number"
                      min="0"
                      value={expiryForm.quantity}
                      onChange={(e) => setExpiryForm((f) => ({ ...f, quantity: e.target.value }))}
                      placeholder="0"
                      className="w-full bg-gray-700 border border-gray-600 text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Notes</label>
                  <input
                    type="text"
                    value={expiryForm.notes}
                    onChange={(e) => setExpiryForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Optional batch note..."
                    className="w-full bg-gray-700 border border-gray-600 text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                {expiryFormError && <p className="text-red-400 text-sm">{expiryFormError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveExpiry}
                    disabled={savingExpiry}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {savingExpiry ? "Saving..." : editingExpiry ? "Update" : "Add Batch"}
                  </button>
                  {editingExpiry && (
                    <button
                      onClick={() => { setEditingExpiry(null); setExpiryForm({ expiryDate: "", quantity: "", notes: "" }); }}
                      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {/* Existing batches */}
              {expiryModalProduct.expiries.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No expiry batches yet.</p>
              ) : (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-400">Existing Batches</h3>
                  {expiryModalProduct.expiries.map((e) => {
                    const days = daysUntil(e.expiryDate);
                    return (
                      <div key={e.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2.5 gap-3">
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium ${expiryStatusColor(days)}`}>
                            {formatDate(e.expiryDate)}
                            <span className="ml-2 text-xs opacity-70">
                              {days <= 0 ? "Expired" : `${days}d left`}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400">
                            Qty: {e.quantity}{e.notes ? ` · ${e.notes}` : ""}
                          </div>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() => handleEditExpiry(e)}
                            className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteExpiry(e.id)}
                            disabled={deletingExpiryId === e.id}
                            className="text-xs px-2 py-1 bg-red-900/40 hover:bg-red-900/60 text-red-400 rounded transition-colors disabled:opacity-50"
                          >
                            {deletingExpiryId === e.id ? "..." : "Del"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
