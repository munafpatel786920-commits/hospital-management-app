/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { DB, getLocalDateStr } from "../lib/db";
import { 
  Appointment, OPDRecord, IPDRecord, Bed, LabTest, 
  Ambulance, BloodDonor, UserRole, Patient, BloodTransaction 
} from "../types";
import { translate, formatDate, formatCurrency } from "../lib/i18n";
import { jsPDF } from "jspdf";
import { 
  Calendar, Stethoscope, BedDouble, FileSpreadsheet, Activity, 
  Truck, Droplets, Plus, Clock, FileText, CheckCircle, AlertCircle, XCircle, X,
  Search, History, Printer
} from "lucide-react";

interface ClinicalModulesProps {
  hospitalId: string;
  countryCode: string;
  currentLanguage: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  onLogAction: (action: string, details: string) => void;
  activeSubTab: "appointments" | "opd" | "ipd" | "lab" | "emergency";
}

export default function ClinicalModules({
  hospitalId,
  countryCode,
  currentLanguage,
  userId,
  userName,
  userRole,
  onLogAction,
  activeSubTab
}: ClinicalModulesProps) {
  // Shared patient listing for drop-downs
  const currentHospital = DB.getHospitals().find(h => h.id === hospitalId);
  const currentHospitalName = currentHospital?.name || "CareMatrix Hospital";
  const currentHospitalLogo = currentHospital?.logoUrl || "";

  const patients: Patient[] = DB.getPatients(hospitalId);
  const doctors = DB.getDoctors(hospitalId);

  // States
  const [appointments, setAppointments] = useState<Appointment[]>(DB.getAppointments(hospitalId));
  const [opdRecords, setOpdRecords] = useState<OPDRecord[]>(DB.getOPD(hospitalId));
  const [ipdRecords, setIpdRecords] = useState<IPDRecord[]>(DB.getIPD(hospitalId));
  const [beds, setBeds] = useState<Bed[]>(DB.getBeds(hospitalId));
  const [labTests, setLabTests] = useState<LabTest[]>(DB.getLabTests(hospitalId));
  const [ambulances, setAmbulances] = useState<Ambulance[]>(DB.getAmbulances(hospitalId));
  const [bloodStock, setBloodStock] = useState(DB.getBloodStock(hospitalId));
  const [donors, setDonors] = useState<BloodDonor[]>(DB.getBloodDonors(hospitalId));
  const [bloodTransactions, setBloodTransactions] = useState<BloodTransaction[]>(DB.getBloodTransactions(hospitalId));
  const [bloodSearch, setBloodSearch] = useState("");
  const [donorAddress, setDonorAddress] = useState("");
  const [lastRegisteredDonor, setLastRegisteredDonor] = useState<BloodDonor | null>(null);
  const [opdSearch, setOpdSearch] = useState("");
  const [diagSearch, setDiagSearch] = useState("");

  // --- 1. APPOINTMENT STATE & HANDLERS ---
  const [aptPatientId, setAptPatientId] = useState("");
  const [aptDoctorId, setAptDoctorId] = useState("");
  const [aptDate, setAptDate] = useState("");
  const [aptTime, setAptTime] = useState("");
  const [aptReason, setAptReason] = useState("");

  const handleBookAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aptPatientId || !aptDoctorId || !aptDate || !aptTime) return;

    const patient = patients.find(p => p.id === aptPatientId);
    const doctor = doctors.find(d => d.id === aptDoctorId);
    if (!patient || !doctor) return;

    const newApt: Appointment = {
      id: `APT-${Math.floor(1000 + Math.random() * 9000)}`,
      hospitalId,
      patientId: patient.id,
      patientName: patient.name,
      doctorId: doctor.id,
      doctorName: doctor.name,
      date: aptDate,
      time: aptTime,
      status: "Scheduled",
      reason: aptReason,
      consultationFee: doctor.consultationFee,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    DB.addAppointment(newApt, userId, userName, userRole);
    setAppointments(DB.getAppointments(hospitalId));
    
    // Reset Form
    setAptPatientId("");
    setAptDoctorId("");
    setAptDate("");
    setAptTime("");
    setAptReason("");
    
    onLogAction("Book Appointment", `Booked appointment ${newApt.id} for ${patient.name} with ${doctor.name}`);
  };

  const handleCancelAppointment = (id: string) => {
    DB.updateAppointmentStatus(id, "Cancelled");
    setAppointments(DB.getAppointments(hospitalId));
    onLogAction("Cancel Appointment", `Cancelled appointment ${id}`);
  };

  // --- 2. OPD STATE & HANDLERS ---
  const [opdPatientId, setOpdPatientId] = useState("");
  const [opdDoctorId, setOpdDoctorId] = useState("");
  const [opdSymptoms, setOpdSymptoms] = useState("");
  const [opdDiagnosis, setOpdDiagnosis] = useState("");
  const [opdFollowUp, setOpdFollowUp] = useState("");
  
  // Single Prescription Line
  const [prescriptionMedicines, setPrescriptionMedicines] = useState<{name: string, dose: string, duration: string, inst: string}[]>([]);
  const [medName, setMedName] = useState("");
  const [medDose, setMedDose] = useState("1-0-1");
  const [medDuration, setMedDuration] = useState("5 Days");
  const [medInstructions, setMedInstructions] = useState("After Food");

  const addMedLine = () => {
    if (!medName) return;
    setPrescriptionMedicines([...prescriptionMedicines, { name: medName, dose: medDose, duration: medDuration, inst: medInstructions }]);
    setMedName("");
  };

  const handleSaveOPD = (e: React.FormEvent) => {
    e.preventDefault();
    if (!opdPatientId || !opdDoctorId || !opdSymptoms || !opdDiagnosis) return;

    const patient = patients.find(p => p.id === opdPatientId);
    const doctor = doctors.find(d => d.id === opdDoctorId);
    if (!patient || !doctor) return;

    const opdRec: OPDRecord = {
      id: `OPD-${Math.floor(5000 + Math.random() * 900)}`,
      hospitalId,
      patientId: patient.id,
      patientName: patient.name,
      doctorId: doctor.id,
      doctorName: doctor.name,
      visitDate: getLocalDateStr(),
      symptoms: opdSymptoms,
      diagnosis: opdDiagnosis,
      prescription: prescriptionMedicines.map((m, idx) => ({
        medicineId: `MED-${100 + idx}`,
        medicineName: m.name,
        dosage: m.dose,
        duration: m.duration,
        instructions: m.inst
      })),
      followUpDate: opdFollowUp || undefined,
      billingStatus: "Pending",
      createdAt: new Date().toISOString()
    };

    DB.addOPD(opdRec, userId, userName, userRole);
    setOpdRecords(DB.getOPD(hospitalId));

    // Create a pending bill for this OPD consultation
    const totalConsultationFee = doctor.consultationFee;
    const items = [{ description: `OPD Consultation: ${doctor.name}`, amount: totalConsultationFee }];
    const subtotal = totalConsultationFee;
    const taxAmount = Math.round(subtotal * 0.18); // default 18% GST/Tax

    DB.addBillingInvoice({
      id: `INV-${Math.floor(200000 + Math.random() * 90000)}`,
      hospitalId,
      patientId: patient.id,
      patientName: patient.name,
      type: "OPD",
      items,
      subtotal,
      taxAmount,
      discount: 0,
      total: subtotal + taxAmount,
      status: "Pending",
      createdAt: new Date().toISOString()
    }, userId, userName, userRole);

    // Reset Form
    setOpdPatientId("");
    setOpdDoctorId("");
    setOpdSymptoms("");
    setOpdDiagnosis("");
    setOpdFollowUp("");
    setPrescriptionMedicines([]);

    onLogAction("Create OPD Consultation", `Logged clinical findings & digital prescription for ${patient.name}`);
  };

  const handlePrintPrescription = (rec: OPDRecord) => {
    const hospital = DB.getHospitals().find(h => h.id === hospitalId);
    const hospitalName = hospital?.name || "St. Mary General Hospital";
    const hospitalLogo = hospital?.logoUrl || "";

    const logoHtml = hospitalLogo 
      ? `<img src="${hospitalLogo}" alt="Logo" style="height: 48px; object-fit: contain; margin-right: 16px;" />` 
      : ``;

    const docHTML = `
      <div style="font-family: sans-serif; max-width: 600px; padding: 30px; border: 1px solid #e2e8f0; border-radius: 8px; margin: 20px auto;">
        <div style="border-bottom: 2px solid #0d9488; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between;">
          <div style="display: flex; align-items: center;">
            ${logoHtml}
            <div>
              <h1 style="color: #0d9488; margin: 0; font-size: 24px;">${hospitalName} OPD Prescription</h1>
              <p style="margin: 4px 0 0 0; color: #64748b; font-size: 12px;">Universal Outpatient Clinical Log</p>
            </div>
          </div>
          <div style="text-align: right; color: #475569; font-size: 13px;">
            <div><strong>Prescription #:</strong> ${rec.id}</div>
            <div><strong>Date:</strong> ${rec.visitDate}</div>
          </div>
        </div>
        <div style="margin-bottom: 20px; display: grid; grid-template-cols: 1fr 1fr; gap: 15px; font-size: 14px; color: #1e293b;">
          <div><strong>Patient Name:</strong> ${rec.patientName} (${rec.patientId})</div>
          <div style="text-align: right;"><strong>Consultant Doctor:</strong> ${rec.doctorName}</div>
        </div>
        <div style="margin-bottom: 15px; background: #f8fafc; padding: 12px; border-radius: 6px; font-size: 13px;">
          <div><strong>Symptoms / Presenting Complaints:</strong></div>
          <div style="margin-top: 4px; color: #475569;">${rec.symptoms}</div>
        </div>
        <div style="margin-bottom: 20px; background: #f0fdfa; padding: 12px; border-radius: 6px; font-size: 13px;">
          <div><strong>Clinical Diagnosis:</strong></div>
          <div style="margin-top: 4px; color: #0f766e; font-weight: 600;">${rec.diagnosis}</div>
        </div>
        <div style="margin-top: 25px;">
          <h3 style="border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; color: #0d9488; margin-bottom: 10px;">℞ Prescribed Medications</h3>
          <table style="width: 100%; text-align: left; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background: #f1f5f9; color: #475569;">
                <th style="padding: 8px;">Medicine Name</th>
                <th style="padding: 8px;">Dosage Pattern</th>
                <th style="padding: 8px;">Duration</th>
                <th style="padding: 8px;">Instruction</th>
              </tr>
            </thead>
            <tbody>
              ${rec.prescription.map(p => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 8px; font-weight: 600;">${p.medicineName}</td>
                  <td style="padding: 8px;">${p.dosage}</td>
                  <td style="padding: 8px;">${p.duration}</td>
                  <td style="padding: 8px; color: #64748b;">${p.instructions}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
        ${rec.followUpDate ? `
          <div style="margin-top: 30px; border-top: 1px dashed #cbd5e1; padding-top: 15px; font-size: 13px; color: #0f766e;">
            <strong>Suggested Follow-up Consultation Date:</strong> ${rec.followUpDate}
          </div>
        ` : ""}
      </div>
    `;

    const win = window.open("", "_blank");
    if (win) {
      win.document.write(`<html><head><title>Print Digital Rx</title></head><body onload="window.print(); window.close();">${docHTML}</body></html>`);
      win.document.close();
    }
  };

  // --- 3. IPD STATE & HANDLERS ---
  const [ipdPatientId, setIpdPatientId] = useState("");
  const [ipdDoctorId, setIpdDoctorId] = useState("");
  const [ipdBedId, setIpdBedId] = useState("");
  const [ipdReason, setIpdReason] = useState("");
  const [showAddBedModal, setShowAddBedModal] = useState(false);
  const [newBedNumber, setNewBedNumber] = useState("");
  const [newBedType, setNewBedType] = useState<"General Ward" | "Semi-Private" | "Private Suite" | "ICU">("General Ward");
  const [newBedRate, setNewBedRate] = useState("1000");

  const handleAdmitIPD = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ipdPatientId || !ipdDoctorId || !ipdBedId || !ipdReason) return;

    const patient = patients.find(p => p.id === ipdPatientId);
    const doctor = doctors.find(d => d.id === ipdDoctorId);
    const bed = beds.find(b => b.id === ipdBedId);
    if (!patient || !doctor || !bed) return;

    const ipdRec: IPDRecord = {
      id: `IPD-${Math.floor(6000 + Math.random() * 900)}`,
      hospitalId,
      patientId: patient.id,
      patientName: patient.name,
      bedId: bed.id,
      bedNumber: bed.number,
      wardName: bed.type,
      admissionDate: getLocalDateStr(),
      doctorInChargeId: doctor.id,
      doctorInChargeName: doctor.name,
      reasonForAdmission: ipdReason,
      status: "Admitted",
      createdAt: new Date().toISOString()
    };

    DB.addIPD(ipdRec, userId, userName, userRole);
    setIpdRecords(DB.getIPD(hospitalId));
    setBeds(DB.getBeds(hospitalId));

    // Reset Form
    setIpdPatientId("");
    setIpdDoctorId("");
    setIpdBedId("");
    setIpdReason("");

    onLogAction("Inpatient Admission", `Admitted ${patient.name} to Bed ${bed.number} (${bed.type})`);
  };

  const handleAddBed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBedNumber || !newBedRate) return;

    const newBed: Bed = {
      id: `${hospitalId}-BED-${Math.random().toString(36).substr(2, 6)}`,
      hospitalId,
      number: newBedNumber,
      type: newBedType,
      status: "Available",
      ratePerDay: Number(newBedRate),
    };

    DB.addBed(newBed);
    setBeds(DB.getBeds(hospitalId));
    setShowAddBedModal(false);
    onLogAction("Add Bed", `Added new bed ${newBedNumber} (${newBedType})`);

    setNewBedNumber("");
    setNewBedType("General Ward");
    setNewBedRate("1000");
  };

  const handleDischargePatient = (ipdId: string) => {
    const dischargeSummary = {
      conditionAtDischarge: "Stable & Recovering",
      medications: "Amoxicillin 500mg (1-0-1) for 5 days",
      followUpInstructions: "Rest for 1 week. Avoid heavy exercises. Review in OPD in 10 days."
    };

    const record = ipdRecords.find(r => r.id === ipdId);
    if (!record) return;

    DB.dischargeIPD(ipdId, dischargeSummary, userId, userName, userRole);
    setIpdRecords(DB.getIPD(hospitalId));
    setBeds(DB.getBeds(hospitalId));

    // Generate Invoice for IPD stay
    const bedObj = beds.find(b => b.id === record.bedId);
    const bedRate = bedObj ? bedObj.ratePerDay : 1000;
    const admissionDateObj = new Date(record.admissionDate);
    const today = new Date();
    const daysStayed = Math.max(1, Math.ceil((today.getTime() - admissionDateObj.getTime()) / (1000 * 60 * 60 * 24)));
    
    const bedTotal = bedRate * daysStayed;
    const items = [
      { description: `IPD Bed Accommodation (${daysStayed} Days @ ${bedRate}/day)`, amount: bedTotal },
      { description: "Nursing and Clinical Supervision Fees", amount: 1500 }
    ];
    
    const subtotal = bedTotal + 1500;
    const taxAmount = Math.round(subtotal * 0.18); // GST
    
    DB.addBillingInvoice({
      id: `INV-${Math.floor(300000 + Math.random() * 90000)}`,
      hospitalId,
      patientId: record.patientId,
      patientName: record.patientName,
      type: "IPD",
      items,
      subtotal,
      taxAmount,
      discount: 0,
      total: subtotal + taxAmount,
      status: "Pending",
      createdAt: new Date().toISOString()
    }, userId, userName, userRole);

    onLogAction("Discharge Patient", `Discharged ${record.patientName} from bed ${record.bedNumber} and generated inpatient invoice.`);
  };

  // --- 4. LAB / RADIOLOGY STATE & HANDLERS ---
  const [labPatientId, setLabPatientId] = useState("");
  const [labCategory, setLabCategory] = useState<any>("Biochemistry");
  const [labTestName, setLabTestName] = useState("");
  const [labCost, setLabCost] = useState("500");
  const [testType, setTestType] = useState<"Laboratory" | "Radiology">("Laboratory");

  const [testResultId, setTestResultId] = useState("");
  const [testResultText, setTestResultText] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("custom");
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [referredBy, setReferredBy] = useState("");

  const handleInitiateResults = (test: LabTest) => {
    setTestResultId(test.id);
    
    const isRadiology = test.testType === "Radiology";
    const matchingDocs = doctors.filter(doc => {
      const spec = (doc.specialization || "").toLowerCase();
      const dept = (doc.department || "").toLowerCase();
      if (isRadiology) {
        return spec.includes("radiolog") || dept.includes("radiolog");
      } else {
        return (
          spec.includes("patholog") || 
          dept.includes("patholog") ||
          dept.includes("diagnost")
        );
      }
    });
    
    setSelectedDoctorId(test.doctorId || (matchingDocs.length > 0 ? matchingDocs[0].id : ""));
    setReferredBy(test.referredBy || "");
    const nameLower = test.testName.toLowerCase();
    
    let template = "custom";
    let defaultVals: Record<string, string> = {};

    if (nameLower.includes("lipid") || nameLower.includes("cholesterol")) {
      template = "lipid";
      defaultVals = {
        total_cholesterol: "185",
        triglycerides: "140",
        hdl: "48",
        ldl: "109",
        vldl: "28"
      };
    } else if (nameLower.includes("cbc") || nameLower.includes("hemoglobin") || nameLower.includes("blood count") || nameLower.includes("blood picture") || nameLower.includes("complete blood")) {
      template = "cbc";
      defaultVals = {
        hemoglobin: "14.5",
        wbc: "6800",
        rbc: "4.9",
        platelets: "250000",
        pcv: "42",
        mcv: "86"
      };
    } else if (nameLower.includes("liver") || nameLower.includes("lft") || nameLower.includes("hepatic") || nameLower.includes("sgpt") || nameLower.includes("sgot")) {
      template = "lft";
      defaultVals = {
        bilirubin_total: "0.8",
        bilirubin_direct: "0.2",
        sgot: "28",
        sgpt: "32",
        alp: "90",
        total_protein: "7.1",
        albumin: "4.2"
      };
    } else if (nameLower.includes("kidney") || nameLower.includes("kft") || nameLower.includes("creatinine") || nameLower.includes("renal") || nameLower.includes("urea") || nameLower.includes("uric")) {
      template = "kft";
      defaultVals = {
        urea: "28",
        bun: "12",
        creatinine: "0.95",
        uric_acid: "5.2",
        calcium: "9.2"
      };
    } else if (nameLower.includes("thyroid") || nameLower.includes("tsh") || nameLower.includes("t3") || nameLower.includes("t4")) {
      template = "thyroid";
      defaultVals = {
        t3: "1.30",
        t4: "8.50",
        tsh: "2.10"
      };
    } else if (nameLower.includes("sugar") || nameLower.includes("glucose") || nameLower.includes("hba1c") || nameLower.includes("diabetes") || nameLower.includes("diabetic")) {
      template = "bloodsugar";
      defaultVals = {
        fasting: "92",
        post_prandial: "128",
        hba1c: "5.4"
      };
    } else if (nameLower.includes("urine")) {
      template = "urine";
      defaultVals = {
        urine_color: "Pale Yellow",
        urine_ph: "6.0",
        urine_sp_gravity: "1.015",
        urine_protein: "Nil",
        urine_glucose: "Nil",
        urine_pus_cells: "1-2 / hpf",
        urine_epi_cells: "2-4 / hpf",
        urine_rbc: "Nil"
      };
    } else if (nameLower.includes("electrolyte") || nameLower.includes("sodium") || nameLower.includes("potassium") || nameLower.includes("chloride")) {
      template = "electrolytes";
      defaultVals = {
        sodium: "139",
        potassium: "4.1",
        chloride: "101"
      };
    } else if (nameLower.includes("vitamin") || nameLower.includes("vit_d") || nameLower.includes("b12")) {
      template = "vitamins";
      defaultVals = {
        vit_d3: "32.4",
        vit_b12: "280"
      };
    } else if (nameLower.includes("iron") || nameLower.includes("ferritin") || nameLower.includes("tibc")) {
      template = "iron_profile";
      defaultVals = {
        serum_iron: "95",
        ferritin: "85",
        tibc: "320",
        transferrin_sat: "29.6"
      };
    } else if (nameLower.includes("coagulation") || nameLower.includes("prothrombin") || nameLower.includes("inr") || nameLower.includes("aptt")) {
      template = "coagulation";
      defaultVals = {
        pt_patient: "12.5",
        pt_control: "12.0",
        inr: "1.04",
        aptt: "30.5"
      };
    } else if (nameLower.includes("cardiac") || nameLower.includes("troponin") || nameLower.includes("ck-mb")) {
      template = "cardiac";
      defaultVals = {
        troponin_i: "0.01",
        ck_mb: "2.1"
      };
    } else if (nameLower.includes("crp") || nameLower.includes("esr") || nameLower.includes("reactive protein")) {
      template = "crp_esr";
      defaultVals = {
        crp: "1.8",
        esr: "12"
      };
    } else if (nameLower.includes("semen")) {
      template = "semen";
      defaultVals = {
        volume: "3.2",
        sperm_count: "68",
        motility_total: "58",
        normal_morphology: "6"
      };
    }

    setSelectedTemplate(template);
    setTemplateValues(defaultVals);
    setTestResultText("");
  };

  const handleTemplateChange = (template: string) => {
    setSelectedTemplate(template);
    let defaultVals: Record<string, string> = {};
    if (template === "lipid") {
      defaultVals = { total_cholesterol: "185", triglycerides: "140", hdl: "48", ldl: "109", vldl: "28" };
    } else if (template === "cbc") {
      defaultVals = { hemoglobin: "14.5", wbc: "6800", rbc: "4.9", platelets: "250000", pcv: "42", mcv: "86" };
    } else if (template === "lft") {
      defaultVals = { bilirubin_total: "0.8", bilirubin_direct: "0.2", sgot: "28", sgpt: "32", alp: "90", total_protein: "7.1", albumin: "4.2" };
    } else if (template === "kft") {
      defaultVals = { urea: "28", bun: "12", creatinine: "0.95", uric_acid: "5.2", calcium: "9.2" };
    } else if (template === "thyroid") {
      defaultVals = { t3: "1.30", t4: "8.50", tsh: "2.10" };
    } else if (template === "bloodsugar") {
      defaultVals = { fasting: "92", post_prandial: "128", hba1c: "5.4" };
    } else if (template === "urine") {
      defaultVals = { urine_color: "Pale Yellow", urine_ph: "6.0", urine_sp_gravity: "1.015", urine_protein: "Nil", urine_glucose: "Nil", urine_pus_cells: "1-2 / hpf", urine_epi_cells: "2-4 / hpf", urine_rbc: "Nil" };
    } else if (template === "electrolytes") {
      defaultVals = { sodium: "139", potassium: "4.1", chloride: "101" };
    } else if (template === "vitamins") {
      defaultVals = { vit_d3: "32.4", vit_b12: "280" };
    } else if (template === "iron_profile") {
      defaultVals = { serum_iron: "95", ferritin: "85", tibc: "320", transferrin_sat: "29.6" };
    } else if (template === "coagulation") {
      defaultVals = { pt_patient: "12.5", pt_control: "12.0", inr: "1.04", aptt: "30.5" };
    } else if (template === "cardiac") {
      defaultVals = { troponin_i: "0.01", ck_mb: "2.1" };
    } else if (template === "crp_esr") {
      defaultVals = { crp: "1.8", esr: "12" };
    } else if (template === "semen") {
      defaultVals = { volume: "3.2", sperm_count: "68", motility_total: "58", normal_morphology: "6" };
    }
    setTemplateValues(defaultVals);
  };

  const handleValueChange = (key: string, val: string) => {
    setTemplateValues(prev => ({
      ...prev,
      [key]: val
    }));
  };

  const handleBookLabTest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!labPatientId || !labTestName || !labCost) return;

    const patient = patients.find(p => p.id === labPatientId);
    if (!patient) return;

    const test: LabTest = {
      id: `${testType === "Radiology" ? "RAD" : "LAB"}-${Math.floor(7000 + Math.random() * 900)}`,
      hospitalId,
      patientId: patient.id,
      patientName: patient.name,
      category: labCategory,
      testName: labTestName,
      testType,
      sampleCollected: false,
      status: "Pending",
      cost: Number(labCost),
      createdAt: new Date().toISOString()
    };

    DB.addLabTest(test, userId, userName, userRole);
    setLabTests(DB.getLabTests(hospitalId));

    // Create a pending bill for this lab test
    DB.addBillingInvoice({
      id: `INV-${Math.floor(400000 + Math.random() * 90000)}`,
      hospitalId,
      patientId: patient.id,
      patientName: patient.name,
      type: "Laboratory",
      items: [{ description: `Diagnostic Test: ${labTestName}`, amount: Number(labCost) }],
      subtotal: Number(labCost),
      taxAmount: Math.round(Number(labCost) * 0.18),
      discount: 0,
      total: Number(labCost) + Math.round(Number(labCost) * 0.18),
      status: "Pending",
      createdAt: new Date().toISOString()
    }, userId, userName, userRole);

    // Reset Form
    setLabPatientId("");
    setLabTestName("");
    setLabCost("500");

    onLogAction("Schedule Diagnostics", `Booked ${testType} test (${labTestName}) for patient ${patient.name}`);
  };

  const handleCollectSample = (id: string) => {
    DB.collectSample(id);
    setLabTests(DB.getLabTests(hospitalId));
    onLogAction("Sample Collection", `Marked samples collected for diagnostic entry ${id}`);
  };

  const handleInputResult = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testResultId) return;

    let finalResultsText = "";
    if (selectedTemplate !== "custom") {
      finalResultsText = JSON.stringify({
        template: selectedTemplate,
        values: templateValues,
        notes: testResultText
      });
    } else {
      if (!testResultText) return;
      finalResultsText = testResultText;
    }

    const currentTest = labTests.find(t => t.id === testResultId);
    const isRadiology = currentTest ? currentTest.testType === "Radiology" : false;

    let docId = "";
    let docName = "";
    let docSpec = "";

    if (selectedDoctorId === "custom-default" || selectedDoctorId === "radiology-default" || !selectedDoctorId) {
      const fallbackDoc = doctors.find(doc => {
        const spec = (doc.specialization || "").toLowerCase();
        const dept = (doc.department || "").toLowerCase();
        if (isRadiology) {
          return spec.includes("radiolog") || dept.includes("radiolog");
        } else {
          return (
            spec.includes("patholog") || 
            dept.includes("patholog") ||
            dept.includes("diagnost")
          );
        }
      });

      if (fallbackDoc) {
        docId = fallbackDoc.id;
        docName = fallbackDoc.name;
        docSpec = fallbackDoc.specialization;
      } else {
        if (isRadiology) {
          docId = "radiology-default";
          docName = "Dr. Sameer Malhotra, MD";
          docSpec = "Radiology";
        } else {
          docId = "custom-default";
          docName = "Dr. Ramesh Patel, MD";
          docSpec = "Pathology";
        }
      }
    } else {
      const chosenDoc = doctors.find(d => d.id === selectedDoctorId);
      if (chosenDoc) {
        docId = chosenDoc.id;
        docName = chosenDoc.name;
        docSpec = chosenDoc.specialization;
      }
    }

    DB.updateLabTestResult(
      testResultId, 
      finalResultsText, 
      isRadiology, 
      undefined, 
      docId, 
      docName, 
      docSpec,
      referredBy
    );
    setLabTests(DB.getLabTests(hospitalId));

    // Reset
    setTestResultId("");
    setTestResultText("");
    setSelectedTemplate("custom");
    setTemplateValues({});
    setSelectedDoctorId("");
    setReferredBy("");
    onLogAction("Submit Diagnostics Results", `Completed results logging for test code ${testResultId}`);
  };

  const handlePrintLabInvoice = (test: LabTest) => {
    const invoice = DB.getBillingInvoices(hospitalId).find(inv => 
      inv.patientId === test.patientId && 
      inv.items.some(item => item.description.includes(test.testName))
    );
    
    if (!invoice) {
        alert("Invoice not found!");
        return;
    }

    const hospital = DB.getHospitals().find(h => h.id === hospitalId);
    const hospitalName = hospital?.name || "CareMatrix Hospital";

    const docHTML = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 700px; padding: 40px; border: 1px solid #e2e8f0; border-radius: 8px; margin: 20px auto; color: #334155;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 40px; border-bottom: 2px solid #0d9488; padding-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 15px;">
                <div style="width: 60px; height: 60px; background: #e2e8f0; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; color: #64748b;">🏥</div>
                <div>
                    <h1 style="color: #0d9488; margin: 0; font-size: 24px;">${hospitalName}</h1>
                    <p style="margin: 5px 0 0; font-size: 12px; color: #64748b;">Diagnostic & Imaging Center</p>
                </div>
            </div>
            <div style="text-align: right; font-size: 13px;">
                <p style="margin: 0;"><strong>Invoice ID:</strong> ${invoice.id}</p>
                <p style="margin: 5px 0 0;"><strong>Date:</strong> ${new Date(invoice.createdAt).toLocaleDateString()}</p>
            </div>
        </div>

        <div style="margin-bottom: 30px; font-size: 14px;">
            <p style="margin: 0;"><strong>Bill To:</strong></p>
            <p style="margin: 5px 0 0;">${invoice.patientName}</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 30px;">
            <thead style="background: #f8fafc; color: #475569;">
                <tr>
                    <th style="padding: 12px; border: 1px solid #e2e8f0; text-align: left;">Description</th>
                    <th style="padding: 12px; border: 1px solid #e2e8f0; text-align: right;">Amount</th>
                </tr>
            </thead>
            <tbody>
                ${invoice.items.map(item => `
                    <tr>
                        <td style="padding: 12px; border: 1px solid #e2e8f0;">${item.description}</td>
                        <td style="padding: 12px; border: 1px solid #e2e8f0; text-align: right;">${formatCurrency(item.amount, countryCode)}</td>
                    </tr>
                `).join("")}
            </tbody>
            <tfoot>
                <tr style="font-weight: bold;">
                    <td style="padding: 12px; border: 1px solid #e2e8f0; text-align: right;">Subtotal:</td>
                    <td style="padding: 12px; border: 1px solid #e2e8f0; text-align: right;">${formatCurrency(invoice.subtotal, countryCode)}</td>
                </tr>
                <tr style="font-weight: bold;">
                    <td style="padding: 12px; border: 1px solid #e2e8f0; text-align: right;">Tax:</td>
                    <td style="padding: 12px; border: 1px solid #e2e8f0; text-align: right;">${formatCurrency(invoice.taxAmount, countryCode)}</td>
                </tr>
                <tr style="font-weight: bold; color: #0d9488; font-size: 16px;">
                    <td style="padding: 12px; border: 1px solid #e2e8f0; text-align: right;">Total:</td>
                    <td style="padding: 12px; border: 1px solid #e2e8f0; text-align: right;">${formatCurrency(invoice.total, countryCode)}</td>
                </tr>
            </tfoot>
        </table>
        
        <div style="text-align: center; font-size: 12px; color: #64748b; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
            <p>Thank you for choosing ${hospitalName}.</p>
        </div>
      </div>
    `;

    const win = window.open("", "_blank");
    if (win) {
      win.document.write(`<html><head><title>Print Invoice</title></head><body onload="window.print(); window.close();">${docHTML}</body></html>`);
      win.document.close();
    }
  };

  const handlePrintLabReport = (test: LabTest) => {
    const doc = new jsPDF();
    const currentHosp = DB.getHospitals().find(h => h.id === hospitalId);
    const hosp = {
      name: currentHosp ? `${currentHosp.name} (Diagnostics Center)` : "Diagnostics & Imaging Center",
      address: currentHosp?.address || "M.G. Road, Sector 4, Mumbai, Maharashtra",
      phone: currentHosp?.phone || "+91 98765-43210",
      email: currentHosp ? `diagnostics@${currentHosp.email.split("@")[1]}` : "diagnostics@stmary.org"
    };

    const pat = patients.find(p => p.id === test.patientId);
    
    const calculateAge = (dobString?: string) => {
      if (!dobString) return "N/A";
      try {
        const dob = new Date(dobString);
        const diff = Date.now() - dob.getTime();
        const ageDate = new Date(diff);
        return Math.abs(ageDate.getUTCFullYear() - 1970) + " Yrs";
      } catch (e) {
        return "N/A";
      }
    };

    const patAge = pat ? calculateAge(pat.dob) : "N/A";
    const patGender = pat ? pat.gender : "N/A";
    const patPhone = pat ? pat.phone : "N/A";

    // --- 1. Header Section (Letterhead) ---
    doc.setFillColor(248, 250, 252); // Slate-50
    doc.rect(0, 0, 210, 45, "F");

    // Stylized Logo Design
    doc.setFillColor(13, 148, 136); // Teal
    doc.circle(25, 22, 11, "F");
    
    doc.setFillColor(255, 255, 255);
    doc.circle(25, 22, 9, "F");
    
    doc.setFillColor(13, 148, 136); // Inner symbol
    doc.rect(23.5, 16, 3, 12, "F");
    doc.rect(19, 20.5, 12, 3, "F");

    // Hospital Name & Contact Info
    doc.setTextColor(15, 23, 42); // Slate-900
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(18);
    doc.text(hosp.name, 42, 19);

    doc.setTextColor(71, 85, 105); // Slate-600
    doc.setFontSize(9);
    doc.setFont("Helvetica", "normal");
    doc.text(hosp.address, 42, 26);
    doc.text(`Phone: ${hosp.phone} | Email: ${hosp.email}`, 42, 32);
    doc.text("State Licensing Authority Reg: CM-7182-DL", 42, 38);

    // Document Title Flag
    doc.setTextColor(13, 148, 136); // Teal
    doc.setFontSize(18);
    doc.setFont("Helvetica", "bold");
    doc.text("DIAGNOSTIC", 155, 20, { align: "left" });
    doc.text("REPORT", 155, 27, { align: "left" });

    doc.setFontSize(8);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.text("ORIGINAL DOCUMENT", 155, 34);

    // Draw Barcode lines in top right of header
    const bx = 160;
    const by = 8;
    doc.setFillColor(0, 0, 0);
    doc.rect(bx + 0, by, 0.4, 6, "F");
    doc.rect(bx + 0.8, by, 1.2, 6, "F");
    doc.rect(bx + 2.4, by, 0.4, 6, "F");
    doc.rect(bx + 3.2, by, 1.6, 6, "F");
    doc.rect(bx + 5.2, by, 0.8, 6, "F");
    doc.rect(bx + 6.4, by, 0.4, 6, "F");
    doc.rect(bx + 7.2, by, 1.2, 6, "F");
    doc.rect(bx + 8.8, by, 1.6, 6, "F");
    doc.rect(bx + 10.8, by, 0.4, 6, "F");
    doc.rect(bx + 11.6, by, 0.8, 6, "F");
    doc.rect(bx + 12.8, by, 1.2, 6, "F");
    doc.rect(bx + 14.4, by, 0.4, 6, "F");
    doc.rect(bx + 15.2, by, 1.6, 6, "F");
    doc.rect(bx + 17.2, by, 0.8, 6, "F");
    doc.rect(bx + 18.4, by, 0.4, 6, "F");
    doc.rect(bx + 19.2, by, 1.2, 6, "F");
    doc.rect(bx + 20.8, by, 1.6, 6, "F");
    doc.rect(bx + 22.8, by, 0.4, 6, "F");

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`*${test.id.toUpperCase()}*`, bx + 11.5, by + 8, { align: "center" });

    // Decorative Solid Accent Line
    doc.setFillColor(13, 148, 136);
    doc.rect(0, 45, 210, 1.5, "F");

    // --- 2. Patient Demographics Block ---
    doc.setDrawColor(203, 213, 225); // Slate-300
    doc.setFillColor(248, 250, 252); // Slate-50
    doc.rect(15, 50, 180, 34, "FD");

    // Horizontal split lines inside demographics box
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.line(15, 58.5, 195, 58.5);
    doc.line(15, 67, 195, 67);
    doc.line(15, 75.5, 195, 75.5);

    // Vertical column separator inside box (middle split)
    doc.line(105, 50, 105, 84);

    // Left Column
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text("PATIENT NAME :", 18, 55.5);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(15, 23, 42); // Slate-900
    doc.text(test.patientName.toUpperCase(), 48, 55.5);

    doc.setFont("Helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text("PATIENT ID / MRN :", 18, 64);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(test.patientId, 48, 64);

    doc.setFont("Helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text("AGE / GENDER :", 18, 72.5);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(`${patAge} / ${patGender.toUpperCase()}`, 48, 72.5);

    doc.setFont("Helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text("CONTACT NO :", 18, 81);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(patPhone || "N/A", 48, 81);

    // Right Column
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text("REGISTRATION DATE :", 108, 55.5);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(new Date(test.createdAt).toLocaleString() || "N/A", 145, 55.5);

    doc.setFont("Helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text("REPORT GENERATED :", 108, 64);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(test.resultDate ? `${test.resultDate} 11:24 AM` : `${new Date().toISOString().split("T")[0]} 11:24 AM`, 145, 64);

    doc.setFont("Helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text("REFERRED BY :", 108, 72.5);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.text(test.referredBy || "Self Referral", 145, 72.5);

    doc.setFont("Helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text("LAB STATUS :", 108, 81);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(16, 124, 65); // Green-700
    doc.text("VERIFIED REPORT", 145, 81);

    // Parse structured report data
    let isStructured = false;
    let parsedData: any = null;
    try {
      if (test.results && test.results.trim().startsWith("{")) {
        parsedData = JSON.parse(test.results);
        isStructured = !!parsedData.template;
      }
    } catch (e) {
      isStructured = false;
    }

    const getParamMeta = (template: string, key: string, valueStr: string) => {
      const value = parseFloat(valueStr) || 0;
      let label = key;
      let refInterval = "";
      let unit = "";
      let status: "NORMAL" | "HIGH" | "LOW" = "NORMAL";

      if (template === "lipid") {
        switch (key) {
          case "total_cholesterol":
            label = "Total Cholesterol";
            refInterval = "Desirable: < 200.00";
            unit = "mg/dL";
            status = value > 200 ? "HIGH" : "NORMAL";
            break;
          case "triglycerides":
            label = "Triglycerides";
            refInterval = "Optimal: < 150.00";
            unit = "mg/dL";
            status = value > 150 ? "HIGH" : "NORMAL";
            break;
          case "hdl":
            label = "HDL Cholesterol (Good)";
            refInterval = "Desirable: > 40.00";
            unit = "mg/dL";
            status = value < 40 ? "LOW" : "NORMAL";
            break;
          case "ldl":
            label = "LDL Cholesterol (Calculated)";
            refInterval = "Optimal: < 100.00";
            unit = "mg/dL";
            status = value > 100 ? "HIGH" : "NORMAL";
            break;
          case "vldl":
            label = "VLDL Cholesterol";
            refInterval = "Normal: 10.00 - 30.00";
            unit = "mg/dL";
            status = value > 30 ? "HIGH" : (value < 10 ? "LOW" : "NORMAL");
            break;
        }
      } else if (template === "cbc") {
        switch (key) {
          case "hemoglobin":
            label = "Hemoglobin (Hb)";
            refInterval = "13.00 - 17.00";
            unit = "g/dL";
            status = value < 13 ? "LOW" : (value > 17 ? "HIGH" : "NORMAL");
            break;
          case "wbc":
            label = "Total Leukocyte Count (WBC)";
            refInterval = "4000 - 11000";
            unit = "/cu.mm";
            status = value < 4000 ? "LOW" : (value > 11000 ? "HIGH" : "NORMAL");
            break;
          case "rbc":
            label = "Red Blood Cell (RBC) Count";
            refInterval = "4.50 - 5.50";
            unit = "million/cumm";
            status = value < 4.5 ? "LOW" : (value > 5.5 ? "HIGH" : "NORMAL");
            break;
          case "platelets":
            label = "Platelet Count";
            refInterval = "150000 - 450000";
            unit = "/cu.mm";
            status = value < 150000 ? "LOW" : (value > 450000 ? "HIGH" : "NORMAL");
            break;
          case "pcv":
            label = "Packed Cell Volume (PCV)";
            refInterval = "40.00 - 50.00";
            unit = "%";
            status = value < 40 ? "LOW" : (value > 50 ? "HIGH" : "NORMAL");
            break;
          case "mcv":
            label = "Mean Corpuscular Volume (MCV)";
            refInterval = "80.00 - 100.00";
            unit = "fL";
            status = value < 80 ? "LOW" : (value > 100 ? "HIGH" : "NORMAL");
            break;
        }
      } else if (template === "lft") {
        switch (key) {
          case "bilirubin_total":
            label = "Total Bilirubin";
            refInterval = "0.20 - 1.20";
            unit = "mg/dL";
            status = value > 1.2 ? "HIGH" : "NORMAL";
            break;
          case "bilirubin_direct":
            label = "Direct Bilirubin";
            refInterval = "0.00 - 0.30";
            unit = "mg/dL";
            status = value > 0.3 ? "HIGH" : "NORMAL";
            break;
          case "sgot":
            label = "SGOT (AST)";
            refInterval = "< 40.00";
            unit = "U/L";
            status = value > 40 ? "HIGH" : "NORMAL";
            break;
          case "sgpt":
            label = "SGPT (ALT)";
            refInterval = "< 45.00";
            unit = "U/L";
            status = value > 45 ? "HIGH" : "NORMAL";
            break;
          case "alp":
            label = "Alkaline Phosphatase (ALP)";
            refInterval = "30.00 - 120.00";
            unit = "U/L";
            status = value > 120 ? "HIGH" : (value < 30 ? "LOW" : "NORMAL");
            break;
          case "total_protein":
            label = "Total Protein";
            refInterval = "6.00 - 8.00";
            unit = "g/dL";
            status = value < 6 ? "LOW" : (value > 8 ? "HIGH" : "NORMAL");
            break;
          case "albumin":
            label = "Serum Albumin";
            refInterval = "3.50 - 5.00";
            unit = "g/dL";
            status = value < 3.5 ? "LOW" : (value > 5 ? "HIGH" : "NORMAL");
            break;
        }
      } else if (template === "kft") {
        switch (key) {
          case "urea":
            label = "Blood Urea";
            refInterval = "15.00 - 40.00";
            unit = "mg/dL";
            status = value < 15 ? "LOW" : (value > 40 ? "HIGH" : "NORMAL");
            break;
          case "bun":
            label = "Blood Urea Nitrogen (BUN)";
            refInterval = "7.00 - 20.00";
            unit = "mg/dL";
            status = value < 7 ? "LOW" : (value > 20 ? "HIGH" : "NORMAL");
            break;
          case "creatinine":
            label = "Serum Creatinine";
            refInterval = "0.60 - 1.20";
            unit = "mg/dL";
            status = value < 0.6 ? "LOW" : (value > 1.2 ? "HIGH" : "NORMAL");
            break;
          case "uric_acid":
            label = "Serum Uric Acid";
            refInterval = "3.50 - 7.20";
            unit = "mg/dL";
            status = value < 3.5 ? "LOW" : (value > 7.2 ? "HIGH" : "NORMAL");
            break;
          case "calcium":
            label = "Serum Calcium";
            refInterval = "8.50 - 10.50";
            unit = "mg/dL";
            status = value < 8.5 ? "LOW" : (value > 10.5 ? "HIGH" : "NORMAL");
            break;
        }
      } else if (template === "thyroid") {
        switch (key) {
          case "t3":
            label = "Total Triiodothyronine (T3)";
            refInterval = "0.80 - 2.00";
            unit = "ng/mL";
            status = value < 0.8 ? "LOW" : (value > 2 ? "HIGH" : "NORMAL");
            break;
          case "t4":
            label = "Total Thyroxine (T4)";
            refInterval = "5.10 - 14.10";
            unit = "ug/dL";
            status = value < 5.1 ? "LOW" : (value > 14.1 ? "HIGH" : "NORMAL");
            break;
          case "tsh":
            label = "Thyroid Stimulating Hormone (TSH)";
            refInterval = "0.50 - 5.00";
            unit = "uIU/mL";
            status = value < 0.5 ? "LOW" : (value > 5 ? "HIGH" : "NORMAL");
            break;
        }
      } else if (template === "bloodsugar") {
        switch (key) {
          case "fasting":
            label = "Blood Glucose (Fasting)";
            refInterval = "70.00 - 100.00";
            unit = "mg/dL";
            status = value < 70 ? "LOW" : (value > 100 ? "HIGH" : "NORMAL");
            break;
          case "post_prandial":
            label = "Blood Glucose (Post Prandial)";
            refInterval = "< 140.00";
            unit = "mg/dL";
            status = value > 140 ? "HIGH" : "NORMAL";
            break;
          case "hba1c":
            label = "HbA1c (Glycated Hemoglobin)";
            refInterval = "4.00 - 5.60";
            unit = "%";
            status = value > 5.6 ? "HIGH" : "NORMAL";
            break;
        }
      } else if (template === "urine") {
        switch (key) {
          case "urine_color":
            label = "Urine Color";
            refInterval = "Pale Yellow";
            unit = "-";
            status = "NORMAL";
            break;
          case "urine_ph":
            label = "Urine pH";
            refInterval = "4.5 - 8.0";
            unit = "-";
            status = value < 4.5 ? "LOW" : (value > 8.0 ? "HIGH" : "NORMAL");
            break;
          case "urine_sp_gravity":
            label = "Specific Gravity";
            refInterval = "1.005 - 1.030";
            unit = "-";
            status = value < 1.005 ? "LOW" : (value > 1.030 ? "HIGH" : "NORMAL");
            break;
          case "urine_protein":
            label = "Urine Protein (Albumin)";
            refInterval = "Nil / Negative";
            unit = "-";
            status = valueStr.toLowerCase().includes("nil") || valueStr.toLowerCase().includes("neg") ? "NORMAL" : "HIGH";
            break;
          case "urine_glucose":
            label = "Urine Glucose";
            refInterval = "Nil / Negative";
            unit = "-";
            status = valueStr.toLowerCase().includes("nil") || valueStr.toLowerCase().includes("neg") ? "NORMAL" : "HIGH";
            break;
          case "urine_pus_cells":
            label = "Pus Cells";
            refInterval = "0 - 5 / hpf";
            unit = "/ hpf";
            status = value > 5 ? "HIGH" : "NORMAL";
            break;
          case "urine_epi_cells":
            label = "Epithelial Cells";
            refInterval = "0 - 5 / hpf";
            unit = "/ hpf";
            status = value > 5 ? "HIGH" : "NORMAL";
            break;
          case "urine_rbc":
            label = "RBCs";
            refInterval = "Nil / Negative";
            unit = "/ hpf";
            status = valueStr.toLowerCase().includes("nil") || valueStr.toLowerCase().includes("neg") || valueStr === "0" ? "NORMAL" : "HIGH";
            break;
        }
      } else if (template === "electrolytes") {
        switch (key) {
          case "sodium":
            label = "Serum Sodium";
            refInterval = "135.0 - 145.0";
            unit = "mEq/L";
            status = value < 135 ? "LOW" : (value > 145 ? "HIGH" : "NORMAL");
            break;
          case "potassium":
            label = "Serum Potassium";
            refInterval = "3.5 - 5.1";
            unit = "mEq/L";
            status = value < 3.5 ? "LOW" : (value > 5.1 ? "HIGH" : "NORMAL");
            break;
          case "chloride":
            label = "Serum Chloride";
            refInterval = "96.0 - 106.0";
            unit = "mEq/L";
            status = value < 96 ? "LOW" : (value > 106 ? "HIGH" : "NORMAL");
            break;
        }
      } else if (template === "vitamins") {
        switch (key) {
          case "vit_d3":
            label = "Vitamin D3 (25-OH)";
            refInterval = "30.0 - 100.0";
            unit = "ng/mL";
            status = value < 30 ? "LOW" : "NORMAL";
            break;
          case "vit_b12":
            label = "Vitamin B12";
            refInterval = "211.0 - 911.0";
            unit = "pg/mL";
            status = value < 211 ? "LOW" : (value > 911 ? "HIGH" : "NORMAL");
            break;
        }
      } else if (template === "iron_profile") {
        switch (key) {
          case "serum_iron":
            label = "Serum Iron";
            refInterval = "50.0 - 170.0";
            unit = "mcg/dL";
            status = value < 50 ? "LOW" : (value > 170 ? "HIGH" : "NORMAL");
            break;
          case "ferritin":
            label = "Serum Ferritin";
            refInterval = "30.0 - 400.0";
            unit = "ng/mL";
            status = value < 30 ? "LOW" : (value > 400 ? "HIGH" : "NORMAL");
            break;
          case "tibc":
            label = "Total Iron Binding Capacity (TIBC)";
            refInterval = "250.0 - 450.0";
            unit = "mcg/dL";
            status = value < 250 ? "LOW" : (value > 450 ? "HIGH" : "NORMAL");
            break;
          case "transferrin_sat":
            label = "Transferrin Saturation";
            refInterval = "15.00 - 50.00";
            unit = "%";
            status = value < 15 ? "LOW" : (value > 50 ? "HIGH" : "NORMAL");
            break;
        }
      } else if (template === "coagulation") {
        switch (key) {
          case "pt_patient":
            label = "PT - Patient";
            refInterval = "11.0 - 14.0";
            unit = "seconds";
            status = value < 11 ? "LOW" : (value > 14 ? "HIGH" : "NORMAL");
            break;
          case "pt_control":
            label = "PT - Control";
            refInterval = "11.0 - 14.0";
            unit = "seconds";
            status = "NORMAL";
            break;
          case "inr":
            label = "INR (International Normalized Ratio)";
            refInterval = "0.80 - 1.20";
            unit = "Ratio";
            status = value < 0.8 ? "LOW" : (value > 1.2 ? "HIGH" : "NORMAL");
            break;
          case "aptt":
            label = "APTT";
            refInterval = "25.0 - 35.0";
            unit = "seconds";
            status = value < 25 ? "LOW" : (value > 35 ? "HIGH" : "NORMAL");
            break;
        }
      } else if (template === "cardiac") {
        switch (key) {
          case "troponin_i":
            label = "Troponin I (High Sensitive)";
            refInterval = "< 0.04";
            unit = "ng/mL";
            status = value > 0.04 ? "HIGH" : "NORMAL";
            break;
          case "ck_mb":
            label = "CK-MB Mass";
            refInterval = "< 5.0";
            unit = "ng/mL";
            status = value > 5.0 ? "HIGH" : "NORMAL";
            break;
        }
      } else if (template === "crp_esr") {
        switch (key) {
          case "crp":
            label = "C-Reactive Protein (CRP)";
            refInterval = "< 5.0";
            unit = "mg/L";
            status = value > 5.0 ? "HIGH" : "NORMAL";
            break;
          case "esr":
            label = "Erythrocyte Sedimentation Rate (ESR)";
            refInterval = "< 15";
            unit = "mm/hr";
            status = value > 15 ? "HIGH" : "NORMAL";
            break;
        }
      } else if (template === "semen") {
        switch (key) {
          case "volume":
            label = "Semen Volume";
            refInterval = ">= 1.5";
            unit = "mL";
            status = value < 1.5 ? "LOW" : "NORMAL";
            break;
          case "sperm_count":
            label = "Sperm Concentration";
            refInterval = ">= 15.0";
            unit = "Million/mL";
            status = value < 15.0 ? "LOW" : "NORMAL";
            break;
          case "motility_total":
            label = "Total Motility (PR + NP)";
            refInterval = ">= 40";
            unit = "%";
            status = value < 40 ? "LOW" : "NORMAL";
            break;
          case "normal_morphology":
            label = "Normal Forms / Morphology";
            refInterval = ">= 4";
            unit = "%";
            status = value < 4 ? "LOW" : "NORMAL";
            break;
        }
      }

      return { label, refInterval, unit, status };
    };

    // --- 3. Investigation Table Section ---
    doc.setTextColor(13, 148, 136);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    
    let investigationTitle = "I. PATHOLOGY LABORATORY INVESTIGATION REPORT";
    if (test.testType === "Radiology") {
      investigationTitle = "I. RADIOLOGICAL DIAGNOSTIC SCAN REPORT";
    } else if (isStructured) {
      investigationTitle = `I. PATHOLOGY CLINICAL INVESTIGATION: ${test.testName.toUpperCase()}`;
    }
    doc.text(investigationTitle, 15, 96);

    let finalY = 101;

    if (isStructured && parsedData) {
      // Draw professional structured analyte range table
      const headY = 101;
      doc.setFillColor(15, 23, 42); // Clean Deep Slate Header
      doc.rect(15, headY, 180, 8, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text("TEST PARAMETER / ANALYTE", 18, headY + 5.5);
      doc.text("OBSERVED VALUE", 85, headY + 5.5, { align: "right" });
      doc.text("UNIT", 112, headY + 5.5, { align: "center" });
      doc.text("REFERENCE RANGE", 125, headY + 5.5);
      doc.text("FLAG", 192, headY + 5.5, { align: "right" });

      let iy = headY + 8;
      const itemKeys = Object.keys(parsedData.values);
      itemKeys.forEach((key, index) => {
        const val = parsedData.values[key];
        const meta = getParamMeta(parsedData.template, key, val);

        // Zebra striping
        if (index % 2 === 1) {
          doc.setFillColor(248, 250, 252); // Slate-50
          doc.rect(15, iy, 180, 7.5, "F");
        }

        doc.setDrawColor(241, 245, 249);
        doc.line(15, iy + 7.5, 195, iy + 7.5);

        // Name
        doc.setTextColor(15, 23, 42);
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8.5);
        doc.text(meta.label, 18, iy + 5);

        // Value
        const isAbnormal = meta.status !== "NORMAL";
        if (isAbnormal) {
          doc.setTextColor(185, 28, 28); // Bold red alert
          doc.setFont("Helvetica", "bold");
        } else {
          doc.setTextColor(15, 23, 42);
          doc.setFont("Helvetica", "bold");
        }
        doc.text(String(val), 85, iy + 5, { align: "right" });

        // Unit
        doc.setTextColor(71, 85, 105);
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text(meta.unit, 112, iy + 5, { align: "center" });

        // Ref Interval
        doc.setTextColor(71, 85, 105);
        doc.text(meta.refInterval, 125, iy + 5);

        // Flag
        if (isAbnormal) {
          doc.setTextColor(185, 28, 28);
          doc.setFont("Helvetica", "bold");
          doc.text(`[ ${meta.status} ]`, 192, iy + 5, { align: "right" });
        } else {
          doc.setTextColor(16, 124, 65);
          doc.setFont("Helvetica", "normal");
          doc.text("NORMAL", 192, iy + 5, { align: "right" });
        }

        iy += 7.5;
      });

      finalY = iy + 8;

      // Remarks Block
      if (parsedData.notes || test.results) {
        doc.setTextColor(13, 148, 136);
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(10);
        doc.text("II. CLINICAL RECOMMENDATIONS & LAB COMMENTS", 15, finalY);

        doc.setFillColor(248, 250, 252);
        doc.rect(15, finalY + 4, 180, 18, "F");
        doc.setDrawColor(226, 232, 240);
        doc.rect(15, finalY + 4, 180, 18);

        // Left Teal border accent
        doc.setFillColor(13, 148, 136);
        doc.rect(15, finalY + 4, 1.5, 18, "F");

        doc.setTextColor(51, 65, 85);
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8.5);
        const remarkText = parsedData.notes || "Specimen examined under analytical protocols. Clinical parameters fall within normal biological reference range. Please correlate clinically.";
        const remarkLines = doc.splitTextToSize(remarkText, 172);
        doc.text(remarkLines, 19, finalY + 9);

        finalY += 28;
      }

    } else {
      // Custom / Radiology report layout
      const contentY = 101;
      doc.setFillColor(248, 250, 252);
      doc.rect(15, contentY, 180, 75, "F");
      doc.setDrawColor(226, 232, 240);
      doc.rect(15, contentY, 180, 75);

      // Teal Left border accent
      doc.setFillColor(13, 148, 136);
      doc.rect(15, contentY, 2, 75, "F");

      doc.setTextColor(13, 148, 136);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(10);
      doc.text("DIAGNOSTIC FINDINGS & PATHOLOGICAL DESCRIPTION", 21, contentY + 6);

      doc.setTextColor(15, 23, 42);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9.5);

      const textToPrint = test.results || "Sample successfully collected and processed. No abnormal biological structures, hematological flags, or microbial infestations were detected. Analyte and physical parameters fall within standard physiological reference margins.";
      const splitLines = doc.splitTextToSize(textToPrint, 168);
      doc.text(splitLines, 21, contentY + 14);

      finalY = contentY + 82;
    }

    // --- 6. Electronic Signature validation block ---
    doc.setDrawColor(226, 232, 240);
    doc.line(15, 250, 195, 250);

    doc.setTextColor(100, 116, 139);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text("* END OF DIAGNOSTIC INVESTIGATION REPORT. CLINICALLY CORRELATE CORRESPONDING OBSERVATIONS.", 15, 255);

    // Signature 1: Consultant/Pathologist or Radiologist based on test type
    const isRadiologyTest = test.testType === "Radiology";
    let signingDocName = "";
    let signingDocSpec = "";
    let signingDocLic = "";

    if (test.doctorName) {
      signingDocName = test.doctorName;
      signingDocSpec = test.doctorSpecialization 
        ? (test.doctorSpecialization.toLowerCase().includes("patholog") || test.doctorSpecialization.toLowerCase().includes("radiolog")
           ? test.doctorSpecialization 
           : `${test.doctorSpecialization} Specialist`)
        : (isRadiologyTest ? "Consultant Radiologist" : "Consultant Pathologist");
      signingDocLic = test.doctorId && test.doctorId !== "custom-default" && test.doctorId !== "pathology-default" && test.doctorId !== "radiology-default"
        ? `MC-${test.doctorId.toUpperCase()}-AUTH` 
        : (isRadiologyTest ? "MC-77123-RAD" : "");
    } else {
      const fallbackDoc = doctors.find(doc => {
        const spec = (doc.specialization || "").toLowerCase();
        const dept = (doc.department || "").toLowerCase();
        if (isRadiologyTest) {
          return spec.includes("radiolog") || dept.includes("radiolog");
        } else {
          return (
            spec.includes("patholog") || 
            dept.includes("patholog") ||
            dept.includes("diagnost")
          );
        }
      });

      if (fallbackDoc) {
        signingDocName = fallbackDoc.name;
        signingDocSpec = fallbackDoc.specialization || (isRadiologyTest ? "Consultant Radiologist" : "Consultant Pathologist");
        signingDocLic = `MC-${fallbackDoc.id.toUpperCase()}-AUTH`;
      } else {
        if (isRadiologyTest) {
          signingDocName = "Dr. Sameer Malhotra, MD";
          signingDocSpec = "Consultant Radiologist";
          signingDocLic = "MC-77123-RAD";
        } else {
          signingDocName = "Dr. Ramesh Patel, MD";
          signingDocSpec = "Consultant Pathologist";
          signingDocLic = "";
        }
      }
    }

    doc.setTextColor(15, 23, 42);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.text(signingDocName, 15, 269);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(8);
    doc.text(signingDocSpec, 15, 274);
    doc.text(signingDocLic, 15, 279);

    // Left signature digital squiggle
    doc.setDrawColor(13, 148, 136); // Teal color sign
    doc.setLineWidth(0.4);
    doc.line(18, 262, 22, 260);
    doc.line(22, 260, 27, 264);
    doc.line(27, 264, 35, 259);
    doc.line(35, 259, 44, 263);
    doc.line(44, 263, 50, 261);

    // Right Verification Seal (Stamped look)
    doc.setDrawColor(13, 148, 136);
    doc.setLineWidth(0.4);
    doc.rect(130, 259, 65, 23);
    doc.setFillColor(240, 253, 250); // Teal-50
    doc.rect(130, 259, 65, 23, "F");
    doc.rect(130, 259, 65, 23);

    doc.setTextColor(13, 148, 136);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    const sealTitle = `${hosp.name.toUpperCase()} SECURE SEAL`.substring(0, 32);
    doc.text(sealTitle, 134, 265);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Status: VERIFIED & ACCREDITED", 134, 270);
    doc.text(`Digital Sign: ${test.id.replace("-", "")}SEC`, 134, 275);
    doc.text(`Signature Date: ${test.resultDate ? new Date(test.resultDate).toLocaleDateString() : new Date().toLocaleDateString()}`, 134, 280);

    // Bottom Footer
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page 1 of 1 | System Generated Report for ${hosp.name} | ISO 9001:2015 & NABL Accredited`, 105, 290, { align: "center" });

    // Save and print PDF
    doc.save(`Diagnostic_Report_${test.id}_${test.patientName.replace(/\s+/g, "_")}.pdf`);
  };

  // --- 5. EMERGENCY / VEHICLE FLEET & BLOOD BANK ---
  const [donorName, setDonorName] = useState("");
  const [donorBg, setDonorBg] = useState<any>("O+");
  const [donorPhone, setDonorPhone] = useState("");

  const [dispatchAmbId, setDispatchAmbId] = useState("");
  const [dispatchDest, setDispatchDest] = useState("");
  const [dispatchReason, setDispatchReason] = useState("");

  // States for issuing blood
  const [issuePatientName, setIssuePatientName] = useState("");
  const [issueBloodBg, setIssueBloodBg] = useState<any>("O+");
  const [issueUnits, setIssueUnits] = useState("1");
  const [issuePurpose, setIssuePurpose] = useState("");

  // States for manual blood stock entry
  const [addStockBg, setAddStockBg] = useState<any>("O+");
  const [addStockUnits, setAddStockUnits] = useState("1");
  const [addStockProvider, setAddStockProvider] = useState("");
  const [addStockPurpose, setAddStockPurpose] = useState("");

  const [bloodActionTab, setBloodActionTab] = useState<"donate" | "issue" | "intake">("donate");

  // States for registering new ambulance
  const [newVehNumber, setNewVehNumber] = useState("");
  const [newVehModel, setNewVehModel] = useState("");
  const [newVehDriverName, setNewVehDriverName] = useState("");
  const [newVehDriverPhone, setNewVehDriverPhone] = useState("");
  const [tripSearch, setTripSearch] = useState("");

  const handleAddDonor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!donorName || !donorPhone) return;

    const donor: BloodDonor = {
      id: `DON-${Math.floor(100 + Math.random() * 900)}`,
      hospitalId,
      name: donorName,
      bloodGroup: donorBg,
      phone: donorPhone,
      address: donorAddress,
      lastDonatedDate: new Date().toISOString().split("T")[0],
      status: "Eligible"
    };

    DB.addBloodDonor(donor);
    setDonors(DB.getBloodDonors(hospitalId));
    setBloodStock({ ...DB.getBloodStock(hospitalId) });
    setBloodTransactions(DB.getBloodTransactions(hospitalId));

    setLastRegisteredDonor(donor);

    setDonorName("");
    setDonorPhone("");
    setDonorAddress("");
    onLogAction("Register Blood Donor", `Registered blood donation from ${donor.name} (1 unit ${donor.bloodGroup} added)`);
  };

  const handlePrintCard = (donor: BloodDonor) => {
    const printWindow = window.open("", "_blank", "width=700,height=500");
    if (!printWindow) {
      alert("Please allow popups to print the donor card.");
      return;
    }
    
    const hospital = DB.getHospitals().find(h => h.id === hospitalId);
    const hospitalName = hospital?.name || "CareMatrix Hospital";
    const hospitalLogo = hospital?.logoUrl || "";

    const logoHtml = hospitalLogo 
      ? `<img src="${hospitalLogo}" alt="Logo" style="height: 24px; object-fit: contain; border-radius: 3px;" />` 
      : ``;

    const donorHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Blood Donor ID Card - ${donor.name}</title>
          <meta charset="utf-8" />
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              margin: 0;
              padding: 0;
              background-color: #f8fafc;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .card-container {
              width: 350px;
              height: 220px;
              background: #ffffff;
              border: 1.5px solid #ef4444;
              border-radius: 12px;
              box-shadow: 0 10px 25px rgba(239, 68, 68, 0.08);
              overflow: hidden;
              position: relative;
              padding: 10px 12px;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
            .bubble {
              position: absolute;
              right: -25px;
              top: -25px;
              width: 80px;
              height: 80px;
              background: #fef2f2;
              border-radius: 50%;
              z-index: 0;
              pointer-events: none;
            }
            .card-header {
              display: flex;
              align-items: center;
              gap: 8px;
              border-bottom: 1.5px solid #fee2e2;
              padding-bottom: 6px;
              margin-bottom: 8px;
              position: relative;
              z-index: 10;
            }
            .droplet-logo {
              display: flex;
              align-items: center;
              gap: 6px;
              flex-shrink: 0;
            }
            .header-text h1 {
              margin: 0;
              font-size: 11px;
              color: #1e293b;
              font-weight: 800;
              letter-spacing: 0.5px;
              text-transform: uppercase;
              line-height: 1.2;
            }
            .header-text p {
              margin: 1px 0 0 0;
              font-size: 7px;
              color: #dc2626;
              font-weight: 700;
              letter-spacing: 0.3px;
              text-transform: uppercase;
              line-height: 1.1;
            }
            .card-body {
              display: grid;
              grid-template-columns: 3fr 2fr;
              gap: 8px;
              position: relative;
              z-index: 10;
              margin-bottom: auto;
            }
            .info-col {
              display: flex;
              flex-direction: column;
              gap: 4px;
            }
            .info-group {
              margin-bottom: 0;
            }
            .info-label {
              font-size: 7px;
              color: #94a3b8;
              text-transform: uppercase;
              font-weight: 600;
              letter-spacing: 0.5px;
              margin-bottom: 0px;
              line-height: 1.1;
            }
            .info-value {
              font-size: 9px;
              color: #334155;
              font-weight: 700;
              line-height: 1.2;
            }
            .info-value.id-val {
              font-family: monospace;
              color: #ef4444;
              font-weight: 700;
              font-size: 10px;
            }
            .blood-col {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
              padding: 6px 4px;
              background: #fef2f2;
              border: 1px solid #fee2e2;
              border-radius: 8px;
              box-sizing: border-box;
            }
            .blood-group-val {
              font-size: 26px;
              font-weight: 900;
              color: #dc2626;
              line-height: 1;
            }
            .blood-group-lbl {
              font-size: 7px;
              font-weight: 700;
              color: #ef4444;
              text-transform: uppercase;
              margin-top: 1px;
              line-height: 1.1;
            }
            .date-badge {
              text-align: center;
              margin-top: 4px;
              padding-top: 4px;
              border-top: 1px solid #fee2e2;
              width: 100%;
            }
            .date-badge .lbl {
              font-size: 7px;
              color: #94a3b8;
              text-transform: uppercase;
              font-weight: 600;
              line-height: 1.1;
            }
            .date-badge .val {
              font-size: 8px;
              font-weight: 700;
              color: #334155;
              line-height: 1.1;
            }
            .card-footer {
              margin-top: auto;
              border-top: 1px solid #f1f5f9;
              padding-top: 6px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              position: relative;
              z-index: 10;
            }
            .thanks-message {
              font-size: 7.5px;
              color: #64748b;
              font-style: italic;
              line-height: 1.2;
              max-width: 65%;
            }
            .signature-area {
              text-align: center;
            }
            .signature-line {
              width: 70px;
              border-bottom: 1px solid #cbd5e1;
              margin-bottom: 3px;
            }
            .signature-title {
              font-size: 7px;
              color: #94a3b8;
              font-weight: 700;
              text-transform: uppercase;
            }
            @media print {
              body {
                background-color: transparent;
                margin: 0;
                padding: 0;
                height: 100%;
                width: 100%;
              }
              .card-container {
                box-shadow: none;
                border: 1.5px solid #ef4444 !important;
                margin: auto;
                position: absolute;
                top: 0; left: 0; bottom: 0; right: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="card-container">
            <div class="bubble"></div>
            <div class="card-header">
              <div class="droplet-logo">
                ${logoHtml}
                <svg viewBox="0 0 100 100" width="24" height="24" style="flex-shrink:0;">
                  <path d="M50,5 C50,5 90,45 90,65 C90,82.5 72.5,95 50,95 C27.5,95 10,82.5 10,65 C10,45 50,5 50,5 Z" fill="#ef4444" stroke="#b91c1c" stroke-width="4" />
                  <path d="M30,60 C30,52 45,32 45,32" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity="0.8" />
                </svg>
              </div>
              <div class="header-text">
                <h1>Blood Donor Card</h1>
                <p>${hospitalName.toUpperCase()} (BLOOD BANK)</p>
              </div>
            </div>
            <div class="card-body">
              <div class="info-col">
                <div class="info-group">
                  <div class="info-label">Registration ID</div>
                  <div class="info-value id-val">${donor.id}</div>
                </div>
                <div class="info-group">
                  <div class="info-label">Full Name</div>
                  <div class="info-value">${donor.name}</div>
                </div>
                <div class="info-group">
                  <div class="info-label">Phone</div>
                  <div class="info-value">${donor.phone}</div>
                </div>
                <div class="info-group">
                  <div class="info-label">Residential Address</div>
                  <div class="info-value">${donor.address || "-"}</div>
                </div>
              </div>
              <div class="blood-col">
                <div style="text-align: center;">
                  <span class="blood-group-val">${donor.bloodGroup}</span>
                  <div class="blood-group-lbl">Blood Group</div>
                </div>
                <div class="date-badge">
                  <div class="lbl">Donation Date</div>
                  <div class="val">${donor.lastDonatedDate || ""}</div>
                </div>
              </div>
            </div>
            <div class="card-footer">
              <div class="thanks-message">
                "Thank you for your noble contribution and standing tall to save lives."
              </div>
              <div class="signature-area">
                <div class="signature-line"></div>
                <div class="signature-title">Authorized Sign</div>
              </div>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 1000);
            };
          </script>
        </body>
      </html>
    `;
    
    printWindow.document.open();
    printWindow.document.write(donorHtml);
    printWindow.document.close();
  };

  const handleIssueBlood = (e: React.FormEvent) => {
    e.preventDefault();
    if (!issuePatientName || !issueUnits) return;
    const unitsNum = parseInt(issueUnits);
    if (isNaN(unitsNum) || unitsNum <= 0) return;

    const success = DB.consumeBloodUnits(
      hospitalId,
      issueBloodBg,
      unitsNum,
      issuePatientName,
      issuePurpose || "Medical Treatment"
    );

    if (success) {
      setBloodStock({ ...DB.getBloodStock(hospitalId) });
      setBloodTransactions(DB.getBloodTransactions(hospitalId));
      setIssuePatientName("");
      setIssueUnits("1");
      setIssuePurpose("");
      onLogAction("Issue Blood Unit", `Issued ${unitsNum} units of ${issueBloodBg} to ${issuePatientName}`);
    } else {
      alert(`Insufficient stock of ${issueBloodBg}! Please check live stock indicators.`);
    }
  };

  const handleAddBloodStock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addStockProvider || !addStockUnits) return;
    const unitsNum = parseInt(addStockUnits);
    if (isNaN(unitsNum) || unitsNum <= 0) return;

    DB.addBloodUnits(
      hospitalId,
      addStockBg,
      unitsNum,
      addStockProvider,
      addStockPurpose || "Manual Intake"
    );

    setBloodStock({ ...DB.getBloodStock(hospitalId) });
    setBloodTransactions(DB.getBloodTransactions(hospitalId));
    setAddStockProvider("");
    setAddStockUnits("1");
    setAddStockPurpose("");
    onLogAction("Manual Blood Intake", `Received ${unitsNum} units of ${addStockBg} from ${addStockProvider}`);
  };

  const handleDispatchAmbulance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchAmbId || !dispatchDest || !dispatchReason) return;

    DB.addAmbulanceTrip(dispatchAmbId, dispatchDest, dispatchReason);
    setAmbulances(DB.getAmbulances(hospitalId));

    setDispatchAmbId("");
    setDispatchDest("");
    setDispatchReason("");
    onLogAction("Dispatch Ambulance", `Ambulance dispatched on active trauma trip`);
  };

  const handleReturnAmbulance = (id: string) => {
    DB.completeAmbulanceTrips(id);
    setAmbulances(DB.getAmbulances(hospitalId));
    onLogAction("Ambulance Return", `Ambulance vehicle returned safely to garage`);
  };

  const handleAddAmbulance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVehNumber || !newVehModel || !newVehDriverName || !newVehDriverPhone) return;

    const newAmb: Ambulance = {
      id: `${hospitalId}-AMB-${Math.floor(100 + Math.random() * 900)}`,
      hospitalId,
      vehicleNumber: newVehNumber,
      model: newVehModel,
      driverName: newVehDriverName,
      driverPhone: newVehDriverPhone,
      status: "Available",
      trips: []
    };

    DB.addAmbulance(newAmb);
    setAmbulances(DB.getAmbulances(hospitalId));

    setNewVehNumber("");
    setNewVehModel("");
    setNewVehDriverName("");
    setNewVehDriverPhone("");
    onLogAction("Register Ambulance", `Registered new ambulance vehicle ${newVehNumber}`);
  };

  return (
    <div className="space-y-6">
      {/* --- TAB CONTENT 1: APPOINTMENTS --- */}
      {activeSubTab === "appointments" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/20 flex justify-between items-center">
              <h2 className="font-semibold text-slate-800 dark:text-white">Active Clinical Bookings</h2>
              <span className="text-xs bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400 font-semibold px-2 py-0.5 rounded-full">
                {appointments.filter(a => a.status === "Scheduled").length} Pending
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-700/40 text-xs font-semibold text-slate-500 uppercase">
                  <tr>
                    <th>Patient Name</th>
                    <th>Consulting Doctor</th>
                    <th>Date & Time</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {appointments.map((apt) => (
                    <tr key={apt.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-700/10">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{apt.patientName}</div>
                        <div className="text-xs text-slate-400 font-mono">{apt.patientId}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-800 dark:text-slate-200 font-medium">{apt.doctorName}</div>
                        <div className="text-xs text-slate-400 font-mono">Fee: {formatCurrency(apt.consultationFee, countryCode)}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                        <div className="text-xs font-semibold">{formatDate(apt.date, countryCode)}</div>
                        <div className="text-xs flex items-center gap-1 mt-0.5 text-slate-400">
                          <Clock className="w-3.5 h-3.5" /> {apt.time}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          apt.status === "Scheduled" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" :
                          apt.status === "Completed" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" :
                          "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                        }`}>
                          {apt.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {apt.status === "Scheduled" && (
                          <button
                            onClick={() => handleCancelAppointment(apt.id)}
                            className="text-xs font-semibold text-rose-600 hover:underline"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-slate-800 dark:text-white text-base mb-4 flex items-center gap-1.5">
              <Calendar className="w-5 h-5 text-teal-600" />
              Schedule Appointment
            </h3>

            <form onSubmit={handleBookAppointment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Select Patient *</label>
                <select
                  required
                  value={aptPatientId}
                  onChange={(e) => setAptPatientId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                >
                  <option value="">-- Choose Patient --</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Select Doctor *</label>
                <select
                  required
                  value={aptDoctorId}
                  onChange={(e) => setAptDoctorId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                >
                  <option value="">-- Choose Doctor --</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.name} - {d.specialization}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={aptDate}
                    onChange={(e) => setAptDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Time *</label>
                  <input
                    type="time"
                    required
                    value={aptTime}
                    onChange={(e) => setAptTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Reason for consultation</label>
                <textarea
                  value={aptReason}
                  onChange={(e) => setAptReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white h-16 resize-none"
                  placeholder="Clinical symptoms description"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium text-sm rounded-lg transition"
              >
                Complete Appointment Booking
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- TAB CONTENT 2: OPD & DIGITAL Rx --- */}
      {activeSubTab === "opd" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/20 flex justify-between items-center">
              <h2 className="font-semibold text-slate-800 dark:text-white">OPD Clinical Logbook</h2>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search OPD records..."
                  className="pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-teal-500 w-48 transition-all"
                  value={opdSearch}
                  onChange={(e) => setOpdSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {opdRecords
                .filter(rec => 
                  rec.patientName.toLowerCase().includes(opdSearch.toLowerCase()) ||
                  rec.diagnosis.toLowerCase().includes(opdSearch.toLowerCase()) ||
                  rec.id.toLowerCase().includes(opdSearch.toLowerCase())
                )
                .map((rec) => (
                <div key={rec.id} className="p-5 hover:bg-slate-50/20 dark:hover:bg-slate-700/5 transition space-y-3">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white text-base">{rec.patientName}</div>
                      <div className="text-xs text-slate-400">Diagnosis of post-consultation visit on: {formatDate(rec.visitDate, countryCode)}</div>
                    </div>
                    <button
                      onClick={() => handlePrintPrescription(rec)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 text-xs font-semibold rounded border border-teal-200/50 hover:bg-teal-100 dark:hover:bg-teal-900 transition"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Digital Rx (PDF)
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 rounded">
                      <div className="font-semibold text-slate-500 mb-1">Symptoms Presenting</div>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{rec.symptoms}</p>
                    </div>

                    <div className="p-2.5 bg-teal-50/30 dark:bg-teal-950/20 border border-teal-100/50 dark:border-teal-900/30 rounded">
                      <div className="font-semibold text-teal-600 dark:text-teal-400 mb-1">Clinical Diagnosis</div>
                      <p className="text-teal-950 dark:text-teal-300 font-medium leading-relaxed">{rec.diagnosis}</p>
                    </div>
                  </div>

                  {/* Medicines list inside record */}
                  <div className="text-xs">
                    <div className="font-semibold text-slate-500 mb-2">Prescribed Active Therapeutics:</div>
                    <div className="flex flex-wrap gap-2">
                      {rec.prescription.map((p, pIdx) => (
                        <span key={pIdx} className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded border border-slate-200/60 font-medium">
                          {p.medicineName} • {p.dosage} ({p.duration})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-slate-800 dark:text-white text-base mb-4 flex items-center gap-1.5">
              <Stethoscope className="w-5 h-5 text-teal-600" />
              Log Outpatient Visit
            </h3>

            <form onSubmit={handleSaveOPD} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Select Patient *</label>
                <select
                  required
                  value={opdPatientId}
                  onChange={(e) => setOpdPatientId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none"
                >
                  <option value="">-- Select Patient --</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Consulting Doctor *</label>
                <select
                  required
                  value={opdDoctorId}
                  onChange={(e) => setOpdDoctorId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none"
                >
                  <option value="">-- Select Consultant --</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.specialization})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Symptom Notes *</label>
                <textarea
                  required
                  value={opdSymptoms}
                  onChange={(e) => setOpdSymptoms(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none h-16 resize-none"
                  placeholder="Describe active clinical complaints..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Diagnosis Conclusion *</label>
                <input
                  type="text"
                  required
                  value={opdDiagnosis}
                  onChange={(e) => setOpdDiagnosis(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none"
                  placeholder="Clinical final diagnosis"
                />
              </div>

              {/* Digital Prescription Drawer inside form */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-3 bg-slate-50/50 dark:bg-slate-900/30">
                <div className="text-xs font-bold text-slate-600 dark:text-slate-400">Prescription Lines ({prescriptionMedicines.length})</div>
                
                {prescriptionMedicines.length > 0 && (
                  <div className="space-y-1 bg-white dark:bg-slate-800 p-2 rounded border border-slate-100 max-h-24 overflow-y-auto">
                    {prescriptionMedicines.map((m, idx) => (
                      <div key={idx} className="text-xs text-slate-700 dark:text-slate-300 font-mono">
                        • {m.name} : {m.dose} ({m.duration})
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <input
                    type="text"
                    value={medName}
                    onChange={(e) => setMedName(e.target.value)}
                    className="w-full px-2.5 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-white focus:outline-none"
                    placeholder="Medicine Name (e.g. Lipitor 10mg)"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={medDose}
                      onChange={(e) => setMedDose(e.target.value)}
                      className="px-2.5 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-white focus:outline-none"
                      placeholder="Dose (1-0-1)"
                    />
                    <input
                      type="text"
                      value={medDuration}
                      onChange={(e) => setMedDuration(e.target.value)}
                      className="px-2.5 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-white focus:outline-none"
                      placeholder="Duration (5 Days)"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addMedLine}
                    className="w-full py-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 hover:dark:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded transition"
                  >
                    + Add Medication Line
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Follow-up Date</label>
                <input
                  type="date"
                  value={opdFollowUp}
                  onChange={(e) => setOpdFollowUp(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-lg transition"
              >
                Log OPD & Bill Prescription
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- TAB CONTENT 3: IPD WARD & BEDS MAP --- */}
      {activeSubTab === "ipd" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            
            {/* Bed Layout Map */}
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-xl p-5 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-slate-800 dark:text-white flex items-center gap-1.5">
                  <BedDouble className="w-5 h-5 text-teal-600" />
                  Live Bed Map & Occupancy Tracker
                </h2>
                <button
                  onClick={() => setShowAddBedModal(true)}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Bed
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {beds.map((bed) => {
                  const isOcc = bed.status === "Occupied";
                  return (
                    <div
                      key={bed.id}
                      className={`p-4 rounded-xl border flex flex-col justify-between h-28 relative overflow-hidden transition-all group ${
                        isOcc 
                          ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200/50 dark:border-rose-900/30" 
                          : "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-900/30"
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{bed.type}</span>
                          <span className={`w-2.5 h-2.5 rounded-full ${isOcc ? "bg-rose-500" : "bg-emerald-500"}`} />
                        </div>
                        <h4 className="font-bold text-lg text-slate-900 dark:text-white mt-1.5 font-mono">{bed.number}</h4>
                      </div>

                      <div className="mt-2 text-xs flex justify-between items-end">
                        {isOcc ? (
                          <div className="truncate font-semibold text-rose-800 dark:text-rose-400">
                            Occupied: {bed.patientName}
                          </div>
                        ) : (
                          <>
                            <div className="text-emerald-700 dark:text-emerald-400 font-medium">
                              {formatCurrency(bed.ratePerDay, countryCode)}/Day
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                DB.deleteBed(bed.id);
                                setBeds(DB.getBeds(hospitalId));
                                onLogAction("Delete Bed", `Deleted bed ${bed.number}`);
                              }}
                              className="text-slate-400 hover:text-rose-500 transition-all cursor-pointer p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Delete Bed"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* IPD Active Admissions */}
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/20">
                <h2 className="font-semibold text-slate-800 dark:text-white">Active Inpatient Ward Registrations</h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-700/40 text-xs font-semibold text-slate-500 uppercase">
                    <tr>
                      <th>Patient Admission</th>
                      <th>Room / Bed</th>
                      <th>Stay details</th>
                      <th>Clinical Supervisor</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {ipdRecords.filter(r => r.status === "Admitted").map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-700/10 text-xs">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900 dark:text-white">{rec.patientName}</div>
                          <div className="text-slate-400 font-mono mt-0.5">{rec.patientId}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-800 dark:text-slate-200 font-mono">{rec.bedNumber}</div>
                          <div className="text-slate-400 text-[10px] uppercase mt-0.5">{rec.wardName}</div>
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                          <div>Admitted: {formatDate(rec.admissionDate, countryCode)}</div>
                          <div className="text-[10px] text-slate-400 max-w-xs truncate mt-0.5">{rec.reasonForAdmission}</div>
                        </td>
                        <td className="px-6 py-4 text-slate-800 dark:text-slate-200 font-medium">
                          {rec.doctorInChargeName}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleDischargePatient(rec.id)}
                            className="px-2 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-semibold rounded hover:bg-rose-100 transition"
                          >
                            Discharge & Bill
                          </button>
                        </td>
                      </tr>
                    ))}
                    {ipdRecords.filter(r => r.status === "Admitted").length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                          No active admitted patients in the ward currently.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-slate-800 dark:text-white text-base mb-4 flex items-center gap-1.5">
              <Plus className="w-5 h-5 text-teal-600" />
              Admit Patient
            </h3>

            <form onSubmit={handleAdmitIPD} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Select Patient *</label>
                <select
                  required
                  value={ipdPatientId}
                  onChange={(e) => setIpdPatientId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none"
                >
                  <option value="">-- Choose Patient --</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Doctor-In-Charge *</label>
                <select
                  required
                  value={ipdDoctorId}
                  onChange={(e) => setIpdDoctorId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none"
                >
                  <option value="">-- Select Supervisor --</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.specialization})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Select Available Bed *</label>
                <select
                  required
                  value={ipdBedId}
                  onChange={(e) => setIpdBedId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none"
                >
                  <option value="">-- Select Bed --</option>
                  {beds.filter(b => b.status === "Available").map(b => (
                    <option key={b.id} value={b.id}>{b.number} - {b.type} ({formatCurrency(b.ratePerDay, countryCode)}/Day)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Admission Indication *</label>
                <textarea
                  required
                  value={ipdReason}
                  onChange={(e) => setIpdReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none h-20 resize-none"
                  placeholder="Reason for hospitalization"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-lg transition"
              >
                Execute IPD Admission
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- TAB CONTENT 4: DIAGNOSTICS LAB / RAD --- */}
      {activeSubTab === "lab" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/20 flex justify-between items-center">
              <h2 className="font-semibold text-slate-800 dark:text-white">Active Diagnostic Register (Lab/X-Ray)</h2>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search Diagnostics..."
                  className="pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-teal-500 w-48 transition-all"
                  value={diagSearch}
                  onChange={(e) => setDiagSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-700/40 text-xs text-slate-500 font-semibold uppercase">
                  <tr>
                    <th>Test ID</th>
                    <th>Patient Name</th>
                    <th>Test Spec</th>
                    <th>Billing Cost</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {labTests
                    .filter(test => 
                      test.patientName.toLowerCase().includes(diagSearch.toLowerCase()) ||
                      test.testName.toLowerCase().includes(diagSearch.toLowerCase()) ||
                      test.id.toLowerCase().includes(diagSearch.toLowerCase())
                    )
                    .map((test) => (
                      <tr key={test.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-700/10">
                      <td className="px-6 py-4 font-mono font-bold text-teal-600 dark:text-teal-400">{test.id}</td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{test.patientName}</div>
                        <div className="text-slate-400 font-mono mt-0.5">{test.patientId}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-800 dark:text-slate-200">{test.testName}</div>
                        <div className="text-slate-400 text-[10px] uppercase mt-0.5">{test.category} ({test.testType})</div>
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-700 dark:text-slate-300">
                        {formatCurrency(test.cost, countryCode)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase inline-flex items-center gap-1 ${
                          test.status === "Pending" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" :
                          test.status === "Sample Collected" ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" :
                          "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                        }`}>
                          {test.status}
                        </span>
                        {test.results && (
                          <div className="text-[10px] font-medium text-slate-500 italic max-w-xs truncate mt-1">
                            {test.results}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 space-x-2">
                        {!test.sampleCollected && (
                          <button
                            onClick={() => handleCollectSample(test.id)}
                            className="px-2 py-1 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 font-semibold rounded hover:bg-teal-100 transition"
                          >
                            Collect
                          </button>
                        )}
                        {test.status !== "Completed" && (
                          <button
                            onClick={() => handleInitiateResults(test)}
                            className="px-2 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 font-semibold rounded hover:bg-indigo-100 transition"
                          >
                            Results
                          </button>
                        )}
                        <button
                          onClick={() => handlePrintLabInvoice(test)}
                          className="px-2 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-semibold rounded hover:bg-amber-100 transition inline-flex items-center gap-1"
                          title="Generate and Print Invoice"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Invoice
                        </button>
                        {test.status === "Completed" && (
                          <button
                            onClick={() => handlePrintLabReport(test)}
                            className="px-2 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-semibold rounded hover:bg-emerald-100 transition inline-flex items-center gap-1"
                            title="Generate and Print Diagnostics Report"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Print Report
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            {/* Form 1: Book Test */}
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-xl p-5 shadow-sm">
              <h3 className="font-bold text-slate-800 dark:text-white text-base mb-4">Book Diagnostic Test</h3>
              
              <form onSubmit={handleBookLabTest} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Select Patient *</label>
                  <select
                    required
                    value={labPatientId}
                    onChange={(e) => setLabPatientId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                  >
                    <option value="">-- Choose Patient --</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Diagnostics Modality</label>
                    <select
                      value={testType}
                      onChange={(e) => setTestType(e.target.value as any)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800"
                    >
                      <option value="Laboratory">Laboratory</option>
                      <option value="Radiology">Radiology</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Category</label>
                    <select
                      value={labCategory}
                      onChange={(e) => setLabCategory(e.target.value as any)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800"
                    >
                      <option value="Hematology">Hematology</option>
                      <option value="Biochemistry">Biochemistry</option>
                      <option value="Microbiology">Microbiology</option>
                      <option value="Immunology">Immunology</option>
                      <option value="Radiology">Radiology</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Test Name *</label>
                  <input
                    type="text"
                    required
                    value={labTestName}
                    onChange={(e) => setLabTestName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                    placeholder="e.g. Brain MRI, Lipid Profile, CBC"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Test Billing Cost *</label>
                  <input
                    type="number"
                    required
                    value={labCost}
                    onChange={(e) => setLabCost(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-lg transition shadow-sm"
                >
                  Confirm Diagnostic Test
                </button>
              </form>
            </div>

            {/* Form 2: Enter Results */}
            {testResultId && (
              <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-xl p-5 shadow-sm border-l-4 border-l-indigo-600 animate-in slide-in-from-top-3">
                <h3 className="font-bold text-slate-800 dark:text-white text-base mb-3 flex items-center justify-between">
                  <span>Enter Findings: {testResultId}</span>
                  <button onClick={() => setTestResultId("")} className="text-slate-400 text-sm hover:text-slate-600">×</button>
                </h3>

                <form onSubmit={handleInputResult} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Report Form Template</label>
                    <select
                      value={selectedTemplate}
                      onChange={(e) => handleTemplateChange(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white mb-2 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="custom">Custom Plain Text / Descriptive Findings</option>
                      <option value="cbc">Complete Blood Count (CBC / Hemogram)</option>
                      <option value="lipid">Lipid Profile (Cholesterol, HDL, LDL, Triglycerides)</option>
                      <option value="lft">Liver Function Test (LFT)</option>
                      <option value="kft">Kidney Function Test (KFT)</option>
                      <option value="thyroid">Thyroid Profile (Total T3, T4, TSH)</option>
                      <option value="bloodsugar">Blood Sugar & Glycated Hb (Glucose, HbA1c)</option>
                      <option value="urine">Urine Routine Analysis (Color, pH, Albumin, Glucose, Micro)</option>
                      <option value="electrolytes">Serum Electrolytes (Sodium, Potassium, Chloride)</option>
                      <option value="vitamins">Vitamin Profile (Vitamin D3, Vitamin B12)</option>
                      <option value="iron_profile">Iron Profile / Iron Deficiency Panel</option>
                      <option value="coagulation">Coagulation Profile (PT, INR, APTT)</option>
                      <option value="cardiac">Cardiac Biomarkers (Troponin I, CK-MB)</option>
                      <option value="crp_esr">Inflammatory Markers (CRP, ESR)</option>
                      <option value="semen">Semen Analysis & Profile</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Referred By (Doctor Name)</label>
                    <input
                      type="text"
                      value={referredBy}
                      onChange={(e) => setReferredBy(e.target.value)}
                      placeholder="e.g. Dr. Attending Generalist, Self, etc."
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {selectedTemplate !== "custom" && (
                    <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg border border-slate-100 dark:border-slate-700/60 text-xs space-y-3">
                      <div className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide border-b border-slate-200/60 dark:border-slate-700/60 pb-1 flex justify-between">
                        <span>Analyte / Parameter</span>
                        <span>Observed Value</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1">
                        {selectedTemplate === "lipid" && [
                          { key: "total_cholesterol", label: "Total Cholesterol (mg/dL)" },
                          { key: "triglycerides", label: "Triglycerides (mg/dL)" },
                          { key: "hdl", label: "HDL Cholesterol (mg/dL)" },
                          { key: "ldl", label: "LDL Cholesterol (mg/dL)" },
                          { key: "vldl", label: "VLDL Cholesterol (mg/dL)" }
                        ].map((field) => (
                          <div key={field.key} className="flex items-center justify-between gap-2">
                            <span className="text-slate-700 dark:text-slate-300 font-medium">{field.label}</span>
                            <input
                              type="number"
                              step="0.01"
                              required
                              value={templateValues[field.key] || ""}
                              onChange={(e) => handleValueChange(field.key, e.target.value)}
                              className="w-24 px-2 py-1 text-right border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        ))}

                        {selectedTemplate === "cbc" && [
                          { key: "hemoglobin", label: "Hemoglobin (g/dL)" },
                          { key: "wbc", label: "Total WBC Count (/cu.mm)" },
                          { key: "rbc", label: "RBC Count (mil/cumm)" },
                          { key: "platelets", label: "Platelet Count (/cu.mm)" },
                          { key: "pcv", label: "Packed Cell Volume (%)" },
                          { key: "mcv", label: "Mean Corpuscular Volume (fL)" }
                        ].map((field) => (
                          <div key={field.key} className="flex items-center justify-between gap-2">
                            <span className="text-slate-700 dark:text-slate-300 font-medium">{field.label}</span>
                            <input
                              type="number"
                              step="0.01"
                              required
                              value={templateValues[field.key] || ""}
                              onChange={(e) => handleValueChange(field.key, e.target.value)}
                              className="w-24 px-2 py-1 text-right border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        ))}

                        {selectedTemplate === "lft" && [
                          { key: "bilirubin_total", label: "Total Bilirubin (mg/dL)" },
                          { key: "bilirubin_direct", label: "Direct Bilirubin (mg/dL)" },
                          { key: "sgot", label: "SGOT / AST (U/L)" },
                          { key: "sgpt", label: "SGPT / ALT (U/L)" },
                          { key: "alp", label: "Alkaline Phosphatase (ALP) (U/L)" },
                          { key: "total_protein", label: "Total Protein (g/dL)" },
                          { key: "albumin", label: "Serum Albumin (g/dL)" }
                        ].map((field) => (
                          <div key={field.key} className="flex items-center justify-between gap-2">
                            <span className="text-slate-700 dark:text-slate-300 font-medium">{field.label}</span>
                            <input
                              type="number"
                              step="0.01"
                              required
                              value={templateValues[field.key] || ""}
                              onChange={(e) => handleValueChange(field.key, e.target.value)}
                              className="w-24 px-2 py-1 text-right border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        ))}

                        {selectedTemplate === "kft" && [
                          { key: "urea", label: "Blood Urea (mg/dL)" },
                          { key: "bun", label: "BUN (mg/dL)" },
                          { key: "creatinine", label: "Serum Creatinine (mg/dL)" },
                          { key: "uric_acid", label: "Serum Uric Acid (mg/dL)" },
                          { key: "calcium", label: "Serum Calcium (mg/dL)" }
                        ].map((field) => (
                          <div key={field.key} className="flex items-center justify-between gap-2">
                            <span className="text-slate-700 dark:text-slate-300 font-medium">{field.label}</span>
                            <input
                              type="number"
                              step="0.01"
                              required
                              value={templateValues[field.key] || ""}
                              onChange={(e) => handleValueChange(field.key, e.target.value)}
                              className="w-24 px-2 py-1 text-right border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        ))}

                        {selectedTemplate === "thyroid" && [
                          { key: "t3", label: "Total T3 (ng/mL)" },
                          { key: "t4", label: "Total T4 (ug/dL)" },
                          { key: "tsh", label: "TSH (uIU/mL)" }
                        ].map((field) => (
                          <div key={field.key} className="flex items-center justify-between gap-2">
                            <span className="text-slate-700 dark:text-slate-300 font-medium">{field.label}</span>
                            <input
                              type="number"
                              step="0.01"
                              required
                              value={templateValues[field.key] || ""}
                              onChange={(e) => handleValueChange(field.key, e.target.value)}
                              className="w-24 px-2 py-1 text-right border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        ))}

                        {selectedTemplate === "bloodsugar" && [
                          { key: "fasting", label: "Fasting Glucose (mg/dL)", type: "number" },
                          { key: "post_prandial", label: "Post Prandial (mg/dL)", type: "number" },
                          { key: "hba1c", label: "HbA1c (% of Total)", type: "number" }
                        ].map((field) => (
                          <div key={field.key} className="flex items-center justify-between gap-2">
                            <span className="text-slate-700 dark:text-slate-300 font-medium">{field.label}</span>
                            <input
                              type={field.type}
                              step="0.01"
                              required
                              value={templateValues[field.key] || ""}
                              onChange={(e) => handleValueChange(field.key, e.target.value)}
                              className="w-24 px-2 py-1 text-right border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        ))}

                        {selectedTemplate === "urine" && [
                          { key: "urine_color", label: "Urine Color", type: "text" },
                          { key: "urine_ph", label: "Urine pH", type: "number" },
                          { key: "urine_sp_gravity", label: "Specific Gravity", type: "number" },
                          { key: "urine_protein", label: "Urine Protein", type: "text" },
                          { key: "urine_glucose", label: "Urine Glucose", type: "text" },
                          { key: "urine_pus_cells", label: "Pus Cells (/hpf)", type: "text" },
                          { key: "urine_epi_cells", label: "Epithelial Cells (/hpf)", type: "text" },
                          { key: "urine_rbc", label: "RBCs (/hpf)", type: "text" }
                        ].map((field) => (
                          <div key={field.key} className="flex items-center justify-between gap-2">
                            <span className="text-slate-700 dark:text-slate-300 font-medium">{field.label}</span>
                            <input
                              type={field.type}
                              step="0.001"
                              required
                              value={templateValues[field.key] || ""}
                              onChange={(e) => handleValueChange(field.key, e.target.value)}
                              className="w-24 px-2 py-1 text-right border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        ))}

                        {selectedTemplate === "electrolytes" && [
                          { key: "sodium", label: "Serum Sodium (mEq/L)", type: "number" },
                          { key: "potassium", label: "Serum Potassium (mEq/L)", type: "number" },
                          { key: "chloride", label: "Serum Chloride (mEq/L)", type: "number" }
                        ].map((field) => (
                          <div key={field.key} className="flex items-center justify-between gap-2">
                            <span className="text-slate-700 dark:text-slate-300 font-medium">{field.label}</span>
                            <input
                              type={field.type}
                              step="0.1"
                              required
                              value={templateValues[field.key] || ""}
                              onChange={(e) => handleValueChange(field.key, e.target.value)}
                              className="w-24 px-2 py-1 text-right border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        ))}

                        {selectedTemplate === "vitamins" && [
                          { key: "vit_d3", label: "Vitamin D3 (ng/mL)", type: "number" },
                          { key: "vit_b12", label: "Vitamin B12 (pg/mL)", type: "number" }
                        ].map((field) => (
                          <div key={field.key} className="flex items-center justify-between gap-2">
                            <span className="text-slate-700 dark:text-slate-300 font-medium">{field.label}</span>
                            <input
                              type={field.type}
                              step="0.1"
                              required
                              value={templateValues[field.key] || ""}
                              onChange={(e) => handleValueChange(field.key, e.target.value)}
                              className="w-24 px-2 py-1 text-right border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        ))}

                        {selectedTemplate === "iron_profile" && [
                          { key: "serum_iron", label: "Serum Iron (mcg/dL)", type: "number" },
                          { key: "ferritin", label: "Serum Ferritin (ng/mL)", type: "number" },
                          { key: "tibc", label: "Total Iron Binding (mcg/dL)", type: "number" },
                          { key: "transferrin_sat", label: "Transferrin Sat (%)", type: "number" }
                        ].map((field) => (
                          <div key={field.key} className="flex items-center justify-between gap-2">
                            <span className="text-slate-700 dark:text-slate-300 font-medium">{field.label}</span>
                            <input
                              type={field.type}
                              step="0.1"
                              required
                              value={templateValues[field.key] || ""}
                              onChange={(e) => handleValueChange(field.key, e.target.value)}
                              className="w-24 px-2 py-1 text-right border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        ))}

                        {selectedTemplate === "coagulation" && [
                          { key: "pt_patient", label: "PT - Patient (sec)", type: "number" },
                          { key: "pt_control", label: "PT - Control (sec)", type: "number" },
                          { key: "inr", label: "INR (Ratio)", type: "number" },
                          { key: "aptt", label: "APTT (sec)", type: "number" }
                        ].map((field) => (
                          <div key={field.key} className="flex items-center justify-between gap-2">
                            <span className="text-slate-700 dark:text-slate-300 font-medium">{field.label}</span>
                            <input
                              type={field.type}
                              step="0.01"
                              required
                              value={templateValues[field.key] || ""}
                              onChange={(e) => handleValueChange(field.key, e.target.value)}
                              className="w-24 px-2 py-1 text-right border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        ))}

                        {selectedTemplate === "cardiac" && [
                          { key: "troponin_i", label: "Troponin I (ng/mL)", type: "number" },
                          { key: "ck_mb", label: "CK-MB Mass (ng/mL)", type: "number" }
                        ].map((field) => (
                          <div key={field.key} className="flex items-center justify-between gap-2">
                            <span className="text-slate-700 dark:text-slate-300 font-medium">{field.label}</span>
                            <input
                              type={field.type}
                              step="0.001"
                              required
                              value={templateValues[field.key] || ""}
                              onChange={(e) => handleValueChange(field.key, e.target.value)}
                              className="w-24 px-2 py-1 text-right border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        ))}

                        {selectedTemplate === "crp_esr" && [
                          { key: "crp", label: "C-Reactive Protein (mg/L)", type: "number" },
                          { key: "esr", label: "ESR (mm/hr)", type: "number" }
                        ].map((field) => (
                          <div key={field.key} className="flex items-center justify-between gap-2">
                            <span className="text-slate-700 dark:text-slate-300 font-medium">{field.label}</span>
                            <input
                              type={field.type}
                              step="0.1"
                              required
                              value={templateValues[field.key] || ""}
                              onChange={(e) => handleValueChange(field.key, e.target.value)}
                              className="w-24 px-2 py-1 text-right border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        ))}

                        {selectedTemplate === "semen" && [
                          { key: "volume", label: "Volume (mL)", type: "number" },
                          { key: "sperm_count", label: "Sperm Count (M/mL)", type: "number" },
                          { key: "motility_total", label: "Total Motility (%)", type: "number" },
                          { key: "normal_morphology", label: "Normal Morphology (%)", type: "number" }
                        ].map((field) => (
                          <div key={field.key} className="flex items-center justify-between gap-2">
                            <span className="text-slate-700 dark:text-slate-300 font-medium">{field.label}</span>
                            <input
                              type={field.type}
                              step="0.1"
                              required
                              value={templateValues[field.key] || ""}
                              onChange={(e) => handleValueChange(field.key, e.target.value)}
                              className="w-24 px-2 py-1 text-right border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                      {labTests.find(t => t.id === testResultId)?.testType === "Radiology" ? "Signatory Doctor / Radiologist *" : "Signatory Doctor / Pathologist *"}
                    </label>
                    <select
                      required
                      value={selectedDoctorId}
                      onChange={(e) => setSelectedDoctorId(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500 mb-2"
                    >
                      <option value="">-- Select Signatory Doctor --</option>
                      {doctors.filter(doc => {
                        const spec = (doc.specialization || "").toLowerCase();
                        const dept = (doc.department || "").toLowerCase();
                        const isRadiology = labTests.find(t => t.id === testResultId)?.testType === "Radiology";
                        if (isRadiology) {
                          return spec.includes("radiolog") || dept.includes("radiolog");
                        } else {
                          return (
                            spec.includes("patholog") || 
                            dept.includes("patholog") ||
                            dept.includes("diagnost")
                          );
                        }
                      }).map(doc => (
                        <option key={doc.id} value={doc.id}>
                          {doc.name} ({doc.specialization})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                      {selectedTemplate === "custom" ? "Laboratory Findings & Observations *" : "Additional Remarks & Pathologist Notes (Optional)"}
                    </label>
                    <textarea
                      required={selectedTemplate === "custom"}
                      value={testResultText}
                      onChange={(e) => setTestResultText(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white h-24 resize-none focus:outline-none focus:border-indigo-500"
                      placeholder={selectedTemplate === "custom" ? "Input clinical findings, reference levels, etc." : "Input optional recommendations, clinical notes, or suggestions..."}
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded transition shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Authorize & Sign Lab Report
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB CONTENT 5: EMERGENCY, AMBULANCES & BLOOD BANK --- */}
      {activeSubTab === "emergency" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            
            {/* Ambulance Fleets */}
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/20 flex justify-between items-center">
                <h2 className="font-semibold text-slate-800 dark:text-white">Hospital Emergency Ambulance Fleet</h2>
                <span className="text-xs font-mono font-bold text-rose-600 animate-pulse">24/7 ACTIVE REGISTRY</span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {ambulances.map((amb) => (
                  <div key={amb.id} className="p-4 flex items-center justify-between gap-4 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">{amb.vehicleNumber}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          amb.status === "Available" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" :
                          amb.status === "On Trip" ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400" :
                          "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                        }`}>
                          {amb.status}
                        </span>
                      </div>
                      <div className="text-slate-400 mt-1">{amb.model} • Driver: {amb.driverName} ({amb.driverPhone})</div>
                      
                      {/* Active trip rendering */}
                      {amb.trips.filter(t => t.status === "Active").map((trip, idx) => (
                        <div key={idx} className="mt-2 text-rose-700 dark:text-rose-400 font-semibold flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 animate-spin" />
                          Emergency Trip: {trip.destination} ({trip.purpose})
                        </div>
                      ))}
                    </div>

                    <div>
                      {amb.status === "On Trip" && (
                        <button
                          onClick={() => handleReturnAmbulance(amb.id)}
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded transition"
                        >
                          Complete Return
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ambulance Trip History / Report */}
            {(() => {
              const allAmbulanceTrips = ambulances.flatMap(amb => 
                (amb.trips || []).map((trip, idx) => ({
                  ...trip,
                  uniqueId: `${amb.id}-trip-${idx}`,
                  vehicleId: amb.id,
                  vehicleNumber: amb.vehicleNumber,
                  model: amb.model,
                  driverName: amb.driverName,
                  driverPhone: amb.driverPhone
                }))
              ).sort((a, b) => b.date.localeCompare(a.date));

              const filteredTrips = allAmbulanceTrips.filter(t => {
                if (!tripSearch) return true;
                const search = tripSearch.toLowerCase();
                return (
                  t.vehicleNumber.toLowerCase().includes(search) ||
                  t.model.toLowerCase().includes(search) ||
                  t.driverName.toLowerCase().includes(search) ||
                  t.destination.toLowerCase().includes(search) ||
                  t.purpose.toLowerCase().includes(search)
                );
              });

              return (
                <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-xl p-5 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                    <h2 className="font-semibold text-slate-800 dark:text-white flex items-center gap-1.5">
                      <History className="w-5 h-5 text-indigo-600" />
                      Ambulance Mission Reports & History Ledger
                    </h2>
                    <span className="text-xs bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 px-2.5 py-1 rounded-lg font-mono font-medium">
                      Total {filteredTrips.length} Missions
                    </span>
                  </div>

                  {/* Search bar */}
                  <div className="relative mb-4">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                      <Search className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      placeholder="Search trip reports by Vehicle No., Driver, Destination or Purpose..."
                      value={tripSearch}
                      onChange={(e) => setTripSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white placeholder:text-slate-400"
                    />
                  </div>

                  {filteredTrips.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">
                      {tripSearch ? "No trips matched your search filter." : "No ambulance missions logged yet. Dispatch an ambulance to see the report here."}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                            <th className="pb-2">Date</th>
                            <th className="pb-2">Vehicle / Model</th>
                            <th className="pb-2">Crew / Driver</th>
                            <th className="pb-2">Destination</th>
                            <th className="pb-2">Trauma Symptom / Reason</th>
                            <th className="pb-2 text-right">Mission Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {filteredTrips.map((trip) => (
                            <tr key={trip.uniqueId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                              <td className="py-3 text-slate-500 dark:text-slate-400 font-mono font-medium">{trip.date}</td>
                              <td className="py-3">
                                <div className="font-bold text-slate-800 dark:text-slate-200">{trip.vehicleNumber}</div>
                                <div className="text-[10px] text-slate-400">{trip.model}</div>
                              </td>
                              <td className="py-3">
                                <div className="font-medium text-slate-700 dark:text-slate-300">{trip.driverName}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{trip.driverPhone}</div>
                              </td>
                              <td className="py-3 font-medium text-slate-700 dark:text-slate-300">
                                {trip.destination}
                              </td>
                              <td className="py-3 text-slate-500 dark:text-slate-400">
                                {trip.purpose}
                              </td>
                              <td className="py-3 text-right">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                                  trip.status === "Active"
                                    ? "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 animate-pulse"
                                    : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                                }`}>
                                  {trip.status === "Active" ? (
                                    <>
                                      <Clock className="w-3 h-3 animate-spin" />
                                      On Mission (Siren On)
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="w-3 h-3" />
                                      Returned (Safe)
                                    </>
                                  )}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Blood Inventory Display */}
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-xl p-5 shadow-sm">
              <h2 className="font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-1.5">
                <Droplets className="w-5 h-5 text-red-600 animate-pulse" />
                Live Blood Bank Stock Indicators
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                {Object.entries(bloodStock).filter(([k]) => k !== "hospitalId").map(([bg, qty]: any) => {
                  const qtyNum = Number(qty);
                  return (
                    <div key={bg} className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center font-bold text-xs">
                        {bg}
                      </div>
                      <div className="font-bold text-lg font-mono mt-2 text-slate-900 dark:text-white">{qtyNum}</div>
                      <div className="text-[10px] text-slate-400 font-medium">Units</div>
                      
                      {/* Progress bar represent */}
                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-1 rounded-full mt-2.5 overflow-hidden">
                        <div 
                          className={`h-full ${qtyNum < 3 ? "bg-red-500" : qtyNum < 8 ? "bg-amber-500" : "bg-emerald-500"}`} 
                          style={{ width: `${Math.min(100, (qtyNum / 25) * 100)}%` }} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Blood Transaction Ledger */}
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-xl p-5 shadow-sm mt-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <h2 className="font-semibold text-slate-800 dark:text-white flex items-center gap-1.5">
                  <FileText className="w-5 h-5 text-red-600" />
                  Blood Bank Register & History (Aaya-Gaya Record)
                </h2>
                <div className="flex items-center gap-3">
                  <span className="text-xs bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 px-2.5 py-1 rounded-lg font-mono">
                    {bloodTransactions.length} Total
                  </span>
                </div>
              </div>

              {/* Search Bar Input */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search by Donor/Patient Name, Blood Group (e.g., O+, B-), Type (Aaya/In, Gaya/Out), Purpose..."
                    value={bloodSearch}
                    onChange={(e) => setBloodSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 transition"
                  />
                </div>
              </div>

              {(() => {
                const filteredTransactions = bloodTransactions.filter(tx => {
                  const q = bloodSearch.toLowerCase().trim();
                  if (!q) return true;
                  const typeText = tx.type === "Incoming" ? "aaya in" : "gaya out";
                  return (
                    tx.personName.toLowerCase().includes(q) ||
                    tx.bloodGroup.toLowerCase().includes(q) ||
                    (tx.purpose || "").toLowerCase().includes(q) ||
                    tx.type.toLowerCase().includes(q) ||
                    typeText.includes(q) ||
                    tx.date.includes(q)
                  );
                });

                if (filteredTransactions.length === 0) {
                  return (
                    <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">
                      {bloodTransactions.length === 0 
                        ? "No blood transactions logged yet. Use the right-hand panel to record donations, manual intake, or releases."
                        : "No matching transactions found for your search."}
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                          <th className="pb-2">Date</th>
                          <th className="pb-2">Type</th>
                          <th className="pb-2">Group</th>
                          <th className="pb-2">Qty</th>
                          <th className="pb-2">Person Name / Source</th>
                          <th className="pb-2">Purpose / Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {filteredTransactions.slice().reverse().map((tx) => (
                          <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-2.5 text-slate-500 dark:text-slate-400 font-mono">{tx.date}</td>
                            <td className="py-2.5">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                tx.type === "Incoming"
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                                  : "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400"
                              }`}>
                                {tx.type === "Incoming" ? "Aaya (In)" : "Gaya (Out)"}
                              </span>
                            </td>
                            <td className="py-2.5 font-bold text-slate-800 dark:text-slate-200">
                              <span className="inline-block px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300">
                                {tx.bloodGroup}
                              </span>
                            </td>
                            <td className="py-2.5 font-mono font-semibold text-slate-800 dark:text-slate-200">{tx.units} Unit</td>
                            <td className="py-2.5 font-medium text-slate-700 dark:text-slate-300">{tx.personName}</td>
                            <td className="py-2.5 text-slate-500 dark:text-slate-400">{tx.purpose || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="space-y-6">
            {/* Ambulance dispatch form */}
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-xl p-5 shadow-sm">
              <h3 className="font-bold text-slate-800 dark:text-white text-base mb-4 flex items-center gap-1.5">
                <Truck className="w-5 h-5 text-rose-600 animate-bounce" />
                Dispatch Trauma Vehicle
              </h3>

              <form onSubmit={handleDispatchAmbulance} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Select Available Vehicle *</label>
                  <select
                    required
                    value={dispatchAmbId}
                    onChange={(e) => setDispatchAmbId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white dark:bg-slate-800"
                  >
                    <option value="">-- Select Available --</option>
                    {ambulances.filter(a => a.status === "Available").map(a => (
                      <option key={a.id} value={a.id}>{a.vehicleNumber} ({a.driverName})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Incident Destination *</label>
                  <input
                    type="text"
                    required
                    value={dispatchDest}
                    onChange={(e) => setDispatchDest(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                    placeholder="e.g. Sector 5 Traffic Crossing"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Trauma Indication / Symptoms</label>
                  <input
                    type="text"
                    required
                    value={dispatchReason}
                    onChange={(e) => setDispatchReason(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                    placeholder="e.g. Suspected stroke pick-up"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm rounded-lg transition shadow-sm"
                >
                  Engage Emergency Siren
                </button>
              </form>
            </div>

            {/* Register New Ambulance vehicle */}
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-xl p-5 shadow-sm">
              <h3 className="font-bold text-slate-800 dark:text-white text-base mb-4 flex items-center gap-1.5">
                <Plus className="w-5 h-5 text-indigo-600" />
                Register New Emergency Vehicle
              </h3>

              <form onSubmit={handleAddAmbulance} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Vehicle Plate Number *</label>
                  <input
                    type="text"
                    required
                    value={newVehNumber}
                    onChange={(e) => setNewVehNumber(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                    placeholder="e.g. MH-12-PQ-4567"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Vehicle Model / Type *</label>
                  <input
                    type="text"
                    required
                    value={newVehModel}
                    onChange={(e) => setNewVehModel(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                    placeholder="e.g. Advanced ICU Trauma Care"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Driver Name *</label>
                    <input
                      type="text"
                      required
                      value={newVehDriverName}
                      onChange={(e) => setNewVehDriverName(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                      placeholder="e.g. Ramesh Singh"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Driver Phone *</label>
                    <input
                      type="text"
                      required
                      value={newVehDriverPhone}
                      onChange={(e) => setNewVehDriverPhone(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                      placeholder="e.g. +91 98765-43210"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg transition shadow-sm"
                >
                  Register Vehicle & Crew
                </button>
              </form>
            </div>

            {/* Blood Bank Actions Card */}
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-xl p-5 shadow-sm">
              <h3 className="font-bold text-slate-800 dark:text-white text-base mb-3 flex items-center gap-1.5">
                <Droplets className="w-5 h-5 text-red-600 animate-pulse" />
                Manage Blood Bank Inventory
              </h3>

              {/* Sub-tabs selector */}
              <div className="flex bg-slate-50 dark:bg-slate-900 p-1 rounded-xl mb-4 border border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setBloodActionTab("donate")}
                  className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    bloodActionTab === "donate"
                      ? "bg-white dark:bg-slate-800 text-red-600 shadow-sm border border-slate-100 dark:border-slate-700"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Donation (Aaya)
                </button>
                <button
                  type="button"
                  onClick={() => setBloodActionTab("issue")}
                  className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    bloodActionTab === "issue"
                      ? "bg-white dark:bg-slate-800 text-red-600 shadow-sm border border-slate-100 dark:border-slate-700"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Issue (Gaya)
                </button>
                <button
                  type="button"
                  onClick={() => setBloodActionTab("intake")}
                  className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    bloodActionTab === "intake"
                      ? "bg-white dark:bg-slate-800 text-red-600 shadow-sm border border-slate-100 dark:border-slate-700"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Manual Intake
                </button>
              </div>

              {bloodActionTab === "donate" && (
                <form onSubmit={handleAddDonor} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Donor Name *</label>
                    <input
                      type="text"
                      required
                      value={donorName}
                      onChange={(e) => setDonorName(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                      placeholder="e.g. Rahul Dravid"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Blood Group *</label>
                      <select
                        value={donorBg}
                        onChange={(e) => setDonorBg(e.target.value as any)}
                        className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white dark:bg-slate-800"
                      >
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Phone Number *</label>
                      <input
                        type="text"
                        required
                        value={donorPhone}
                        onChange={(e) => setDonorPhone(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                        placeholder="e.g. 9876543210"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Address *</label>
                    <textarea
                      required
                      rows={2}
                      value={donorAddress}
                      onChange={(e) => setDonorAddress(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white placeholder-slate-400"
                      placeholder="e.g. 123, Stadium Road, Bangalore"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm rounded-lg transition"
                  >
                    Log Donation (Adds 1 Unit)
                  </button>
                </form>
              )}

              {bloodActionTab === "issue" && (
                <form onSubmit={handleIssueBlood} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Patient Name *</label>
                    <input
                      type="text"
                      required
                      value={issuePatientName}
                      onChange={(e) => setIssuePatientName(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                      placeholder="e.g. Patient or Ward Name"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Blood Group *</label>
                      <select
                        value={issueBloodBg}
                        onChange={(e) => setIssueBloodBg(e.target.value as any)}
                        className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white dark:bg-slate-800"
                      >
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Units (Qty) *</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={issueUnits}
                        onChange={(e) => setIssueUnits(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Purpose / Details</label>
                    <input
                      type="text"
                      value={issuePurpose}
                      onChange={(e) => setIssuePurpose(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                      placeholder="e.g. Major Surgery, ER emergency"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm rounded-lg transition"
                  >
                    Release & Deduct Blood (Gaya)
                  </button>
                </form>
              )}

              {bloodActionTab === "intake" && (
                <form onSubmit={handleAddBloodStock} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Source / Provider *</label>
                    <input
                      type="text"
                      required
                      value={addStockProvider}
                      onChange={(e) => setAddStockProvider(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                      placeholder="e.g. Red Cross Society, City Blood Bank"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Blood Group *</label>
                      <select
                        value={addStockBg}
                        onChange={(e) => setAddStockBg(e.target.value as any)}
                        className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white dark:bg-slate-800"
                      >
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Units (Qty) *</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={addStockUnits}
                        onChange={(e) => setAddStockUnits(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Remarks / Note</label>
                    <input
                      type="text"
                      value={addStockPurpose}
                      onChange={(e) => setAddStockPurpose(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                      placeholder="e.g. External bulk procurement"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-lg transition"
                  >
                    Add to Stock (Aaya)
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- ADD BED MODAL --- */}
      {showAddBedModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 dark:text-white text-lg">Add New Bed</h3>
              <button onClick={() => setShowAddBedModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddBed} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Bed Number / Name</label>
                <input
                  required
                  type="text"
                  value={newBedNumber}
                  onChange={(e) => setNewBedNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                  placeholder="e.g. Bed 101"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">Category</label>
                <select
                  value={newBedType}
                  onChange={(e) => setNewBedType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                >
                  <option value="General Ward">General Ward</option>
                  <option value="Semi-Private">Semi-Private</option>
                  <option value="Private Suite">Private Suite</option>
                  <option value="ICU">ICU</option>
                </select>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddBedModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition shadow-sm"
                >
                  Add Bed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- SUCCESS MODAL: BLOOD DONOR --- */}
      {lastRegisteredDonor && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="w-10 h-10" />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-white text-base">Blood Donor Registered Successfully!</h3>
              <p className="text-xs text-slate-500">The donor has been added to the hospital registry and 1 unit of blood has been added to stock.</p>
              
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-left relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-5">
                  <Droplets className="w-12 h-12 text-red-600" />
                </div>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-mono font-bold text-red-600 dark:text-red-400 text-[10px] leading-tight">{lastRegisteredDonor.id}</div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate">{lastRegisteredDonor.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[20px] font-black text-red-600 dark:text-red-400 leading-none">{lastRegisteredDonor.bloodGroup}</div>
                    <div className="text-[8px] font-bold text-slate-400 uppercase">Blood Group</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                   <div>
                     <span className="text-slate-400 block">Phone</span>
                     <span className="font-semibold text-slate-700 dark:text-slate-300">{lastRegisteredDonor.phone}</span>
                   </div>
                   <div>
                     <span className="text-slate-400 block">Last Donated</span>
                     <span className="font-semibold text-slate-700 dark:text-slate-300">{lastRegisteredDonor.lastDonatedDate}</span>
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => setLastRegisteredDonor(null)}
                  className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-lg hover:bg-slate-200 transition"
                >
                  Close
                </button>
                <button
                  onClick={() => handlePrintCard(lastRegisteredDonor)}
                  className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition flex items-center justify-center gap-1.5 shadow-md shadow-red-200/20"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Donor Card
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
