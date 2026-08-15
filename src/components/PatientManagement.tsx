/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { DB } from "../lib/db";
import { Patient, UserRole } from "../types";
import { translate, formatDate, formatCurrency } from "../lib/i18n";
import { Search, Plus, Printer, ShieldCheck, HeartPulse, User, Phone, Mail, Award, Calendar, AlertTriangle, QrCode } from "lucide-react";

interface PatientManagementProps {
  hospitalId: string;
  countryCode: string;
  currentLanguage: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  onLogAction: (action: string, details: string) => void;
}

export default function PatientManagement({
  hospitalId,
  countryCode,
  currentLanguage,
  userId,
  userName,
  userRole,
  onLogAction
}: PatientManagementProps) {
  const [patients, setPatients] = useState<Patient[]>(DB.getPatients(hospitalId));
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // Subscribe to DB updates for real-time patient syncing
  React.useEffect(() => {
    setPatients(DB.getPatients(hospitalId));
    const unsub = DB.subscribe(() => {
      setPatients(DB.getPatients(hospitalId));
    });
    return () => unsub();
  }, [hospitalId]);

  // Form State
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"Male" | "Female" | "Other">("Male");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [ecName, setEcName] = useState("");
  const [ecRel, setEcRel] = useState("");
  const [ecPhone, setEcPhone] = useState("");
  const [allergiesText, setAllergiesText] = useState("");
  const [historyText, setHistoryText] = useState("");
  const [insuranceProvider, setInsuranceProvider] = useState("");
  const [insurancePolicy, setInsurancePolicy] = useState("");
  const [insuranceLimit, setInsuranceLimit] = useState("");

  const handleRegisterPatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !dob || !phone) return;

    const currentYear = new Date().getFullYear();
    const sequence = Math.floor(1000 + Math.random() * 9000);
    const newId = `PAT-${currentYear}-${sequence}`;

    const newPatient: Patient = {
      id: newId,
      hospitalId,
      countryCode,
      name,
      gender,
      dob,
      phone,
      email: email || "no-email@carematrix.com",
      emergencyContact: {
        name: ecName,
        relationship: ecRel,
        phone: ecPhone
      },
      allergies: allergiesText ? allergiesText.split(",").map(s => s.trim()) : [],
      medicalHistory: historyText ? historyText.split(",").map(s => s.trim()) : [],
      insurance: {
        provider: insuranceProvider || "Self Paid",
        policyNumber: insurancePolicy || "N/A",
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        coverageLimit: Number(insuranceLimit) || 0
      },
      qrCodeData: `CareMatrix::${hospitalId}::${newId}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: userId
    };

    DB.addPatient(newPatient, userId, userName, userRole);
    setPatients(DB.getPatients(hospitalId));
    setShowAddModal(false);

    // Reset Form
    setName("");
    setDob("");
    setPhone("");
    setEmail("");
    setEcName("");
    setEcRel("");
    setEcPhone("");
    setAllergiesText("");
    setHistoryText("");
    setInsuranceProvider("");
    setInsurancePolicy("");
    setInsuranceLimit("");

    onLogAction("Patient Onboarding", `Onboarded new patient ${newPatient.name} with ID ${newPatient.id}`);
  };

  const handlePrintCard = (patient: Patient) => {
    onLogAction("Print Patient Card", `Triggered print layout for Patient ID ${patient.id}`);
    
    const hospital = DB.getHospitals().find(h => h.id === hospitalId);
    const hospitalName = hospital?.name || "St. Mary General Hospital";
    const hospitalLogo = hospital?.logoUrl || "";

    const logoHtml = hospitalLogo 
      ? `<img src="${hospitalLogo}" alt="Logo" style="height: 40px; object-fit: contain;" />` 
      : `<div style="width: 40px; height: 40px; background: #0d9488; border-radius: 8px; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px;">+</div>`;

    const printContent = `
      <div style="font-family: sans-serif; max-width: 400px; padding: 20px; border: 2px solid #0d9488; border-radius: 12px; margin: 40px auto; box-shadow: 0 4px 10px rgba(0,0,0,0.1)">
        <div style="display: flex; align-items: center; gap: 16px; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px;">
          ${logoHtml}
          <div>
            <h2 style="margin: 0; color: #0d9488; font-size: 18px;">${hospitalName}</h2>
            <p style="margin: 4px 0 0 0; font-size: 11px; color: #64748b;">Universal Clinical Identity</p>
          </div>
        </div>
        <div style="margin-top: 16px;">
          <h3 style="margin: 0 0 8px 0; color: #1e293b;">${patient.name}</h3>
          <p style="margin: 4px 0; font-size: 13px; color: #475569;"><strong>ID:</strong> <span style="font-family: monospace; font-weight: bold;">${patient.id}</span></p>
          <p style="margin: 4px 0; font-size: 13px; color: #475569;"><strong>DOB:</strong> ${formatDate(patient.dob, countryCode)} (${patient.gender})</p>
          <p style="margin: 4px 0; font-size: 13px; color: #475569;"><strong>Phone:</strong> ${patient.phone}</p>
          <p style="margin: 4px 0; font-size: 13px; color: #475569;"><strong>Insurance:</strong> ${patient.insurance.provider}</p>
        </div>
        <div style="margin-top: 16px; text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 12px;">
          <div style="display: inline-block; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div style="font-size: 10px; font-weight: bold; font-family: monospace; letter-spacing: 1px; color: #0d9488;">
              QR SECURE MATRIX
            </div>
            <div style="font-size: 9px; color: #94a3b8; margin-top: 4px;">
              ${patient.qrCodeData}
            </div>
          </div>
        </div>
      </div>
    `;

    const win = window.open("", "_blank");
    if (win) {
      win.document.write(`<html><head><title>Print Patient Card</title></head><body onload="window.print(); window.close();">${printContent}</body></html>`);
      win.document.close();
    }
  };

  const filteredPatients = patients.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.phone.includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      {/* Header and Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <HeartPulse className="w-7 h-7 text-teal-600" />
            {translate("patients", currentLanguage)}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Browse registered patients, check comprehensive clinical histories, and onboard new clinic visitors.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition shadow-sm self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          Onboard Patient
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Patients List Card */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700/60 flex flex-col sm:flex-row gap-3 justify-between items-center bg-slate-50/50 dark:bg-slate-700/20">
            <h2 className="font-semibold text-slate-800 dark:text-white">Active Patient Directory</h2>
            
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Search patient, ID, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-700/40 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                <tr>
                  <th className="px-6 py-3">Patient Code</th>
                  <th className="px-6 py-3">Demographics</th>
                  <th className="px-6 py-3">Phone & Email</th>
                  <th className="px-6 py-3">Primary Insurance</th>
                  <th className="px-6 py-3">Alerts</th>
                  <th className="px-6 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {filteredPatients.map((patient) => (
                  <tr
                    key={patient.id}
                    className={`hover:bg-slate-50/30 dark:hover:bg-slate-700/10 cursor-pointer transition ${
                      selectedPatient?.id === patient.id ? "bg-teal-50/40 dark:bg-teal-950/20" : ""
                    }`}
                    onClick={() => setSelectedPatient(patient)}
                  >
                    <td className="px-6 py-4 font-mono font-bold text-teal-600 dark:text-teal-400">{patient.id}</td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900 dark:text-white">{patient.name}</div>
                      <div className="text-xs text-slate-400">
                        {formatDate(patient.dob, countryCode)} ({patient.gender})
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      <div className="text-xs font-medium">{patient.phone}</div>
                      <div className="text-xs text-slate-400">{patient.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">{patient.insurance.provider}</div>
                      <div className="text-xs text-slate-400 font-mono">Limit: {formatCurrency(patient.insurance.coverageLimit, countryCode)}</div>
                    </td>
                    <td className="px-6 py-4">
                      {patient.allergies.length > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/50">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {patient.allergies[0]}
                          {patient.allergies.length > 1 && ` +${patient.allergies.length - 1}`}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">No allergies</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPatient(patient);
                        }}
                        className="text-teal-600 dark:text-teal-400 text-xs font-semibold hover:underline"
                      >
                        Open Chart
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredPatients.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                      No patients match current search criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Patient Chart / Visual Medical Profile */}
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
          {selectedPatient ? (
            <div>
              <div className="p-4 bg-teal-600 text-white flex justify-between items-center">
                <h3 className="font-semibold text-sm flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4" />
                  Active Clinical Chart
                </h3>
                <button
                  onClick={() => handlePrintCard(selectedPatient)}
                  className="p-1 bg-teal-500 hover:bg-teal-400 rounded transition text-white"
                  title="Print ID Card"
                >
                  <Printer className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-6">
                {/* Header Profile Section */}
                <div className="flex items-center gap-4 border-b border-slate-100 dark:border-slate-700/60 pb-5">
                  <div className="w-14 h-14 bg-teal-100 dark:bg-teal-950/40 rounded-full flex items-center justify-center text-teal-600 dark:text-teal-400">
                    <User className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-base leading-snug">{selectedPatient.name}</h4>
                    <span className="text-xs font-mono font-bold text-teal-600 dark:text-teal-400 block mt-0.5">{selectedPatient.id}</span>
                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-semibold uppercase rounded mt-1.5 inline-block">
                      {selectedPatient.gender}
                    </span>
                  </div>
                </div>

                {/* Details list */}
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>Born: {formatDate(selectedPatient.dob, countryCode)}</span>
                  </div>

                  <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span>Phone: {selectedPatient.phone}</span>
                  </div>

                  <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span className="truncate">Email: {selectedPatient.email}</span>
                  </div>

                  <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300">
                    <Award className="w-4 h-4 text-teal-600" />
                    <span>Ins: {selectedPatient.insurance.provider}</span>
                  </div>
                </div>

                {/* Allergies / Medical History Block */}
                <div className="space-y-3.5 bg-slate-50 dark:bg-slate-900/40 p-3.5 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Allergies</div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {selectedPatient.allergies.length > 0 ? (
                        selectedPatient.allergies.map((all, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-semibold rounded border border-rose-100">
                            {all}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400 italic">No recorded allergies</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Medical Pre-conditions</div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {selectedPatient.medicalHistory.length > 0 ? (
                        selectedPatient.medicalHistory.map((h, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded">
                            {h}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400 italic">No medical history logged</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Emergency Contact */}
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Emergency Contact</div>
                  <div className="border border-slate-100 dark:border-slate-700/60 p-3 rounded-lg text-xs space-y-1 bg-white dark:bg-slate-800/50">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedPatient.emergencyContact.name} ({selectedPatient.emergencyContact.relationship})
                    </div>
                    <div className="text-slate-500 font-mono">{selectedPatient.emergencyContact.phone}</div>
                  </div>
                </div>

                {/* Interactive Visual QR code card representation */}
                <div className="border border-slate-100 dark:border-slate-700/60 p-3 rounded-lg flex items-center justify-between bg-slate-50 dark:bg-slate-900/30">
                  <div>
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <QrCode className="w-4 h-4 text-teal-600" />
                      Scan Medical QR
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">Scannable within triage terminals</p>
                  </div>
                  <div className="p-1 bg-white dark:bg-slate-800 border border-slate-200 rounded">
                    <QrCode className="w-10 h-10 text-slate-800 dark:text-white" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center h-80">
              <User className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-sm font-medium">Select a patient from the directory</p>
              <p className="text-xs text-slate-400 mt-1">Select any patient record to display their secure clinical chart, insurance policy data, and print hospital cards.</p>
            </div>
          )}
        </div>
      </div>

      {/* Onboard Patient Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 w-full max-w-xl shadow-xl overflow-hidden animate-in fade-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-700/50 flex justify-between items-center">
              <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-1.5">
                <HeartPulse className="w-5 h-5 text-teal-600" />
                Register New Patient
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-lg">×</button>
            </div>

            <form onSubmit={handleRegisterPatient} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Demographics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none"
                    placeholder="e.g. John Doe"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Date of Birth *</label>
                  <input
                    type="date"
                    required
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Gender *</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none"
                    placeholder="+91 9988X-XXXXX"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none"
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="border-t border-slate-100 dark:border-slate-700/60 pt-4">
                <h4 className="font-semibold text-sm text-slate-800 dark:text-white mb-3">Emergency Contact Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Contact Name</label>
                    <input
                      type="text"
                      value={ecName}
                      onChange={(e) => setEcName(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none"
                      placeholder="Jane Doe"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Relationship</label>
                    <input
                      type="text"
                      value={ecRel}
                      onChange={(e) => setEcRel(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none"
                      placeholder="e.g. Spouse, Father"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Contact Phone</label>
                    <input
                      type="text"
                      value={ecPhone}
                      onChange={(e) => setEcPhone(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none"
                      placeholder="Emergency phone"
                    />
                  </div>
                </div>
              </div>

              {/* Allergies and History */}
              <div className="border-t border-slate-100 dark:border-slate-700/60 pt-4">
                <h4 className="font-semibold text-sm text-slate-800 dark:text-white mb-3">Medical History Alerts</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Known Allergies</label>
                    <input
                      type="text"
                      value={allergiesText}
                      onChange={(e) => setAllergiesText(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none"
                      placeholder="e.g. Penicillin, Peanuts (comma separated)"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Chronic Pre-conditions</label>
                    <input
                      type="text"
                      value={historyText}
                      onChange={(e) => setHistoryText(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none"
                      placeholder="e.g. Asthma, Hypertension (comma separated)"
                    />
                  </div>
                </div>
              </div>

              {/* Insurance Info */}
              <div className="border-t border-slate-100 dark:border-slate-700/60 pt-4">
                <h4 className="font-semibold text-sm text-slate-800 dark:text-white mb-3">Health Insurance Policy</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Insurance Provider</label>
                    <input
                      type="text"
                      value={insuranceProvider}
                      onChange={(e) => setInsuranceProvider(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none"
                      placeholder="e.g. Star Health Insurance"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Policy Number</label>
                    <input
                      type="text"
                      value={insurancePolicy}
                      onChange={(e) => setInsurancePolicy(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none"
                      placeholder="POL-88776655"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Coverage Limit (Numeric)</label>
                    <input
                      type="number"
                      value={insuranceLimit}
                      onChange={(e) => setInsuranceLimit(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none"
                      placeholder="e.g. 500000"
                    />
                  </div>
                </div>
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
                  Complete Registration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
