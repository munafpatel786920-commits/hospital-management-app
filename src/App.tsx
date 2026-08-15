/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { DB } from "./lib/db";
import { UserRole, Hospital, UserProfile } from "./types";
import { LANGUAGES, getRTL, translate, COUNTRIES } from "./lib/i18n";
import SuperAdminPanel from "./components/SuperAdminPanel";
import PatientManagement from "./components/PatientManagement";
import ClinicalModules from "./components/ClinicalModules";
import SupportModules from "./components/SupportModules";
import DashboardHome from "./components/DashboardHome";
import LoginPage from "./components/LoginPage";
import { RoleManagement } from "./components/RoleManagement";
import { 
  Building2, Users, ShieldAlert, Heart, Sun, Moon, 
  Languages, LogOut, ChevronRight, Activity, ShieldCheck, 
  Settings2, HelpCircle, Pill, Receipt, FileText, Settings, Briefcase,
  Calendar, Stethoscope, BedDouble, FileSpreadsheet,
  Maximize2, Minimize2, Monitor, Cloud, CheckCircle2, RefreshCw, Database
} from "lucide-react";

export default function App() {
  // Theme state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem("darkMode") === "true";
  });

  useEffect(() => {
    localStorage.setItem("darkMode", String(darkMode));
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  // Full screen & Wide screen layout states
  const [isWideLayout, setIsWideLayout] = useState<boolean>(true);
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState<boolean>(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsBrowserFullscreen(true);
      }).catch((err) => {
        console.error("Error attempting to enable full-screen mode:", err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => {
          setIsBrowserFullscreen(false);
        }).catch((err) => {
          console.error("Error exiting full-screen:", err);
        });
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsBrowserFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Tenant / Multi-country states
  const [hospitals, setHospitals] = useState<Hospital[]>(DB.getHospitals());
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>("HOSP-001");
  const [hospitalDetails, setHospitalDetails] = useState<Hospital>(
    DB.getHospitals().find(h => h.id === "HOSP-001") || DB.getHospitals()[0]
  );

  // Role Authentication states
  const [users, setUsers] = useState<UserProfile[]>(DB.getUsers());
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [cloudStatus, setCloudStatus] = useState(DB.getCloudStatus());

  // Subscribe to real-time database updates (including Firebase Firestore sync)
  useEffect(() => {
    const unsub = DB.subscribe((data) => {
      setHospitals(data.hospitals);
      setUsers(data.users);
      setCloudStatus(DB.getCloudStatus());
    });

    const interval = setInterval(() => {
      setCloudStatus(DB.getCloudStatus());
    }, 10000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<string>("dashboard");

  const handleLogin = (user: UserProfile) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    if (user.hospitalId) {
      setSelectedHospitalId(user.hospitalId);
    }
    
    // Auto routing tabs based on role
    if (user.role === UserRole.SUPER_ADMIN) {
      setActiveTab("superadmin");
    } else if (user.role === UserRole.PATIENT) {
      setActiveTab("patients");
    } else {
      setActiveTab("dashboard");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  // Locale settings
  const [currentLanguage, setCurrentLanguage] = useState<string>("en");

  // Audit transaction alerts
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Synchronize tenant parameters
  useEffect(() => {
    const allHospitals = DB.getHospitals();
    const selected = allHospitals.find(h => h.id === selectedHospitalId);
    if (selected) {
      setHospitalDetails(selected);
      // Automatically switch default translation language based on hospital choice
      if (selected.id === "HOSP-001") {
        setCurrentLanguage("en");
      } else if (selected.id === "HOSP-002") {
        setCurrentLanguage("en");
      }
    } else if (allHospitals.length > 0) {
      setSelectedHospitalId(allHospitals[0].id);
      setHospitalDetails(allHospitals[0]);
    }
  }, [selectedHospitalId, hospitals]);

  // Synchronize users lists when DB is modified
  const handleRefreshHospital = () => {
    setHospitals(DB.getHospitals());
    const selected = DB.getHospitals().find(h => h.id === selectedHospitalId);
    if (selected) {
      setHospitalDetails(selected);
    }
  };

  const handleLogAction = (action: string, details: string) => {
    if (!currentUser) return;
    DB.logAction(
      currentUser.role === UserRole.SUPER_ADMIN ? null : selectedHospitalId,
      currentUser.id,
      currentUser.name,
      currentUser.role,
      action,
      details
    );
    showToast(`${action}: ${details}`);
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Change currently authenticated user
  const handleUserChange = (userId: string) => {
    const targetUser = DB.getUsers().find(u => u.id === userId);
    if (targetUser) {
      setCurrentUser(targetUser);
      if (targetUser.hospitalId) {
        setSelectedHospitalId(targetUser.hospitalId);
      }
      
      // Auto routing tabs based on role
      if (targetUser.role === UserRole.SUPER_ADMIN) {
        setActiveTab("superadmin");
      } else if (targetUser.role === UserRole.PATIENT) {
        setActiveTab("patients");
      } else {
        setActiveTab("dashboard");
      }
      showToast(`Logged in as ${targetUser.name} (${targetUser.role})`);
    }
  };

  const handleHospitalChange = (id: string) => {
    setSelectedHospitalId(id);
    
    // Automatically match a user profile in this hospital
    const matchUser = DB.getUsers().find(u => u.hospitalId === id);
    if (matchUser) {
      setCurrentUser(matchUser);
    }
    showToast(`Switched workspace to Hospital tenant ID: ${id}`);
  };

  const isRtl = getRTL(currentLanguage);

  return (
    <div className={`${darkMode ? "dark" : ""} min-h-screen font-sans antialiased bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 transition-colors duration-200`} dir={isRtl ? "rtl" : "ltr"}>
      
      {!isAuthenticated ? (
        <LoginPage onLogin={handleLogin} />
      ) : (
        <>
          {/* Toast alert box */}
          {toastMessage && (
            <div className="fixed bottom-5 right-5 z-50 bg-slate-900/90 text-white dark:bg-white dark:text-slate-950 px-4 py-3 rounded-xl border border-slate-700/50 shadow-2xl flex items-center gap-2 max-w-sm animate-in slide-in-from-bottom-5 font-mono text-xs">
              <Activity className="w-4 h-4 text-teal-400 shrink-0 animate-pulse" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* PRIMARY HEADER */}
          <header id="primary-header" className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 shadow-xs">
            <div className={`mx-auto px-4 sm:px-6 ${isWideLayout ? "max-w-full lg:px-8" : "max-w-7xl lg:px-8"} h-16 flex items-center justify-between transition-all duration-300`}>
              
              {/* Logo & Brand title */}
              <div className="flex items-center gap-2.5">
                {hospitalDetails?.logoUrl ? (
                  <img src={hospitalDetails.logoUrl} alt="Logo" className="w-9 h-9 object-contain bg-white rounded-md shadow-sm shadow-slate-200/50 border border-slate-100" />
                ) : (
                  <div className="p-2 bg-blue-600 rounded-md text-white shadow-sm shadow-blue-600/30">
                    <Building2 className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <div className="font-bold text-slate-900 dark:text-white text-lg tracking-tight flex items-center gap-1.5">
                    {currentUser?.role !== UserRole.SUPER_ADMIN && hospitalDetails?.name 
                      ? hospitalDetails.name 
                      : translate("app_title", currentLanguage)}
                    <span className="text-[10px] uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded-full font-bold">
                      v1.2
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                    {currentUser?.role !== UserRole.SUPER_ADMIN && hospitalDetails?.name 
                      ? `${hospitalDetails.name} Clinical Portal` 
                      : translate("tagline", currentLanguage)}
                  </p>
                </div>
              </div>

              {/* Right actions */}
              <div className="flex items-center gap-2.5 sm:gap-3">
                {/* Firebase Cloud Sync Indicator */}
                <div 
                  onClick={() => {
                    DB.syncWithCloud();
                    showToast("Syncing all data with Google Firebase Firestore...");
                  }}
                  className="cursor-pointer px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 transition bg-teal-50/70 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/50"
                  title="Google Firebase Firestore Live Cloud Database. Click to force sync."
                >
                  <span className="relative flex h-2 w-2">
                    {cloudStatus.status === "connected" && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                    )}
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${
                      cloudStatus.status === "connected" ? "bg-teal-500" : cloudStatus.status === "syncing" ? "bg-amber-500" : "bg-slate-400"
                    }`}></span>
                  </span>
                  <Cloud className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden md:inline">
                    {cloudStatus.status === "connected" ? "Firebase Live" : cloudStatus.status === "syncing" ? "Syncing..." : "Cloud Saved"}
                  </span>
                </div>

                {/* Light/Dark Theme Toggle Button */}
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold"
                  title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                >
                  {darkMode ? (
                    <>
                      <Sun className="w-4 h-4 text-amber-400 shrink-0 animate-spin-slow" />
                      <span className="hidden sm:inline">Light Mode</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span className="hidden sm:inline">Dark Mode</span>
                    </>
                  )}
                </button>

                {/* Widescreen Toggle Button */}
                <button 
                  onClick={() => setIsWideLayout(!isWideLayout)}
                  className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold"
                  title={isWideLayout ? "Switch to Compact Layout" : "Switch to Fullscreen Wide Layout"}
                >
                  <Monitor className="w-4 h-4" />
                  <span className="hidden sm:inline">{isWideLayout ? "Compact View" : "Widescreen"}</span>
                </button>

                {/* Native Browser Fullscreen Button */}
                <button 
                  onClick={toggleFullscreen}
                  className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold"
                  title={isBrowserFullscreen ? "Exit Fullscreen" : "Go Full Screen"}
                >
                  {isBrowserFullscreen ? (
                    <>
                      <Minimize2 className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="hidden sm:inline">Exit Full</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="hidden sm:inline font-bold">Go Fullscreen</span>
                    </>
                  )}
                </button>

                <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block"></div>

                <button onClick={handleLogout} className="text-xs font-bold text-red-500 flex items-center gap-1.5 hover:text-red-700">
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>

            </div>
          </header>

          {/* CORE FRAME LAYOUT */}
          <div className={`mx-auto px-4 sm:px-6 ${isWideLayout ? "max-w-full lg:px-8" : "max-w-7xl lg:px-8"} transition-all duration-300 lg:h-[calc(100vh-4rem)] lg:overflow-hidden flex flex-col pt-4 pb-4 lg:pt-6 lg:pb-6`}>
            <div className="flex flex-col lg:flex-row gap-6 items-stretch flex-1 min-h-0">
              
              {/* Navigation Sidebar Drawer */}
              <aside className="w-full lg:w-60 lg:shrink-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-2 transition-all duration-300 overflow-y-auto lg:h-full">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">Hospital Navigation</div>

                {currentUser?.role === UserRole.SUPER_ADMIN && (
                  <button
                    onClick={() => setActiveTab("superadmin")}
                    className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-between ${
                      activeTab === "superadmin"
                        ? "bg-teal-600 text-white shadow-sm shadow-teal-600/15"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Super Admin Portal</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {(currentUser?.role === UserRole.SUPER_ADMIN || currentUser?.role === UserRole.HOSPITAL_ADMIN || (currentUser?.role && DB.hasPermission(currentUser.role, "settings"))) && (
                  <button
                    onClick={() => setActiveTab("roles")}
                    className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-between ${
                      activeTab === "roles"
                        ? "bg-teal-600 text-white shadow-sm shadow-teal-600/15"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      <span>Role Control (RBAC)</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {currentUser?.role !== UserRole.SUPER_ADMIN && (
                  <div className="space-y-1">
                    {currentUser?.role && DB.hasPermission(currentUser.role, "dashboard") && (
                      <button
                        onClick={() => setActiveTab("dashboard")}
                        className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-between ${
                          activeTab === "dashboard"
                            ? "bg-teal-600 text-white font-semibold shadow-sm shadow-teal-600/15"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4" />
                          <span>{translate("dashboard", currentLanguage)}</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {currentUser?.role && DB.hasPermission(currentUser.role, "patients") && (
                      <button
                        onClick={() => setActiveTab("patients")}
                        className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-between ${
                          activeTab === "patients"
                            ? "bg-teal-600 text-white shadow-sm shadow-teal-600/15"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          <span>{translate("patients", currentLanguage)}</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {currentUser?.role && DB.hasPermission(currentUser.role, "appointments") && (
                      <button
                        onClick={() => setActiveTab("appointments")}
                        className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-between ${
                          activeTab === "appointments"
                            ? "bg-teal-600 text-white shadow-sm shadow-teal-600/15"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>Appointments</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {currentUser?.role && DB.hasPermission(currentUser.role, "opd") && (
                      <button
                        onClick={() => setActiveTab("opd")}
                        className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-between ${
                          activeTab === "opd"
                            ? "bg-teal-600 text-white shadow-sm shadow-teal-600/15"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Stethoscope className="w-4 h-4" />
                          <span>OPD & Rx</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {currentUser?.role && DB.hasPermission(currentUser.role, "ipd") && (
                      <button
                        onClick={() => setActiveTab("ipd")}
                        className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-between ${
                          activeTab === "ipd"
                            ? "bg-teal-600 text-white shadow-sm shadow-teal-600/15"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <BedDouble className="w-4 h-4" />
                          <span>IPD & Beds Map</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {currentUser?.role && DB.hasPermission(currentUser.role, "lab") && (
                      <button
                        onClick={() => setActiveTab("lab")}
                        className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-between ${
                          activeTab === "lab"
                            ? "bg-teal-600 text-white shadow-sm shadow-teal-600/15"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4" />
                          <span>Diagnostics (Lab)</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {currentUser?.role && DB.hasPermission(currentUser.role, "emergency") && (
                      <button
                        onClick={() => setActiveTab("emergency")}
                        className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-between ${
                          activeTab === "emergency"
                            ? "bg-teal-600 text-white shadow-sm shadow-teal-600/15"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4" />
                          <span>Trauma & Blood Bank</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {currentUser?.role && DB.hasPermission(currentUser.role, "pharmacy") && (
                      <button
                        onClick={() => setActiveTab("pharmacy")}
                        className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-between ${
                          activeTab === "pharmacy"
                            ? "bg-teal-600 text-white shadow-sm shadow-teal-600/15"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Pill className="w-4 h-4" />
                          <span>Pharmacy</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {currentUser?.role && DB.hasPermission(currentUser.role, "billing") && (
                      <button
                        onClick={() => setActiveTab("billing")}
                        className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-between ${
                          activeTab === "billing"
                            ? "bg-teal-600 text-white shadow-sm shadow-teal-600/15"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Receipt className="w-4 h-4" />
                          <span>Billing Ledger</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {currentUser?.role && DB.hasPermission(currentUser.role, "hr") && (
                      <button
                        onClick={() => setActiveTab("hr")}
                        className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-between ${
                          activeTab === "hr"
                            ? "bg-teal-600 text-white shadow-sm shadow-teal-600/15"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-4 h-4" />
                          <span>Human Resources</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {currentUser?.role && DB.hasPermission(currentUser.role, "reports") && (
                      <button
                        onClick={() => setActiveTab("reports")}
                        className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-between ${
                          activeTab === "reports"
                            ? "bg-teal-600 text-white shadow-sm shadow-teal-600/15"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          <span>Reports</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {currentUser?.role && DB.hasPermission(currentUser.role, "settings") && (
                      <button
                        onClick={() => setActiveTab("settings")}
                        className={`w-full text-left px-3.5 py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-between ${
                          activeTab === "settings"
                            ? "bg-teal-600 text-white shadow-sm shadow-teal-600/15"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Settings className="w-4 h-4" />
                          <span>Settings</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </aside>
              
              {/* MAIN PAGE VIEW STAGE */}
              <main className="flex-1 space-y-6 transition-all duration-300 overflow-y-auto lg:h-full pr-1 lg:pr-3 pb-12 lg:pb-4">
                
                {activeTab === "superadmin" && currentUser?.role === UserRole.SUPER_ADMIN && (
                  <SuperAdminPanel 
                    currentLanguage={currentLanguage} 
                    onLogAction={handleLogAction} 
                  />
                )}

                {activeTab === "dashboard" && currentUser?.role !== UserRole.SUPER_ADMIN && (
                  <DashboardHome
                    hospitalId={selectedHospitalId}
                    countryCode={hospitalDetails.countryCode}
                    currentLanguage={currentLanguage}
                    userId={currentUser.id}
                    userName={currentUser.name}
                    userRole={currentUser.role}
                    onNavigate={(tab) => setActiveTab(tab)}
                  />
                )}

                {activeTab === "patients" && (
                  <PatientManagement
                    hospitalId={selectedHospitalId}
                    countryCode={hospitalDetails.countryCode}
                    currentLanguage={currentLanguage}
                    userId={currentUser.id}
                    userName={currentUser.name}
                    userRole={currentUser.role}
                    onLogAction={handleLogAction}
                  />
                )}

                {["appointments", "opd", "ipd", "lab", "emergency"].includes(activeTab) && currentUser?.role !== UserRole.SUPER_ADMIN && (
                  <ClinicalModules
                    hospitalId={selectedHospitalId}
                    countryCode={hospitalDetails.countryCode}
                    currentLanguage={currentLanguage}
                    userId={currentUser.id}
                    userName={currentUser.name}
                    userRole={currentUser.role}
                    onLogAction={handleLogAction}
                    activeSubTab={activeTab as any}
                  />
                )}

                {["pharmacy", "billing", "hr", "reports", "settings"].includes(activeTab) && currentUser?.role !== UserRole.SUPER_ADMIN && (
                  <SupportModules
                    hospitalId={selectedHospitalId}
                    countryCode={hospitalDetails.countryCode}
                    currentLanguage={currentLanguage}
                    userId={currentUser.id}
                    userName={currentUser.name}
                    userRole={currentUser.role}
                    hospitalDetails={hospitalDetails}
                    onRefreshHospital={handleRefreshHospital}
                    onLogAction={handleLogAction}
                    activeSubTab={activeTab as any}
                  />
                )}

                {activeTab === "roles" && (
                  <RoleManagement
                    hospitalId={selectedHospitalId}
                    currentLanguage={currentLanguage}
                    userId={currentUser.id}
                    userName={currentUser.name}
                    userRole={currentUser.role}
                    onLogAction={handleLogAction}
                  />
                )}

                {activeTab === "superadmin" && currentUser?.role !== UserRole.SUPER_ADMIN && (
                  <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                    <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
                    <h3 className="font-bold text-slate-800 dark:text-white text-base">Workspace Access Restricted</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                      You are not authorized to view the Super Admin interface. Please toggle your active role to Super Admin in the top toolbar to access this cockpit.
                    </p>
                  </div>
                )}
              </main>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
