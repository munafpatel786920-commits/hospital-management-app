import React, { useState, useEffect } from "react";
import { DB } from "../lib/db";
import { UserRole, UserProfile } from "../types";
import { 
  Shield, ShieldCheck, ShieldAlert, Users, Check, X, Lock, 
  Settings, Activity, UserCheck, RefreshCw, AlertTriangle, 
  Plus, Search, Key, Sliders, Save, CheckCircle, Info, BadgeAlert, Trash2
} from "lucide-react";

interface RoleManagementProps {
  hospitalId: string | null;
  currentLanguage: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  onLogAction: (action: string, details: string) => void;
}

const MODULES = [
  { id: "dashboard", name: "Dashboard Hub", desc: "Central workspace clinical/operational overview & quick actions" },
  { id: "patients", name: "Patients Registry", desc: "Medical charts, registration, demographic profiling and patient QR codes" },
  { id: "appointments", name: "Appointments", desc: "Consultation schedule manager, slot allocation and bookings" },
  { id: "opd", name: "OPD & Rx", desc: "Outpatient clinical visits, symptom logging, diagnosis & digital prescriptions" },
  { id: "ipd", name: "IPD & Beds Map", desc: "Inpatient admissions, real-time bed layout state and discharge summaries" },
  { id: "lab", name: "Diagnostics (Lab)", desc: "Radiology, Pathology order processing, sample collection and result reporting" },
  { id: "emergency", name: "Trauma & Blood Bank", desc: "Ambulance tracking, emergency room and blood group inventory ledger" },
  { id: "pharmacy", name: "Pharmacy Store", desc: "Compound inventories, manufacturer records, stock alerts & pricing" },
  { id: "billing", name: "Billing Ledger", desc: "Invoices, taxation settings, insurance claims, and cash/card ledgers" },
  { id: "hr", name: "Human Resources", desc: "Employee attendance loggers, professional tax deductions & monthly payroll" },
  { id: "reports", name: "Reporting & Auditing", desc: "Financial ledger downloads, clinical census reports, and tax worksheets" },
  { id: "settings", name: "Clinic Settings", desc: "Hospital details, tax parameters, logo configuration & active departments" },
  { id: "superadmin", name: "Super Admin Cockpit", desc: "Global Multi-Tenant orchestrator, system backup & restore center" }
];

export const RoleManagement: React.FC<RoleManagementProps> = ({
  hospitalId,
  userId,
  userName,
  userRole,
  onLogAction
}) => {
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [rolePermissions, setRolePermissions] = useState<{ [role: string]: string[] }>({});
  const [selectedRole, setSelectedRole] = useState<string>(UserRole.DOCTOR);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  
  // New User Form States
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>(UserRole.DOCTOR);
  const [newUserPhone, setNewUserPhone] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserDept, setNewUserDept] = useState("");
  const [newUserSpec, setNewUserSpec] = useState("");

  // Audit alerts inside page
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, [hospitalId]);

  const loadData = () => {
    // Load users (filter by hospitalId if not Super Admin)
    const allUsers = DB.getUsers();
    const filteredUsers = hospitalId 
      ? allUsers.filter(u => u.hospitalId === hospitalId || u.role === UserRole.SUPER_ADMIN)
      : allUsers;
    setUsersList(filteredUsers);

    // Load Permissions
    setRolePermissions(DB.getRolePermissions());
  };

  const showAlert = (text: string, type: "success" | "error" = "success") => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg(null), 4000);
  };

  // Toggle dynamic privilege in state
  const handleTogglePermission = (role: string, moduleId: string) => {
    // Prevent removing clinical settings/superadmin access from super admin to avoid lockouts
    if (role === UserRole.SUPER_ADMIN && moduleId === "superadmin") {
      showAlert("Super Admin cockpit access cannot be revoked from the Super Admin role.", "error");
      return;
    }

    const currentPerms = rolePermissions[role] || [];
    let updatedPerms: string[];
    
    if (currentPerms.includes(moduleId)) {
      updatedPerms = currentPerms.filter(id => id !== moduleId);
    } else {
      updatedPerms = [...currentPerms, moduleId];
    }

    const updated = { ...rolePermissions, [role]: updatedPerms };
    setRolePermissions(updated);
    DB.updateRolePermissions(role, updatedPerms);
    
    // Log audit log
    onLogAction("Access Rules Updated", `Modified permissions for role: ${role}. Active modules: [${updatedPerms.join(", ")}]`);
    showAlert(`Successfully updated permissions for ${role}`);
  };

  // Change user role
  const handleUserRoleChange = (targetUserId: string, newRole: UserRole) => {
    // Prevent modifying own role to avoid self-lockout
    if (targetUserId === userId) {
      showAlert("You cannot modify your own role to prevent lockout. Please ask another administrator.", "error");
      return;
    }

    const targetUser = usersList.find(u => u.id === targetUserId);
    if (!targetUser) return;

    DB.updateUser(targetUserId, { role: newRole });
    loadData();
    onLogAction("User Role Reassigned", `Reassigned role of ${targetUser.name} from ${targetUser.role} to ${newRole}`);
    showAlert(`Reassigned ${targetUser.name} to ${newRole}`);
  };

  // Toggle user active status
  const handleToggleUserStatus = (targetUserId: string) => {
    if (targetUserId === userId) {
      showAlert("You cannot deactivate your own administrative account.", "error");
      return;
    }

    const targetUser = usersList.find(u => u.id === targetUserId);
    if (!targetUser) return;

    const newStatus = targetUser.status === "Active" ? "Inactive" : "Active";
    DB.updateUser(targetUserId, { status: newStatus });
    loadData();
    onLogAction("User Status Modified", `Toggled user ${targetUser.name} (${targetUser.role}) account status to ${newStatus}`);
    showAlert(`User status set to ${newStatus}`);
  };

  // Reset Password
  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForPassword || !newPassword.trim()) return;

    DB.updateUser(selectedUserForPassword.id, { password: newPassword.trim() });
    onLogAction("Credentials Reset", `Reset authentication password for user profile ${selectedUserForPassword.name}`);
    showAlert(`Successfully updated password for ${selectedUserForPassword.name}`);
    setSelectedUserForPassword(null);
    setNewPassword("");
  };

  // Onboard New System User
  const handleOnboardUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail || !newUserPassword) {
      showAlert("Please enter all required fields for user onboarding.", "error");
      return;
    }

    // Check if email already registered
    const emailExists = DB.getUsers().some(u => u.email.toLowerCase() === newUserEmail.toLowerCase());
    if (emailExists) {
      showAlert("A user with this login email address is already registered.", "error");
      return;
    }

    const newProfileId = `usr-${newUserRole.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Math.floor(100 + Math.random() * 900)}`;
    const newProfile: UserProfile = {
      id: newProfileId,
      hospitalId: newUserRole === UserRole.SUPER_ADMIN ? null : (hospitalId || "HOSP-001"),
      name: newUserName,
      email: newUserEmail,
      role: newUserRole,
      phone: newUserPhone || "+91 99000-11122",
      status: "Active",
      department: newUserDept || "General Ward",
      specialization: newUserSpec || undefined,
      password: newUserPassword,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    DB.addUser(newProfile);
    
    // Log and notify
    onLogAction("User Onboarded", `Created new login credential profile for ${newUserName} as ${newUserRole}`);
    showAlert(`Successfully onboarded ${newUserName} as ${newUserRole}!`);
    loadData();

    // Reset Form
    setNewUserName("");
    setNewUserEmail("");
    setNewUserRole(UserRole.DOCTOR);
    setNewUserPhone("");
    setNewUserPassword("");
    setNewUserDept("");
    setNewUserSpec("");
    setShowAddUserModal(false);
  };

  // Filter users based on query
  const filteredUsers = usersList.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <div>
          <h1 className="font-bold text-slate-900 dark:text-white text-xl tracking-tight flex items-center gap-2">
            <Shield className="w-5.5 h-5.5 text-teal-600 dark:text-teal-400" />
            Role-Based Management & Access Control
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure system capabilities, module routing access, dynamic permissions, and authenticate operational clinic roles.
          </p>
        </div>
        <button
          onClick={() => setShowAddUserModal(true)}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition shadow-md flex items-center justify-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Onboard System User
        </button>
      </div>

      {/* Local Alert Feedback */}
      {alertMsg && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 animate-in fade-in duration-150 ${
          alertMsg.type === "success" 
            ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-400" 
            : "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-400"
        }`}>
          {alertMsg.type === "success" ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <span className="text-xs font-semibold">{alertMsg.text}</span>
        </div>
      )}

      {/* Main Multi-grid Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Left / Upper Section: Active Role Module Customizer (7 Cols) */}
        <div className="xl:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col">
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 mb-4 border-b border-slate-150 dark:border-slate-800 gap-3">
            <div>
              <h2 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-4.5 h-4.5 text-teal-600" />
                Dynamic Permissions Customizer
              </h2>
              <p className="text-[10px] text-slate-400 font-semibold">Select role to configure live access privileges:</p>
            </div>
            
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="text-xs font-bold py-1.5 pl-3 pr-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none"
            >
              {Object.values(UserRole).map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>

          {/* Core Modules Checklist */}
          <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px] pr-1">
            {MODULES.map(mod => {
              const isAllowed = (rolePermissions[selectedRole] || []).includes(mod.id);
              return (
                <div 
                  key={mod.id} 
                  onClick={() => handleTogglePermission(selectedRole, mod.id)}
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition cursor-pointer ${
                    isAllowed 
                      ? "bg-teal-50/50 dark:bg-teal-950/15 border-teal-200/60 dark:border-teal-900/40 hover:bg-teal-50 dark:hover:bg-teal-950/25"
                      : "bg-slate-50/40 dark:bg-slate-900/10 border-slate-200/50 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <div className={`mt-0.5 p-2 rounded-lg ${
                      isAllowed ? "bg-teal-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                    }`}>
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-xs text-slate-800 dark:text-white">{mod.name}</span>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">{mod.desc}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                      isAllowed 
                        ? "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400" 
                        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    }`}>
                      {isAllowed ? "Access Active" : "Restricted"}
                    </span>
                    <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${
                      isAllowed 
                        ? "bg-teal-600 border-teal-600 text-white" 
                        : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-transparent"
                    }`}>
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Security warning */}
          <div className="mt-5 p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-150 dark:border-slate-800 flex gap-2.5 items-start">
            <Info className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <p className="text-[10px] text-slate-500 leading-relaxed">
              <strong>Interactive Session Note:</strong> CareMatrix integrates state permission guards dynamically. When you grant or revoke a privilege in the matrix above, the target role will instantly lose or gain visual navigation options in the primary sidebar during this active sandbox session.
            </p>
          </div>
        </div>

        {/* Right Section: Active Authenticated User Accounts List (5 Cols) */}
        <div className="xl:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col">
          
          <div className="pb-4 mb-4 border-b border-slate-150 dark:border-slate-800">
            <h2 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4.5 h-4.5 text-teal-600" />
              Active User Directories
            </h2>
            <p className="text-[10px] text-slate-400 font-semibold">Track accounts, swap roles, reset passwords, or deactivate logins.</p>
            
            {/* Search Input */}
            <div className="relative mt-3">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email or designation..."
                className="w-full text-xs pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Scrollable list */}
          <div className="space-y-3 overflow-y-auto max-h-[460px] pr-1 flex-1">
            {filteredUsers.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                <ShieldAlert className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-semibold">No registered users matched your query.</p>
              </div>
            ) : (
              filteredUsers.map(user => (
                <div key={user.id} className="p-3.5 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-150 dark:border-slate-850 rounded-xl space-y-2.5">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="font-bold text-xs text-slate-800 dark:text-white flex items-center gap-1.5">
                        {user.name}
                        {user.id === userId && (
                          <span className="text-[8px] uppercase px-1.5 py-0.5 bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded font-black">
                            YOU
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium block">{user.email}</span>
                      <span className="text-[9px] font-mono text-slate-500">ID: {user.id}</span>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <button
                        onClick={() => handleToggleUserStatus(user.id)}
                        className={`text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md ${
                          user.status === "Active"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200/50 dark:bg-emerald-950/30 dark:text-emerald-400"
                            : "bg-rose-50 text-rose-700 border border-rose-200/50 dark:bg-rose-950/30 dark:text-rose-400"
                        }`}
                        title="Click to toggle status"
                      >
                        {user.status === "Active" ? "Active" : "Disabled"}
                      </button>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 font-bold">Assign Role:</span>
                      <select
                        value={user.role}
                        onChange={(e) => handleUserRoleChange(user.id, e.target.value as UserRole)}
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded text-[10px] font-semibold text-slate-800 focus:outline-none"
                      >
                        {Object.values(UserRole).map(roleOption => (
                          <option key={roleOption} value={roleOption}>{roleOption}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={() => setSelectedUserForPassword(user)}
                      className="text-[10px] font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 flex items-center gap-1 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/40 px-2.5 py-1 rounded"
                    >
                      <Key className="w-3 h-3" />
                      Set Password
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Bird's-eye Full Permission Matrix Grid View (Highly visual and impressive) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs overflow-hidden">
        <h2 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-teal-600" />
          CareMatrix Multi-Role Privileges Matrix
        </h2>
        <p className="text-xs text-slate-400 mb-5 leading-relaxed">
          Comprehensive summary matrix of all system roles and active workspaces. Toggle privileges instantly by clicking checkboxes on the intersection matrix:
        </p>

        <div className="overflow-auto max-h-[550px] border border-slate-150 dark:border-slate-800 rounded-xl relative">
          <table className="w-full text-left text-[11px] border-collapse min-w-[800px]">
            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 shadow-sm">
              <tr className="border-b border-slate-150 dark:border-slate-800">
                <th className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider w-[220px] bg-slate-50 dark:bg-slate-900">Workspace Module</th>
                {Object.values(UserRole).filter(r => [UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.DOCTOR, UserRole.NURSE, UserRole.RECEPTIONIST, UserRole.PHARMACIST, UserRole.LAB_TECHNICIAN, UserRole.ACCOUNTANT, UserRole.PATIENT].includes(r)).map(role => (
                  <th key={role} className="py-3 px-2 font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-center bg-slate-50 dark:bg-slate-900">{role}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 dark:divide-slate-800/80">
              {MODULES.map(mod => (
                <tr key={mod.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/40">
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-800 dark:text-white">{mod.name}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">{mod.desc}</div>
                  </td>
                  {Object.values(UserRole).filter(r => [UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.DOCTOR, UserRole.NURSE, UserRole.RECEPTIONIST, UserRole.PHARMACIST, UserRole.LAB_TECHNICIAN, UserRole.ACCOUNTANT, UserRole.PATIENT].includes(r)).map(role => {
                    const isAllowed = (rolePermissions[role] || []).includes(mod.id);
                    return (
                      <td key={role} className="py-3 px-2 text-center">
                        <button
                          onClick={() => handleTogglePermission(role, mod.id)}
                          className={`mx-auto w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                            isAllowed 
                              ? "bg-teal-600 border-teal-600 text-white shadow-xs" 
                              : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-transparent"
                          }`}
                        >
                          <Check className="w-3 h-3 stroke-[3]" />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- PASSWORD MODAL --- */}
      {selectedUserForPassword && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-850">
              <h3 className="font-bold text-slate-800 dark:text-white text-sm">Update Password</h3>
              <button onClick={() => setSelectedUserForPassword(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleResetPasswordSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <span className="text-slate-400 font-bold block mb-1">Target Account:</span>
                <span className="font-bold text-sm text-slate-800 dark:text-white">{selectedUserForPassword.name} ({selectedUserForPassword.role})</span>
              </div>
              <div className="space-y-1">
                <label className="text-slate-500 font-semibold uppercase">New Login Password</label>
                <input
                  required
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white font-mono"
                  placeholder="Minimum 6 characters"
                />
              </div>
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedUserForPassword(null)}
                  className="px-3.5 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-600 text-white hover:bg-teal-700 rounded-lg font-bold shadow-sm"
                >
                  Confirm Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD SYSTEM USER ONBOARD MODAL --- */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-850">
              <h3 className="font-bold text-slate-800 dark:text-white text-base">Onboard New System Login Profile</h3>
              <button onClick={() => setShowAddUserModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleOnboardUser} className="p-6 space-y-4 text-xs">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-500 font-semibold uppercase">Full Name *</label>
                  <input
                    required
                    type="text"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                    placeholder="e.g. Dr. Munaf Patel"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-500 font-semibold uppercase">Primary Role *</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                  >
                    {Object.values(UserRole).map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-500 font-semibold uppercase">Login Email *</label>
                  <input
                    required
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                    placeholder="email@hospital.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-500 font-semibold uppercase">Secure Password *</label>
                  <input
                    required
                    type="password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                    placeholder="Minimum 6 characters"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-500 font-semibold uppercase">Phone Number</label>
                  <input
                    type="text"
                    value={newUserPhone}
                    onChange={(e) => setNewUserPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                    placeholder="+91 99000-11122"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-500 font-semibold uppercase">Department</label>
                  <input
                    type="text"
                    value={newUserDept}
                    onChange={(e) => setNewUserDept(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                    placeholder="e.g. Cardiology"
                  />
                </div>
              </div>

              {newUserRole === UserRole.DOCTOR && (
                <div className="space-y-1">
                  <label className="text-slate-500 font-semibold uppercase">Clinical Specialization</label>
                  <input
                    type="text"
                    value={newUserSpec}
                    onChange={(e) => setNewUserSpec(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                    placeholder="e.g. Interventional Cardiology"
                  />
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold bg-teal-600 text-white hover:bg-teal-700 rounded-xl transition shadow-md"
                >
                  Confirm & Register Profile
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
