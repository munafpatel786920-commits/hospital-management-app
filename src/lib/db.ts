/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db as firestore, auth, doc, setDoc, getDoc, onSnapshot } from "./firebase";
import { 
  Hospital, UserProfile, UserRole, Patient, Doctor, Staff, 
  Appointment, OPDRecord, IPDRecord, Bed, Medicine, LabTest, 
  BillingInvoice, Ambulance, BloodDonor, BloodStock, InventoryItem, 
  EmployeeHR, AuditLog, BloodTransaction, MedicinePurchase, Expense
} from "../types";

// LOCAL-FIRST PERSISTENT MULTI-TENANT ENGINE WITH GOOGLE FIREBASE CLOUD SYNC
const LOCAL_STORAGE_KEY = "CAREMATRIX_DB";

interface SystemDB {
  hospitals: Hospital[];
  users: UserProfile[];
  patients: Patient[];
  doctors: Doctor[];
  staff: Staff[];
  appointments: Appointment[];
  opd: OPDRecord[];
  ipd: IPDRecord[];
  beds: Bed[];
  medicines: Medicine[];
  labTests: LabTest[];
  billing: BillingInvoice[];
  ambulances: Ambulance[];
  bloodDonors: BloodDonor[];
  bloodStock: { [hospitalId: string]: BloodStock };
  bloodTransactions?: BloodTransaction[];
  inventory: InventoryItem[];
  employees: EmployeeHR[];
  auditLogs: AuditLog[];
  medicinePurchases?: MedicinePurchase[];
  expenses?: Expense[];
  rolePermissions?: { [role: string]: string[] };
}

const DEFAULT_DEPARTMENTS = [
  "Cardiology",
  "Neurology",
  "Pediatrics",
  "Orthopedics",
  "General Medicine",
  "Emergency",
  "ICU",
  "Radiology",
  "Pathology",
  "Ophthalmology",
  "ENT (Otolaryngology)",
  "Dermatology",
  "Psychiatry",
  "Oncology",
  "Gynecology & Obstetrics",
  "Urology",
  "Nephrology",
  "Gastroenterology",
  "Pulmonology",
  "Endocrinology",
  "Rheumatology",
  "Hematology",
  "Dentistry",
  "General Surgery",
  "Anesthesiology",
  "Physiotherapy & Rehabilitation",
  "Infectious Diseases"
];

// Helper functions to generate local timezone-aware YYYY-MM-DD date strings
export const getLocalDateStr = (date: Date = new Date()): string => {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split("T")[0];
};

export const getRelativeDateStr = (daysOffset: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return getLocalDateStr(d);
};

export const getRelativeDateTimeStr = (daysOffset: number, timeStr: string = "12:00:00"): string => {
  const dateStr = getRelativeDateStr(daysOffset);
  return `${dateStr}T${timeStr}Z`;
};

// Initial Seeding
export const SEED_DATA: SystemDB = {
  hospitals: [
    {
      id: "HOSP-001",
      name: "St. Mary General Hospital",
      countryCode: "IN",
      currency: "INR",
      language: "en",
      status: "Active",
      plan: "Premium",
      address: "M.G. Road, Sector 4, Mumbai, Maharashtra",
      phone: "+91 98765-43210",
      email: "contact@stmary.org",
      taxSystem: "GST",
      taxRate: 0.18,
      departments: DEFAULT_DEPARTMENTS,
      createdAt: "2026-01-10T10:00:00Z",
      updatedAt: "2026-01-10T10:00:00Z",
      createdBy: "Super Admin"
    },
    {
      id: "HOSP-002",
      name: "Mayo Health Clinic",
      countryCode: "US",
      currency: "USD",
      language: "en",
      status: "Active",
      plan: "Standard",
      address: "200 First St SW, Rochester, MN 55905",
      phone: "+1 (507) 284-2511",
      email: "info@mayoclinic.org",
      taxSystem: "Sales Tax",
      taxRate: 0.08,
      departments: DEFAULT_DEPARTMENTS,
      createdAt: "2026-02-15T09:00:00Z",
      updatedAt: "2026-02-15T09:00:00Z",
      createdBy: "Super Admin"
    }
  ],
  users: [
    {
      id: "usr-super",
      hospitalId: null,
      name: "Dr. Munaf Patel",
      email: "patelmunaf90@gmail.com",
      password: "munaf786",
      role: UserRole.SUPER_ADMIN,
      phone: "+91 99999-99999",
      status: "Active",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z"
    },
    {
      id: "usr-admin-1",
      hospitalId: "HOSP-001",
      name: "Aarav Sharma",
      email: "admin@stmary.org",
      password: "1234",
      role: UserRole.HOSPITAL_ADMIN,
      phone: "+91 88888-88888",
      status: "Active",
      createdAt: "2026-01-10T11:00:00Z",
      updatedAt: "2026-01-10T11:00:00Z"
    },
    {
      id: "usr-doc-1",
      hospitalId: "HOSP-001",
      name: "Dr. Rajesh Koothrapali",
      email: "rajesh@stmary.org",
      password: "1234",
      role: UserRole.DOCTOR,
      phone: "+91 77777-77777",
      status: "Active",
      specialization: "Cardiology",
      department: "Cardiology",
      createdAt: "2026-01-12T10:00:00Z",
      updatedAt: "2026-01-12T10:00:00Z"
    },
    {
      id: "usr-doc-2",
      hospitalId: "HOSP-001",
      name: "Dr. Sunita Williams",
      email: "sunita@stmary.org",
      password: "1234",
      role: UserRole.DOCTOR,
      phone: "+91 76666-66666",
      status: "Active",
      specialization: "Pediatrics",
      department: "Pediatrics",
      createdAt: "2026-01-13T09:00:00Z",
      updatedAt: "2026-01-13T09:00:00Z"
    },
    {
      id: "usr-doc-pathologist",
      hospitalId: "HOSP-001",
      name: "Dr. Ramesh Patel",
      email: "ramesh.patel@stmary.org",
      password: "1234",
      role: UserRole.DOCTOR,
      phone: "+91 94250-12345",
      status: "Active",
      specialization: "Pathology",
      department: "Diagnostics",
      createdAt: "2026-01-14T10:00:00Z",
      updatedAt: "2026-01-14T10:00:00Z"
    },
    {
      id: "usr-doc-radiologist",
      hospitalId: "HOSP-001",
      name: "Dr. Sameer Malhotra",
      email: "sameer.malhotra@stmary.org",
      password: "1234",
      role: UserRole.DOCTOR,
      phone: "+91 94250-67890",
      status: "Active",
      specialization: "Radiology",
      department: "Radiology",
      createdAt: "2026-01-15T11:00:00Z",
      updatedAt: "2026-01-15T11:00:00Z"
    },
    {
      id: "usr-nurse-1",
      hospitalId: "HOSP-001",
      name: "Sister Priyanka Chopra",
      email: "priyanka@stmary.org",
      password: "1234",
      role: UserRole.NURSE,
      phone: "+91 75555-55555",
      status: "Active",
      department: "General Medicine",
      createdAt: "2026-01-14T08:00:00Z",
      updatedAt: "2026-01-14T08:00:00Z"
    },
    {
      id: "usr-pharm-1",
      hospitalId: "HOSP-001",
      name: "Karan Johar",
      email: "karan@stmary.org",
      password: "1234",
      role: UserRole.PHARMACIST,
      phone: "+91 74444-44444",
      status: "Active",
      department: "Pharmacy",
      createdAt: "2026-01-15T08:00:00Z",
      updatedAt: "2026-01-15T08:00:00Z"
    },
    {
      id: "usr-lab-1",
      hospitalId: "HOSP-001",
      name: "Aditya Roy",
      email: "aditya@stmary.org",
      password: "1234",
      role: UserRole.LAB_TECHNICIAN,
      phone: "+91 73333-33333",
      status: "Active",
      department: "Pathology",
      createdAt: "2026-01-16T08:00:00Z",
      updatedAt: "2026-01-16T08:00:00Z"
    },
    {
      id: "usr-acct-1",
      hospitalId: "HOSP-001",
      name: "Nirmala Sitharaman",
      email: "nirmala@stmary.org",
      password: "1234",
      role: UserRole.ACCOUNTANT,
      phone: "+91 72222-22222",
      status: "Active",
      department: "Finance",
      createdAt: "2026-01-17T08:00:00Z",
      updatedAt: "2026-01-17T08:00:00Z"
    },
    {
      id: "usr-recep-1",
      hospitalId: "HOSP-001",
      name: "Deepika Padukone",
      email: "deepika@stmary.org",
      password: "1234",
      role: UserRole.RECEPTIONIST,
      phone: "+91 71111-11111",
      status: "Active",
      department: "Outpatient Department",
      createdAt: "2026-01-18T08:00:00Z",
      updatedAt: "2026-01-18T08:00:00Z"
    },
    {
      id: "usr-pat-1",
      hospitalId: "HOSP-001",
      name: "Amitabh Bachchan",
      email: "amitabh@bachchan.com",
      password: "1234",
      role: UserRole.PATIENT,
      phone: "+91 90000-00001",
      status: "Active",
      createdAt: "2026-01-20T12:00:00Z",
      updatedAt: "2026-01-20T12:00:00Z"
    }
  ],
  patients: [
    {
      id: "PAT-2026-0001",
      hospitalId: "HOSP-001",
      countryCode: "IN",
      name: "Amitabh Bachchan",
      gender: "Male",
      dob: "1942-10-11",
      phone: "+91 90000-00001",
      email: "amitabh@bachchan.com",
      emergencyContact: {
        name: "Abhishek Bachchan",
        relationship: "Son",
        phone: "+91 90000-00002"
      },
      allergies: ["Penicillin", "Dust"],
      medicalHistory: ["Mild Asthma", "Covid Survivor"],
      insurance: {
        provider: "LIC India Medical Shield",
        policyNumber: "LIC-887722-MED",
        expiryDate: "2028-12-31",
        coverageLimit: 1500000
      },
      qrCodeData: "CareMatrix-PAT-2026-0001",
      createdAt: "2026-01-20T12:00:00Z",
      updatedAt: "2026-01-20T12:00:00Z",
      createdBy: "usr-recep-1"
    },
    {
      id: "PAT-2026-0002",
      hospitalId: "HOSP-001",
      countryCode: "IN",
      name: "Sachin Tendulkar",
      gender: "Male",
      dob: "1973-04-24",
      phone: "+91 90000-00003",
      email: "sachin@tendulkar.com",
      emergencyContact: {
        name: "Anjali Tendulkar",
        relationship: "Spouse",
        phone: "+91 90000-00004"
      },
      allergies: ["None"],
      medicalHistory: ["Tennis Elbow Surgery (2004)", "Knee Ligament Strain"],
      insurance: {
        provider: "HDFC ERGO General",
        policyNumber: "HDFC-992211-M",
        expiryDate: "2027-06-30",
        coverageLimit: 2500000
      },
      qrCodeData: "CareMatrix-PAT-2026-0002",
      createdAt: "2026-01-22T14:30:00Z",
      updatedAt: "2026-01-22T14:30:00Z",
      createdBy: "usr-recep-1"
    },
    {
      id: "PAT-2026-0003",
      hospitalId: "HOSP-002",
      countryCode: "US",
      name: "John Doe",
      gender: "Male",
      dob: "1985-05-15",
      phone: "+1 (555) 234-5678",
      email: "john.doe@gmail.com",
      emergencyContact: {
        name: "Jane Doe",
        relationship: "Spouse",
        phone: "+1 (555) 234-5679"
      },
      allergies: ["Peanuts"],
      medicalHistory: ["Hypertension"],
      insurance: {
        provider: "BlueCross BlueShield",
        policyNumber: "BCBS-4455881",
        expiryDate: "2027-01-01",
        coverageLimit: 50000
      },
      qrCodeData: "CareMatrix-PAT-2026-0003",
      createdAt: "2026-02-18T10:00:00Z",
      updatedAt: "2026-02-18T10:00:00Z",
      createdBy: "usr-super"
    }
  ],
  doctors: [
    {
      id: "usr-doc-1",
      hospitalId: "HOSP-001",
      name: "Dr. Rajesh Koothrapali",
      specialization: "Cardiology",
      department: "Cardiology",
      consultationFee: 1500,
      schedule: {
        "Monday": [{ start: "09:00", end: "13:00", slots: 8 }, { start: "14:00", end: "18:00", slots: 8 }],
        "Wednesday": [{ start: "09:00", end: "13:00", slots: 8 }],
        "Friday": [{ start: "09:00", end: "13:00", slots: 8 }, { start: "14:00", end: "18:00", slots: 8 }]
      },
      leaves: ["2026-08-15"],
      status: "Available",
      createdAt: "2026-01-12T10:00:00Z"
    },
    {
      id: "usr-doc-2",
      hospitalId: "HOSP-001",
      name: "Dr. Sunita Williams",
      specialization: "Pediatrics",
      department: "Pediatrics",
      consultationFee: 1000,
      schedule: {
        "Tuesday": [{ start: "10:00", end: "16:00", slots: 12 }],
        "Thursday": [{ start: "10:00", end: "16:00", slots: 12 }],
        "Saturday": [{ start: "10:00", end: "13:00", slots: 6 }]
      },
      leaves: [],
      status: "Available",
      createdAt: "2026-01-13T09:00:00Z"
    },
    {
      id: "usr-doc-pathologist",
      hospitalId: "HOSP-001",
      name: "Dr. Ramesh Patel",
      specialization: "Pathology",
      department: "Diagnostics",
      consultationFee: 500,
      schedule: {
        "Monday": [{ start: "09:00", end: "17:00", slots: 20 }],
        "Tuesday": [{ start: "09:00", end: "17:00", slots: 20 }],
        "Wednesday": [{ start: "09:00", end: "17:00", slots: 20 }],
        "Thursday": [{ start: "09:00", end: "17:00", slots: 20 }],
        "Friday": [{ start: "09:00", end: "17:00", slots: 20 }],
        "Saturday": [{ start: "09:00", end: "13:00", slots: 10 }]
      },
      leaves: [],
      status: "Available",
      createdAt: "2026-01-14T10:00:00Z"
    },
    {
      id: "usr-doc-radiologist",
      hospitalId: "HOSP-001",
      name: "Dr. Sameer Malhotra",
      specialization: "Radiology",
      department: "Radiology",
      consultationFee: 800,
      schedule: {
        "Monday": [{ start: "09:00", end: "17:00", slots: 20 }],
        "Tuesday": [{ start: "09:00", end: "17:00", slots: 20 }],
        "Wednesday": [{ start: "09:00", end: "17:00", slots: 20 }],
        "Thursday": [{ start: "09:00", end: "17:00", slots: 20 }],
        "Friday": [{ start: "09:00", end: "17:00", slots: 20 }],
        "Saturday": [{ start: "09:00", end: "13:00", slots: 10 }]
      },
      leaves: [],
      status: "Available",
      createdAt: "2026-01-15T11:00:00Z"
    }
  ],
  staff: [
    {
      id: "usr-nurse-1",
      hospitalId: "HOSP-001",
      name: "Sister Priyanka Chopra",
      role: UserRole.NURSE,
      department: "General Ward",
      phone: "+91 75555-55555",
      email: "priyanka@stmary.org",
      status: "Active",
      salary: 45000,
      createdAt: "2026-01-14T08:00:00Z"
    },
    {
      id: "usr-pharm-1",
      hospitalId: "HOSP-001",
      name: "Karan Johar",
      role: UserRole.PHARMACIST,
      department: "Pharmacy",
      phone: "+91 74444-44444",
      email: "karan@stmary.org",
      status: "Active",
      salary: 50000,
      createdAt: "2026-01-15T08:00:00Z"
    },
    {
      id: "usr-lab-1",
      hospitalId: "HOSP-001",
      name: "Aditya Roy",
      role: UserRole.LAB_TECHNICIAN,
      department: "Laboratory",
      phone: "+91 73333-33333",
      email: "aditya@stmary.org",
      status: "Active",
      salary: 42000,
      createdAt: "2026-01-16T08:00:00Z"
    }
  ],
  appointments: [
    {
      id: "APT-1001",
      hospitalId: "HOSP-001",
      patientId: "PAT-2026-0001",
      patientName: "Amitabh Bachchan",
      doctorId: "usr-doc-1",
      doctorName: "Dr. Rajesh Koothrapali",
      date: getRelativeDateStr(0),
      time: "10:30",
      status: "Scheduled",
      reason: "Routine Cardiac Checkup",
      consultationFee: 1500,
      createdAt: getRelativeDateTimeStr(-2, "11:00:00"),
      updatedAt: getRelativeDateTimeStr(-2, "11:00:00")
    },
    {
      id: "APT-1002",
      hospitalId: "HOSP-001",
      patientId: "PAT-2026-0002",
      patientName: "Sachin Tendulkar",
      doctorId: "usr-doc-2",
      doctorName: "Dr. Sunita Williams",
      date: getRelativeDateStr(0),
      time: "11:15",
      status: "Scheduled",
      reason: "General pediatric immunization consult",
      consultationFee: 1000,
      createdAt: getRelativeDateTimeStr(-1, "12:00:00"),
      updatedAt: getRelativeDateTimeStr(-1, "12:00:00")
    }
  ],
  opd: [
    {
      id: "OPD-5001",
      hospitalId: "HOSP-001",
      patientId: "PAT-2026-0001",
      patientName: "Amitabh Bachchan",
      doctorId: "usr-doc-1",
      doctorName: "Dr. Rajesh Koothrapali",
      visitDate: getRelativeDateStr(-3),
      symptoms: "Mild chest tightness and anxiety during rapid walks.",
      diagnosis: "Post-Covid arterial stiffness, stable cardiac function.",
      prescription: [
        { medicineId: "MED-001", medicineName: "Amoxicillin 500mg", dosage: "1-0-1", duration: "5 Days", instructions: "After Food" },
        { medicineId: "MED-002", medicineName: "Paracetamol 650mg", dosage: "1-1-1", duration: "3 Days", instructions: "In case of body pain" }
      ],
      followUpDate: getRelativeDateStr(7),
      notes: "Walk 30 minutes daily in the morning, avoid high sodium.",
      billingStatus: "Paid",
      createdAt: getRelativeDateTimeStr(-3, "12:30:00")
    }
  ],
  ipd: [
    {
      id: "IPD-6001",
      hospitalId: "HOSP-001",
      patientId: "PAT-2026-0002",
      patientName: "Sachin Tendulkar",
      bedId: "BED-ICU-01",
      bedNumber: "ICU-101",
      wardName: "ICU",
      admissionDate: getRelativeDateStr(-5),
      doctorInChargeId: "usr-doc-1",
      doctorInChargeName: "Dr. Rajesh Koothrapali",
      reasonForAdmission: "Accidental sports injury leading to suspected concussion",
      diagnosis: "Grade I concussion and left shoulder contusion",
      treatmentSummary: "Observation for 48 hours, analgesics, cold compression therapy.",
      status: "Admitted",
      createdAt: getRelativeDateTimeStr(-5, "18:00:00")
    }
  ],
  beds: [
    { id: "BED-G-01", hospitalId: "HOSP-001", number: "G-101", type: "General Ward", status: "Available", ratePerDay: 800 },
    { id: "BED-G-02", hospitalId: "HOSP-001", number: "G-102", type: "General Ward", status: "Available", ratePerDay: 800 },
    { id: "BED-P-01", hospitalId: "HOSP-001", number: "PVT-201", type: "Private Suite", status: "Available", ratePerDay: 4000 },
    { id: "BED-ICU-01", hospitalId: "HOSP-001", number: "ICU-101", type: "ICU", status: "Occupied", ratePerDay: 7500, patientId: "PAT-2026-0002", patientName: "Sachin Tendulkar" },
    { id: "BED-ICU-02", hospitalId: "HOSP-001", number: "ICU-102", type: "ICU", status: "Available", ratePerDay: 7500 }
  ],
  medicines: [
    { id: "MED-001", hospitalId: "HOSP-001", name: "Amoxicillin 500mg", category: "Antibiotics", stock: 120, minStockAlert: 20, price: 12, expiryDate: "2027-10-15", manufacturer: "GlaxoSmithKline", location: "Shelf A-1", createdAt: "2026-01-01T00:00:00Z" },
    { id: "MED-002", hospitalId: "HOSP-001", name: "Paracetamol 650mg", category: "Analgesics", stock: 450, minStockAlert: 50, price: 5, expiryDate: "2028-04-20", manufacturer: "Cipla Pharmaceuticals", location: "Shelf A-2", createdAt: "2026-01-01T00:00:00Z" },
    { id: "MED-003", hospitalId: "HOSP-001", name: "Atorvastatin 10mg", category: "Cardiology", stock: 8, minStockAlert: 25, price: 22, expiryDate: "2026-08-30", manufacturer: "Pfizer India", location: "Cold Vault B-1", createdAt: "2026-01-01T00:00:00Z" }, // Low stock & near expiry alert
    { id: "MED-004", hospitalId: "HOSP-001", name: "Metformin 500mg", category: "Antidiabetics", stock: 340, minStockAlert: 40, price: 8, expiryDate: "2027-12-15", manufacturer: "Sun Pharma", location: "Shelf C-4", createdAt: "2026-01-01T00:00:00Z" }
  ],
  labTests: [
    {
      id: "LAB-7001",
      hospitalId: "HOSP-001",
      patientId: "PAT-2026-0001",
      patientName: "Amitabh Bachchan",
      category: "Biochemistry",
      testName: "Lipid Profile",
      testType: "Laboratory",
      sampleCollected: true,
      sampleCollectionDate: getRelativeDateStr(-2),
      resultDate: getRelativeDateStr(-2),
      results: "Total Cholesterol: 185 mg/dL (Normal < 200), HDL: 45 mg/dL, LDL: 110 mg/dL",
      status: "Completed",
      technicianId: "usr-lab-1",
      technicianName: "Aditya Roy",
      cost: 950,
      createdAt: getRelativeDateTimeStr(-2, "08:30:00")
    },
    {
      id: "RAD-8001",
      hospitalId: "HOSP-001",
      patientId: "PAT-2026-0002",
      patientName: "Sachin Tendulkar",
      category: "Radiology",
      testName: "MRI Left Shoulder",
      testType: "Radiology",
      sampleCollected: true,
      sampleCollectionDate: getRelativeDateStr(-4),
      resultDate: getRelativeDateStr(-4),
      results: "Mild supraspinatus tendinopathy, no full-thickness rotator cuff tears detected. Mild joint effusion.",
      status: "Completed",
      technicianId: "usr-lab-1",
      technicianName: "Aditya Roy",
      cost: 6500,
      createdAt: getRelativeDateTimeStr(-4, "10:00:00")
    }
  ],
  billing: [
    {
      id: "INV-260001",
      hospitalId: "HOSP-001",
      patientId: "PAT-2026-0001",
      patientName: "Amitabh Bachchan",
      type: "OPD",
      items: [
        { description: "Cardiology Consultation Fee", amount: 1500 },
        { description: "Lipid Profile Lab Test", amount: 950 }
      ],
      subtotal: 2450,
      taxAmount: 441, // 18% GST
      discount: 200,
      total: 2691,
      status: "Paid",
      paymentMethod: "Card",
      createdAt: getRelativeDateTimeStr(-3, "13:00:00")
    },
    {
      id: "INV-260002",
      hospitalId: "HOSP-001",
      patientId: "PAT-2026-0002",
      patientName: "Sachin Tendulkar",
      type: "IPD",
      items: [
        { description: "ICU Bed Accommodation (3 Days)", amount: 22500 },
        { description: "MRI Left Shoulder (Radiology)", amount: 6500 },
        { description: "Consumables & Nurse Service Fees", amount: 4500 }
      ],
      subtotal: 33500,
      taxAmount: 6030,
      discount: 1500,
      total: 38030,
      status: "Pending",
      insuranceClaimed: {
        provider: "HDFC ERGO General",
        amountClaimed: 35000,
        status: "Pending"
      },
      createdAt: getRelativeDateTimeStr(-5, "11:00:00")
    }
  ],
  ambulances: [
    { id: "AMB-01", hospitalId: "HOSP-001", vehicleNumber: "MH-01-AX-4433", model: "Force Traveller Advanced ICU", driverName: "Raju Prasad", driverPhone: "+91 99112-23344", status: "Available", trips: [] },
    { id: "AMB-02", hospitalId: "HOSP-001", vehicleNumber: "MH-01-BY-5566", model: "Tata Winger Cardiac Lifeline", driverName: "Sohan Lal", driverPhone: "+91 99112-25588", status: "On Trip", trips: [{ date: "2026-07-17", destination: "Gateway Towers Mumbai", purpose: "Cardiac Patient Emergency Pick", status: "Active" }] }
  ],
  bloodDonors: [
    { id: "DON-01", hospitalId: "HOSP-001", name: "Rahul Dravid", bloodGroup: "O+", phone: "+91 91122-33445", lastDonatedDate: "2026-05-10", status: "Eligible" },
    { id: "DON-02", hospitalId: "HOSP-001", name: "Virat Kohli", bloodGroup: "AB-", phone: "+91 92233-44556", lastDonatedDate: "2026-06-25", status: "Eligible" }
  ],
  bloodStock: {
    "HOSP-001": {
      hospitalId: "HOSP-001",
      "A+": 0, "A-": 0, "B+": 0, "B-": 0, "AB+": 0, "AB-": 0, "O+": 0, "O-": 0
    },
    "HOSP-002": {
      hospitalId: "HOSP-002",
      "A+": 0, "A-": 0, "B+": 0, "B-": 0, "AB+": 0, "AB-": 0, "O+": 0, "O-": 0
    }
  },
  inventory: [
    { id: "INV-E-01", hospitalId: "HOSP-001", name: "High-Performance Patient Monitor", category: "Equipment", stock: 15, vendor: "Philips Healthcare", unit: "Pieces", pricePerUnit: 120000, lastOrderedDate: "2026-03-12" },
    { id: "INV-C-01", hospitalId: "HOSP-001", name: "Disposable Sterile Syringes (10ml)", category: "Consumables", stock: 1200, vendor: "Becton Dickinson", unit: "Boxes", pricePerUnit: 450, lastOrderedDate: "2026-06-01" },
    { id: "INV-S-01", hospitalId: "HOSP-001", name: "Surgical Scalpels & Blades", category: "Surgical", stock: 85, vendor: "Medtronic India", unit: "Boxes", pricePerUnit: 1800, lastOrderedDate: "2026-05-18" }
  ],
  employees: [
    {
      id: "usr-nurse-1",
      hospitalId: "HOSP-001",
      name: "Sister Priyanka Chopra",
      role: UserRole.NURSE,
      department: "General Ward",
      salary: 45000,
      attendance: { "2026-07-15": "Present", "2026-07-16": "Present", "2026-07-17": "Present" },
      leavesLeft: 12,
      payrollHistory: [
        {
          id: "PY-JUN2026-N1",
          month: "2026-06",
          netPay: "45000.00",
          status: "Paid",
          basic: 35000,
          hra: 5000,
          da: 3000,
          bonus: 2000,
          overtime: 1500,
          pf: 1250,
          profTax: 250
        }
      ]
    },
    {
      id: "usr-pharm-1",
      hospitalId: "HOSP-001",
      name: "Karan Johar",
      role: UserRole.PHARMACIST,
      department: "Pharmacy",
      salary: 50000,
      attendance: { "2026-07-15": "Present", "2026-07-16": "Present", "2026-07-17": "Leave" },
      leavesLeft: 9,
      payrollHistory: [
        {
          id: "PY-JUN2026-P1",
          month: "2026-06",
          netPay: "50000.00",
          status: "Paid",
          basic: 40000,
          hra: 6000,
          da: 3500,
          bonus: 2500,
          overtime: 0,
          pf: 1600,
          profTax: 400
        }
      ]
    }
  ],
  auditLogs: [
    { id: "LOG-100", hospitalId: "HOSP-001", userId: "usr-admin-1", userName: "Aarav Sharma", userRole: UserRole.HOSPITAL_ADMIN, action: "Patient Registration", details: "Registered Sachin Tendulkar (PAT-2026-0002)", timestamp: "2026-07-17T10:00:00Z" },
    { id: "LOG-101", hospitalId: "HOSP-001", userId: "usr-doc-1", userName: "Dr. Rajesh Koothrapali", userRole: UserRole.DOCTOR, action: "Admitted Patient", details: "Admitted patient PAT-2026-0002 into Bed ICU-101", timestamp: "2026-07-17T11:15:00Z" },
    { id: "LOG-102", hospitalId: "HOSP-001", userId: "usr-pharm-1", userName: "Karan Johar", userRole: UserRole.PHARMACIST, action: "Dispensed Medicine", details: "Dispensed Amoxicillin 500mg for Patient PAT-2026-0001", timestamp: "2026-07-17T13:40:00Z" }
  ],
  bloodTransactions: [
    { id: "TX-B-01", hospitalId: "HOSP-001", date: "2026-07-15", type: "Incoming", bloodGroup: "O+", units: 1, personName: "Rahul Dravid", purpose: "Voluntary Donation" },
    { id: "TX-B-02", hospitalId: "HOSP-001", date: "2026-07-16", type: "Outgoing", bloodGroup: "O+", units: 1, personName: "Sachin Tendulkar", purpose: "Surgery Requirement" },
    { id: "TX-B-03", hospitalId: "HOSP-001", date: "2026-07-17", type: "Incoming", bloodGroup: "AB-", units: 1, personName: "Virat Kohli", purpose: "Voluntary Donation" }
  ],
  medicinePurchases: []
};

// PERSISTENCE MANAGER WITH SESSION / LOCALSTORAGE BACKING & GOOGLE FIREBASE FIRESTORE SYNC
class CareMatrixDatabase {
  private data: SystemDB;
  private listeners: Array<(data: SystemDB) => void> = [];
  private syncTimeout: any = null;
  private isApplyingRemoteUpdate: boolean = false;
  private cloudStatus: "connected" | "syncing" | "offline" = "syncing";
  private lastSyncedAt: string | null = null;

  constructor() {
    const existing = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (existing) {
      try {
        this.data = JSON.parse(existing);
        
        // Fix duplicate audit log IDs that were generated in previous versions
        if (this.data.auditLogs) {
          const logIds = new Set<string>();
          this.data.auditLogs = this.data.auditLogs.map((log) => {
            if (logIds.has(log.id)) {
              log.id = `${log.id}-${Math.random().toString(36).substring(2, 6)}`;
            }
            logIds.add(log.id);
            return log;
          });
        }

        // Ensure users list exists and is well-formed
        if (!this.data.users || this.data.users.length === 0) {
          this.data.users = JSON.parse(JSON.stringify(SEED_DATA.users));
        } else {
          // Patch all users to ensure valid passwords
          this.data.users = this.data.users.map(u => {
            if (u.id === "usr-super") {
              return { ...u, password: u.password || "munaf786" };
            }
            return { ...u, password: u.password || "1234" };
          });

          // Ensure super admin exists
          const hasSuper = this.data.users.some(u => u.id === "usr-super" || u.role === UserRole.SUPER_ADMIN);
          if (!hasSuper) {
            const defaultSuper = SEED_DATA.users.find(u => u.id === "usr-super");
            if (defaultSuper) {
              this.data.users.unshift(defaultSuper);
            }
          }
        }
        this.save(true);

        // Patch hospitals with all medical departments
        if (this.data.hospitals) {
          this.data.hospitals = this.data.hospitals.map(h => {
            const existingDepts = h.departments || [];
            const mergedDepts = Array.from(new Set([...existingDepts, ...DEFAULT_DEPARTMENTS]));
            return { ...h, departments: mergedDepts };
          });
          this.save(true);
        }

        // Initialize role permissions
        if (!this.data.rolePermissions) {
          this.data.rolePermissions = this.getDefaultRolePermissions();
          this.save(true);
        }
      } catch (e) {
        this.data = JSON.parse(JSON.stringify(SEED_DATA));
        this.data.rolePermissions = this.getDefaultRolePermissions();
        this.save(true);
      }
    } else {
      this.data = JSON.parse(JSON.stringify(SEED_DATA));
      this.data.rolePermissions = this.getDefaultRolePermissions();
      this.save(true);
    }

    // Start background Firebase Firestore Real-Time Listener
    this.initCloudSync();
  }

  private initCloudSync() {
    try {
      const stateDocRef = doc(firestore, "app_state", "global_erp");
      onSnapshot(stateDocRef, (snap) => {
        if (snap.exists()) {
          const docData = snap.data();
          if (docData && docData.data) {
            try {
              const currentLocalStr = JSON.stringify(this.data);
              if (docData.data !== currentLocalStr) {
                const remoteData: SystemDB = JSON.parse(docData.data);
                if (remoteData && Array.isArray(remoteData.hospitals) && Array.isArray(remoteData.users)) {
                  // Remote update received from Firebase that is actually different
                  this.isApplyingRemoteUpdate = true;
                  this.data = remoteData;
                  localStorage.setItem(LOCAL_STORAGE_KEY, docData.data);
                  this.cloudStatus = "connected";
                  this.lastSyncedAt = new Date().toLocaleTimeString();
                  this.notifySubscribers();
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("carematrix_db_updated", { detail: this.data }));
                  }
                  this.isApplyingRemoteUpdate = false;
                }
              }
            } catch (err) {
              console.warn("Could not parse Firestore remote database payload", err);
            }
          }
        } else {
          // Document does not exist in Firebase Firestore yet (first init) -> push local state
          this.pushToFirestore();
        }
        this.cloudStatus = "connected";
        this.lastSyncedAt = new Date().toLocaleTimeString();
      }, (err) => {
        console.warn("Firestore onSnapshot error:", err);
        this.cloudStatus = "offline";
      });
    } catch (err) {
      console.warn("Failed to initialize Firebase Cloud Sync", err);
      this.cloudStatus = "offline";
    }
  }

  private async pushToFirestore() {
    try {
      const stateDocRef = doc(firestore, "app_state", "global_erp");
      await setDoc(stateDocRef, {
        data: JSON.stringify(this.data),
        updatedAt: new Date().toISOString(),
        clientTimestamp: Date.now()
      }, { merge: true });
      this.cloudStatus = "connected";
      this.lastSyncedAt = new Date().toLocaleTimeString();
    } catch (err) {
      console.warn("Error pushing to Google Firebase Firestore", err);
    }
  }

  private notifySubscribers() {
    this.listeners.forEach(fn => {
      try {
        fn(this.data);
      } catch (e) {
        console.error("Error in DB subscriber callback", e);
      }
    });
  }

  public subscribe(fn: (data: SystemDB) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  public getCloudStatus(): { status: "connected" | "syncing" | "offline"; lastSyncedAt: string | null } {
    return {
      status: this.cloudStatus,
      lastSyncedAt: this.lastSyncedAt
    };
  }

  public async syncWithCloud(): Promise<boolean> {
    try {
      this.cloudStatus = "syncing";
      this.notifySubscribers();
      await this.pushToFirestore();
      return true;
    } catch (e) {
      this.cloudStatus = "offline";
      this.notifySubscribers();
      return false;
    }
  }

  private save(skipCloudSync = false) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.data));
    } catch (err) {
      console.warn("Local storage write error:", err);
    }

    this.notifySubscribers();

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("carematrix_db_updated", { detail: this.data }));
    }

    if (!skipCloudSync && !this.isApplyingRemoteUpdate) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = setTimeout(() => {
        this.pushToFirestore();
      }, 250);
    }
  }

  // Hospitals
  getHospitals(): Hospital[] {
    return this.data.hospitals;
  }

  addHospital(hospital: Hospital) {
    this.data.hospitals.push(hospital);
    // Initialize blood stock for new hospital
    this.data.bloodStock[hospital.id] = {
      hospitalId: hospital.id,
      "A+": 0, "A-": 0, "B+": 0, "B-": 0, "AB+": 0, "AB-": 0, "O+": 0, "O-": 0
    };
    this.save();
    this.logAction(hospital.id, "system", "Super Admin", UserRole.SUPER_ADMIN, "Register Hospital", `Created hospital ${hospital.name} with ${hospital.plan} plan`);
  }

  updateHospital(hospitalId: string, updates: Partial<Hospital>) {
    this.data.hospitals = this.data.hospitals.map(h => 
      h.id === hospitalId ? { ...h, ...updates, updatedAt: new Date().toISOString() } : h
    );
    this.save();
  }

  deleteHospital(hospitalId: string) {
    this.data.hospitals = this.data.hospitals.filter(h => h.id !== hospitalId);
    this.data.users = this.data.users.filter(u => u.hospitalId !== hospitalId);
    if (this.data.doctors) {
      this.data.doctors = this.data.doctors.filter(d => d.hospitalId !== hospitalId);
    }
    if (this.data.staff) {
      this.data.staff = this.data.staff.filter(s => s.hospitalId !== hospitalId);
    }
    this.data.patients = this.data.patients.filter(p => p.hospitalId !== hospitalId);
    this.data.appointments = this.data.appointments.filter(a => a.hospitalId !== hospitalId);
    this.data.ipd = this.data.ipd.filter(i => i.hospitalId !== hospitalId);
    this.data.opd = this.data.opd.filter(o => o.hospitalId !== hospitalId);
    this.data.beds = this.data.beds.filter(b => b.hospitalId !== hospitalId);
    this.data.medicines = this.data.medicines.filter(m => m.hospitalId !== hospitalId);
    this.data.labTests = this.data.labTests.filter(t => t.hospitalId !== hospitalId);
    this.data.billing = this.data.billing.filter(b => b.hospitalId !== hospitalId);
    this.data.ambulances = this.data.ambulances.filter(a => a.hospitalId !== hospitalId);
    this.data.bloodDonors = this.data.bloodDonors.filter(d => d.hospitalId !== hospitalId);
    this.data.inventory = this.data.inventory.filter(i => i.hospitalId !== hospitalId);
    this.data.employees = this.data.employees.filter(e => e.hospitalId !== hospitalId);
    
    if (this.data.bloodTransactions) {
      this.data.bloodTransactions = this.data.bloodTransactions.filter(tx => tx.hospitalId !== hospitalId);
    }
    if (this.data.medicinePurchases) {
      this.data.medicinePurchases = this.data.medicinePurchases.filter(p => p.hospitalId !== hospitalId);
    }
    if (this.data.expenses) {
      this.data.expenses = this.data.expenses.filter(e => e.hospitalId !== hospitalId);
    }
    if (this.data.bloodStock) {
      delete this.data.bloodStock[hospitalId];
    }
    
    this.save();
    this.logAction(null, "system", "Super Admin", UserRole.SUPER_ADMIN, "Delete Hospital", `Deleted hospital ${hospitalId} and all associated data`);
  }

  resetHospitalData(hospitalId: string, userId: string, userName: string, userRole: UserRole) {
    this.data.patients = this.data.patients.filter(p => p.hospitalId !== hospitalId);
    this.data.appointments = this.data.appointments.filter(a => a.hospitalId !== hospitalId);
    this.data.ipd = this.data.ipd.filter(i => i.hospitalId !== hospitalId);
    this.data.opd = this.data.opd.filter(o => o.hospitalId !== hospitalId);
    this.data.beds = this.data.beds.filter(b => b.hospitalId !== hospitalId);
    this.data.medicines = this.data.medicines.filter(m => m.hospitalId !== hospitalId);
    this.data.labTests = this.data.labTests.filter(t => t.hospitalId !== hospitalId);
    this.data.billing = this.data.billing.filter(b => b.hospitalId !== hospitalId);
    this.data.ambulances = this.data.ambulances.filter(a => a.hospitalId !== hospitalId);
    this.data.bloodDonors = this.data.bloodDonors.filter(d => d.hospitalId !== hospitalId);
    this.data.inventory = this.data.inventory.filter(i => i.hospitalId !== hospitalId);
    this.data.employees = this.data.employees.filter(e => e.hospitalId !== hospitalId);
    
    if (this.data.medicinePurchases) {
      this.data.medicinePurchases = this.data.medicinePurchases.filter(p => p.hospitalId !== hospitalId);
    }
    if (this.data.expenses) {
      this.data.expenses = this.data.expenses.filter(e => e.hospitalId !== hospitalId);
    }

    this.data.bloodStock[hospitalId] = {
      hospitalId,
      "A+": 0, "A-": 0, "B+": 0, "B-": 0, "AB+": 0, "AB-": 0, "O+": 0, "O-": 0
    };

    this.save();
    this.logAction(hospitalId, userId, userName, userRole, "Master Reset", `Performed master data reset for hospital ${hospitalId}`);
  }

  // Users / Auth
  getUsers(): UserProfile[] {
    return this.data.users;
  }

  addUser(user: UserProfile) {
    this.data.users.push(user);
    this.save();
    this.logAction(user.hospitalId, user.id, user.name, user.role, "Create User", `Registered user profile ${user.name} (${user.role})`);
  }

  updateUser(userId: string, updates: Partial<UserProfile>) {
    this.data.users = this.data.users.map(u => 
      u.id === userId ? { ...u, ...updates, updatedAt: new Date().toISOString() } : u
    );
    this.save();
  }

  getDefaultRolePermissions(): { [role: string]: string[] } {
    const defaultDoctorPerms = ["dashboard", "patients", "appointments", "opd", "ipd", "lab", "emergency", "pharmacy", "billing", "reports", "settings"];
    const perms: { [role: string]: string[] } = {
      [UserRole.SUPER_ADMIN]: ["dashboard", "patients", "appointments", "opd", "ipd", "lab", "emergency", "pharmacy", "billing", "hr", "reports", "settings", "superadmin"],
      [UserRole.HOSPITAL_ADMIN]: ["dashboard", "patients", "appointments", "opd", "ipd", "lab", "emergency", "pharmacy", "billing", "hr", "reports", "settings"],
      [UserRole.DOCTOR]: defaultDoctorPerms,
      [UserRole.NURSE]: ["dashboard", "patients", "appointments", "opd", "ipd", "lab", "emergency", "pharmacy"],
      [UserRole.RECEPTIONIST]: ["dashboard", "patients", "appointments", "billing"],
      [UserRole.PHARMACIST]: ["dashboard", "pharmacy", "billing"],
      [UserRole.LAB_TECHNICIAN]: ["dashboard", "lab"],
      [UserRole.ACCOUNTANT]: ["dashboard", "billing", "hr", "reports"],
      [UserRole.PATIENT]: ["patients", "appointments"]
    };

    const specialistRoles = [
      UserRole.PATHOLOGIST, UserRole.RADIOLOGIST, UserRole.SURGEON, UserRole.CARDIOLOGIST,
      UserRole.PEDIATRICIAN, UserRole.DENTIST, UserRole.PSYCHIATRIST, UserRole.ORTHOPEDIC,
      UserRole.DERMATOLOGIST, UserRole.NEUROLOGIST, UserRole.OPHTHALMOLOGIST, UserRole.GYNECOLOGIST,
      UserRole.ANESTHESIOLOGIST, UserRole.GENERAL_PRACTITIONER, UserRole.ENT_SPECIALIST, UserRole.ONCOLOGIST
    ];

    specialistRoles.forEach(role => {
      perms[role] = [...defaultDoctorPerms];
    });

    return perms;
  }

  getRolePermissions(): { [role: string]: string[] } {
    if (!this.data.rolePermissions) {
      this.data.rolePermissions = this.getDefaultRolePermissions();
    }
    return this.data.rolePermissions;
  }

  updateRolePermissions(role: string, permissions: string[]) {
    if (!this.data.rolePermissions) {
      this.data.rolePermissions = this.getDefaultRolePermissions();
    }
    this.data.rolePermissions[role] = permissions;
    this.save();
  }

  hasPermission(role: string, moduleName: string): boolean {
    const perms = this.getRolePermissions();
    return perms[role]?.includes(moduleName) || false;
  }

  // Patients
  getPatients(hospitalId: string): Patient[] {
    return this.data.patients.filter(p => p.hospitalId === hospitalId);
  }

  addPatient(patient: Patient, userId: string, userName: string, userRole: UserRole) {
    this.data.patients.push(patient);
    this.save();
    this.logAction(patient.hospitalId, userId, userName, userRole, "Patient Registration", `Registered patient ${patient.name} (${patient.id})`);
  }

  updatePatient(patientId: string, updates: Partial<Patient>) {
    this.data.patients = this.data.patients.map(p => 
      p.id === patientId ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
    );
    this.save();
  }

  // Doctors
  getDoctors(hospitalId: string): Doctor[] {
    return this.data.doctors.filter(d => d.hospitalId === hospitalId && d.isActive !== false);
  }

  addDoctor(doctor: Doctor) {
    this.data.doctors.push(doctor);
    this.save();
  }

  updateDoctorStatus(doctorId: string, status: "Available" | "On Leave" | "Busy") {
    this.data.doctors = this.data.doctors.map(d => 
      d.id === doctorId ? { ...d, status } : d
    );
    this.save();
  }

  // Staff
  getStaff(hospitalId: string): Staff[] {
    return this.data.staff.filter(s => s.hospitalId === hospitalId);
  }

  addStaff(staff: Staff) {
    this.data.staff.push(staff);
    this.save();
  }

  // Appointments
  getAppointments(hospitalId: string): Appointment[] {
    return this.data.appointments.filter(a => a.hospitalId === hospitalId);
  }

  addAppointment(appointment: Appointment, userId: string, userName: string, userRole: UserRole) {
    this.data.appointments.push(appointment);
    this.save();
    this.logAction(appointment.hospitalId, userId, userName, userRole, "Book Appointment", `Booked appointment for ${appointment.patientName} with ${appointment.doctorName}`);
  }

  updateAppointmentStatus(appointmentId: string, status: "Scheduled" | "Completed" | "Cancelled" | "Rescheduled") {
    this.data.appointments = this.data.appointments.map(a => 
      a.id === appointmentId ? { ...a, status, updatedAt: new Date().toISOString() } : a
    );
    this.save();
  }

  // OPD Records
  getOPD(hospitalId: string): OPDRecord[] {
    return this.data.opd.filter(o => o.hospitalId === hospitalId);
  }

  addOPD(record: OPDRecord, userId: string, userName: string, userRole: UserRole) {
    this.data.opd.push(record);
    this.save();
    this.logAction(record.hospitalId, userId, userName, userRole, "OPD Session Created", `Saved diagnosis for ${record.patientName}`);
  }

  // IPD Records
  getIPD(hospitalId: string): IPDRecord[] {
    return this.data.ipd.filter(i => i.hospitalId === hospitalId);
  }

  addIPD(record: IPDRecord, userId: string, userName: string, userRole: UserRole) {
    this.data.ipd.push(record);
    // Occupy Bed
    this.data.beds = this.data.beds.map(b => 
      b.id === record.bedId ? { ...b, status: "Occupied", patientId: record.patientId, patientName: record.patientName } : b
    );
    this.save();
    this.logAction(record.hospitalId, userId, userName, userRole, "IPD Admission", `Admitted patient ${record.patientName} to bed ${record.bedNumber}`);
  }

  dischargeIPD(ipdId: string, dischargeSummary: any, userId: string, userName: string, userRole: UserRole) {
    const record = this.data.ipd.find(i => i.id === ipdId);
    if (!record) return;

    this.data.ipd = this.data.ipd.map(i => 
      i.id === ipdId ? { ...i, status: "Discharged", dischargeDate: getLocalDateStr(), dischargeSummary } : i
    );
    // Free Bed
    this.data.beds = this.data.beds.map(b => 
      b.id === record.bedId ? { ...b, status: "Available", patientId: undefined, patientName: undefined } : b
    );
    this.save();
    this.logAction(record.hospitalId, userId, userName, userRole, "IPD Discharge", `Discharged patient ${record.patientName}`);
  }

  // Beds
  getBeds(hospitalId: string): Bed[] {
    const beds = this.data.beds.filter(b => b.hospitalId === hospitalId);
    if (beds.length === 0) {
      // Seed default beds for new hospital
      const defaultBeds: Bed[] = [
        { id: `${hospitalId}-BED-G-01`, hospitalId, number: "G-101", type: "General Ward", status: "Available", ratePerDay: 500 },
        { id: `${hospitalId}-BED-G-02`, hospitalId, number: "G-102", type: "General Ward", status: "Available", ratePerDay: 500 },
        { id: `${hospitalId}-BED-P-01`, hospitalId, number: "PVT-201", type: "Private Suite", status: "Available", ratePerDay: 3000 },
        { id: `${hospitalId}-BED-ICU-01`, hospitalId, number: "ICU-101", type: "ICU", status: "Available", ratePerDay: 6000 }
      ];
      this.data.beds.push(...defaultBeds);
      return defaultBeds;
    }
    return beds;
  }

  addBed(bed: Bed) {
    this.data.beds.push(bed);
    this.save();
  }

  deleteBed(bedId: string) {
    this.data.beds = this.data.beds.filter(b => b.id !== bedId);
    this.save();
  }

  // Pharmacy Medicines
  getMedicines(hospitalId: string): Medicine[] {
    return this.data.medicines.filter(m => m.hospitalId === hospitalId);
  }

  addMedicine(medicine: Medicine) {
    this.data.medicines.push(medicine);
    this.save();
  }

  sellMedicine(medicineId: string, quantity: number, userId: string, userName: string, userRole: UserRole) {
    this.data.medicines = this.data.medicines.map(m => 
      m.id === medicineId ? { ...m, stock: Math.max(0, m.stock - quantity) } : m
    );
    this.save();
  }

  restockMedicine(medicineId: string, qty: number) {
    this.data.medicines = this.data.medicines.map(m => 
      m.id === medicineId ? { ...m, stock: m.stock + qty } : m
    );
    this.save();
  }

  getMedicinePurchases(hospitalId: string): MedicinePurchase[] {
    if (!this.data.medicinePurchases) {
      this.data.medicinePurchases = [];
    }
    return this.data.medicinePurchases.filter(p => p.hospitalId === hospitalId);
  }

  getExpenses(hospitalId: string): Expense[] {
    if (!this.data.expenses) {
      this.data.expenses = [];
    }
    return this.data.expenses.filter(e => e.hospitalId === hospitalId);
  }

  addExpense(expense: Expense) {
    if (!this.data.expenses) {
      this.data.expenses = [];
    }
    this.data.expenses.push(expense);
    this.save();
  }

  deleteExpense(id: string) {
    if (this.data.expenses) {
      this.data.expenses = this.data.expenses.filter(e => e.id !== id);
      this.save();
    }
  }

  addMedicinePurchase(purchase: MedicinePurchase) {
    if (!this.data.medicinePurchases) {
      this.data.medicinePurchases = [];
    }
    this.data.medicinePurchases.push(purchase);
    
    // Auto-restock the medicine stock when purchased
    this.data.medicines = this.data.medicines.map(m => 
      m.id === purchase.medicineId 
        ? { ...m, stock: m.stock + purchase.quantity, expiryDate: purchase.expiryDate } 
        : m
    );
    
    this.save();
  }

  // Laboratory & Radiology Lab Tests
  getLabTests(hospitalId: string): LabTest[] {
    return this.data.labTests.filter(t => t.hospitalId === hospitalId);
  }

  addLabTest(test: LabTest, userId: string, userName: string, userRole: UserRole) {
    this.data.labTests.push(test);
    this.save();
    this.logAction(test.hospitalId, userId, userName, userRole, "Test Booked", `Booked ${test.testName} for ${test.patientName}`);
  }

  updateLabTestResult(
    testId: string, 
    results: string, 
    isRadiology = false, 
    imageUrl?: string, 
    doctorId?: string, 
    doctorName?: string, 
    doctorSpecialization?: string,
    referredBy?: string
  ) {
    this.data.labTests = this.data.labTests.map(t => 
      t.id === testId ? { 
        ...t, 
        results, 
        status: "Completed", 
        resultDate: new Date().toISOString().split("T")[0],
        radiologyImageUrl: imageUrl || t.radiologyImageUrl,
        doctorId: doctorId || t.doctorId,
        doctorName: doctorName || t.doctorName,
        doctorSpecialization: doctorSpecialization || t.doctorSpecialization,
        referredBy: referredBy || t.referredBy
      } : t
    );
    this.save();
  }

  collectSample(testId: string) {
    this.data.labTests = this.data.labTests.map(t => 
      t.id === testId ? { 
        ...t, 
        sampleCollected: true, 
        sampleCollectionDate: new Date().toISOString().split("T")[0],
        status: "Sample Collected"
      } : t
    );
    this.save();
  }

  // Billing
  getBillingInvoices(hospitalId: string): BillingInvoice[] {
    return this.data.billing.filter(b => b.hospitalId === hospitalId);
  }

  addBillingInvoice(invoice: BillingInvoice, userId: string, userName: string, userRole: UserRole) {
    this.data.billing.push(invoice);
    this.save();
    this.logAction(invoice.hospitalId, userId, userName, userRole, "Invoice Issued", `Issued Invoice ${invoice.id} for ${invoice.patientName} (${invoice.total})`);
  }

  updateInvoiceStatus(invoiceId: string, status: "Paid" | "Pending" | "Refunded", paymentMethod?: "Cash" | "Card" | "UPI" | "Insurance") {
    this.data.billing = this.data.billing.map(b => 
      b.id === invoiceId ? { ...b, status, paymentMethod: paymentMethod || b.paymentMethod } : b
    );
    this.save();
  }

  // Ambulance
  getAmbulances(hospitalId: string): Ambulance[] {
    const amb = this.data.ambulances.filter(a => a.hospitalId === hospitalId);
    if (amb.length === 0) {
      const defaultAmb: Ambulance[] = [
        { id: `${hospitalId}-AMB-01`, hospitalId, vehicleNumber: "MH-01-AX-9988", model: "Trauma Care Standard", driverName: "Raju Prasad", driverPhone: "+91 99001-12233", status: "Available", trips: [] }
      ];
      this.data.ambulances.push(...defaultAmb);
      return defaultAmb;
    }
    return amb;
  }

  updateAmbulanceStatus(ambulanceId: string, status: "Available" | "On Trip" | "Maintenance") {
    this.data.ambulances = this.data.ambulances.map(a => 
      a.id === ambulanceId ? { ...a, status } : a
    );
    this.save();
  }

  addAmbulanceTrip(ambulanceId: string, destination: string, purpose: string) {
    this.data.ambulances = this.data.ambulances.map(a => {
      if (a.id === ambulanceId) {
        return {
          ...a,
          status: "On Trip" as const,
          trips: [
            ...a.trips,
            {
              date: new Date().toISOString().split("T")[0],
              destination,
              purpose,
              status: "Active" as const
            }
          ]
        };
      }
      return a;
    });
    this.save();
  }

  completeAmbulanceTrips(ambulanceId: string) {
    this.data.ambulances = this.data.ambulances.map(a => {
      if (a.id === ambulanceId) {
        return {
          ...a,
          status: "Available" as const,
          trips: a.trips.map(t => t.status === "Active" ? { ...t, status: "Completed" as const } : t)
        };
      }
      return a;
    });
    this.save();
  }

  addAmbulance(ambulance: Ambulance) {
    this.data.ambulances.push(ambulance);
    this.save();
  }

  // Blood Bank
  getBloodDonors(hospitalId: string): BloodDonor[] {
    return this.data.bloodDonors.filter(b => b.hospitalId === hospitalId);
  }

  getBloodTransactions(hospitalId: string): BloodTransaction[] {
    if (!this.data.bloodTransactions) {
      this.data.bloodTransactions = [];
    }
    return this.data.bloodTransactions.filter(t => t.hospitalId === hospitalId);
  }

  addBloodTransaction(tx: BloodTransaction) {
    if (!this.data.bloodTransactions) {
      this.data.bloodTransactions = [];
    }
    this.data.bloodTransactions.push(tx);
    this.save();
  }

  addBloodDonor(donor: BloodDonor) {
    this.data.bloodDonors.push(donor);
    // Add to stock
    this.addBloodUnits(donor.hospitalId, donor.bloodGroup, 1);
    
    // Automatically log incoming transaction
    const tx: BloodTransaction = {
      id: `TX-${Math.floor(1000 + Math.random() * 9000)}`,
      hospitalId: donor.hospitalId,
      date: new Date().toISOString().split("T")[0],
      type: "Incoming",
      bloodGroup: donor.bloodGroup,
      units: 1,
      personName: donor.name,
      purpose: "Blood Donation"
    };
    this.addBloodTransaction(tx);
  }

  getBloodStock(hospitalId: string): BloodStock {
    // Dynamically calculate blood stock based on actual blood transaction ledger entries to eliminate mock sample data
    const stock: BloodStock = {
      hospitalId,
      "A+": 0, "A-": 0, "B+": 0, "B-": 0, "AB+": 0, "AB-": 0, "O+": 0, "O-": 0
    };

    const txs = this.getBloodTransactions(hospitalId);
    txs.forEach(tx => {
      const bg = tx.bloodGroup as keyof BloodStock;
      if (bg !== "hospitalId" && typeof stock[bg] === "number") {
        if (tx.type === "Incoming") {
          (stock[bg] as number) += tx.units;
        } else if (tx.type === "Outgoing") {
          (stock[bg] as number) -= tx.units;
        }
      }
    });

    this.data.bloodStock[hospitalId] = stock;
    return stock;
  }

  addBloodUnits(hospitalId: string, bloodGroup: keyof BloodStock, units: number, personName?: string, purpose?: string) {
    const stock = this.getBloodStock(hospitalId);
    if (typeof stock[bloodGroup] === "number") {
      (stock[bloodGroup] as number) += units;
    }
    
    // Log manual stock addition transaction if requested
    if (personName) {
      const tx: BloodTransaction = {
        id: `TX-${Math.floor(1000 + Math.random() * 9000)}`,
        hospitalId,
        date: new Date().toISOString().split("T")[0],
        type: "Incoming",
        bloodGroup: bloodGroup as any,
        units,
        personName: personName,
        purpose: purpose || "Manual Stock Intake"
      };
      this.addBloodTransaction(tx);
    } else {
      this.save();
    }
  }

  consumeBloodUnits(hospitalId: string, bloodGroup: keyof BloodStock, units: number, personName?: string, purpose?: string): boolean {
    const stock = this.getBloodStock(hospitalId);
    const current = (stock[bloodGroup] as number) || 0;
    if (current >= units) {
      (stock[bloodGroup] as number) -= units;
      
      // Automatically log outgoing transaction
      const tx: BloodTransaction = {
        id: `TX-${Math.floor(1000 + Math.random() * 9000)}`,
        hospitalId,
        date: new Date().toISOString().split("T")[0],
        type: "Outgoing",
        bloodGroup: bloodGroup as any,
        units,
        personName: personName || "Patient Case",
        purpose: purpose || "Medical Release"
      };
      this.addBloodTransaction(tx);
      return true;
    }
    return false;
  }

  // Inventory
  getInventory(hospitalId: string): InventoryItem[] {
    return this.data.inventory.filter(i => i.hospitalId === hospitalId);
  }

  addInventoryItem(item: InventoryItem) {
    this.data.inventory.push(item);
    this.save();
  }

  updateInventoryStock(itemId: string, stock: number) {
    this.data.inventory = this.data.inventory.map(i => 
      i.id === itemId ? { ...i, stock } : i
    );
    this.save();
  }

  // Human Resources & Attendance / Payroll
  getHRRecord(hospitalId: string): EmployeeHR[] {
    return this.data.employees.filter(e => e.hospitalId === hospitalId);
  }

  addEmployee(emp: EmployeeHR) {
    if (emp.isActive === undefined) emp.isActive = true;
    this.data.employees.push(emp);
    this.save();
  }

  toggleEmployeeActiveStatus(employeeId: string, isActive: boolean) {
    const employee = this.data.employees.find(e => e.id === employeeId);
    if (employee) {
      employee.isActive = isActive;
    }
    
    const user = this.data.users.find(u => u.id === employeeId);
    if (user) {
      user.status = isActive ? "Active" : "Inactive";
    }

    const staff = this.data.staff.find(s => s.id === employeeId);
    if (staff) {
      staff.status = isActive ? "Active" : "Inactive";
    }

    const doctor = this.data.doctors.find(d => d.id === employeeId);
    if (doctor) {
      doctor.isActive = isActive;
    }

    this.save();
  }

  deleteEmployee(employeeId: string) {
    this.data.employees = this.data.employees.filter(e => e.id !== employeeId);
    this.data.users = this.data.users.filter(u => u.id !== employeeId);
    this.data.staff = this.data.staff.filter(s => s.id !== employeeId);
    this.data.doctors = this.data.doctors.filter(d => d.id !== employeeId);
    this.save();
  }

  markAttendance(employeeId: string, date: string, status: "Present" | "Absent" | "Leave") {
    this.data.employees = this.data.employees.map(e => {
      if (e.id === employeeId) {
        return {
          ...e,
          attendance: {
            ...e.attendance,
            [date]: status
          }
        };
      }
      return e;
    });
    this.save();
  }

  addPayroll(
    employeeId: string,
    month: string,
    netPay: string,
    basic?: number,
    hra?: number,
    da?: number,
    bonus?: number,
    overtime?: number,
    pf?: number,
    profTax?: number
  ) {
    const payrollId = `PY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    this.data.employees = this.data.employees.map(e => {
      if (e.id === employeeId) {
        return {
          ...e,
          payrollHistory: [
            ...e.payrollHistory,
            {
              id: payrollId,
              month,
              netPay,
              status: "Paid",
              basic: basic ?? e.salary,
              hra: hra ?? 0,
              da: da ?? 0,
              bonus: bonus ?? 0,
              overtime: overtime ?? 0,
              pf: pf ?? 0,
              profTax: profTax ?? 0
            }
          ]
        };
      }
      return e;
    });
    this.save();
    return payrollId;
  }

  deletePayroll(employeeId: string, payrollIdOrMonth: string) {
    this.data.employees = this.data.employees.map(e => {
      if (e.id === employeeId) {
        return {
          ...e,
          payrollHistory: e.payrollHistory.filter(
            p => p.id !== payrollIdOrMonth && p.month !== payrollIdOrMonth
          )
        };
      }
      return e;
    });
    this.save();
  }

  // Audit Logging
  getAuditLogs(hospitalId: string | null): AuditLog[] {
    if (hospitalId === null) return this.data.auditLogs; // Super Admin sees all
    return this.data.auditLogs.filter(l => l.hospitalId === hospitalId);
  }

  logAction(hospitalId: string | null, userId: string, userName: string, userRole: UserRole, action: string, details: string) {
    const newLog: AuditLog = {
      id: `LOG-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      hospitalId,
      userId,
      userName,
      userRole,
      action,
      details,
      timestamp: new Date().toISOString()
    };
    this.data.auditLogs.unshift(newLog); // Newest first
    if (this.data.auditLogs.length > 500) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 500); // Limit to 500 items
    }
    this.save();
  }

  // Backup and Restore helper
  getBackupJSON(): string {
    return JSON.stringify(this.data, null, 2);
  }

  restoreBackup(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.hospitals && parsed.users && parsed.patients) {
        this.data = parsed;
        this.save();
        return true;
      }
    } catch (e) {
      console.error("Failed to restore backup", e);
    }
    return false;
  }
}

export const DB = new CareMatrixDatabase();
export { firestore, auth };
