"use client";

import { useState, useEffect, useCallback } from "react";
import type { AlertItem, ReminderRule } from "@/lib/types";
import Link from "next/link";

function urgencyColor(days: number) {
  if (days <= 0) return "bg-red-500/10 border-red-500/30 text-red-400";
  if (days <= 7) return "bg-red-500/10 border-red-500/30 text-red-400";
  if (days <= 14) return "bg-orange-500/10 border-orange-500/30 text-orange-400";
  if (days <= 30) return "bg-yellow-500/10 border-yellow-500/30 text-yellow-400";
  return "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
}

function urgencyBadge(days: number) {
  if (days <= 0) return { label: "Expired", cls: "bg-red-500/20 text-red-300" };
  if (days <= 7) return { label: `${days}d left`, cls: "bg-red-500/20 text-red-300" };
  if (days <= 14) return { label: `${days}d left`, cls: "bg-orange-500/20 text-orange-300" };
  if (days <= 30) return { label: `${days}d left`, cls: "bg-yellow-500/20 text-yellow-300" };
  return { label: `${days}d left`, cls: "bg-emerald-500/20 text-emerald-300" };
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function Dashboard() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [rules, setRules] = useState<ReminderRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "acknowledged">("all");
  const [selectedRule, setSelectedRule] = useState<number | "all">("all");
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [alertsRes, rulesRes] = await Promise.all([
        fetch("/api/alerts"),
        fetch("/api/reminder-rules"),
      ]);
      const alertsData = await alertsRes.json();
      const rulesData = await rulesRes.json();
      setAlerts(Array.isArray(alertsData) ? alertsData : []);
      setRules(Array.isArray(rulesData) ? rulesData : []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAcknowledge = async (alert: AlertItem) => {
    const key = `${alert.ruleId}-${alert.productExpiryId}`;
    setAcknowledging(key);
    try {
      if (alert.acknowledged) {
        await fetch("/api/alerts/acknowledge", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ruleId: alert.ruleId, productExpiryId: alert.productExpiryId }),
        });
      } else {
        await fetch("/api/alerts/acknowledge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ruleId: alert.ruleId, productExpiryId: alert.productExpiryId }),
        });
      }
      await fetchData();
    } finally {
      setAcknowledging(null);
    }
  };

  const filteredAlerts = alerts.filter((a) => {
    if (filter === "active" && a.acknowledged) return false;
    if (filter === "acknowledged" && !a.acknowledged) return false;
    if (selectedRule !== "all" && a.ruleId !== selectedRule) return false;
    return true;
  });

  const activeCount = alerts.filter((a) => !a.acknowledged).length;
  const expiredCount = alerts.filter((a) => a.daysUntilExpiry <= 0 && !a.acknowledged).length;
  const criticalCount = alerts.filter((a) => a.daysUntilExpiry > 0 && a.daysUntilExpiry <= 7 && !a.acknowledged).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">Expiry alerts based on your reminder rules</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-3xl font-bold text-white">{activeCount}</div>
          <div className="text-sm text-gray-400 mt-1">Active Alerts</div>
        </div>
        <div className="bg-gray-900 border border-red-900/40 rounded-xl p-4">
          <div className="text-3xl font-bold text-red-400">{expiredCount}</div>
          <div className="text-sm text-gray-400 mt-1">Expired Products</div>
        </div>
        <div className="bg-gray-900 border border-orange-900/40 rounded-xl p-4">
          <div className="text-3xl font-bold text-orange-400">{criticalCount}</div>
          <div className="text-sm text-gray-400 mt-1">Critical (≤7 days)</div>
        </div>
      </div>

      {rules.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
          <div className="text-gray-500 text-lg">No reminder rules set up yet</div>
          <p className="text-gray-600 mt-2 text-sm">Create reminder rules to start seeing expiry alerts here.</p>
          <Link
            href="/reminder-rules"
            className="inline-block mt-4 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Set Up Reminder Rules
          </Link>
        </div>
      ) : alerts.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
          <div className="text-gray-500 text-lg">No expiry alerts</div>
          <p className="text-gray-600 mt-2 text-sm">
            No products are expiring within your reminder rule windows.
          </p>
          <Link
            href="/products"
            className="inline-block mt-4 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Manage Products
          </Link>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex bg-gray-900 border border-gray-800 rounded-lg p-1 gap-1">
              {(["all", "active", "acknowledged"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
                    filter === f
                      ? "bg-gray-700 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <select
              value={selectedRule === "all" ? "all" : String(selectedRule)}
              onChange={(e) => setSelectedRule(e.target.value === "all" ? "all" : parseInt(e.target.value))}
              className="bg-gray-900 border border-gray-800 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Rules</option>
              {rules.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.daysBeforeExpiry}d)
                </option>
              ))}
            </select>
            <span className="text-sm text-gray-500">{filteredAlerts.length} alert{filteredAlerts.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Alert list */}
          {filteredAlerts.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">
              No alerts match this filter.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAlerts.map((alert) => {
                const key = `${alert.ruleId}-${alert.productExpiryId}`;
                const badge = urgencyBadge(alert.daysUntilExpiry);
                const cardCls = urgencyColor(alert.daysUntilExpiry);
                return (
                  <div
                    key={key}
                    className={`border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-opacity ${cardCls} ${alert.acknowledged ? "opacity-50" : ""}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-white text-sm">{alert.productName}</span>
                        <span className="text-xs font-mono bg-gray-800/60 text-gray-400 px-2 py-0.5 rounded">
                          {alert.sku}
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>
                          {badge.label}
                        </span>
                        {alert.acknowledged && (
                          <span className="text-xs bg-gray-700/60 text-gray-400 px-2 py-0.5 rounded-full">
                            Acknowledged
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-4 flex-wrap text-xs text-gray-400">
                        <span>Expires: <span className="text-gray-300">{formatDate(alert.expiryDate)}</span></span>
                        <span>Qty: <span className="text-gray-300">{alert.quantity}</span></span>
                        <span>Rule: <span className="text-gray-300">{alert.ruleName}</span></span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAcknowledge(alert)}
                      disabled={acknowledging === key}
                      className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                        alert.acknowledged
                          ? "bg-gray-700 hover:bg-gray-600 text-gray-300"
                          : "bg-gray-800 hover:bg-gray-700 text-white"
                      } disabled:opacity-50`}
                    >
                      {acknowledging === key ? "..." : alert.acknowledged ? "Unacknowledge" : "Acknowledge"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
