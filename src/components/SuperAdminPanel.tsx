/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { DB } from "../lib/db";
import { COUNTRIES, translate } from "../lib/i18n";
import { Hospital, UserRole, UserProfile } from "../types";
import { 
  Plus, ToggleLeft, ToggleRight, Shield, Globe, Award, 
  Building2, Activity, Trash2, AlertTriangle, CheckCircle2,
  Search, X, Check, Mail, Phone, MapPin, Sparkles
} from "lucide-react";

interface SuperAdminPanelProps {
  currentLanguage: string;
  onLogAction: (action: string, details: string) => void;
}

export default function SuperAdminPanel({ currentLanguage, onLogAction }: SuperAdminPanelProps) {
  const [hospitals, setHospitals] = useState<Hospital[]>(DB.getHospitals());
  const [showAddModal, setShowAddModal] = useState(false);
  const [hospitalToDelete, setHospitalToDelete] = useState<Hospital | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  
  // Form State
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("IN");
  const [plan, setPlan] = useState<"Basic" | "Standard" | "Premium">("Standard");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Keep hospital list in real-time sync with DB and cloud changes
  useEffect(() => {
    const unsub = DB.subscribe((data) => {
      setHospitals(data.hospitals);
    });
    return () => unsub();
  }, []);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleToggleStatus = (id: string, currentStatus: "Active" | "Inactive") => {
    const nextStatus = currentStatus === "Active" ? "Inactive" : "Active";
    DB.updateHospital(id, { status: nextStatus });
    setHospitals(DB.getHospitals());
    onLogAction("Toggle Hospital Status", `Changed hospital ${id} status to ${nextStatus}`);
    showToast(`Hospital status updated to ${nextStatus}`);
  };

  const handleConfirmDelete = () => {
    if (!hospitalToDelete) return;
    const targetId = hospitalToDelete.id;
    const targetName = hospitalToDelete.name;

    // Perform database deletion
    DB.deleteHospital(targetId);
    setHospitals(DB.getHospitals());
    onLogAction("Delete Hospital", `Deleted hospital ${targetName} (${targetId}) and all associated records`);
    
    // Close modal & notify
    setHospitalToDelete(null);
    showToast(`Hospital "${targetName}" (${targetId}) has been successfully deleted.`, "success");
  };

  const handleAddHospital = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !phone || !password) {
      showToast("Please fill in all required fields.", "error");
      return;
    }

    const hospitalId = `HOSP-${Math.floor(100 + Math.random() * 900)}`;
    const country = COUNTRIES[countryCode] || COUNTRIES.IN;

    const newHospital: Hospital = {
      id: hospitalId,
      name: name.trim(),
      countryCode,
      currency: country.currency,
      language: "en",
      status: "Active",
      plan,
      address: address.trim(),
      phone: phone.trim(),
      email: email.trim(),
      taxSystem: country.taxLabel,
      taxRate: country.taxRate,
      departments: ["General Medicine", "Emergency", "ICU", "Pediatrics", "Cardiology", "Pathology", "Pharmacy"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "Super Admin"
    };

    const adminUser: UserProfile = {
      id: `usr-${hospitalId.toLowerCase()}-admin`,
      hospitalId,
      name: `${name.trim()} Admin`,
      email: email.trim(),
      role: UserRole.HOSPITAL_ADMIN,
      phone: phone.trim(),
      status: "Active",
      password: password.trim(),
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
    
    onLogAction("Register Hospital", `Successfully onboarded hospital ${newHospital.name} (${newHospital.id}) and created admin user ${adminUser.email}`);
    showToast(`Hospital "${newHospital.name}" onboarded successfully!`, "success");
  };

  // Filtered hospitals based on search
  const filteredHospitals = hospitals.filter(h => 
    h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.countryCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Unified calculations
  const totalHospitals = hospitals.length;
  const activeHospitals = hospitals.filter(h => h.status === "Active").length;
  const premiumTier = hospitals.filter(h => h.plan === "Premium").length;

  return (
    <div id="super-admin-root" className="space-y-6">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 animate-in fade-in duration-150 shadow-md ${
          toastMessage.type === "success" 
            ? "bg-emerald-50 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300" 
            : "bg-rose-50 dark:bg-rose-950/80 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-300"
        }`}>
          <div className="flex items-center gap-2.5">
            {toastMessage.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span className="text-sm font-semibold">{toastMessage.text}</span>
          </div>
          <button 
            onClick={() => setToastMessage(null)}
            className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg text-xs"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Shield className="w-7 h-7 text-teal-600 dark:text-teal-400" />
            {translate("super_admin", currentLanguage)}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
            Global multi-tenant hospital network cockpit. Onboard, configure, manage, and delete hospital instances.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-xl transition shadow-md shadow-teal-600/20 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            Onboard Hospital
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center gap-4 shadow-xs">
          <div className="p-3 bg-teal-50 dark:bg-teal-950/60 rounded-xl text-teal-600 dark:text-teal-400">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Hospitals</div>
            <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">{totalHospitals}</div>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center gap-4 shadow-xs">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl text-emerald-600 dark:text-emerald-400">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Active Tenants</div>
            <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">{activeHospitals}</div>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center gap-4 shadow-xs">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl text-indigo-600 dark:text-indigo-400">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Premium Licenses</div>
            <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">{premiumTier}</div>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center gap-4 shadow-xs">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/60 rounded-xl text-amber-600 dark:text-amber-400">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Countries Active</div>
            <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
              {new Set(hospitals.map(h => h.countryCode)).size || 1}
            </div>
          </div>
        </div>
      </div>

      {/* Hospital Listing Table & Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white text-base">Registered Hospital Network</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Click Delete on any row to permanently delete that hospital and all records.</p>
          </div>

          <div className="w-full sm:w-64 relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search hospitals..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-teal-600"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Hospital ID</th>
                <th className="px-6 py-3.5">Hospital Name</th>
                <th className="px-6 py-3.5">Country & Location</th>
                <th className="px-6 py-3.5">Contact Detail</th>
                <th className="px-6 py-3.5">Plan Tier</th>
                <th className="px-6 py-3.5">Tax & Currency</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredHospitals.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-sm text-slate-400">
                    No hospitals found matching your search.
                  </td>
                </tr>
              ) : (
                filteredHospitals.map((hospital) => {
                  const country = COUNTRIES[hospital.countryCode] || COUNTRIES.IN;
                  return (
                    <tr key={hospital.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                      <td className="px-6 py-4 font-mono font-bold text-teal-600 dark:text-teal-400">{hospital.id}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 dark:text-white">{hospital.name}</div>
                        <div className="text-xs text-slate-400 dark:text-slate-500">
                          Registered: {new Date(hospital.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded uppercase border border-slate-200 dark:border-slate-700">
                            {hospital.countryCode}
                          </span>
                          <span className="font-medium">{country.name}</span>
                        </div>
                        <div className="text-xs mt-0.5 max-w-xs truncate text-slate-400">{hospital.address}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">{hospital.email}</div>
                        <div className="text-xs text-slate-400">{hospital.phone}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          hospital.plan === "Premium" ? "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800" :
                          hospital.plan === "Standard" ? "bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800" :
                          "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700"
                        }`}>
                          {hospital.plan}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-600 dark:text-slate-400">
                        <div>Tax: {hospital.taxSystem} ({Math.round(hospital.taxRate * 100)}%)</div>
                        <div>Currency: {hospital.currency} ({country.currencySymbol})</div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(hospital.id, hospital.status)}
                          className="flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                        >
                          <span className={`px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 ${
                            hospital.status === "Active" 
                              ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800" 
                              : "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${hospital.status === "Active" ? "bg-emerald-500" : "bg-rose-500"}`} />
                            {hospital.status}
                          </span>
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(hospital.id, hospital.status)}
                            className="p-1 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition"
                            title="Toggle Status"
                          >
                            {hospital.status === "Active" ? (
                              <ToggleRight className="w-7 h-7 text-teal-600" />
                            ) : (
                              <ToggleLeft className="w-7 h-7 text-slate-400" />
                            )}
                          </button>

                          {/* Delete Hospital Button */}
                          <button
                            type="button"
                            onClick={() => setHospitalToDelete(hospital)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer"
                            title="Delete this Hospital"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* IN-APP CONFIRMATION MODAL FOR DELETING HOSPITAL (Works 100% reliably in iFrames, Mobile & Desktop) */}
      {hospitalToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200 dark:border-rose-800">
                <AlertTriangle className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Delete Medical Center?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Are you sure you want to permanently delete this hospital?
                </p>
              </div>

              <div className="p-4 bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 rounded-2xl text-left space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {hospitalToDelete.name}
                  </span>
                  <span className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
                    {hospitalToDelete.id}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  ⚠️ <strong>Warning:</strong> This will permanently delete:
                  <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-500 dark:text-slate-400">
                    <li>Hospital Admin & staff user logins</li>
                    <li>All OPD/IPD clinical patient files & beds</li>
                    <li>Pharmacy medicines, lab test records & bills</li>
                  </ul>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setHospitalToDelete(null)}
                  className="w-full py-2.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="w-full py-2.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition shadow-md shadow-rose-600/30 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Yes, Delete Hospital
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Onboard Hospital Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-teal-600" />
                Onboard New Medical Center
              </h3>
              <button 
                onClick={() => setShowAddModal(false)} 
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddHospital} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Hospital Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-teal-600"
                  placeholder="e.g. Apollo Super Specialty Hospital"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Country *</label>
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-teal-600"
                  >
                    {Object.values(COUNTRIES).map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({c.currency})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Subscription Tier *</label>
                  <select
                    value={plan}
                    onChange={(e) => setPlan(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-teal-600"
                  >
                    <option value="Basic">Basic Tier</option>
                    <option value="Standard">Standard Tier</option>
                    <option value="Premium">Premium Tier</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Admin Email *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-teal-600"
                    placeholder="admin@hospital.org"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Admin Password *</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-teal-600"
                    placeholder="1234 or custom"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-teal-600"
                  placeholder="+91 99880-12345"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">Physical Address</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-teal-600 h-20 resize-none"
                  placeholder="Street details, City, State"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-xl transition shadow-md shadow-teal-600/20"
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
