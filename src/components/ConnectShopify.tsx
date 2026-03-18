"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ConnectContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [status, setStatus] = useState<"loading" | "connected" | "disconnected">("loading");
  const [shop, setShop] = useState("");
  const [installUrl, setInstallUrl] = useState("");

  useEffect(() => {
    fetch("/api/shopify/status")
      .then((r) => r.json())
      .then((d) => {
        setStatus(d.connected ? "connected" : "disconnected");
        setShop(d.shop ?? "");
        setInstallUrl(d.installUrl ?? "");
      })
      .catch(() => setStatus("disconnected"));
  }, []);

  return (
    <div className="max-w-lg mx-auto pt-10 space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white">Connect to Shopify</h1>
        <p className="text-gray-400 mt-2 text-sm">
          Authorise this app to sync products from <span className="text-gray-300">{shop}</span>
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {status === "loading" && (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {status === "connected" && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 text-center space-y-3">
          <div className="text-emerald-400 font-semibold">Connected</div>
          <p className="text-gray-400 text-sm">
            This app is authorised to access <span className="text-white">{shop}</span>.
            You can sync products from the Products page.
          </p>
          <a
            href="/products"
            className="inline-block px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Go to Products
          </a>
        </div>
      )}

      {status === "disconnected" && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 space-y-4">
          <div className="space-y-2 text-sm text-gray-400">
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs shrink-0">1</span>
              <span>Click the button below to connect to your Shopify store</span>
            </div>
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs shrink-0">2</span>
              <span>Approve the permissions in Shopify</span>
            </div>
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs shrink-0">3</span>
              <span>Come back and sync your products — done</span>
            </div>
          </div>
          <a
            href={installUrl}
            className="block text-center px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors"
          >
            Connect Shopify Store
          </a>
        </div>
      )}
    </div>
  );
}

export default function ConnectShopify() {
  return (
    <Suspense>
      <ConnectContent />
    </Suspense>
  );
}
