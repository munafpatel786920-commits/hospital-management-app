import React, { useState } from "react";
import { DB } from "../lib/db";
import { UserProfile, LicenseDuration } from "../types";
import { formatDurationLabel } from "../lib/crypto";
import { 
  KeyRound, Building2, User, Lock, Eye, EyeOff, 
  ArrowRight, ShieldCheck, CheckCircle2, AlertCircle, HeartPulse, Sparkles, ArrowLeft
} from "lucide-react";

interface Props {
  onSuccess: (user: UserProfile) => void;
  onBackToLogin: () => void;
}

export default function CustomerActivation({ onSuccess, onBackToLogin }: Props) {
  const [activationKey, setActivationKey] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [desiredUserId, setDesiredUserId] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [verifiedKeyInfo, setVerifiedKeyInfo] = useState<{ duration: LicenseDuration } | null>(null);
  const [isActivating, setIsActivating] = useState(false);

  // Auto-verify key format on change
  const handleKeyChange = (val: string) => {
    const formatted = val.trim().toUpperCase();
    setActivationKey(formatted);
    setError("");

    if (formatted.length >= 14) {
      const res = DB.verifyActivationKey(formatted);
      if (res.valid && res.key) {
        setVerifiedKeyInfo({ duration: res.key.duration });
      } else {
        setVerifiedKeyInfo(null);
      }
    } else {
      setVerifiedKeyInfo(null);
    }
  };

  const handleActivate = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanKey = activationKey.trim().toUpperCase();
    const cleanHosp = hospitalName.trim();
    const cleanUser = desiredUserId.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanKey) {
      setError("Please enter your Activation Key.");
      return;
    }
    if (!cleanHosp) {
      setError("Please enter your Hospital or Clinic Name.");
      return;
    }
    if (!cleanUser || cleanUser.length < 3) {
      setError("Desired User ID must be at least 3 characters.");
      return;
    }
    if (!cleanPass || cleanPass.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }
    if (cleanPass !== confirmPassword.trim()) {
      setError("Passwords do not match. Please retype carefully.");
      return;
    }

    setIsActivating(true);

    try {
      const result = DB.activateCustomerHospital({
        rawKey: cleanKey,
        hospitalName: cleanHosp,
        desiredUserId: cleanUser,
        password: cleanPass,
        phone,
        email
      });

      if (!result.success || !result.user) {
        setError(result.error || "Failed to activate license. Please try again.");
        setIsActivating(false);
        return;
      }

      // Success! Log the user directly into their brand new isolated tenant
      onSuccess(result.user);
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred during activation.");
      setIsActivating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/90 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-3 sm:p-6 md:p-8 relative overflow-x-hidden">
      {/* Background ambient lighting */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-teal-200/40 dark:bg-teal-900/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-200/40 dark:bg-indigo-900/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 relative z-10">
        
        {/* Left Side: Instructions & Verification Badge */}
        <div className="lg:col-span-5 bg-gradient-to-br from-teal-50 via-slate-50 to-emerald-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-teal-950/40 p-6 sm:p-8 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800">
          <div className="space-y-6">
            <button
              type="button"
              onClick={onBackToLogin}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-teal-600 dark:text-slate-400 dark:hover:text-teal-400 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </button>

            <div>
              <div className="inline-flex p-3 bg-gradient-to-tr from-teal-600 to-emerald-600 rounded-2xl shadow-md shadow-teal-600/20 text-white mb-3">
                <KeyRound className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
                Customer License <span className="text-teal-600 dark:text-teal-400">Activation</span>
              </h1>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Activate your genuine hospital operating license. Enter your unique Activation Key provided by the Super Administrator to set up your dedicated, isolated tenant.
              </p>
            </div>

            {/* Key verification indicator card */}
            {verifiedKeyInfo ? (
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Valid Activation Key Detected</span>
                </div>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                  License Duration: <strong>{formatDurationLabel(verifiedKeyInfo.duration)}</strong>
                </p>
              </div>
            ) : (
              <div className="p-3.5 bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                  <Sparkles className="w-4 h-4 text-teal-600" />
                  <span>Single-Use Key Protocol</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Your key activates your hospital and creates your permanent administrator credentials. You will never need to re-enter this key again.
                </p>
              </div>
            )}

            <div className="space-y-2 pt-2 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                <span>Isolated Hospital Tenant ID Generated</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                <span>Zero-Trust Role-Based Access Control</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-teal-600" />
                <span>Full Access to OPD, IPD, Beds, Pharmacy & Billing</span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-400">
            CareMatrix Hospital OS • Security & License Authority
          </div>
        </div>

        {/* Right Side: Activation Form */}
        <div className="lg:col-span-7 p-6 sm:p-8 bg-white dark:bg-slate-900 flex flex-col justify-between">
          <form onSubmit={handleActivate} className="space-y-3.5">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Register Your Medical Center</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">All fields marked with * are required</p>
            </div>

            {/* Activation Key */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                Activation Key *
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={activationKey}
                  onChange={(e) => handleKeyChange(e.target.value)}
                  placeholder="e.g. CMX-XXXX-XXXX-XXXX"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-3 py-2.5 text-sm font-mono font-bold uppercase text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 tracking-wider"
                />
              </div>
            </div>

            {/* Hospital Name */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                Hospital / Clinic Name *
              </label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={hospitalName}
                  onChange={(e) => setHospitalName(e.target.value)}
                  placeholder="e.g. City Care Multispeciality Hospital"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-teal-600"
                />
              </div>
            </div>

            {/* Desired User ID & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Desired User ID *
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={desiredUserId}
                    onChange={(e) => setDesiredUserId(e.target.value)}
                    placeholder="e.g. dr_arun or cityadmin"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Contact Phone
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765-43210"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-teal-600"
                />
              </div>
            </div>

            {/* Password and Retype Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Create Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a strong password"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-10 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-teal-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Retype Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-10 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-teal-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-medium flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isActivating}
              className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold py-3 rounded-xl text-sm transition shadow-md shadow-teal-600/20 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-50"
            >
              {isActivating ? "Verifying & Activating..." : "Activate Hospital License & Sign In"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
            <button
              type="button"
              onClick={onBackToLogin}
              className="text-xs text-slate-500 hover:text-teal-600 dark:text-slate-400 dark:hover:text-teal-400 font-semibold"
            >
              Already activated? Click here to Sign In with your User ID
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
