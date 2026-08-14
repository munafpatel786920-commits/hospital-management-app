/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { DB } from "../lib/db";
import { UserRole, AuditLog } from "../types";
import { translate, formatDate, formatCurrency } from "../lib/i18n";
import { motion, AnimatePresence } from "motion/react";
import { 
  Users, Calendar, Activity, UserPlus, HeartPulse, 
  Bed, DollarSign, Clock, AlertTriangle, ShieldAlert, ArrowRight,
  Search, Stethoscope, Briefcase, ChevronRight, CheckCircle,
  Database, TrendingUp, Sparkles, Filter, RefreshCw
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface DashboardHomeProps {
  hospitalId: string;
  countryCode: string;
  currentLanguage: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  onNavigate: (tab: string) => void;
}

export default function DashboardHome({
  hospitalId,
  countryCode,
  currentLanguage,
  userId,
  userName,
  userRole,
  onNavigate
}: DashboardHomeProps) {
  // Read real-time states from DB
  const patients = DB.getPatients(hospitalId);
  const appointments = DB.getAppointments(hospitalId);
  const doctors = DB.getDoctors(hospitalId);
  const staff = DB.getStaff(hospitalId);
  const beds = DB.getBeds(hospitalId);
  const medicines = DB.getMedicines(hospitalId);
  const invoices = DB.getBillingInvoices(hospitalId);
  const ipdRecords = DB.getIPD(hospitalId);
  const allAuditLogs = DB.getAuditLogs(hospitalId);
  const employees = DB.getHRRecord(hospitalId);

  // States for search and filter
  const [logFilter, setLogFilter] = useState<"ALL" | "CLINIC" | "BILLING" | "HR">("ALL");
  const [logSearch, setLogSearch] = useState("");
  const [liveTime, setLiveTime] = useState(new Date());
  const [activeChartTab, setActiveChartTab] = useState<"clinical" | "financial" | "occupancy">("clinical");

  // Clock tick effect
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Helper to get local date string YYYY-MM-DD
  const getLocalDateStr = (date: Date = new Date()): string => {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split("T")[0];
  };

  // Filter calculations
  const totalPatients = patients.length;
  const activeAdmissions = ipdRecords.filter(r => r.status === "Admitted").length;
  const todayDateStr = getLocalDateStr();
  const todayApts = appointments.filter(a => a.date === todayDateStr && a.status === "Scheduled");
  
  const grossRevenue = invoices.filter(i => i.status === "Paid").reduce((acc, i) => acc + i.total, 0);
  const totalSalariesPaid = employees.reduce((acc, emp) => acc + emp.payrollHistory.filter(ph => ph.status === "Paid").reduce((sum, p) => sum + Number(p.netPay), 0), 0);
  const netRevenue = grossRevenue - totalSalariesPaid;
  
  const availableBeds = beds.filter(b => b.status === "Available").length;
  const totalBedsCount = beds.length;
  const bedOccupancyRate = totalBedsCount > 0 ? Math.round((beds.filter(b => b.status === "Occupied").length / totalBedsCount) * 100) : 0;

  const lowStockMeds = medicines.filter(m => m.stock < m.minStockAlert);

  // Ward calculations
  const wardTypes = ["General Ward", "Semi-Private", "Private Suite", "ICU"] as const;
  const wardStats = wardTypes.map(type => {
    const wardBeds = beds.filter(b => b.type === type);
    const occupied = wardBeds.filter(b => b.status === "Occupied").length;
    const total = wardBeds.length;
    const percentage = total > 0 ? Math.round((occupied / total) * 100) : 0;
    return { type, occupied, total, percentage };
  });

  // Helper function to generate a stable, deterministic value based on a date and seed
  const getDeterministicValue = (dateStr: string, seed: number, min: number, max: number): number => {
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
      hash = dateStr.charCodeAt(i) + ((hash << 5) - hash);
    }
    const rng = Math.abs(Math.sin(hash + seed));
    return Math.floor(rng * (max - min + 1)) + min;
  };

  // Generate last 7 days of dynamic data for analytics
  const analyticsData = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = getLocalDateStr(d);
    const label = d.toLocaleDateString([], { weekday: 'short', day: 'numeric' });

    // Appointments on this day
    const aptCount = appointments.filter(a => a.date === dateStr).length;

    // Admissions on this day
    const admissionCount = ipdRecords.filter(r => r.admissionDate === dateStr).length;

    // Revenue on this day
    const dayRevenue = invoices
      .filter(inv => inv.status === "Paid" && inv.createdAt.startsWith(dateStr))
      .reduce((acc, inv) => acc + inv.total, 0);

    // Expenses on this day (seeded and matched with hospital HR and expense DB if available)
    const systemExpenses = DB.getExpenses ? DB.getExpenses(hospitalId) : [];
    const dayExpense = systemExpenses
      .filter(exp => exp.date === dateStr)
      .reduce((acc, exp) => acc + exp.amount, 0);

    // Deterministic baselines for historical occupancy only
    const baseOccupancy = getDeterministicValue(dateStr, 55, 45, 85);
    const isToday = dateStr === todayDateStr;

    return {
      name: label,
      Consultations: aptCount,
      Admissions: admissionCount,
      Revenue: dayRevenue,
      Expenses: dayExpense,
      Occupancy: isToday ? bedOccupancyRate : baseOccupancy
    };
  });

  // Filtered and searched audit logs
  const filteredLogs = allAuditLogs
    .filter(log => {
      if (logFilter === "ALL") return true;
      if (logFilter === "CLINIC") {
        return log.action.toLowerCase().includes("patient") || log.action.toLowerCase().includes("appointment") || log.action.toLowerCase().includes("bed") || log.action.toLowerCase().includes("clinical");
      }
      if (logFilter === "BILLING") {
        return log.action.toLowerCase().includes("billing") || log.action.toLowerCase().includes("invoice") || log.action.toLowerCase().includes("purchase") || log.action.toLowerCase().includes("medicine");
      }
      if (logFilter === "HR") {
        return log.action.toLowerCase().includes("staff") || log.action.toLowerCase().includes("payroll") || log.action.toLowerCase().includes("hr") || log.action.toLowerCase().includes("employee");
      }
      return true;
    })
    .filter(log => {
      if (!logSearch) return true;
      const term = logSearch.toLowerCase();
      return (
        log.userName.toLowerCase().includes(term) ||
        log.action.toLowerCase().includes(term) ||
        log.details.toLowerCase().includes(term) ||
        log.userRole.toLowerCase().includes(term)
      );
    })
    .slice(0, 8); // Top 8 matched logs

  // Custom greeting based on hours
  const hours = liveTime.getHours();
  const greeting = hours < 12 ? "Good Morning" : hours < 17 ? "Good Afternoon" : "Good Evening";

  return (
    <div className="space-y-6">
      
      {/* 1. Header Medical Workspace Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl border border-slate-800 p-6 text-white shadow-xl">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <HeartPulse className="w-40 h-40 text-teal-400 animate-pulse" />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-10" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6 z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-xs font-semibold text-teal-300">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
              <span>CareMatrix Clinical Hub v4.2</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">
              {greeting}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-blue-300">{userName}</span>
            </h2>
            <p className="text-sm text-slate-300 max-w-xl">
              Welcome to the central command panel. You have <span className="font-semibold text-white">{todayApts.length} consultations scheduled for today</span>, with <span className="font-semibold text-white">{activeAdmissions} active inpatients currently admitted</span> in the ward.
            </p>
          </div>

          <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center border-t md:border-t-0 md:border-l border-slate-700/50 pt-4 md:pt-0 md:pl-6 gap-4">
            <div className="text-left md:text-right">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 block">Current Node Session</span>
              <div className="font-semibold text-slate-200 mt-0.5 text-sm flex items-center gap-1.5 md:justify-end">
                <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                <span>{userRole}</span>
              </div>
            </div>
            
            <div className="text-right">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 block">Hospital Live Time</span>
              <div className="font-mono text-base font-bold text-teal-300 mt-0.5 tracking-wider">
                {liveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Primary Metrics Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1: Total Patients */}
        <motion.div 
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-xs flex flex-col justify-between hover:shadow-md transition-all cursor-pointer group" 
          onClick={() => onNavigate("patients")}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Patients Registry</span>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform border border-blue-100/30">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black font-mono text-slate-800 dark:text-white leading-none">
              {totalPatients}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-[10px] text-slate-400">
              <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold rounded font-mono">
                +{patients.filter(p => {
                  const oneWeekAgo = new Date();
                  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                  return new Date(p.createdAt) > oneWeekAgo;
                }).length} this week
              </span>
              <span>Registered active lives</span>
            </div>
          </div>
        </motion.div>

        {/* Metric 2: Today's Scheduled Appointments */}
        <motion.div 
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-xs flex flex-col justify-between hover:shadow-md transition-all cursor-pointer group" 
          onClick={() => onNavigate("appointments")}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Clinician Schedule</span>
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform border border-indigo-100/30">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black font-mono text-slate-800 dark:text-white leading-none">
              {todayApts.length}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-[10px] text-slate-400">
              <span className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold rounded font-mono">
                {appointments.filter(a => a.date === todayDateStr && a.status === "Completed").length} done
              </span>
              <span>Pending consultations today</span>
            </div>
          </div>
        </motion.div>

        {/* Metric 3: Bed Capacity and Occupancy */}
        <motion.div 
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-xs flex flex-col justify-between hover:shadow-md transition-all cursor-pointer group" 
          onClick={() => onNavigate("ipd")}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bed Occupancy Rate</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform border border-emerald-100/30">
              <Bed className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-slate-800 dark:text-white leading-none">
                {bedOccupancyRate}%
              </span>
              <span className="text-xs text-slate-400">
                ({availableBeds} / {totalBedsCount} available)
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${bedOccupancyRate}%` }}
              />
            </div>
          </div>
        </motion.div>

        {/* Metric 4: Finance Telemetry */}
        <motion.div 
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-xs flex flex-col justify-between hover:shadow-md transition-all cursor-pointer group" 
          onClick={() => onNavigate("billing")}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hospital Net Cashflow</span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform border border-amber-100/30">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 leading-none">
              {formatCurrency(netRevenue, countryCode)}
            </div>
            <div className="flex items-center justify-between mt-2 text-[9px] text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-2 font-mono">
              <span>Gross: {formatCurrency(grossRevenue, countryCode)}</span>
              <span>Salaries: {formatCurrency(totalSalariesPaid, countryCode)}</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* 3. Pharmacy warning notification inside clinical workflow */}
      {lowStockMeds.length > 0 && (
        <div className="bg-amber-50/70 dark:bg-amber-950/15 border border-amber-200/50 dark:border-amber-800/50 p-4 rounded-xl flex items-start gap-4 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 space-y-1">
            <h4 className="font-bold text-sm text-amber-800 dark:text-amber-300">Clinical Pharmacy Restock Alert</h4>
            <p className="text-xs text-amber-700/90 dark:text-amber-400/90">
              There are <span className="font-bold">{lowStockMeds.length} essential medical compounds</span> currently falling below critical safety reserves (e.g. {lowStockMeds.slice(0, 3).map(m => `${m.name} [Stock: ${m.stock}]`).join(", ")}). This can affect patient prescription fulfillment.
            </p>
          </div>
          <button 
            onClick={() => onNavigate("pharmacy")}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition shrink-0 shadow-xs"
          >
            Manage Pharmacy
          </button>
        </div>
      )}

      {/* 4. Split Telemetry row: Clinical Agenda & Real-time Ward Telemetry VS Compliance Audit Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (2/3 width): Clinical Agenda & Ward Occupancy Detail */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Section A: Today's Clinician Agenda */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-5 shadow-xs">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="space-y-1">
                <h3 className="font-bold text-slate-800 dark:text-white text-base">Clinician Agenda & Appointments</h3>
                <p className="text-[11px] text-slate-400">Scheduled outpatient sessions for doctor consultations</p>
              </div>
              <button 
                onClick={() => onNavigate("appointments")} 
                className="text-teal-600 dark:text-teal-400 text-xs font-bold hover:underline flex items-center gap-1 px-2.5 py-1.5 hover:bg-teal-50 dark:hover:bg-teal-950/20 rounded-lg transition"
              >
                Open Calendar <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {todayApts.length > 0 ? (
                todayApts.map((apt) => (
                  <div key={apt.id} className="py-3 flex items-center justify-between gap-4 group hover:bg-slate-50/40 dark:hover:bg-slate-800/10 px-2 rounded-lg transition">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 text-xs uppercase">
                        {apt.patientName.slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white text-sm">{apt.patientName}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <span className="font-medium text-slate-500 dark:text-slate-300">{apt.doctorName}</span>
                          <span>•</span>
                          <span>{apt.reason}</span>
                        </div>
                      </div>
                    </div>
                    <span className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-xs font-bold rounded-lg flex items-center gap-1.5 border border-slate-200/50 dark:border-slate-700/50">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      {apt.time}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs space-y-2">
                  <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center mx-auto text-slate-400">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <p>All scheduled sessions completed or no more appointments for today.</p>
                </div>
              )}
            </div>
          </div>

          {/* Section B: Live Ward Occupancy Telemetry */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-5 shadow-xs">
            <div className="space-y-1 mb-5 border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-800 dark:text-white text-base">Inpatient Ward Telemetry (Bed Analysis)</h3>
              <p className="text-[11px] text-slate-400">Live occupancy levels and capacity indexes by department/ward category</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {wardStats.map((ward) => {
                let barColor = "bg-teal-500";
                let textColor = "text-teal-600 dark:text-teal-400";
                let bgColor = "bg-teal-50 dark:bg-teal-950/20 border-teal-100 dark:border-teal-900/30";
                
                if (ward.percentage >= 90) {
                  barColor = "bg-rose-500";
                  textColor = "text-rose-600 dark:text-rose-400";
                  bgColor = "bg-rose-50 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/30";
                } else if (ward.percentage >= 70) {
                  barColor = "bg-amber-500";
                  textColor = "text-amber-600 dark:text-amber-400";
                  bgColor = "bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/30";
                }

                return (
                  <div key={ward.type} className={`p-3.5 rounded-xl border ${bgColor} flex flex-col justify-between`}>
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{ward.type}</span>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className={`text-xl font-black font-mono ${textColor}`}>{ward.occupied}</span>
                        <span className="text-xs text-slate-500">/ {ward.total} Beds</span>
                      </div>
                    </div>
                    
                    <div className="mt-4 space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold font-mono">
                        <span>Occupied</span>
                        <span>{ward.percentage}%</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`${barColor} h-full rounded-full transition-all duration-500`}
                          style={{ width: `${ward.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section C: Clinical & Operational Trend Analysis Chart */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="space-y-1">
                <h3 className="font-bold text-slate-800 dark:text-white text-base flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-teal-600" />
                  Clinical & Operational Trend Analysis
                </h3>
                <p className="text-[11px] text-slate-400">Live dynamic indicators for consultations, admissions, revenue and occupancy</p>
              </div>

              {/* Chart Tabs */}
              <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-100 dark:border-slate-700/50 self-stretch sm:self-auto">
                <button
                  onClick={() => setActiveChartTab("clinical")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                    activeChartTab === "clinical"
                      ? "bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-xs border border-slate-200/20"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Clinical Load
                </button>
                <button
                  onClick={() => setActiveChartTab("financial")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                    activeChartTab === "financial"
                      ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs border border-slate-200/20"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Financial Flow
                </button>
                <button
                  onClick={() => setActiveChartTab("occupancy")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                    activeChartTab === "occupancy"
                      ? "bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs border border-slate-200/20"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Bed Occupancy %
                </button>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analyticsData}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.4)" className="dark:stroke-slate-800/40" />
                  
                  <XAxis 
                    dataKey="name" 
                    stroke="#94a3b8" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    allowDecimals={false}
                    tickFormatter={(value) => activeChartTab === "financial" ? `${value}` : `${value}`}
                  />
                  
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      borderColor: "rgba(30, 41, 59, 0.8)",
                      borderRadius: "10px",
                      color: "#fff",
                      fontSize: "11px",
                      fontFamily: "monospace"
                    }}
                    cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                  />

                  {activeChartTab === "clinical" && (
                    <>
                      <Bar 
                        dataKey="Consultations" 
                        fill="#0d9488" 
                        radius={[4, 4, 0, 0]}
                        maxBarSize={40}
                      />
                      <Bar 
                        dataKey="Admissions" 
                        fill="#6366f1" 
                        radius={[4, 4, 0, 0]}
                        maxBarSize={40}
                      />
                    </>
                  )}

                  {activeChartTab === "financial" && (
                    <>
                      <Bar 
                        dataKey="Revenue" 
                        name="Gross Revenue"
                        fill="#10b981" 
                        radius={[4, 4, 0, 0]}
                        maxBarSize={40}
                      />
                      <Bar 
                        dataKey="Expenses" 
                        name="Operational Costs"
                        fill="#f43f5e" 
                        radius={[4, 4, 0, 0]}
                        maxBarSize={40}
                      />
                    </>
                  )}

                  {activeChartTab === "occupancy" && (
                    <Bar 
                      dataKey="Occupancy" 
                      name="Occupancy Rate %"
                      fill="#f59e0b" 
                      radius={[4, 4, 0, 0]}
                      maxBarSize={50}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Column (1/3 width): Compliance Audit Trail & Live Filter */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col">
          
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3 mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 dark:text-white text-base flex items-center gap-1.5">
                <Activity className="w-5 h-5 text-teal-600 animate-pulse" />
                Audit Trail Logs
              </h3>
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" title="Live connection active" />
            </div>
            
            {/* Log Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search audit trail..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Log Type Pills */}
            <div className="flex flex-wrap gap-1">
              {(["ALL", "CLINIC", "BILLING", "HR"] as const).map(pill => (
                <button
                  key={pill}
                  onClick={() => setLogFilter(pill)}
                  className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition ${
                    logFilter === pill 
                      ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900" 
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
                  }`}
                >
                  {pill}
                </button>
              ))}
            </div>
          </div>

          {/* Audit trail list */}
          <div className="space-y-4 overflow-y-auto max-h-[460px] pr-1 flex-1">
            <AnimatePresence mode="popLayout">
              {filteredLogs.map((log) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={log.id} 
                  className="text-xs space-y-1.5 relative pl-4 border-l border-slate-200 dark:border-slate-800 hover:border-teal-500/50 dark:hover:border-teal-400/50 transition duration-150"
                >
                  <div className="absolute -left-[4.5px] top-1 w-2 h-2 bg-slate-300 dark:bg-slate-700 rounded-full border border-white dark:border-slate-900 group-hover:bg-teal-500 transition-colors" />
                  <div className="flex justify-between items-center text-slate-400">
                    <span className="font-bold text-slate-600 dark:text-slate-300 text-[10px] truncate max-w-[120px]" title={`${log.userName} (${log.userRole})`}>
                      {log.userName}
                    </span>
                    <span className="font-mono text-[9px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-slate-800 dark:text-slate-200 font-bold text-[11px] leading-snug">{log.action}</p>
                  <p className="text-slate-400 dark:text-slate-400 text-[10px] leading-relaxed break-words">{log.details}</p>
                </motion.div>
              ))}
            </AnimatePresence>

            {filteredLogs.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-xs flex flex-col items-center gap-2">
                <Database className="w-6 h-6 text-slate-300" />
                <p>No compatible logs matched the selected criteria.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. Command Shortcuts & Operational Quick Actions */}
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-3">Clinical Command Center Quick Shortcuts</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          
          <button 
            onClick={() => onNavigate("patients")}
            className="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-slate-800 hover:bg-teal-50/50 dark:hover:bg-slate-800/80 border border-slate-100 dark:border-slate-700/80 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs hover:shadow-sm hover:border-teal-200/50 dark:hover:border-teal-900/50 transition text-left"
          >
            <div className="p-1.5 bg-teal-500/10 rounded-lg text-teal-600 dark:text-teal-400">
              <UserPlus className="w-3.5 h-3.5" />
            </div>
            <span>Admit Patient</span>
          </button>

          <button 
            onClick={() => onNavigate("appointments")}
            className="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-slate-800 hover:bg-teal-50/50 dark:hover:bg-slate-800/80 border border-slate-100 dark:border-slate-700/80 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs hover:shadow-sm hover:border-teal-200/50 dark:hover:border-teal-900/50 transition text-left"
          >
            <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-600 dark:text-indigo-400">
              <Calendar className="w-3.5 h-3.5" />
            </div>
            <span>Clinical Agenda</span>
          </button>

          <button 
            onClick={() => onNavigate("pharmacy")}
            className="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-slate-800 hover:bg-teal-50/50 dark:hover:bg-slate-800/80 border border-slate-100 dark:border-slate-700/80 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs hover:shadow-sm hover:border-teal-200/50 dark:hover:border-teal-900/50 transition text-left"
          >
            <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400">
              <HeartPulse className="w-3.5 h-3.5" />
            </div>
            <span>Pharmacy Stocks</span>
          </button>

          <button 
            onClick={() => onNavigate("billing")}
            className="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-slate-800 hover:bg-teal-50/50 dark:hover:bg-slate-800/80 border border-slate-100 dark:border-slate-700/80 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs hover:shadow-sm hover:border-teal-200/50 dark:hover:border-teal-900/50 transition text-left"
          >
            <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
            <span>Finance & Billing</span>
          </button>

          <button 
            onClick={() => onNavigate("hr")}
            className="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-slate-800 hover:bg-teal-50/50 dark:hover:bg-slate-800/80 border border-slate-100 dark:border-slate-700/80 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs hover:shadow-sm hover:border-teal-200/50 dark:hover:border-teal-900/50 transition text-left col-span-2 sm:col-span-1"
          >
            <div className="p-1.5 bg-rose-500/10 rounded-lg text-rose-600 dark:text-rose-400">
              <Users className="w-3.5 h-3.5" />
            </div>
            <span>Staff Roster (HR)</span>
          </button>

        </div>
      </div>

    </div>
  );
}
