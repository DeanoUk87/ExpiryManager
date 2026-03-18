"use client";

import { useState, useEffect, useCallback } from "react";
import type { ReminderRule } from "@/lib/types";

const PRESET_DAYS = [7, 14, 30, 60, 90];

export default function ReminderRulesManager() {
  const [rules, setRules] = useState<ReminderRule[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<ReminderRule | null>(null);
  const [form, setForm] = useState({
    name: "",
    daysBeforeExpiry: "",
    isActive: true,
    emailEnabled: false,
    emailAddress: "",
  });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reminder-rules");
      const data = await res.json();
      setRules(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const openNewForm = () => {
    setEditingRule(null);
    setForm({ name: "", daysBeforeExpiry: "", isActive: true, emailEnabled: false, emailAddress: "" });
    setFormError("");
    setShowForm(true);
  };

  const openEditForm = (rule: ReminderRule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      daysBeforeExpiry: String(rule.daysBeforeExpiry),
      isActive: rule.isActive,
      emailEnabled: rule.emailEnabled,
      emailAddress: rule.emailAddress || "",
    });
    setFormError("");
    setShowForm(true);
  };

  const handleSave = async () => {
    setFormError("");
    if (!form.name.trim()) { setFormError("Rule name is required."); return; }
    if (!form.daysBeforeExpiry || parseInt(form.daysBeforeExpiry) <= 0) {
      setFormError("Days before expiry must be a positive number."); return;
    }
    if (form.emailEnabled && !form.emailAddress.trim()) {
      setFormError("Email address is required when email notifications are enabled."); return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        daysBeforeExpiry: parseInt(form.daysBeforeExpiry),
        isActive: form.isActive,
        emailEnabled: form.emailEnabled,
        emailAddress: form.emailAddress.trim() || null,
      };
      let res: Response;
      if (editingRule) {
        res = await fetch(`/api/reminder-rules/${editingRule.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/reminder-rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      if (!res.ok) {
        const e = await res.json();
        setFormError(e.error || "Failed to save rule.");
        return;
      }
      setShowForm(false);
      setEditingRule(null);
      await fetchRules();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await fetch(`/api/reminder-rules/${id}`, { method: "DELETE" });
      await fetchRules();
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggle = async (rule: ReminderRule) => {
    setTogglingId(rule.id);
    try {
      await fetch(`/api/reminder-rules/${rule.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...rule, isActive: !rule.isActive }),
      });
      await fetchRules();
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Reminder Rules</h1>
          <p className="text-gray-400 mt-1">Set up rules to alert you before products expire</p>
        </div>
        <button
          onClick={openNewForm}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + Add Rule
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-4">
          <h2 className="text-white font-semibold">{editingRule ? "Edit Rule" : "New Reminder Rule"}</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Rule Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. 30 Day Warning"
                className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Days Before Expiry *</label>
              <input
                type="number"
                min="1"
                value={form.daysBeforeExpiry}
                onChange={(e) => setForm((f) => ({ ...f, daysBeforeExpiry: e.target.value }))}
                placeholder="e.g. 30"
                className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {/* Quick presets */}
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {PRESET_DAYS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, daysBeforeExpiry: String(d), name: f.name || `${d} Day Warning` }))}
                    className="text-xs px-2 py-0.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Email section (coming soon) */}
          <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-300">Email Notifications</div>
                <div className="text-xs text-gray-500">Receive email alerts (coming soon)</div>
              </div>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, emailEnabled: !f.emailEnabled }))}
                className={`relative w-10 h-5 rounded-full transition-colors ${form.emailEnabled ? "bg-emerald-600" : "bg-gray-700"}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${form.emailEnabled ? "translate-x-5" : ""}`}
                />
              </button>
            </div>
            {form.emailEnabled && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Email Address *</label>
                <input
                  type="email"
                  value={form.emailAddress}
                  onChange={(e) => setForm((f) => ({ ...f, emailAddress: e.target.value }))}
                  placeholder="alerts@yourstore.com"
                  className="w-full bg-gray-700 border border-gray-600 text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="w-4 h-4 accent-emerald-500"
              />
              <span className="text-sm text-gray-300">Active</span>
            </label>
          </div>

          {formError && <p className="text-red-400 text-sm">{formError}</p>}

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? "Saving..." : editingRule ? "Update Rule" : "Create Rule"}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditingRule(null); }}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Rules list */}
      {loading ? (
        <div className="flex items-center justify-center min-h-48">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rules.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
          <div className="text-gray-500 text-lg">No reminder rules yet</div>
          <p className="text-gray-600 mt-2 text-sm">
            Add a rule like &quot;7 days before expiry&quot; to start receiving dashboard alerts.
          </p>
          <div className="flex flex-wrap gap-2 justify-center mt-4">
            {PRESET_DAYS.map((d) => (
              <button
                key={d}
                onClick={() => {
                  setForm({ name: `${d} Day Warning`, daysBeforeExpiry: String(d), isActive: true, emailEnabled: false, emailAddress: "" });
                  setShowForm(true);
                  setFormError("");
                  setEditingRule(null);
                }}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
              >
                {d} days
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`bg-gray-900 border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-opacity ${rule.isActive ? "border-gray-800" : "border-gray-800 opacity-50"}`}
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                {/* Toggle */}
                <button
                  onClick={() => handleToggle(rule)}
                  disabled={togglingId === rule.id}
                  className={`relative shrink-0 w-10 h-5 rounded-full transition-colors ${rule.isActive ? "bg-emerald-600" : "bg-gray-700"} disabled:opacity-50`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${rule.isActive ? "translate-x-5" : ""}`}
                  />
                </button>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-white">{rule.name}</span>
                    <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      {rule.daysBeforeExpiry} days before expiry
                    </span>
                    {!rule.isActive && (
                      <span className="text-xs bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>
                    )}
                    {rule.emailEnabled && rule.emailAddress && (
                      <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
                        Email: {rule.emailAddress}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Products expiring within {rule.daysBeforeExpiry} days will appear on the dashboard
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => openEditForm(rule)}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-lg transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(rule.id)}
                  disabled={deletingId === rule.id}
                  className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {deletingId === rule.id ? "..." : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info box */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 text-sm text-blue-300">
        <strong className="text-blue-200">How it works:</strong> Each active rule defines a time window. Products
        with expiry dates falling within that window will appear as alerts on your Dashboard. You can have
        multiple overlapping rules — e.g. a 30-day warning and a 7-day critical alert.
      </div>
    </div>
  );
}
