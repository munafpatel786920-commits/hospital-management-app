/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { DB } from "../lib/db";
import { COUNTRIES, LANGUAGES, translate } from "../lib/i18n";
import { Hospital, UserRole, UserProfile } from "../types";
import { Plus, ToggleLeft, ToggleRight, Download, Upload, Shield, Globe, Award, Database, Building2, Users2, DollarSign, Activity } from "lucide-react";

interface SuperAdminPanelProps {
  currentLanguage: string;
  onLogAction: (action: string, details: string) => void;
}

export default function SuperAdminPanel({ currentLanguage, onLogAction }: SuperAdminPanelProps) {
  const [hospitals, setHospitals] = useState<Hospital[]>(DB.getHospitals());
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Form State
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("IN");
  const [plan, setPlan] = useState<"Basic" | "Standard" | "Premium">("Standard");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); // Add password state

  const handleToggleStatus = (id: string, currentStatus: "Active" | "Inactive") => {
    const nextStatus = currentStatus === "Active" ? "Inactive" : "Active";
    DB.updateHospital(id, { status: nextStatus });
    setHospitals(DB.getHospitals());
    onLogAction("Toggle Hospital Status", `Changed hospital ${id} status to ${nextStatus}`);
  };

  const handleDeleteHospital = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete ${name}? This action is irreversible.`)) {
      DB.deleteHospital(id);
      setHospitals(prev => prev.filter(h => h.id !== id));
      onLogAction("Delete Hospital", `Deleted hospital ${name} (${id})`);
    }
  };

  const handleAddHospital = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !phone || !password) return;

    const hospitalId = `HOSP-${Math.floor(100 + Math.random() * 900)}`;

    const country = COUNTRIES[countryCode];
    const newHospital: Hospital = {
      id: hospitalId,
      name,
      countryCode,
      currency: country.currency,
      language: "en",
      status: "Active",
      plan,
      address,
      phone,
      email,
      taxSystem: country.taxLabel,
      taxRate: country.taxRate,
      departments: ["General Medicine", "Emergency", "ICU", "Pediatrics", "Cardiology"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "Super Admin"
    };

    const adminUser: UserProfile = {
      id: `usr-${hospitalId}-admin`,
      hospitalId,
      name: "Hospital Admin",
      email,
      role: UserRole.HOSPITAL_ADMIN,
      phone,
      status: "Active",
      password,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    DB.addHospital(newHospital);
    DB.addUser(adminUser);
    setHospitals(DB.getHospitals());
    setShowAddModal(false);
    
    // Clear Form
    setName("");
    setAddress("");
    setPhone("");
    setEmail("");
    setPassword("");
    
    onLogAction("Register Hospital", `Successfully onboarded hospital ${newHospital.name} and created admin user ${adminUser.email}`);
  };

  // Unified calculations
  const totalHospitals = hospitals.length;
  const activeHospitals = hospitals.filter(h => h.status === "Active").length;
  const premiumTier = hospitals.filter(h => h.plan === "Premium").length;

  return (
    <div id="super-admin-root" className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-7 h-7 text-teal-600" />
            {translate("super_admin", currentLanguage)}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Global system cockpit: manage hospital tenants, plans, global configuration, and database integrity.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Onboard Hospital
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-teal-50 dark:bg-teal-950/40 rounded-lg text-teal-600 dark:text-teal-400">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Total Hospital Tenants</div>
            <div className="text-2xl font-bold font-mono text-slate-800 dark:text-white">{totalHospitals}</div>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-emerald-600 dark:text-emerald-400">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Active Hospitals</div>
            <div className="text-2xl font-bold font-mono text-slate-800 dark:text-white">{activeHospitals}</div>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg text-indigo-600 dark:text-indigo-400">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Premium Plan Licenses</div>
            <div className="text-2xl font-bold font-mono text-slate-800 dark:text-white">{premiumTier}</div>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-lg text-amber-600 dark:text-amber-400">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Nations Supported</div>
            <div className="text-2xl font-bold font-mono text-slate-800 dark:text-white">6</div>
          </div>
        </div>
      </div>

      {/* Hospital Listing Table */}
      <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 dark:text-white text-base">Registered Global Hospital Network</h2>
          <span className="px-2.5 py-1 text-xs font-semibold bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-400 rounded-full">
            Multi-Tenant Isolation Enforced
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700/40 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">ID</th>
                <th className="px-6 py-3.5">Hospital Name</th>
                <th className="px-6 py-3.5">Location & Country</th>
                <th className="px-6 py-3.5">Contact Detail</th>
                <th className="px-6 py-3.5">Tier Plan</th>
                <th className="px-6 py-3.5">Finance Config</th>
                <th className="px-6 py-3.5">Tenant Status</th>
                <th className="px-6 py-3.5">Toggle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {hospitals.map((hospital) => {
                const country = COUNTRIES[hospital.countryCode] || COUNTRIES.US;
                return (
                  <tr key={hospital.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/10 transition">
                    <td className="px-6 py-4 font-mono font-bold text-teal-600 dark:text-teal-400">{hospital.id}</td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900 dark:text-white">{hospital.name}</div>
                      <div className="text-xs text-slate-400 dark:text-slate-500">Registered: {new Date(hospital.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded uppercase">
                          {hospital.countryCode}
                        </span>
                        <span>{country.name}</span>
                      </div>
                      <div className="text-xs mt-0.5 max-w-xs truncate text-slate-400">{hospital.address}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      <div className="text-xs font-medium">{hospital.email}</div>
                      <div className="text-xs text-slate-400">{hospital.phone}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        hospital.plan === "Premium" ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/40" :
                        hospital.plan === "Standard" ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/40" :
                        "bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/40"
                      }`}>
                        {hospital.plan}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-600 dark:text-slate-400">
                      <div>Tax: {hospital.taxSystem} ({hospital.taxRate * 100}%)</div>
                      <div>Currency: {hospital.currency} ({country.currencySymbol})</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium inline-flex items-center gap-1 ${
                        hospital.status === "Active" 
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400" 
                          : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${hospital.status === "Active" ? "bg-emerald-500" : "bg-rose-500"}`} />
                        {hospital.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleStatus(hospital.id, hospital.status)}
                          className="text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition"
                        >
                          {hospital.status === "Active" ? (
                            <ToggleRight className="w-8 h-8 text-teal-600 cursor-pointer" />
                          ) : (
                            <ToggleLeft className="w-8 h-8 text-slate-400 cursor-pointer" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteHospital(hospital.id, hospital.name)}
                          className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition"
                        >
                          <span className="text-xs font-semibold px-2 py-1 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-600">Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Onboard Hospital Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-700/50 flex justify-between items-center">
              <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-1.5">
                <Building2 className="w-5 h-5 text-teal-600" />
                Onboard New Medical Center
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-lg">×</button>
            </div>
            
            <form onSubmit={handleAddHospital} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Hospital Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="e.g. Apollo Apollo Care"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Country *</label>
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none"
                  >
                    {Object.values(COUNTRIES).map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({c.currency})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Subscription Tier *</label>
                  <select
                    value={plan}
                    onChange={(e) => setPlan(e.target.value as any)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none"
                  >
                    <option value="Basic">Basic Tier</option>
                    <option value="Standard">Standard Tier</option>
                    <option value="Premium">Premium Tier</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Hospital Email *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none"
                    placeholder="admin@hospital.org"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none"
                  placeholder="+91 99880-XXXXX"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Physical Address</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none h-20 resize-none"
                  placeholder="Street details, State, Country"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm font-medium bg-slate-50 hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition shadow-sm"
                >
                  Onboard Hospital
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
