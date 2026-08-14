/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  SUPER_ADMIN = "Super Admin",
  HOSPITAL_ADMIN = "Hospital Admin",
  DOCTOR = "Doctor",
  NURSE = "Nurse",
  RECEPTIONIST = "Receptionist",
  PHARMACIST = "Pharmacist",
  LAB_TECHNICIAN = "Lab Technician",
  ACCOUNTANT = "Accountant",
  PATIENT = "Patient",
  PATHOLOGIST = "Pathologist",
  RADIOLOGIST = "Radiologist",
  SURGEON = "Surgeon",
  CARDIOLOGIST = "Cardiologist",
  PEDIATRICIAN = "Pediatrician",
  DENTIST = "Dentist",
  PSYCHIATRIST = "Psychiatrist",
  ORTHOPEDIC = "Orthopedic Specialist",
  DERMATOLOGIST = "Dermatologist",
  NEUROLOGIST = "Neurologist",
  OPHTHALMOLOGIST = "Ophthalmologist",
  GYNECOLOGIST = "Gynecologist",
  ANESTHESIOLOGIST = "Anesthesiologist",
  GENERAL_PRACTITIONER = "General Practitioner",
  ENT_SPECIALIST = "ENT Specialist",
  ONCOLOGIST = "Oncologist"
}

export interface CountryConfig {
  code: string;
  name: string;
  currency: string;
  currencySymbol: string;
  phoneFormat: string;
  taxLabel: string; // "GST", "VAT", "Sales Tax"
  taxRate: number; // e.g. 0.15 for 15%
  dateFormat: string;
  timeZone: string;
}

export interface Hospital {
  id: string;
  name: string;
  countryCode: string;
  currency: string;
  language: string;
  status: "Active" | "Inactive";
  plan: "Basic" | "Standard" | "Premium";
  address: string;
  phone: string;
  email: string;
  logoUrl?: string;
  taxSystem: string;
  taxRate: number;
  departments: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface UserProfile {
  id: string;
  hospitalId: string | null; // null for Super Admin
  name: string;
  email: string;
  role: UserRole;
  phone: string;
  status: "Active" | "Inactive";
  photoUrl?: string;
  specialization?: string; // For doctors
  department?: string; // For doctors/nurses/staff
  password?: string; // Add password field
  createdAt: string;
  updatedAt: string;
}

export interface Patient {
  id: string; // Unique Patient ID like PAT-YYYY-XXXX
  hospitalId: string;
  countryCode: string;
  name: string;
  gender: "Male" | "Female" | "Other";
  dob: string;
  phone: string;
  email: string;
  photoUrl?: string;
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  allergies: string[];
  medicalHistory: string[];
  insurance: {
    provider: string;
    policyNumber: string;
    expiryDate: string;
    coverageLimit: number;
  };
  qrCodeData?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface Doctor {
  id: string;
  hospitalId: string;
  name: string;
  specialization: string;
  department: string;
  consultationFee: number;
  schedule: {
    [day: string]: { start: string; end: string; slots: number }[];
  };
  leaves: string[]; // List of dates
  status: "Available" | "On Leave" | "Busy";
  isActive?: boolean;
  createdAt: string;
}

export interface Staff {
  id: string;
  hospitalId: string;
  name: string;
  role: UserRole;
  department: string;
  phone: string;
  email: string;
  status: "Active" | "Inactive";
  salary: number;
  createdAt: string;
}

export interface Appointment {
  id: string;
  hospitalId: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  status: "Scheduled" | "Completed" | "Cancelled" | "Rescheduled";
  reason: string;
  consultationFee: number;
  createdAt: string;
  updatedAt: string;
}

export interface OPDRecord {
  id: string;
  hospitalId: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  visitDate: string;
  symptoms: string;
  diagnosis: string;
  prescription: {
    medicineId: string;
    medicineName: string;
    dosage: string; // e.g. "1-0-1"
    duration: string; // e.g. "5 Days"
    instructions: string; // e.g. "After Food"
  }[];
  followUpDate?: string;
  notes?: string;
  billingStatus: "Pending" | "Paid";
  createdAt: string;
}

export interface IPDRecord {
  id: string;
  hospitalId: string;
  patientId: string;
  patientName: string;
  bedId: string;
  bedNumber: string;
  wardName: string;
  admissionDate: string;
  dischargeDate?: string;
  doctorInChargeId: string;
  doctorInChargeName: string;
  reasonForAdmission: string;
  diagnosis?: string;
  treatmentSummary?: string;
  status: "Admitted" | "Discharged";
  dischargeSummary?: {
    conditionAtDischarge: string;
    medications: string;
    followUpInstructions: string;
  };
  createdAt: string;
}

export interface Bed {
  id: string;
  hospitalId: string;
  number: string;
  type: "General Ward" | "Semi-Private" | "Private Suite" | "ICU";
  status: "Available" | "Occupied" | "Maintenance";
  ratePerDay: number;
  patientId?: string;
  patientName?: string;
}

export interface Medicine {
  id: string;
  hospitalId: string;
  name: string;
  category: string; // e.g. "Antibiotics", "Analgesics"
  stock: number;
  minStockAlert: number;
  price: number;
  expiryDate: string;
  manufacturer: string;
  location: string; // e.g. "Shelf A-3"
  createdAt: string;
}

export interface MedicinePurchase {
  id: string;
  hospitalId: string;
  medicineId: string;
  medicineName: string;
  supplierName: string;
  invoiceNumber: string;
  quantity: number;
  purchasePrice: number;
  expiryDate: string;
  purchaseDate: string;
  totalAmount: number;
}

export interface LabTest {
  id: string;
  hospitalId: string;
  patientId: string;
  patientName: string;
  category: "Hematology" | "Biochemistry" | "Microbiology" | "Immunology" | "Radiology";
  testName: string; // e.g. "CBC", "Blood Sugar", "MRI Chest"
  testType: "Laboratory" | "Radiology";
  sampleCollected: boolean;
  sampleCollectionDate?: string;
  resultDate?: string;
  results?: string;
  status: "Pending" | "Sample Collected" | "Completed" | "Cancelled";
  radiologyImageUrl?: string; // For X-Rays, MRI scans etc
  technicianId?: string;
  technicianName?: string;
  doctorId?: string;
  doctorName?: string;
  doctorSpecialization?: string;
  referredBy?: string;
  cost: number;
  createdAt: string;
}

export interface BillingInvoice {
  id: string; // INV-XXXXXX
  hospitalId: string;
  patientId: string;
  patientName: string;
  type: "OPD" | "IPD" | "Pharmacy" | "Laboratory" | "General";
  items: {
    description: string;
    amount: number;
  }[];
  subtotal: number;
  taxAmount: number;
  discount: number;
  total: number;
  status: "Paid" | "Pending" | "Refunded";
  paymentMethod?: "Cash" | "Card" | "UPI" | "Insurance";
  insuranceClaimed?: {
    provider: string;
    amountClaimed: number;
    status: "Pending" | "Approved" | "Rejected";
  };
  createdAt: string;
}

export interface Ambulance {
  id: string;
  hospitalId: string;
  vehicleNumber: string;
  model: string;
  driverName: string;
  driverPhone: string;
  status: "Available" | "On Trip" | "Maintenance";
  trips: {
    date: string;
    destination: string;
    purpose: string;
    status: "Completed" | "Active";
  }[];
}

export interface BloodDonor {
  id: string;
  hospitalId: string;
  name: string;
  bloodGroup: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
  phone: string;
  address?: string;
  lastDonatedDate?: string;
  status: "Eligible" | "Ineligible";
}

export interface BloodTransaction {
  id: string;
  hospitalId: string;
  date: string;
  type: "Incoming" | "Outgoing";
  bloodGroup: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
  units: number;
  personName: string;
  purpose?: string;
}

export interface BloodStock {
  hospitalId: string;
  "A+": number;
  "A-": number;
  "B+": number;
  "B-": number;
  "AB+": number;
  "AB-": number;
  "O+": number;
  "O-": number;
}

export interface InventoryItem {
  id: string;
  hospitalId: string;
  name: string;
  category: "Equipment" | "Consumables" | "Surgical" | "Office";
  stock: number;
  vendor: string;
  unit: string; // e.g. "Boxes", "Pieces"
  pricePerUnit: number;
  lastOrderedDate?: string;
}

export interface EmployeeHR {
  id: string;
  hospitalId: string;
  name: string;
  role: UserRole;
  department: string;
  salary: number;
  isActive?: boolean;
  attendance: {
    [date: string]: "Present" | "Absent" | "Leave";
  };
  leavesLeft: number;
  payrollHistory: {
    id?: string;
    month: string; // YYYY-MM
    netPay: string;
    status: "Paid" | "Pending";
    basic?: number;
    hra?: number;
    da?: number;
    bonus?: number;
    overtime?: number;
    pf?: number;
    profTax?: number;
  }[];
}

export interface Expense {
  id: string;
  hospitalId: string;
  description: string;
  amount: number;
  date: string;
  category: "Payroll" | "Medicine" | "Maintenance" | "Utilities" | "Other";
}

export interface AuditLog {
  id: string;
  hospitalId: string | null;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  details: string;
  timestamp: string;
}
