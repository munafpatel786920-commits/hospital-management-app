/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { DB } from "../lib/db";
import { 
  Medicine, BillingInvoice, EmployeeHR, UserRole, Hospital, Patient, MedicinePurchase, Expense
} from "../types";
import { translate, formatDate, formatCurrency, COUNTRIES } from "../lib/i18n";
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area
} from "recharts";
import { 
  Pill, Receipt, Users, FileText, Settings, Plus, RefreshCw, 
  AlertTriangle, DollarSign, Download, Save, CheckCircle2, ShieldCheck, X, Printer,
  Search, ShoppingCart, Trash2, Truck, History, ClipboardList, Archive, Database, Upload
} from "lucide-react";

interface SupportModulesProps {
  hospitalId: string;
  countryCode: string;
  currentLanguage: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  hospitalDetails: Hospital;
  onRefreshHospital: () => void;
  onLogAction: (action: string, details: string) => void;
  activeSubTab: "pharmacy" | "billing" | "hr" | "reports" | "settings";
}

export default function SupportModules({
  hospitalId,
  countryCode,
  currentLanguage,
  userId,
  userName,
  userRole,
  hospitalDetails,
  onRefreshHospital,
  onLogAction,
  activeSubTab
}: SupportModulesProps) {
  const config = COUNTRIES[countryCode] || COUNTRIES.US;
  
  // State caches
  const [medicines, setMedicines] = useState<Medicine[]>(DB.getMedicines(hospitalId));
  const [invoices, setInvoices] = useState<BillingInvoice[]>(DB.getBillingInvoices(hospitalId));
  const [employees, setEmployees] = useState<EmployeeHR[]>(DB.getHRRecord(hospitalId));
  const [patients, setPatients] = useState<Patient[]>(DB.getPatients(hospitalId));
  const [staffSearch, setStaffSearch] = useState("");

  // --- 1. PHARMACY POS CART & OPERATIONS ---
  const [pharmMainTab, setPharmMainTab] = useState<"stocks" | "purchases">("stocks");
  const [purchases, setPurchases] = useState<MedicinePurchase[]>(DB.getMedicinePurchases(hospitalId));
  const [expenses, setExpenses] = useState<Expense[]>(DB.getExpenses(hospitalId));
  const [rightPanelTab, setRightPanelTab] = useState<"cart" | "purchase" | "add">("cart");
  const [pharmSearch, setPharmSearch] = useState("");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [expenseSearch, setExpenseSearch] = useState("");
  const [cart, setCart] = useState<{ id: string; name: string; price: number; quantity: number; maxStock: number }[]>([]);
  const [checkoutPatientType, setCheckoutPatientType] = useState<"walkin" | "registered">("walkin");
  const [walkinPatientName, setWalkinPatientName] = useState("Walk-In Pharmacy Patient");
  const [walkinPatientPhone, setWalkinPatientPhone] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<"Cash" | "Card" | "UPI" | "Insurance">("Cash");
  const [checkoutDiscount, setCheckoutDiscount] = useState("0");

  const [newMedName, setNewMedName] = useState("");
  const [newMedCat, setNewMedCat] = useState("Antibiotics");
  const [newMedStock, setNewMedStock] = useState("100");
  const [newMedPrice, setNewMedPrice] = useState("10");
  const [newMedExpiry, setNewMedExpiry] = useState("2027-12-31");
  const [newMedAlert, setNewMedAlert] = useState("20");
  const [restockId, setRestockId] = useState("");
  const [restockQty, setRestockQty] = useState("50");

  // Supplier Purchase Form state
  const [purchaseMedId, setPurchaseMedId] = useState("");
  const [purchaseSupplier, setPurchaseSupplier] = useState("");
  const [purchaseInvoiceNo, setPurchaseInvoiceNo] = useState("");
  const [purchaseQty, setPurchaseQty] = useState("");
  const [purchasePriceVal, setPurchasePriceVal] = useState("");
  const [purchaseExpiry, setPurchaseExpiry] = useState("2027-12-31");
  const [purchaseDateVal, setPurchaseDateVal] = useState(new Date().toISOString().split("T")[0]);
  const [purchaseStatusMsg, setPurchaseStatusMsg] = useState("");

  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("Utility");
  const [showExpenseForm, setShowExpenseForm] = useState(false);

  const handleAddToCart = (med: Medicine) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === med.id);
      if (existing) {
        if (existing.quantity >= med.stock) return prev;
        return prev.map(item => item.id === med.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { id: med.id, name: med.name, price: med.price, quantity: 1, maxStock: med.stock }];
    });
    setRightPanelTab("cart");
  };

  const handleUpdateCartQty = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + delta;
        if (newQty <= 0) return null;
        if (newQty > item.maxStock) return item;
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(Boolean) as typeof cart);
  };

  const handleRemoveFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const handleCartCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    let patientId = "WALK-IN";
    let patientName = walkinPatientName || "Walk-In Pharmacy Patient";
    if (checkoutPatientType === "registered") {
      const foundPat = patients.find(p => p.id === selectedPatientId);
      if (foundPat) {
        patientId = foundPat.id;
        patientName = foundPat.name;
      }
    }

    // Deduct stock
    cart.forEach(item => {
      DB.sellMedicine(item.id, item.quantity, userId, userName, userRole);
    });

    // Subtotal and Calculations
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const taxRate = hospitalDetails.taxRate || 0.18;
    const taxAmount = Math.round(subtotal * taxRate);
    const discountAmount = Number(checkoutDiscount) || 0;
    const total = Math.max(0, subtotal + taxAmount - discountAmount);

    const invoiceItems = cart.map(item => ({
      description: `Pharmacy Compound: ${item.name} x ${item.quantity}`,
      amount: item.price * item.quantity
    }));

    const newInvoiceId = `INV-${Math.floor(400000 + Math.random() * 90000)}`;

    const newInvoice: BillingInvoice = {
      id: newInvoiceId,
      hospitalId,
      patientId,
      patientName,
      type: "Pharmacy",
      items: invoiceItems,
      subtotal,
      taxAmount,
      discount: discountAmount,
      total,
      status: "Paid",
      paymentMethod: checkoutPaymentMethod,
      createdAt: new Date().toISOString()
    };

    DB.addBillingInvoice(newInvoice, userId, userName, userRole);

    // Refresh states
    setMedicines(DB.getMedicines(hospitalId));
    setInvoices(DB.getBillingInvoices(hospitalId));
    setCart([]);
    setWalkinPatientName("Walk-In Pharmacy Patient");
    setWalkinPatientPhone("");
    setCheckoutDiscount("0");

    onLogAction("Dispense Medicine POS", `Checked out ${invoiceItems.length} items for ${patientName}`);

    // Print Receipt directly!
    handlePrintInvoice(newInvoiceId, newInvoice);
  };

  const handleRegisterMedicine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedName || !newMedStock || !newMedPrice) return;

    const med: Medicine = {
      id: `MED-${Math.floor(100 + Math.random() * 900)}`,
      hospitalId,
      name: newMedName,
      category: newMedCat,
      stock: Number(newMedStock),
      minStockAlert: Number(newMedAlert),
      price: Number(newMedPrice),
      expiryDate: newMedExpiry,
      manufacturer: "Cipla Pharmaceuticals",
      location: "Shelf A-1",
      createdAt: new Date().toISOString()
    };

    DB.addMedicine(med);
    setMedicines(DB.getMedicines(hospitalId));

    setNewMedName("");
    setNewMedStock("100");
    setNewMedPrice("10");
    onLogAction("Register Medicine", `Added new pharmacy compound ${med.name} with ${med.stock} units`);
  };

  const handleRestock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockId || !restockQty) return;

    DB.restockMedicine(restockId, Number(restockQty));
    setMedicines(DB.getMedicines(hospitalId));
    setRestockId("");
    onLogAction("Restock Pharmacy", `Replenished medicine ${restockId} stock count by ${restockQty}`);
  };

  const handleRegisterPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseMedId || !purchaseSupplier || !purchaseInvoiceNo || !purchaseQty || !purchasePriceVal) {
      setPurchaseStatusMsg("Error: Please fill in all purchase fields.");
      return;
    }

    const selectedMed = medicines.find(m => m.id === purchaseMedId);
    if (!selectedMed) {
      setPurchaseStatusMsg("Error: Selected medicine not found.");
      return;
    }

    const qty = Number(purchaseQty);
    const pPrice = Number(purchasePriceVal);
    const total = qty * pPrice;

    const purchase: MedicinePurchase = {
      id: `PUR-${Math.floor(100000 + Math.random() * 900000)}`,
      hospitalId,
      medicineId: purchaseMedId,
      medicineName: selectedMed.name,
      supplierName: purchaseSupplier,
      invoiceNumber: purchaseInvoiceNo,
      quantity: qty,
      purchasePrice: pPrice,
      expiryDate: purchaseExpiry,
      purchaseDate: purchaseDateVal,
      totalAmount: total
    };

    DB.addMedicinePurchase(purchase);

    // Add to Expenses Ledger
    const purchaseExpense: Expense = {
      id: `EXP-PUR-${purchase.id}`,
      hospitalId,
      description: `Medicine Purchase: ${selectedMed.name} (${qty} units) - Inv: ${purchaseInvoiceNo}`,
      amount: total,
      date: purchaseDateVal,
      category: "Medicine"
    };
    DB.addExpense(purchaseExpense);

    // Refresh states
    setMedicines(DB.getMedicines(hospitalId));
    setPurchases(DB.getMedicinePurchases(hospitalId));
    setExpenses(DB.getExpenses(hospitalId));

    // Clear form
    setPurchaseSupplier("");
    setPurchaseInvoiceNo("");
    setPurchaseQty("");
    setPurchasePriceVal("");
    setPurchaseStatusMsg(`Success: Purchased ${qty} units of ${selectedMed.name} registered successfully!`);

    // Clear success message after 5 seconds
    setTimeout(() => {
      setPurchaseStatusMsg("");
    }, 5000);

    onLogAction("Register Medicine Purchase", `Purchased ${qty} units of ${selectedMed.name} from ${purchaseSupplier} for ${total}`);
  };

  const handleSellMed = (id: string, qty: number) => {
    const med = medicines.find(m => m.id === id);
    if (!med || med.stock < qty) return;

    DB.sellMedicine(id, qty, userId, userName, userRole);
    setMedicines(DB.getMedicines(hospitalId));

    // Register pharmacy billing automatically
    const medTotal = med.price * qty;
    const items = [{ description: `Pharmacy Dispensation: ${med.name} x ${qty}`, amount: medTotal }];
    const subtotal = medTotal;
    const taxAmount = Math.round(subtotal * (hospitalDetails.taxRate || 0.18));
    const newInvoiceId = `INV-${Math.floor(400000 + Math.random() * 90000)}`;

    const newInvoice: BillingInvoice = {
      id: newInvoiceId,
      hospitalId,
      patientId: "WALK-IN",
      patientName: "Walk-In Pharmacy Patient",
      type: "Pharmacy",
      items,
      subtotal,
      taxAmount,
      discount: 0,
      total: subtotal + taxAmount,
      status: "Paid",
      paymentMethod: "Cash",
      createdAt: new Date().toISOString()
    };

    DB.addBillingInvoice(newInvoice, userId, userName, userRole);

    setInvoices(DB.getBillingInvoices(hospitalId));
    onLogAction("Dispense Medicine", `Sold ${qty} units of ${med.name} and logged transaction.`);

    // Instant PDF Print Trigger!
    handlePrintInvoice(newInvoiceId, newInvoice);
  };

  // --- 2. BILLING OPERATIONS ---
  const handleCollectBill = (id: string, method: "Cash" | "Card" | "UPI" | "Insurance") => {
    DB.updateInvoiceStatus(id, "Paid", method);
    setInvoices(DB.getBillingInvoices(hospitalId));
    onLogAction("Collect Payment", `Recorded bill receipt for Invoice ID ${id} via ${method}`);
  };

  const handleDeleteExpense = (id: string) => {
    DB.deleteExpense(id);
    setExpenses(DB.getExpenses(hospitalId));
    onLogAction("Delete Expense", `Deleted expense entry ${id}`);
  };

  const handlePrintLedger = () => {
    const doc = new jsPDF();
    const config = COUNTRIES[countryCode] || COUNTRIES.US;
    
    const formatNum = (num: number) => {
      return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // Header
    doc.setFillColor(13, 148, 136);
    doc.rect(0, 0, 210, 40, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(22);
    doc.text("UNIFIED FINANCIAL LEDGER", 105, 20, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("Helvetica", "normal");
    doc.text(`${hospitalDetails.name} - Official Financial Statement`, 105, 28, { align: "center" });
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 105, 34, { align: "center" });

    // Summary Section
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.setFont("Helvetica", "bold");
    doc.text("Financial Summary", 15, 55);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Total Income: ${config.currency} ${formatNum(totalPaid)}`, 15, 65);
    doc.text(`Total Expenses: ${config.currency} ${formatNum(totalExpenses)}`, 15, 72);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(13, 148, 136);
    doc.text(`Net Balance: ${config.currency} ${formatNum(totalPaid - totalExpenses)}`, 15, 82);

    // Table Header
    doc.setFillColor(241, 245, 249);
    doc.rect(15, 95, 180, 10, "F");
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(9);
    doc.text("DATE", 20, 101);
    doc.text("ID / REF", 45, 101);
    doc.text("TYPE", 80, 101);
    doc.text("DESCRIPTION", 105, 101);
    doc.text("AMOUNT", 185, 101, { align: "right" });

    // Table Content
    let y = 112;
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(30, 41, 59);
    
    filteredLedger.forEach((item, index) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
        // Re-draw header for new page
        doc.setFillColor(241, 245, 249);
        doc.rect(15, y - 5, 180, 10, "F");
        doc.setTextColor(71, 85, 105);
        doc.text("DATE", 20, y + 1);
        doc.text("ID / REF", 45, y + 1);
        doc.text("TYPE", 80, y + 1);
        doc.text("DESCRIPTION", 105, y + 1);
        doc.text("AMOUNT", 185, y + 1, { align: "right" });
        y += 15;
      }

      if (index % 2 === 0) {
        doc.setFillColor(252, 252, 252);
        doc.rect(15, y - 4, 180, 8, "F");
      }

      doc.setTextColor(30, 41, 59);
      doc.text(new Date(item.date).toLocaleDateString(), 20, y);
      doc.text(item.id, 45, y);
      
      const isIncome = item.type === "Income";
      doc.setTextColor(isIncome ? 5 : 200, isIncome ? 150 : 50, 50);
      doc.text(item.type, 80, y);
      
      doc.setTextColor(30, 41, 59);
      const desc = item.description.length > 35 ? item.description.substring(0, 32) + "..." : item.description;
      doc.text(desc, 105, y);
      
      doc.setTextColor(isIncome ? 5 : 200, isIncome ? 150 : 50, 50);
      doc.text(`${isIncome ? "+" : "-"}${formatNum(item.amount)}`, 185, y, { align: "right" });
      
      y += 8;
    });

    doc.save(`Hospital_Ledger_${new Date().toISOString().split('T')[0]}.pdf`);
    onLogAction("Generate Ledger PDF", "Exported unified hospital ledger to PDF");
  };

  const handleAddGeneralExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseDesc || !expenseAmount) return;

    const newExpense: Expense = {
      id: `EXP-GEN-${Math.floor(1000 + Math.random() * 9000)}`,
      hospitalId,
      description: expenseDesc,
      amount: parseFloat(expenseAmount),
      date: new Date().toISOString().split("T")[0],
      category: expenseCategory
    };

    DB.addExpense(newExpense);
    setExpenses(DB.getExpenses(hospitalId));
    setExpenseDesc("");
    setExpenseAmount("");
    setShowExpenseForm(false);
    onLogAction("Add Expense", `Recorded general expense: ${expenseDesc} (${expenseAmount})`);
  };

  const handlePrintInvoice = (invoiceId: string, invoiceObj?: BillingInvoice) => {
    const inv = invoiceObj || invoices.find(i => i.id === invoiceId);
    if (!inv) return;
    
    const doc = new jsPDF();
    const config = COUNTRIES[countryCode] || COUNTRIES.US;
    
    const formatNum = (num: number) => {
      return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
    
    // --- Header Section ---
    doc.setFillColor(250, 250, 250);
    doc.rect(0, 0, 210, 45, "F");
    
    // Top Right Medical Symbol (Cross)
    doc.setFillColor(13, 148, 136); // Teal
    doc.rect(190, 16, 4, 12, "F"); // Vertical bar
    doc.rect(186, 20, 12, 4, "F"); // Horizontal bar
    
    // Logo placeholder (simulated)
    doc.setFillColor(13, 148, 136); // Teal
    doc.circle(25, 22, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    doc.text("CM", 20, 24); // Initials
    
    // Hospital Details
    doc.setTextColor(30, 41, 59); // Slate-800
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(20);
    doc.text(hospitalDetails.name, 45, 20);
    
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.setFontSize(10);
    doc.setFont("Helvetica", "normal");
    doc.text(`${hospitalDetails.address}`, 45, 27);
    doc.text(`Phone: ${hospitalDetails.phone} | Email: ${hospitalDetails.email}`, 45, 33);
    
    // Invoice Title
    doc.setTextColor(13, 148, 136);
    doc.setFontSize(28);
    doc.setFont("Helvetica", "bold");
    doc.text("INVOICE", 140, 28);
    
    // --- Invoice Details ---
    doc.setDrawColor(226, 232, 240);
    doc.line(15, 50, 195, 50);
    
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(10);
    doc.setFont("Helvetica", "bold");
    doc.text("Invoice Number:", 15, 60);
    doc.setFont("Helvetica", "normal");
    doc.text(inv.id, 45, 60);
    
    doc.setFont("Helvetica", "bold");
    doc.text("Date:", 140, 60);
    doc.setFont("Helvetica", "normal");
    doc.text(formatDate(inv.createdAt.split('T')[0], countryCode), 155, 60);
    
    // --- Bill To Section ---
    doc.setFillColor(248, 250, 252);
    doc.rect(15, 70, 85, 30, "F");
    doc.setTextColor(15, 23, 42);
    doc.setFont("Helvetica", "bold");
    doc.text("Bill To:", 20, 78);
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(11);
    doc.text(inv.patientName, 20, 85);
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`Patient ID: ${inv.patientId}`, 20, 92);
    
    // Status Section
    doc.setFillColor(248, 250, 252);
    doc.rect(110, 70, 85, 30, "F");
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Billing Status:", 115, 78);
    
    doc.setFont("Helvetica", "normal");
    doc.text(`Type: ${inv.type} Billing`, 115, 85);
    doc.setTextColor(inv.status === "Paid" ? 5 : 200, inv.status === "Paid" ? 150 : 50, 50);
    doc.setFont("Helvetica", "bold");
    doc.text(`Status: ${inv.status.toUpperCase()}`, 115, 92);
    
    // --- Table Header ---
    doc.setFillColor(241, 245, 249);
    doc.rect(15, 110, 180, 12, "F");
    doc.setTextColor(15, 23, 42);
    doc.setFont("Helvetica", "bold");
    doc.text("Description", 20, 118);
    doc.text(`Amount (${config.currency})`, 170, 118, { align: "right" });
    
    // --- Table Items ---
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    let y = 130;
    inv.items.forEach(item => {
      doc.text(item.description, 20, y);
      doc.text(formatNum(item.amount), 170, y, { align: "right" });
      y += 8;
      doc.setDrawColor(241, 245, 249);
      doc.line(15, y - 2, 195, y - 2);
    });
    
    // --- Totals Section ---
    y += 10;
    doc.setFillColor(248, 250, 252);
    const hasDiscount = inv.discount && inv.discount > 0;
    doc.rect(110, y - 5, 85, hasDiscount ? 43 : 35, "F");
    
    doc.setTextColor(71, 85, 105);
    doc.setFont("Helvetica", "normal");
    doc.text("Subtotal:", 120, y + 2);
    doc.text(formatNum(inv.subtotal), 185, y + 2, { align: "right" });
    y += 8;
    
    doc.text(`Tax (${hospitalDetails.taxSystem}):`, 120, y + 2);
    doc.text(formatNum(inv.taxAmount), 185, y + 2, { align: "right" });
    y += 8;

    if (hasDiscount) {
      doc.setTextColor(185, 28, 28); // Red color for discount
      doc.text("Discount:", 120, y + 2);
      doc.text(`-${formatNum(inv.discount)}`, 185, y + 2, { align: "right" });
      y += 8;
      doc.setTextColor(71, 85, 105);
    }
    
    doc.setDrawColor(203, 213, 225);
    doc.line(115, y + 2, 190, y + 2);
    y += 8;
    
    doc.setTextColor(13, 148, 136); // Teal for total
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Total:", 120, y + 2);
    doc.text(`${config.currency} ${formatNum(inv.total)}`, 185, y + 2, { align: "right" });
    
    if (inv.paymentMethod) {
      y += 20;
      doc.setFontSize(9);
      doc.setFont("Helvetica", "italic");
      doc.setTextColor(100, 116, 139);
      doc.text(`Payment received via ${inv.paymentMethod} on ${formatDate(new Date().toISOString().split('T')[0], countryCode)}`, 190, y, { align: "right" });
    }
    
    // Footer
    doc.setFontSize(8);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text("Thank you for choosing us for your healthcare needs.", 105, 280, { align: "center" });
 
    doc.autoPrint();
    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    window.open(url, '_blank');
    onLogAction("Print Invoice", `Generated & printed invoice ${inv.id}`);
  };

  // --- 3. HR OPERATIONS ---
  const [attDate, setAttDate] = useState(new Date().toISOString().split("T")[0]);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffRole, setNewStaffRole] = useState<UserRole>(UserRole.DOCTOR);
  const [newStaffDept, setNewStaffDept] = useState("General Medicine");
  const [newStaffSalary, setNewStaffSalary] = useState("50000");
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffPhone, setNewStaffPhone] = useState("");
  const [newStaffPassword, setNewStaffPassword] = useState("password123");
  const [newStaffSpec, setNewStaffSpec] = useState("");

  // States for dynamic salary payment modal
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [selectedEmpForSalary, setSelectedEmpForSalary] = useState<EmployeeHR | null>(null);
  const [salaryBasic, setSalaryBasic] = useState("");
  const [salaryHra, setSalaryHra] = useState("");
  const [salaryDa, setSalaryDa] = useState("");
  const [salaryBonus, setSalaryBonus] = useState("");
  const [salaryOvertime, setSalaryOvertime] = useState("");
  const [salaryPf, setSalaryPf] = useState("");
  const [salaryProfTax, setSalaryProfTax] = useState("");
  const [salaryMonth, setSalaryMonth] = useState(new Date().toISOString().slice(0, 7));

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName || !newStaffEmail || !newStaffPassword || !newStaffDept) return;

    const baseId = `usr-${Math.random().toString(36).substr(2, 6)}`;
    const isMedicalPractitioner = [
      UserRole.DOCTOR,
      UserRole.PATHOLOGIST,
      UserRole.RADIOLOGIST,
      UserRole.SURGEON,
      UserRole.CARDIOLOGIST,
      UserRole.PEDIATRICIAN,
      UserRole.DENTIST,
      UserRole.PSYCHIATRIST,
      UserRole.ORTHOPEDIC,
      UserRole.DERMATOLOGIST,
      UserRole.NEUROLOGIST,
      UserRole.OPHTHALMOLOGIST,
      UserRole.GYNECOLOGIST,
      UserRole.ANESTHESIOLOGIST,
      UserRole.GENERAL_PRACTITIONER,
      UserRole.ENT_SPECIALIST,
      UserRole.ONCOLOGIST
    ].includes(newStaffRole);
    
    // Add to Users for login
    DB.addUser({
      id: baseId,
      hospitalId,
      name: newStaffName,
      email: newStaffEmail,
      phone: newStaffPhone,
      role: newStaffRole,
      department: newStaffDept,
      specialization: isMedicalPractitioner ? newStaffSpec : undefined,
      password: newStaffPassword,
      status: "Active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Add to HR Employees
    DB.addEmployee({
      id: baseId,
      hospitalId,
      name: newStaffName,
      role: newStaffRole,
      department: newStaffDept,
      salary: Number(newStaffSalary),
      attendance: {},
      leavesLeft: 24,
      payrollHistory: []
    });

    // Add to Doctors if role is a medical clinical practitioner
    if (isMedicalPractitioner) {
      DB.addDoctor({
        id: baseId,
        hospitalId,
        name: newStaffName,
        specialization: newStaffSpec || newStaffRole,
        department: newStaffDept,
        consultationFee: 500, // Default fee
        schedule: {
          "Monday": [{ start: "09:00", end: "13:00", slots: 10 }, { start: "14:00", end: "18:00", slots: 10 }],
          "Tuesday": [{ start: "09:00", end: "13:00", slots: 10 }, { start: "14:00", end: "18:00", slots: 10 }],
          "Wednesday": [{ start: "09:00", end: "13:00", slots: 10 }, { start: "14:00", end: "18:00", slots: 10 }],
          "Thursday": [{ start: "09:00", end: "13:00", slots: 10 }, { start: "14:00", end: "18:00", slots: 10 }],
          "Friday": [{ start: "09:00", end: "13:00", slots: 10 }, { start: "14:00", end: "18:00", slots: 10 }]
        },
        leaves: [],
        status: "Available",
        createdAt: new Date().toISOString()
      });
    }

    setEmployees(DB.getHRRecord(hospitalId));
    setShowAddStaffModal(false);
    onLogAction("Add Staff", `Onboarded new ${newStaffRole} ${newStaffName}`);

    // Reset
    setNewStaffName("");
    setNewStaffEmail("");
    setNewStaffPhone("");
    setNewStaffSpec("");
    setNewStaffPassword("password123");
  };

  const handleToggleAttendance = (employeeId: string, status: "Present" | "Absent" | "Leave") => {
    DB.markAttendance(employeeId, attDate, status);
    setEmployees(DB.getHRRecord(hospitalId));
    onLogAction("Mark Attendance", `Set staff ${employeeId} attendance on ${attDate} as ${status}`);
  };

  const handleToggleActive = (employeeId: string, currentStatus: boolean | undefined) => {
    const newStatus = currentStatus === undefined ? false : !currentStatus;
    DB.toggleEmployeeActiveStatus(employeeId, newStatus);
    setEmployees(DB.getHRRecord(hospitalId));
    onLogAction("Toggle Employee Status", `Set staff ${employeeId} active status to ${newStatus}`);
  };

  const handleDeleteEmployee = (employeeId: string) => {
    if (confirm("Are you sure you want to delete this employee?")) {
      DB.deleteEmployee(employeeId);
      setEmployees(DB.getHRRecord(hospitalId));
      onLogAction("Delete Employee", `Deleted staff ${employeeId}`);
    }
  };

  const handlePrintSalarySlip = (emp: EmployeeHR, month: string, payrollId?: string) => {
    const doc = new jsPDF();
    const config = COUNTRIES[countryCode] || COUNTRIES.US;
    
    const formatNum = (num: number) => {
      return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // Find custom breakdown items or fallback to defaults
    const item = emp.payrollHistory.find(p => payrollId ? (p.id === payrollId) : (p.month === month));
    const basic = item?.basic ?? emp.salary;
    const hra = item?.hra ?? 0;
    const da = item?.da ?? 0;
    const bonus = item?.bonus ?? 0;
    const overtime = item?.overtime ?? 0;
    const pf = item?.pf ?? 0;
    const profTax = item?.profTax ?? 0;
    const grossEarnings = basic + hra + da + bonus + overtime;
    const totalDeductions = pf + profTax;
    const netDisbursed = item ? Number(item.netPay) : (grossEarnings - totalDeductions);
    
    // --- Header Section ---
    doc.setFillColor(250, 250, 250);
    doc.rect(0, 0, 210, 45, "F");
    
    // Top Right Medical Symbol (Cross)
    doc.setFillColor(13, 148, 136); // Teal
    doc.rect(190, 16, 4, 12, "F"); // Vertical bar
    doc.rect(186, 20, 12, 4, "F"); // Horizontal bar
    
    // Logo placeholder (simulated)
    doc.setFillColor(13, 148, 136); // Teal
    doc.circle(25, 22, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    doc.text("CM", 20, 24); // Initials
    
    // Hospital Details
    doc.setTextColor(30, 41, 59); // Slate-800
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(20);
    doc.text(hospitalDetails.name, 45, 20);
    
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.setFontSize(10);
    doc.setFont("Helvetica", "normal");
    doc.text(`${hospitalDetails.address}`, 45, 27);
    doc.text(`Phone: ${hospitalDetails.phone} | Email: ${hospitalDetails.email}`, 45, 33);
    
    // Title
    doc.setTextColor(13, 148, 136);
    doc.setFontSize(22);
    doc.setFont("Helvetica", "bold");
    doc.text("SALARY SLIP", 140, 28);
    
    // --- Divider ---
    doc.setDrawColor(226, 232, 240);
    doc.line(15, 50, 195, 50);
    
    // Details row
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(10);
    doc.setFont("Helvetica", "bold");
    doc.text("Payslip ID:", 15, 60);
    doc.setFont("Helvetica", "normal");
    doc.text(item?.id ? `TX-${item.id}` : `SLIP-${emp.id}-${month}`, 40, 60);
    
    doc.setFont("Helvetica", "bold");
    doc.text("Release Date:", 140, 60);
    doc.setFont("Helvetica", "normal");
    doc.text(formatDate(new Date().toISOString().split('T')[0], countryCode), 165, 60);
    
    // --- Employee Info Box ---
    doc.setFillColor(248, 250, 252);
    doc.rect(15, 70, 85, 32, "F");
    doc.setTextColor(15, 23, 42);
    doc.setFont("Helvetica", "bold");
    doc.text("Employee Details:", 20, 78);
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(11);
    doc.text(emp.name, 20, 85);
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`ID: ${emp.id}`, 20, 91);
    doc.text(`Role: ${emp.role}`, 20, 97);
    
    // Pay Info Box
    doc.setFillColor(248, 250, 252);
    doc.rect(110, 70, 85, 32, "F");
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Earnings details:", 115, 78);
    
    doc.setFont("Helvetica", "normal");
    doc.text(`Department: ${emp.department}`, 115, 85);
    doc.text(`Payroll Month: ${month}`, 115, 91);
    doc.setTextColor(13, 148, 136);
    doc.setFont("Helvetica", "bold");
    doc.text("Status: DISBURSED (PAID)", 115, 97);
    
    // --- Table Header ---
    doc.setFillColor(241, 245, 249);
    doc.rect(15, 115, 180, 12, "F");
    doc.setTextColor(15, 23, 42);
    doc.setFont("Helvetica", "bold");
    doc.text("Earnings Component", 20, 123);
    doc.text(`Amount (${config.currency})`, 170, 123, { align: "right" });
    
    // --- Table Items ---
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    let y = 135;
    
    doc.text("Basic Salary Payment", 20, y);
    doc.text(formatNum(basic), 170, y, { align: "right" });
    y += 8;
    
    doc.text("House Rent Allowance (HRA)", 20, y);
    doc.text(formatNum(hra), 170, y, { align: "right" });
    y += 8;

    doc.text("Dearness Allowance (DA)", 20, y);
    doc.text(formatNum(da), 170, y, { align: "right" });
    y += 8;

    doc.text("Performance Bonus", 20, y);
    doc.text(formatNum(bonus), 170, y, { align: "right" });
    y += 8;

    doc.text("Overtime Allowance", 20, y);
    doc.text(formatNum(overtime), 170, y, { align: "right" });
    y += 8;
    
    doc.setDrawColor(241, 245, 249);
    doc.line(15, y, 195, y);
    y += 8;

    // Deductions Table Header
    doc.setFillColor(241, 245, 249);
    doc.rect(15, y - 4, 180, 10, "F");
    doc.setTextColor(15, 23, 42);
    doc.setFont("Helvetica", "bold");
    doc.text("Deductions Component", 20, y + 2);
    doc.text(`Amount (${config.currency})`, 170, y + 2, { align: "right" });
    y += 12;

    doc.setFont("Helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text("Provident Fund (PF) Deduction", 20, y);
    doc.text(formatNum(pf), 170, y, { align: "right" });
    y += 8;

    doc.text("Professional Tax (Hospital Deducted)", 20, y);
    doc.text(formatNum(profTax), 170, y, { align: "right" });
    y += 8;
    
    // --- Totals Box ---
    y += 10;
    doc.setFillColor(248, 250, 252);
    doc.rect(110, y - 5, 85, 30, "F");
    
    doc.setTextColor(71, 85, 105);
    doc.setFont("Helvetica", "normal");
    doc.text("Gross Salary Earnings:", 115, y + 2);
    doc.text(formatNum(grossEarnings), 185, y + 2, { align: "right" });
    y += 8;
    
    doc.text("Total Salary Deductions:", 115, y + 2);
    doc.text(formatNum(totalDeductions), 185, y + 2, { align: "right" });
    y += 8;
    
    doc.setDrawColor(203, 213, 225);
    doc.line(115, y + 2, 190, y + 2);
    y += 10;
    
    doc.setTextColor(13, 148, 136);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Net Take-Home Disbursed:", 115, y);
    doc.text(`${config.currency} ${formatNum(netDisbursed)}`, 185, y, { align: "right" });
    
    // --- Footer Section ---
    doc.setFontSize(8);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text("This payslip is a computer-generated confirmation of bank payroll transfer.", 105, 275, { align: "center" });
    doc.text("No physical signature is required. Thank you for your service.", 105, 280, { align: "center" });
 
    doc.autoPrint();
    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    window.open(url, '_blank');
    
    onLogAction("Print Salary Slip", `Generated & printed salary slip for ${emp.name} for period ${month}`);
  };

  const handlePaySalary = (employeeId: string) => {
    const emp = employees.find(e => e.id === employeeId);
    if (!emp) return;

    setSelectedEmpForSalary(emp);
    setSalaryBasic(emp.salary.toString());
    setSalaryHra("0");
    setSalaryDa("0");
    setSalaryBonus("0");
    setSalaryOvertime("0");
    setSalaryPf("0");
    setSalaryProfTax("0");
    setSalaryMonth(new Date().toISOString().slice(0, 7));
    setShowSalaryModal(true);
  };

  const handleConfirmSalaryDisbursal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpForSalary) return;

    const basic = Number(salaryBasic) || 0;
    const hra = Number(salaryHra) || 0;
    const da = Number(salaryDa) || 0;
    const bonus = Number(salaryBonus) || 0;
    const overtime = Number(salaryOvertime) || 0;
    const pf = Number(salaryPf) || 0;
    const profTax = Number(salaryProfTax) || 0;
    
    const net = basic + hra + da + bonus + overtime - pf - profTax;

    const generatedId = DB.addPayroll(
      selectedEmpForSalary.id,
      salaryMonth,
      net.toFixed(2),
      basic,
      hra,
      da,
      bonus,
      overtime,
      pf,
      profTax
    );
    
    // Add to Expenses Ledger
    const payrollExpense: Expense = {
      id: `EXP-PAY-${generatedId}`,
      hospitalId,
      description: `Payroll: ${selectedEmpForSalary.name} - ${salaryMonth}`,
      amount: net,
      date: new Date().toISOString().split("T")[0],
      category: "Payroll"
    };
    DB.addExpense(payrollExpense);
    
    const updatedEmployees = DB.getHRRecord(hospitalId);
    setEmployees(updatedEmployees);
    setExpenses(DB.getExpenses(hospitalId));
    onLogAction("Disburse Payroll", `Processed payroll release for ${selectedEmpForSalary.name} for month ${salaryMonth} (Net Pay: ${net.toFixed(2)})`);
    
    // Automatically generate and print salary slip with the custom components
    const freshEmp = updatedEmployees.find(e => e.id === selectedEmpForSalary.id) || selectedEmpForSalary;
    handlePrintSalarySlip(freshEmp, salaryMonth, generatedId);
    
    setShowSalaryModal(false);
    setSelectedEmpForSalary(null);
  };

  const handleDeletePayroll = (employeeId: string, payrollIdOrMonth: string) => {
    const emp = employees.find(e => e.id === employeeId);
    if (!emp) return;

    DB.deletePayroll(employeeId, payrollIdOrMonth);
    const updatedEmployees = DB.getHRRecord(hospitalId);
    setEmployees(updatedEmployees);
    onLogAction("Delete Payroll Record", `Deleted salary payment record of reference ${payrollIdOrMonth} for ${emp.name}`);
  };

  const handlePrintPaySheet = (month: string) => {
    const doc = new jsPDF("landscape");
    const config = COUNTRIES[countryCode] || COUNTRIES.US;
    
    const formatNum = (num: number) => {
      return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
    
    // --- Header Banner ---
    doc.setFillColor(13, 148, 136); // Teal header
    doc.rect(0, 0, 297, 26, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(16);
    doc.text(`${hospitalDetails.name} - Monthly Payroll Pay Sheet`, 15, 17);
    
    doc.setFontSize(10);
    doc.setFont("Helvetica", "normal");
    doc.text(`Payroll Period: ${month}`, 235, 17);
    
    // Sub-header info
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(8.5);
    doc.text(`${hospitalDetails.address} | Phone: ${hospitalDetails.phone} | Print Date: ${new Date().toLocaleDateString()}`, 15, 34);
    
    // --- Table Headers ---
    doc.setFillColor(241, 245, 249);
    doc.rect(15, 40, 267, 10, "F");
    
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8.5);
    doc.text("Staff Member ID & Name", 18, 46);
    doc.text("Role / Department", 70, 46);
    doc.text(`Basic (${config.currency})`, 118, 46, { align: "right" });
    doc.text(`HRA (${config.currency})`, 140, 46, { align: "right" });
    doc.text(`DA (${config.currency})`, 162, 46, { align: "right" });
    doc.text(`Bonus (${config.currency})`, 184, 46, { align: "right" });
    doc.text(`O.T. (${config.currency})`, 206, 46, { align: "right" });
    doc.text(`PF Ded. (${config.currency})`, 228, 46, { align: "right" });
    doc.text(`P. Tax (${config.currency})`, 250, 46, { align: "right" });
    doc.text(`Net Pay (${config.currency})`, 277, 46, { align: "right" });
    
    doc.setDrawColor(226, 232, 240);
    doc.line(15, 50, 282, 50);
    
    let y = 56;
    let sumBasic = 0;
    let sumHra = 0;
    let sumDa = 0;
    let sumBonus = 0;
    let sumOvertime = 0;
    let sumPf = 0;
    let sumProfTax = 0;
    let sumNet = 0;
    let count = 0;

    employees.forEach(emp => {
      const pay = emp.payrollHistory.find(p => p.month === month);
      if (pay) {
        count++;
        const basic = pay.basic ?? emp.salary;
        const hra = pay.hra ?? 0;
        const da = pay.da ?? 0;
        const bonus = pay.bonus ?? 0;
        const overtime = pay.overtime ?? 0;
        const pf = pay.pf ?? 0;
        const profTax = pay.profTax ?? 0;
        const net = Number(pay.netPay);
        
        sumBasic += basic;
        sumHra += hra;
        sumDa += da;
        sumBonus += bonus;
        sumOvertime += overtime;
        sumPf += pf;
        sumProfTax += profTax;
        sumNet += net;
        
        doc.setFont("Helvetica", "normal");
        doc.setTextColor(51, 65, 85);
        
        // Staff Metadata
        doc.text(`${emp.name} (${emp.id})`, 18, y);
        doc.setFontSize(7.5);
        doc.text(`${emp.role} - ${emp.department}`, 70, y);
        doc.setFontSize(8.5);
        
        // Numerical Values
        doc.text(formatNum(basic), 118, y, { align: "right" });
        doc.text(formatNum(hra), 140, y, { align: "right" });
        doc.text(formatNum(da), 162, y, { align: "right" });
        doc.text(formatNum(bonus), 184, y, { align: "right" });
        doc.text(formatNum(overtime), 206, y, { align: "right" });
        doc.setTextColor(225, 29, 72); // Rose-600 for PF
        doc.text(formatNum(pf), 228, y, { align: "right" });
        doc.setTextColor(225, 29, 72); // Rose-600 for Professional Tax
        doc.text(formatNum(profTax), 250, y, { align: "right" });
        doc.setTextColor(13, 148, 136); // Teal-600 for Net Pay
        doc.setFont("Helvetica", "bold");
        doc.text(formatNum(net), 277, y, { align: "right" });
        
        y += 8;
        
        // Draw separation line
        doc.setDrawColor(241, 245, 249);
        doc.line(15, y - 4, 282, y - 4);
        
        if (y > 185) {
          doc.addPage("landscape");
          y = 25;
          // Redraw Headers
          doc.setFillColor(241, 245, 249);
          doc.rect(15, 10, 267, 10, "F");
          doc.setFont("Helvetica", "bold");
          doc.setTextColor(15, 23, 42);
          doc.text("Staff Member ID & Name", 18, 16);
          doc.text("Role / Department", 70, 16);
          doc.text("Basic", 118, 16, { align: "right" });
          doc.text("HRA", 140, 16, { align: "right" });
          doc.text("DA", 162, 16, { align: "right" });
          doc.text("Bonus", 184, 16, { align: "right" });
          doc.text("O.T.", 206, 16, { align: "right" });
          doc.text("PF Ded.", 228, 16, { align: "right" });
          doc.text("P. Tax", 250, 16, { align: "right" });
          doc.text("Net Pay", 277, 16, { align: "right" });
          y = 26;
        }
      }
    });
    
    if (count === 0) {
      doc.setFont("Helvetica", "italic");
      doc.setTextColor(148, 163, 184);
      doc.text("No payroll transactions registered for this month yet.", 148, y + 10, { align: "center" });
    } else {
      // Draw grand totals
      doc.setFillColor(248, 250, 252);
      doc.rect(15, y - 2, 267, 10, "F");
      
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("GRAND TOTALS", 18, y + 4);
      
      doc.text(formatNum(sumBasic), 118, y + 4, { align: "right" });
      doc.text(formatNum(sumHra), 140, y + 4, { align: "right" });
      doc.text(formatNum(sumDa), 162, y + 4, { align: "right" });
      doc.text(formatNum(sumBonus), 184, y + 4, { align: "right" });
      doc.text(formatNum(sumOvertime), 206, y + 4, { align: "right" });
      doc.setTextColor(225, 29, 72);
      doc.text(formatNum(sumPf), 228, y + 4, { align: "right" });
      doc.setTextColor(225, 29, 72);
      doc.text(formatNum(sumProfTax), 250, y + 4, { align: "right" });
      doc.setTextColor(13, 148, 136);
      doc.text(formatNum(sumNet), 277, y + 4, { align: "right" });
    }
    
    // Footer
    doc.setFontSize(8);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text("CareMatrix Automated Corporate Payroll ledger. Generated securely.", 148, 198, { align: "center" });
    
    doc.autoPrint();
    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    window.open(url, '_blank');
    onLogAction("Print Monthly Pay Sheet", `Generated and printed staff pay sheet for ${month}`);
  };

  // --- 4. EXPORTS AND REPORTS ---
  // Financial summaries
  const totalInvoiced = invoices.reduce((acc, i) => acc + i.total, 0);
  const totalPaid = invoices.filter(i => i.status === "Paid").reduce((acc, i) => acc + i.total, 0);
  const totalPending = invoices.filter(i => i.status === "Pending").reduce((acc, i) => acc + i.total, 0);
  const totalTaxCollected = invoices.filter(i => i.status === "Paid").reduce((acc, i) => acc + i.taxAmount, 0);
  const opdTax = invoices.filter(i => i.type === "OPD" && i.status === "Paid").reduce((acc, i) => acc + i.taxAmount, 0);
  const ipdTax = invoices.filter(i => i.type === "IPD" && i.status === "Paid").reduce((acc, i) => acc + i.taxAmount, 0);
  const pharmTax = invoices.filter(i => i.type === "Pharmacy" && i.status === "Paid").reduce((acc, i) => acc + i.taxAmount, 0);
  const labTax = invoices.filter(i => (i.type === "Laboratory" || i.type === "General") && i.status === "Paid").reduce((acc, i) => acc + i.taxAmount, 0);
  const totalPayrollExpenses = employees.reduce((acc, emp) => acc + emp.payrollHistory.filter(ph => ph.status === "Paid").reduce((sum, p) => sum + Number(p.netPay), 0), 0);
  const totalMedicineExpenses = expenses.filter(e => e.category === "Medicine").reduce((sum, e) => sum + e.amount, 0);
  const totalOtherExpenses = expenses.filter(e => e.category !== "Medicine" && e.category !== "Payroll").reduce((sum, e) => sum + e.amount, 0);
  const totalExpenses = totalPayrollExpenses + totalMedicineExpenses + totalOtherExpenses;

  // Unified Financial Ledger (Income & Expenses)
  const combinedLedger = [
    ...invoices.map(inv => ({
      id: inv.id,
      date: inv.createdAt,
      description: `${inv.type} Billing: ${inv.patientName}`,
      type: "Income" as const,
      amount: inv.total,
      status: inv.status,
      original: inv
    })),
    ...expenses.map(exp => ({
      id: exp.id,
      date: exp.date,
      description: exp.description,
      type: "Expense" as const,
      amount: exp.amount,
      status: "Settled",
      original: exp
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredLedger = combinedLedger.filter(item => 
    item.description.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
    item.id.toLowerCase().includes(invoiceSearch.toLowerCase())
  );

  const opdRevenue = invoices.filter(i => i.type === "OPD" && i.status !== "Refunded").reduce((acc, i) => acc + i.total, 0);
  const ipdRevenue = invoices.filter(i => i.type === "IPD" && i.status !== "Refunded").reduce((acc, i) => acc + i.total, 0);
  const pharmRevenue = invoices.filter(i => i.type === "Pharmacy" && i.status !== "Refunded").reduce((acc, i) => acc + i.total, 0);
  const generalRevenue = invoices.filter(i => (i.type === "Laboratory" || i.type === "General") && i.status !== "Refunded").reduce((acc, i) => acc + i.total, 0);

  // Recharts structures
  const financeTrendData = [
    { name: "Consultation", amount: opdRevenue },
    { name: "Inpatient Ward", amount: ipdRevenue },
    { name: "Pharmacy Sales", amount: pharmRevenue },
    { name: "Diagnostics Tests", amount: generalRevenue }
  ];

  const handleExportPDF = () => {
    onLogAction("Generate PDF Report", "Issued clinical financial statement PDF");
    const doc = new jsPDF();
    
    const formatNum = (num: number) => {
      return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // Header Background
    doc.setFillColor(13, 148, 136); // Teal
    doc.rect(0, 0, 210, 45, "F");
    
    // Hospital Name & Title
    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(22);
    doc.text(hospitalDetails.name.toUpperCase(), 15, 20);
    
    doc.setFontSize(12);
    doc.setFont("Helvetica", "normal");
    doc.text("FINANCIAL PERFORMANCE & STATUTORY TAX REPORT", 15, 30);
    doc.text(`${hospitalDetails.address} | ID: ${hospitalId}`, 15, 38);

    // Meta Info
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(9);
    doc.text(`Report Generated: ${new Date().toLocaleString()}`, 150, 55, { align: "left" });
    
    // --- SECTION 1: EXECUTIVE SUMMARY ---
    doc.setFillColor(245, 245, 245);
    doc.rect(15, 65, 180, 55, "F");
    doc.setDrawColor(220, 220, 220);
    doc.rect(15, 65, 180, 55);
    
    doc.setTextColor(13, 148, 136);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.text("EXECUTIVE FINANCIAL SUMMARY", 20, 75);
    
    doc.setTextColor(50, 50, 50);
    doc.setFont("Helvetica", "normal");
    doc.text(`Gross Revenue Collected:`, 25, 85);
    doc.text(`${config.currency} ${formatNum(totalPaid)}`, 190, 85, { align: "right" });
    
    doc.text(`Operational Expenses:`, 25, 92);
    doc.text(`(${config.currency} ${formatNum(totalExpenses)})`, 190, 92, { align: "right" });

    doc.text(`Total ${config.taxLabel} Liabilities:`, 25, 99);
    doc.text(`${config.currency} ${formatNum(totalTaxCollected)}`, 190, 99, { align: "right" });

    doc.setDrawColor(13, 148, 136);
    doc.line(20, 104, 190, 104);
    
    doc.setFont("Helvetica", "bold");
    doc.text(`NET OPERATING BALANCE:`, 25, 112);
    doc.setTextColor(13, 148, 136);
    doc.text(`${config.currency} ${formatNum(totalPaid - totalExpenses)}`, 190, 112, { align: "right" });
    
    // --- SECTION 2: REVENUE BREAKDOWN ---
    let y = 135;
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(12);
    doc.setFont("Helvetica", "bold");
    doc.text("REVENUE BY DEPARTMENT", 15, y);
    doc.setDrawColor(200, 200, 200);
    doc.line(15, y + 2, 195, y + 2);
    
    y += 12;
    const revRows = [
      ["Outpatient Consultation (OPD)", opdRevenue],
      ["Inpatient Ward Admissions (IPD)", ipdRevenue],
      ["Pharmacy Sales", pharmRevenue],
      ["Laboratory & Diagnostics", generalRevenue]
    ];

    doc.setFontSize(10);
    doc.setFont("Helvetica", "normal");
    revRows.forEach(([label, value], i) => {
      doc.text(String(label), 20, y);
      doc.text(`${config.currency} ${formatNum(Number(value))}`, 190, y, { align: "right" });
      y += 8;
    });

    // --- SECTION 3: EXPENSE BREAKDOWN ---
    y += 10;
    doc.setFontSize(12);
    doc.setFont("Helvetica", "bold");
    doc.text("EXPENDITURE ANALYSIS", 15, y);
    doc.line(15, y + 2, 195, y + 2);
    
    y += 12;
    const expRows = [
      ["Employee Payroll (Settled)", totalPayrollExpenses],
      ["Medicine & Inventory Purchases", totalMedicineExpenses],
      ["Administrative & Other Costs", totalOtherExpenses]
    ];

    doc.setFontSize(10);
    doc.setFont("Helvetica", "normal");
    expRows.forEach(([label, value], i) => {
      doc.text(String(label), 20, y);
      doc.text(`${config.currency} ${formatNum(Number(value))}`, 190, y, { align: "right" });
      y += 8;
    });
    
    // --- SECTION 4: STATUTORY TAX OVERVIEW ---
    y += 10;
    doc.setFontSize(12);
    doc.setFont("Helvetica", "bold");
    doc.text(`${config.taxLabel} OVERVIEW & COMPLIANCE`, 15, y);
    doc.line(15, y + 2, 195, y + 2);
    
    y += 12;
    const taxRows = [
      [`${config.taxLabel} on OPD Services`, opdTax],
      [`${config.taxLabel} on IPD Admissions`, ipdTax],
      [`${config.taxLabel} on Pharmacy Sales`, pharmTax],
      [`${config.taxLabel} on Lab/Diagnostic Tests`, labTax]
    ];

    doc.setFontSize(10);
    doc.setFont("Helvetica", "normal");
    taxRows.forEach(([label, value], i) => {
      doc.text(String(label), 20, y);
      doc.text(`${config.currency} ${formatNum(Number(value))}`, 190, y, { align: "right" });
      y += 8;
    });

    y += 5;
    doc.setFont("Helvetica", "bold");
    doc.setFillColor(255, 251, 235); // Amber light
    doc.rect(15, y, 180, 15, "F");
    doc.setTextColor(180, 83, 9); // Amber dark
    doc.text(`TOTAL CONSOLIDATED ${config.taxLabel.toUpperCase()} COLLECTED:`, 20, y + 9);
    doc.text(`${config.currency} ${formatNum(totalTaxCollected)}`, 190, y + 9, { align: "right" });

    // Footer
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(8);
    doc.setFont("Helvetica", "italic");
    doc.text("CONFIDENTIAL - FOR INTERNAL AUDIT PURPOSES ONLY", 105, 285, { align: "center" });
    doc.text(`${hospitalDetails.name} Financial Reporting System - CareMatrix v2.0`, 105, 290, { align: "center" });

    // Save
    doc.save(`carematrix_financial_report_${hospitalId}.pdf`);
  };

  const handleExportInventoryPDF = () => {
    onLogAction("Generate Inventory Report", "Issued pharmacy stock audit report PDF");
    const doc = new jsPDF();
    const formatNum = (num: number) => num.toLocaleString();
    
    // Header
    doc.setFillColor(13, 148, 136); 
    doc.rect(0, 0, 210, 40, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(20);
    doc.text("INVENTORY & PHARMACY STOCK AUDIT", 15, 20);
    doc.setFontSize(10);
    doc.setFont("Helvetica", "normal");
    doc.text(`${hospitalDetails.name.toUpperCase()} | ${hospitalDetails.address}`, 15, 30);
    
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 150, 50);

    // Table Header
    let y = 60;
    doc.setFillColor(240, 240, 240);
    doc.rect(15, y, 180, 8, "F");
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    doc.text("ITEM NAME", 20, y + 5);
    doc.text("CATEGORY", 80, y + 5);
    doc.text("STOCK", 120, y + 5);
    doc.text("PRICE", 145, y + 5);
    doc.text("STATUS", 170, y + 5);

    y += 12;
    doc.setFont("Helvetica", "normal");
    medicines.forEach((med, i) => {
      if (y > 270) { doc.addPage(); y = 20; }
      
      const isLow = med.stock <= (med.minStockAlert || 10);
      if (isLow) doc.setTextColor(200, 0, 0);
      else doc.setTextColor(50, 50, 50);

      doc.text(med.name, 20, y);
      doc.text(med.category || "General", 80, y);
      doc.text(formatNum(med.stock), 120, y);
      doc.text(`${config.currency}${med.price}`, 145, y);
      doc.text(isLow ? "LOW STOCK" : "OPTIMAL", 170, y);
      
      doc.setDrawColor(245, 245, 245);
      doc.line(15, y + 2, 195, y + 2);
      y += 8;
    });

    doc.setTextColor(150, 150, 150);
    doc.setFontSize(8);
    doc.text("END OF INVENTORY REPORT", 105, 285, { align: "center" });
    doc.save(`inventory_report_${hospitalId}.pdf`);
  };

  const handleExportHRDPDF = () => {
    onLogAction("Generate HR Report", "Issued employee directory and payroll statement PDF");
    const doc = new jsPDF();
    
    doc.setFillColor(71, 85, 105); // Slate
    doc.rect(0, 0, 210, 40, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(20);
    doc.text("HUMAN RESOURCES DIRECTORY & PAYROLL", 15, 20);
    doc.setFontSize(10);
    doc.setFont("Helvetica", "normal");
    doc.text(`${hospitalDetails.name.toUpperCase()} | FACILITY PERSONNEL RECORDS`, 15, 30);
    
    let y = 60;
    doc.setFillColor(240, 240, 240);
    doc.rect(15, y, 180, 8, "F");
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    doc.text("EMPLOYEE NAME", 20, y + 5);
    doc.text("DESIGNATION", 75, y + 5);
    doc.text("DEPARTMENT", 120, y + 5);
    doc.text("SALARY / MO", 165, y + 5);

    y += 12;
    doc.setFont("Helvetica", "normal");
    employees.forEach((emp) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(emp.name, 20, y);
      doc.text(emp.role, 75, y);
      doc.text(emp.department || "N/A", 120, y);
      doc.text(`${config.currency}${emp.salary?.toLocaleString() || "0"}`, 165, y);
      doc.line(15, y + 2, 195, y + 2);
      y += 8;
    });

    doc.setTextColor(150, 150, 150);
    doc.setFontSize(8);
    doc.text("OFFICIAL HR DOCUMENT - PRIVATE & CONFIDENTIAL", 105, 285, { align: "center" });
    doc.save(`hr_report_${hospitalId}.pdf`);
  };

  const handleExportClinicalPDF = () => {
    onLogAction("Generate Clinical Report", "Issued hospital activity summary report PDF");
    const doc = new jsPDF();
    
    doc.setFillColor(2, 132, 199); // Sky blue
    doc.rect(0, 0, 210, 40, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(20);
    doc.text("CLINICAL ACTIVITY & CENSUS REPORT", 15, 20);
    doc.setFontSize(10);
    doc.setFont("Helvetica", "normal");
    doc.text(`${hospitalDetails.name.toUpperCase()} | MEDICAL STATISTICS SUMMARY`, 15, 30);

    const totalPatients = patients.length;
    const opdCount = invoices.filter(i => i.type === "OPD").length;
    const ipdCount = invoices.filter(i => i.type === "IPD").length;
    const pharmCount = invoices.filter(i => i.type === "Pharmacy").length;

    let y = 60;
    doc.setFontSize(14);
    doc.setTextColor(2, 132, 199);
    doc.text("EXECUTIVE CENSUS SUMMARY", 15, y);
    doc.setDrawColor(2, 132, 199);
    doc.line(15, y + 2, 195, y + 2);

    y += 15;
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.text(`Total Registered Patients: ${totalPatients}`, 20, y);
    doc.text(`Total OPD Visits (Lifetime): ${opdCount}`, 20, y + 8);
    doc.text(`Total IPD Admissions (Lifetime): ${ipdCount}`, 20, y + 16);
    doc.text(`Total Pharmacy Dispensions: ${pharmCount}`, 20, y + 24);

    y += 40;
    doc.setFontSize(14);
    doc.setTextColor(2, 132, 199);
    doc.text("RECENT REGISTERED PATIENTS", 15, y);
    doc.line(15, y + 2, 195, y + 2);

    y += 15;
    doc.setFillColor(240, 240, 240);
    doc.rect(15, y, 180, 8, "F");
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    doc.text("PATIENT NAME", 20, y + 5);
    doc.text("GENDER", 80, y + 5);
    doc.text("DOB", 110, y + 5);
    doc.text("PHONE", 140, y + 5);
    doc.text("REGISTERED", 170, y + 5);

    y += 12;
    doc.setFont("Helvetica", "normal");
    patients.slice(-20).reverse().forEach(p => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(p.name, 20, y);
      doc.text(p.gender || "N/A", 80, y);
      doc.text(p.dob || "N/A", 110, y);
      doc.text(p.phone || "N/A", 140, y);
      doc.text(new Date(p.createdAt).toLocaleDateString(), 170, y);
      doc.line(15, y + 2, 195, y + 2);
      y += 8;
    });

    doc.setTextColor(150, 150, 150);
    doc.setFontSize(8);
    doc.text("OFFICIAL CLINICAL RECORD SUMMARY", 105, 285, { align: "center" });
    doc.save(`clinical_report_${hospitalId}.pdf`);
  };

  const handleExportExcel = () => {
    onLogAction("Generate Excel Report", "Spreadsheet ledger xlsx exported.");
    
    // Prepare invoices array
    const data = invoices.map(inv => ({
      "Invoice ID": inv.id,
      "Patient Name": inv.patientName,
      "Bill Type": inv.type,
      "Subtotal": inv.subtotal,
      "Tax Amount": inv.taxAmount,
      "Total Amount": inv.total,
      "Payment Status": inv.status,
      "Payment Mode": inv.paymentMethod || "N/A",
      "Date Generated": formatDate(inv.createdAt.split("T")[0], countryCode)
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Financial Ledger");
    
    XLSX.writeFile(wb, `carematrix_billing_ledger_${hospitalId}.xlsx`);
  };

  // --- 5. SETTINGS FORM ---
  const [setHospName, setSetHospName] = useState(hospitalDetails.name);
  const [setHospEmail, setSetHospEmail] = useState(hospitalDetails.email);
  const [setHospPhone, setSetHospPhone] = useState(hospitalDetails.phone);
  const [setHospAddress, setSetHospAddress] = useState(hospitalDetails.address);
  const [setHospTaxRate, setSetHospTaxRate] = useState((hospitalDetails.taxRate * 100).toString());
  const [setHospLogo, setSetHospLogo] = useState(hospitalDetails.logoUrl || "");

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSetHospLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    DB.updateHospital(hospitalId, {
      name: setHospName,
      email: setHospEmail,
      phone: setHospPhone,
      address: setHospAddress,
      taxRate: Number(setHospTaxRate) / 100,
      logoUrl: setHospLogo
    });
    onRefreshHospital();
    onLogAction("Update Clinic Settings", "Modified clinic details, tax setups, or address mappings.");
  };

  const [backupSuccess, setBackupSuccess] = useState(false);
  const [backupError, setBackupError] = useState("");

  const handleBackupDownload = () => {
    const dataStr = DB.getBackupJSON();
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `carematrix_backup_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    onLogAction("Export Database Backup", "Downloaded entire system backup via settings panel.");
  };

  const handleBackupUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        const content = event.target?.result as string;
        const success = DB.restoreBackup(content);
        if (success) {
          // Refresh all local component states so the visual tables update instantly
          setMedicines(DB.getMedicines(hospitalId));
          setInvoices(DB.getBillingInvoices(hospitalId));
          setEmployees(DB.getHRRecord(hospitalId));
          setPatients(DB.getPatients(hospitalId));
          onRefreshHospital();

          const freshHosp = DB.getHospitals().find(h => h.id === hospitalId);
          if (freshHosp) {
            setSetHospName(freshHosp.name);
            setSetHospEmail(freshHosp.email);
            setSetHospPhone(freshHosp.phone);
            setSetHospAddress(freshHosp.address);
            setSetHospTaxRate((freshHosp.taxRate * 100).toString());
            setSetHospLogo(freshHosp.logoUrl || "");
          }

          setBackupSuccess(true);
          setBackupError("");
          onLogAction("Restore Database Backup", "Successfully restored entire database state from backup JSON.");
          setTimeout(() => setBackupSuccess(false), 4000);
        } else {
          setBackupError("Invalid backup file layout.");
        }
      };
    }
  };

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState("");

  const handleMasterReset = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Authenticate using any active Hospital Admin or Super Admin user's password for this hospital
    const matchedAdmin = DB.getUsers().find(u => 
      u.hospitalId === hospitalId && 
      (u.role === UserRole.HOSPITAL_ADMIN || u.role === UserRole.SUPER_ADMIN) &&
      (u.password === resetConfirmPassword || (!u.password && resetConfirmPassword === "1234"))
    );

    if (!matchedAdmin) {
      setResetError("Invalid Hospital Admin password.");
      return;
    }

    // Perform the reset
    DB.resetHospitalData(hospitalId, userId, userName, userRole);
    
    // Refresh all state caches
    setMedicines([]);
    setInvoices([]);
    setEmployees([]);
    setPatients([]);
    
    // Trigger parent refresh
    onRefreshHospital();

    setResetSuccess(true);
    setResetError("");
    setResetConfirmPassword("");
    setShowResetModal(false);
    onLogAction("Master Reset Completed", "Fully purged clinical logs, patients, billing, inventory, and payroll logs.");
    setTimeout(() => setResetSuccess(false), 4000);
  };

  return (
    <div className="space-y-6">
      {/* --- SUB-TAB: PHARMACY --- */}
      {activeSubTab === "pharmacy" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            
            {/* Search and Alert Panel */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 p-4 rounded-xl shadow-xs">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search medicine compound name or category..."
                  value={pharmSearch}
                  onChange={(e) => setPharmSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold px-3 py-1.5 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 rounded-full shrink-0">
                  {medicines.filter(m => m.stock < m.minStockAlert).length} Low Stock Alert
                </span>
                <button 
                  onClick={handleExportInventoryPDF}
                  className="px-3 py-1.5 bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400 border border-teal-200/50 text-xs font-semibold rounded-lg hover:bg-teal-100 transition shadow-xs flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Inventory Audit
                </button>
                <button 
                  onClick={() => {
                    setMedicines(DB.getMedicines(hospitalId));
                    setPatients(DB.getPatients(hospitalId));
                  }}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                  title="Reload Stock Data"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Pharmacy stock listings */}
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/20">
                <h2 className="font-semibold text-slate-800 dark:text-white text-sm">Active Pharmacy Stocks</h2>
              </div>

              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-700/40 text-[10px] uppercase font-semibold text-slate-500">
                    <tr>
                      <th className="px-6 py-3">Medicine Compound</th>
                      <th className="px-6 py-3">Stock Details</th>
                      <th className="px-6 py-3">Unit Price</th>
                      <th className="px-6 py-3">Expiry Date</th>
                      <th className="px-6 py-3 text-right">Dispensations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {medicines.filter(med => 
                      med.name.toLowerCase().includes(pharmSearch.toLowerCase()) ||
                      med.category.toLowerCase().includes(pharmSearch.toLowerCase())
                    ).map((med) => {
                      const isLow = med.stock < med.minStockAlert;
                      return (
                        <tr key={med.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-700/10">
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-900 dark:text-white">{med.name}</div>
                            <div className="text-slate-400 text-[10px] mt-0.5 uppercase">{med.category} • {med.location}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className={`font-bold font-mono text-xs ${isLow ? "text-rose-600 animate-pulse" : "text-slate-800 dark:text-slate-200"}`}>
                              {med.stock} Units left
                            </div>
                            {isLow && (
                              <div className="text-[9px] text-rose-500 font-bold mt-0.5 uppercase tracking-wider">Low Stock!</div>
                            )}
                          </td>
                          <td className="px-6 py-4 font-mono text-slate-700 dark:text-slate-300 font-semibold">
                            {formatCurrency(med.price, countryCode)}
                          </td>
                          <td className="px-6 py-4 text-slate-500">
                            {formatDate(med.expiryDate, countryCode)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                            <button
                              onClick={() => handleAddToCart(med)}
                              disabled={med.stock <= 0}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-[10px] disabled:opacity-30 transition uppercase tracking-wider"
                              title="Add to Billing Basket"
                            >
                              + Add Cart
                            </button>
                            <button
                              onClick={() => handleSellMed(med.id, 1)}
                              disabled={med.stock <= 0}
                              className="px-2.5 py-1 bg-teal-600 text-white font-bold rounded hover:bg-teal-700 text-[10px] disabled:opacity-30 transition inline-flex items-center gap-1 uppercase tracking-wider"
                              title="Instant Cash Sell & Print Bill"
                            >
                              <Printer className="w-3 h-3" /> Quick Sell
                            </button>
                            <button
                              onClick={() => setRestockId(med.id)}
                              className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded hover:bg-slate-200 text-[10px] transition"
                            >
                              Restock
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            
            {/* Right Panel Tabs */}
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-xl p-4 shadow-sm">
              <div className="flex bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl mb-4">
                <button
                  onClick={() => setRightPanelTab("cart")}
                  className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                    rightPanelTab === "cart" 
                      ? "bg-white dark:bg-slate-800 text-teal-600 shadow-xs" 
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                  }`}
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  Cart
                </button>
                <button
                  onClick={() => setRightPanelTab("purchase")}
                  className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                    rightPanelTab === "purchase" 
                      ? "bg-white dark:bg-slate-800 text-teal-600 shadow-xs" 
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                  }`}
                >
                  <Truck className="w-3.5 h-3.5" />
                  Purchase
                </button>
                <button
                  onClick={() => setRightPanelTab("add")}
                  className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                    rightPanelTab === "add" 
                      ? "bg-white dark:bg-slate-800 text-teal-600 shadow-xs" 
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>

              {rightPanelTab === "cart" ? (
                /* --- BILLING CART POS TAB --- */
                <div>
                  {cart.length === 0 ? (
                    <div className="text-center py-10 px-4 border border-dashed border-slate-200 dark:border-slate-700/60 rounded-xl">
                      <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Cart is Empty</p>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-[200px] mx-auto">
                        Click "+ Add Cart" on medicine compounds to generate and print combined bill invoice.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Cart Items List */}
                      <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                        {cart.map(item => (
                          <div key={item.id} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700/40 rounded-xl text-[11px]">
                            <div className="space-y-0.5 max-w-[100px] truncate">
                              <div className="font-bold text-slate-900 dark:text-white truncate">{item.name}</div>
                              <div className="text-[9px] text-slate-400 font-mono">{formatCurrency(item.price, countryCode)} each</div>
                            </div>
                            
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleUpdateCartQty(item.id, -1)}
                                className="w-5 h-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded flex items-center justify-center font-bold text-slate-500 hover:bg-slate-100"
                              >
                                -
                              </button>
                              <span className="font-bold font-mono text-slate-800 dark:text-white w-4 text-center">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => handleUpdateCartQty(item.id, 1)}
                                className="w-5 h-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded flex items-center justify-center font-bold text-slate-500 hover:bg-slate-100"
                              >
                                +
                              </button>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <span className="font-bold font-mono text-slate-900 dark:text-white">{formatCurrency(item.price * item.quantity, countryCode)}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveFromCart(item.id)}
                                className="text-rose-500 hover:text-rose-600 p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/20"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Checkout Details Form */}
                      <form onSubmit={handleCartCheckout} className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Patient Category</label>
                          <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 dark:bg-slate-900 rounded-lg">
                            <button
                              type="button"
                              onClick={() => setCheckoutPatientType("walkin")}
                              className={`py-1 text-[10px] font-bold rounded-md transition ${
                                checkoutPatientType === "walkin" ? "bg-white dark:bg-slate-800 text-teal-600 shadow-xs" : "text-slate-500"
                              }`}
                            >
                              Walk-In
                            </button>
                            <button
                              type="button"
                              onClick={() => setCheckoutPatientType("registered")}
                              className={`py-1 text-[10px] font-bold rounded-md transition ${
                                checkoutPatientType === "registered" ? "bg-white dark:bg-slate-800 text-teal-600 shadow-xs" : "text-slate-500"
                              }`}
                            >
                              Hospital Patient
                            </button>
                          </div>
                        </div>

                        {checkoutPatientType === "walkin" ? (
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Patient Name *</label>
                            <input
                              type="text"
                              required
                              value={walkinPatientName}
                              onChange={(e) => setWalkinPatientName(e.target.value)}
                              className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                              placeholder="Walk-In Pharmacy Patient"
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Choose Hospital Patient *</label>
                            <select
                              required
                              onChange={(e) => {
                                const patient = patients.find(p => p.id === e.target.value);
                                if (patient) setWalkinPatientName(patient.name);
                              }}
                              className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                            >
                              <option value="">Select Patient</option>
                              {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                          </div>
                        )}
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Payment Mode</label>
                          <select
                            value={checkoutPaymentMethod}
                            onChange={(e) => setCheckoutPaymentMethod(e.target.value as any)}
                            className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                          >
                            <option value="Cash">Cash</option>
                            <option value="Card">Card</option>
                            <option value="UPI">UPI/QR Code</option>
                            <option value="Insurance">Insurance</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Discount ({COUNTRIES[countryCode]?.currency || "$"})</label>
                          <input
                            type="number"
                            min="0"
                            value={checkoutDiscount}
                            onChange={(e) => setCheckoutDiscount(e.target.value)}
                            className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={cart.length === 0}
                          className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 rounded-lg text-xs mt-2 disabled:opacity-50 transition"
                        >
                          Checkout & Print Invoice
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              ) : rightPanelTab === "purchase" ? (
                /* --- REGISTER PURCHASE TAB --- */
                <div className="space-y-4">
                  <form onSubmit={handleRegisterPurchase} className="space-y-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Medicine *</label>
                      <select
                        value={purchaseMedId}
                        onChange={(e) => setPurchaseMedId(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                        required
                      >
                        <option value="">Select Medicine</option>
                        {medicines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Supplier *</label>
                      <input type="text" required value={purchaseSupplier} onChange={(e) => setPurchaseSupplier(e.target.value)} className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white" />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Invoice # *</label>
                      <input type="text" required value={purchaseInvoiceNo} onChange={(e) => setPurchaseInvoiceNo(e.target.value)} className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Quantity *</label>
                          <input type="number" required value={purchaseQty} onChange={(e) => setPurchaseQty(e.target.value)} className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white" />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Price *</label>
                          <input type="number" required value={purchasePriceVal} onChange={(e) => setPurchasePriceVal(e.target.value)} className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white" />
                        </div>
                    </div>
                    <button type="submit" className="w-full bg-teal-600 text-white font-bold py-2 rounded-lg text-xs hover:bg-teal-700">Register Purchase</button>
                    {purchaseStatusMsg && <p className="text-xs text-center text-teal-600 font-medium">{purchaseStatusMsg}</p>}
                  </form>
                </div>
              ) : (
                /* --- ADD MEDICINE TAB --- */
                <div className="space-y-4">
                  <form onSubmit={handleRegisterMedicine} className="space-y-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Medicine Name *</label>
                      <input
                        type="text"
                        required
                        value={newMedName}
                        onChange={(e) => setNewMedName(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                        placeholder="e.g. Paracetamol 500mg"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                       <div>
                         <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Category *</label>
                         <input
                           type="text"
                           required
                           value={newMedCat}
                           onChange={(e) => setNewMedCat(e.target.value)}
                           className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                           placeholder="e.g. Analgesics"
                         />
                       </div>
                       <div>
                         <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Min Stock Alert *</label>
                         <input
                           type="number"
                           required
                           value={newMedAlert}
                           onChange={(e) => setNewMedAlert(e.target.value)}
                           className="w-full px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                         />
                       </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 rounded-lg text-xs mt-2 transition"
                    >
                      Onboard New Medicine
                    </button>
                  </form>
                </div>
              )}
            </div>
            {/* Restock trigger form */}
            {restockId && (
              <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 p-4 rounded-xl shadow-sm border-l-4 border-l-teal-600 animate-in slide-in-from-top-3">
                <h4 className="font-bold text-slate-800 dark:text-white text-xs mb-3">Replenish Stock: {restockId}</h4>
                <form onSubmit={handleRestock} className="space-y-3">
                  <input
                    type="number"
                    value={restockQty}
                    onChange={(e) => setRestockQty(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800"
                    placeholder="Refill units count"
                  />
                  <div className="flex justify-end gap-2 text-[10px]">
                    <button type="button" onClick={() => setRestockId("")} className="px-3 py-1 text-slate-500">Cancel</button>
                    <button type="submit" className="px-4 py-1 bg-teal-600 text-white font-semibold rounded">Confirm Restock</button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- SUB-TAB: BILLING --- */}
      {activeSubTab === "billing" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl">
              <div className="text-xs text-slate-400 font-semibold uppercase text-emerald-600">Total Payments Settled (Gross)</div>
              <div className="text-xl font-bold font-mono text-emerald-600 mt-1.5">{formatCurrency(totalPaid, countryCode)}</div>
            </div>
            <div className="p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl">
              <div className="text-xs text-slate-400 font-semibold uppercase text-rose-600">Total Hospital Expenses</div>
              <div className="text-xl font-bold font-mono text-rose-600 mt-1.5">{formatCurrency(totalExpenses, countryCode)}</div>
            </div>
            <div className="p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl font-bold border-l-4 border-l-teal-500">
              <div className="text-xs text-teal-600 dark:text-teal-400 uppercase">Net Hospital Income</div>
              <div className="text-xl font-bold font-mono text-teal-600 dark:text-teal-400 mt-1.5">{formatCurrency(totalPaid - totalExpenses, countryCode)}</div>
            </div>
            <div className="p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl">
              <div className="text-xs text-slate-400 font-semibold uppercase text-amber-600">Outstanding Receivables</div>
              <div className="text-xl font-bold font-mono text-amber-600 mt-1.5">{formatCurrency(totalPending, countryCode)}</div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/20 flex justify-between items-center">
              <h2 className="font-semibold text-slate-800 dark:text-white uppercase tracking-wider text-xs">Unified Hospital Financial Ledger (Income & Expenses)</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowExpenseForm(!showExpenseForm)}
                  className="px-3 py-1.5 bg-rose-500 text-white rounded text-sm font-semibold hover:bg-rose-600 transition inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Expense
                </button>
                <button
                  onClick={handlePrintLedger}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded text-sm text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Ledger
                </button>
                <input
                  type="text"
                  placeholder="Search Ledger..."
                  className="px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded text-sm dark:bg-slate-700"
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                />
              </div>
            </div>
            
            {showExpenseForm && (
              <div className="p-4 bg-slate-50 dark:bg-slate-700/30 border-b border-slate-100 dark:border-slate-700">
                <form onSubmit={handleAddGeneralExpense} className="flex flex-wrap gap-4 items-end">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Expense Description</label>
                    <input
                      type="text"
                      placeholder="e.g., Monthly Electricity Bill"
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded text-sm dark:bg-slate-800"
                      value={expenseDesc}
                      onChange={(e) => setExpenseDesc(e.target.value)}
                      required
                    />
                  </div>
                  <div className="w-32">
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Amount</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded text-sm dark:bg-slate-800"
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div className="w-40">
                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Category</label>
                    <select
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded text-sm dark:bg-slate-800"
                      value={expenseCategory}
                      onChange={(e) => setExpenseCategory(e.target.value)}
                    >
                      <option value="Utility">Utility</option>
                      <option value="Rent">Rent</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-teal-600 text-white rounded text-sm font-semibold hover:bg-teal-700 transition"
                  >
                    Record Entry
                  </button>
                </form>
              </div>
            )}

            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-700/40 text-[10px] uppercase font-semibold text-slate-500">
                  <tr>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Reference ID</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Description / Patient</th>
                    <th className="px-6 py-3 text-right">Amount</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {filteredLedger.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-700/10">
                      <td className="px-6 py-4 whitespace-nowrap">{new Date(item.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 font-mono font-bold text-slate-600 dark:text-slate-400">{item.id}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.type === "Income" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                        }`}>
                          {item.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 dark:text-white max-w-xs truncate">{item.description}</div>
                      </td>
                      <td className={`px-6 py-4 text-right font-mono font-bold ${
                        item.type === "Income" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                      }`}>
                        {item.type === "Income" ? "+" : "-"}{formatCurrency(item.amount, countryCode)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.status === "Paid" || item.status === "Settled" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {item.type === "Income" && (item.original as BillingInvoice).status === "Pending" ? (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleCollectBill(item.id, "Cash")}
                                className="px-1.5 py-0.5 bg-teal-600 text-white rounded text-[10px]"
                              >
                                Cash
                              </button>
                              <button
                                onClick={() => handleCollectBill(item.id, "Card")}
                                className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded text-[10px]"
                              >
                                Card
                              </button>
                            </div>
                          ) : item.type === "Expense" ? (
                            <button
                              onClick={() => handleDeleteExpense(item.id)}
                              className="text-rose-600 hover:text-rose-800"
                            >
                              Delete
                            </button>
                          ) : (
                            <button
                              onClick={() => handlePrintInvoice(item.id)}
                              className="p-1 text-slate-500 hover:text-teal-600 rounded transition"
                              title="Print Invoice"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- SUB-TAB: HR WORKFORCES --- */}
      {activeSubTab === "hr" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/20 flex justify-between items-center">
              <h2 className="font-semibold text-slate-800 dark:text-white">Active Clinical Staff Roster</h2>
              
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search Staff..."
                    className="pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-teal-500 w-48 transition-all"
                    value={staffSearch}
                    onChange={(e) => setStaffSearch(e.target.value)}
                  />
                </div>
                <button 
                  onClick={handleExportHRDPDF}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200 transition shadow-xs flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Directory
                </button>
                <button
                  onClick={() => setShowAddStaffModal(true)}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Staff / Doctor
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Roster Date:</span>
                  <input
                    type="date"
                    value={attDate}
                    onChange={(e) => setAttDate(e.target.value)}
                    className="px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 rounded text-slate-800 dark:text-white focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-700/40 text-[10px] uppercase font-semibold text-slate-500">
                  <tr>
                    <th>Staff Name</th>
                    <th>Role & Dep</th>
                    <th>Salary base</th>
                    <th>Status</th>
                    <th>Today Attendance ({attDate.slice(-5)})</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {employees
                    .filter(emp => 
                      emp.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
                      emp.id.toLowerCase().includes(staffSearch.toLowerCase()) ||
                      emp.role.toLowerCase().includes(staffSearch.toLowerCase()) ||
                      emp.department.toLowerCase().includes(staffSearch.toLowerCase())
                    )
                    .map((emp) => {
                      const todayStatus = emp.attendance[attDate] || "Not Marked";
                      const isActive = emp.isActive !== false;
                    return (
                      <tr key={emp.id} className={`hover:bg-slate-50/30 dark:hover:bg-slate-700/10 ${!isActive ? "opacity-60 grayscale" : ""}`}>
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900 dark:text-white">{emp.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{emp.id}</div>
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                          <div className="font-medium">{emp.role}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5 uppercase">{emp.department}</div>
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-800 dark:text-slate-200">
                          {formatCurrency(emp.salary, countryCode)}/m
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            isActive ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                          }`}>
                            {isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase inline-flex items-center gap-1 ${
                            todayStatus === "Present" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" :
                            todayStatus === "Absent" ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400" :
                            todayStatus === "Leave" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" :
                            "bg-slate-100 text-slate-500 dark:bg-slate-700"
                          }`}>
                            {todayStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4 space-x-1.5 whitespace-nowrap">
                          {isActive && (
                            <>
                              <button
                                onClick={() => handleToggleAttendance(emp.id, "Present")}
                                className="px-2 py-1 bg-emerald-50 text-emerald-700 font-semibold rounded hover:bg-emerald-100 transition text-[11px]"
                              >
                                P
                              </button>
                              <button
                                onClick={() => handleToggleAttendance(emp.id, "Absent")}
                                className="px-2 py-1 bg-rose-50 text-rose-700 font-semibold rounded hover:bg-rose-100 transition text-[11px]"
                              >
                                A
                              </button>
                              <button
                                onClick={() => handleToggleAttendance(emp.id, "Leave")}
                                className="px-2 py-1 bg-amber-50 text-amber-700 font-semibold rounded hover:bg-amber-100 transition text-[11px]"
                              >
                                L
                              </button>
                              <button
                                onClick={() => handlePaySalary(emp.id)}
                                className="px-2 py-1 bg-teal-600 text-white font-semibold rounded hover:bg-teal-700 transition text-[11px]"
                              >
                                Pay Salary
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleToggleActive(emp.id, isActive)}
                            className={`px-2 py-1 font-semibold rounded transition text-[11px] ${
                              isActive ? "bg-amber-100 text-amber-800 hover:bg-amber-200" : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                            }`}
                          >
                            {isActive ? "Deactivate" : "Activate"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-slate-800 dark:text-white text-base mb-3 flex items-center gap-1.5">
              <Users className="w-5 h-5 text-teal-600" />
              Payroll Releases
            </h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Disburse monthly salaries instantly to the clinical departments. Disbursed funds are logged as clinical expenditures.
            </p>

            {/* Compiled Pay Sheet printing utility */}
            <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-2">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Generate & Print Monthly Pay Sheet</div>
              <div className="flex gap-2">
                <input
                  type="month"
                  value={salaryMonth}
                  onChange={(e) => setSalaryMonth(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-white w-full focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                <button
                  onClick={() => handlePrintPaySheet(salaryMonth)}
                  className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold rounded flex items-center gap-1 shrink-0 transition shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Sheet
                </button>
              </div>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {employees.map(emp => (
                <div key={emp.id} className="p-3 border border-slate-100 dark:border-slate-700 rounded-lg text-xs space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800 dark:text-white">{emp.name}</span>
                    <span className="font-semibold text-slate-400">{emp.id}</span>
                  </div>
                  
                  {emp.payrollHistory.length > 0 ? (
                    <div className="space-y-1.5">
                      {emp.payrollHistory.map((item, idx) => (
                        <div key={idx} className="bg-slate-50 dark:bg-slate-900 p-2 rounded text-[11px] font-mono flex justify-between items-center gap-2">
                          <div className="truncate">
                            <span className="text-emerald-600 font-semibold block">Month {item.month}</span>
                            <span className="text-[10px] text-slate-400 font-bold">{formatCurrency(Number(item.netPay), countryCode)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => handlePrintSalarySlip(emp, item.month, item.id)}
                              className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-slate-700 hover:bg-teal-50 dark:hover:bg-slate-750 font-bold rounded text-[10px] transition shrink-0 shadow-3xs"
                              title="Print detailed salary slip"
                            >
                              <Printer className="w-3 h-3" />
                              Slip
                            </button>
                            <button
                              onClick={() => handleDeletePayroll(emp.id, item.id || item.month)}
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition shrink-0"
                              title="Delete this payroll record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-400 italic">No disbursement history logged.</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- SUB-TAB: REPORTS --- */}
      {activeSubTab === "reports" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white text-lg">Hospital Reporting Hub</h2>
              <p className="text-xs text-slate-500 mt-0.5">Generate, audit, and print professional statutory reports and clinical summaries.</p>
            </div>
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition shadow-md"
            >
              <Download className="w-4 h-4" />
              Consolidated Ledger (Excel)
            </button>
          </div>

          {/* Report Generation Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Financial Report Card */}
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-teal-50 dark:bg-teal-900/30 rounded-lg flex items-center justify-center mb-4">
                <DollarSign className="w-5 h-5 text-teal-600" />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-1">Financial & Tax</h3>
              <p className="text-[11px] text-slate-500 mb-4 h-8">Complete revenue breakdown, expenditure analysis, and statutory tax estimates.</p>
              <button 
                onClick={handleExportPDF}
                className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold rounded-lg transition flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Generate PDF
              </button>
            </div>

            {/* Clinical Census Card */}
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-sky-50 dark:bg-sky-900/30 rounded-lg flex items-center justify-center mb-4">
                <FileText className="w-5 h-5 text-sky-600" />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-1">Clinical Activity</h3>
              <p className="text-[11px] text-slate-500 mb-4 h-8">Patient demographics, census statistics, and recent clinical registration summary.</p>
              <button 
                onClick={handleExportClinicalPDF}
                className="w-full py-2 bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold rounded-lg transition flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Generate PDF
              </button>
            </div>

            {/* Inventory Audit Card */}
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/30 rounded-lg flex items-center justify-center mb-4">
                <Archive className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-1">Inventory & Pharmacy</h3>
              <p className="text-[11px] text-slate-500 mb-4 h-8">Stock levels, category audit, low-stock alerts, and pharmaceutical valuation.</p>
              <button 
                onClick={handleExportInventoryPDF}
                className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-lg transition flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Generate PDF
              </button>
            </div>

            {/* HR Directory Card */}
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-1">HR & Personnel</h3>
              <p className="text-[11px] text-slate-500 mb-4 h-8">Staff directory, designation mapping, and payroll disbursement overview.</p>
              <button 
                onClick={handleExportHRDPDF}
                className="w-full py-2 bg-slate-700 hover:bg-slate-800 text-white text-[11px] font-bold rounded-lg transition flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Generate PDF
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Visual Analytics */}
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-slate-800 dark:text-white text-xs uppercase mb-4 tracking-wider">Revenue Distribution By Department</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={financeTrendData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${config.currency}${val}`} />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="amount" fill="#0d9488" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Treasury Status highlight */}
            <div className="bg-teal-600 rounded-xl p-6 shadow-md text-white flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <DollarSign className="w-32 h-32" />
              </div>
              <div className="relative z-10">
                <h3 className="text-teal-100 text-xs uppercase font-bold tracking-widest mb-1">Net Treasury Balance</h3>
                <div className="text-4xl font-bold font-mono">
                  {formatCurrency(totalPaid - totalExpenses, countryCode)}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] text-teal-100 uppercase block">Total Liquid Revenue</span>
                    <span className="font-bold text-lg">{formatCurrency(totalPaid, countryCode)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-teal-100 uppercase block">Total Expenditure</span>
                    <span className="font-bold text-lg">{formatCurrency(totalExpenses, countryCode)}</span>
                  </div>
                </div>
              </div>
              <div className="mt-auto pt-6 flex justify-between items-end relative z-10">
                <div className="text-[10px] text-teal-100 italic">Financial health: {totalPaid > totalExpenses ? 'Stable (Surplus)' : 'Review Required (Deficit)'}</div>
                <button 
                  onClick={handleExportPDF}
                  className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded text-[10px] font-bold transition flex items-center gap-1"
                >
                  <Printer className="w-3 h-3" />
                  Print Statement
                </button>
              </div>
            </div>

            {/* Revenues overview */}
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-xl p-5 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-slate-800 dark:text-white text-xs uppercase tracking-wider">Operational Revenue breakdown</h3>
                <button 
                  onClick={handleExportPDF}
                  className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded-lg transition-colors"
                  title="Print Report"
                >
                  <Printer className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-medium">Outpatient Consultations (OPD)</span>
                  <span className="font-bold font-mono text-slate-800 dark:text-white">{formatCurrency(opdRevenue, countryCode)}</span>
                </div>
                <div className="flex justify-between items-center text-xs border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-medium">Inpatient Ward stays (IPD)</span>
                  <span className="font-bold font-mono text-slate-800 dark:text-white">{formatCurrency(ipdRevenue, countryCode)}</span>
                </div>
                <div className="flex justify-between items-center text-xs border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-medium">Pharmacy Compounds sales</span>
                  <span className="font-bold font-mono text-slate-800 dark:text-white">{formatCurrency(pharmRevenue, countryCode)}</span>
                </div>
                <div className="flex justify-between items-center text-xs border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-medium">Laboratory & Diagnostics</span>
                  <span className="font-bold font-mono text-slate-800 dark:text-white">{formatCurrency(generalRevenue, countryCode)}</span>
                </div>
                
                <div className="pt-2">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Adjusted Expenditure</h4>
                  <div className="flex justify-between items-center text-xs border-b border-slate-50 pb-2">
                    <span className="text-rose-600 dark:text-rose-400 font-medium italic">Pharmacy Purchase Expenses</span>
                    <span className="font-bold font-mono text-rose-600 dark:text-rose-400">-{formatCurrency(totalMedicineExpenses, countryCode)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-b border-slate-50 pb-2">
                    <span className="text-rose-600 dark:text-rose-400 font-medium italic">Consolidated Payroll Costs</span>
                    <span className="font-bold font-mono text-rose-600 dark:text-rose-400">-{formatCurrency(totalPayrollExpenses, countryCode)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-b border-slate-50 pb-2">
                    <span className="text-rose-600 dark:text-rose-400 font-medium italic">General Overheads</span>
                    <span className="font-bold font-mono text-rose-600 dark:text-rose-400">-{formatCurrency(totalOtherExpenses, countryCode)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tax Overview */}
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-xl p-5 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-slate-800 dark:text-white text-xs uppercase tracking-wider text-amber-600">Tax Overview ({config.taxLabel || "Tax"})</h3>
                <button 
                  onClick={handleExportPDF}
                  className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors"
                  title="Print Tax Report"
                >
                  <Printer className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-[11px] border-b border-slate-50 pb-2">
                  <span className="text-slate-500 font-medium">OPD Services Tax</span>
                  <span className="font-bold font-mono text-slate-700 dark:text-slate-300">{formatCurrency(opdTax, countryCode)}</span>
                </div>
                <div className="flex justify-between items-center text-[11px] border-b border-slate-50 pb-2">
                  <span className="text-slate-500 font-medium">IPD Admissions Tax</span>
                  <span className="font-bold font-mono text-slate-700 dark:text-slate-300">{formatCurrency(ipdTax, countryCode)}</span>
                </div>
                <div className="flex justify-between items-center text-[11px] border-b border-slate-50 pb-2">
                  <span className="text-slate-500 font-medium">Pharmacy Sales Tax</span>
                  <span className="font-bold font-mono text-slate-700 dark:text-slate-300">{formatCurrency(pharmTax, countryCode)}</span>
                </div>
                <div className="flex justify-between items-center text-[11px] border-b border-slate-50 pb-2">
                  <span className="text-slate-500 font-medium">Laboratory/Tests Tax</span>
                  <span className="font-bold font-mono text-slate-700 dark:text-slate-300">{formatCurrency(labTax, countryCode)}</span>
                </div>
                
                <div className="pt-2">
                  <div className="flex justify-between items-center text-xs border-b border-slate-100 pb-2 bg-amber-50/30 dark:bg-amber-950/20 -mx-2 px-2 py-1 rounded">
                    <span className="text-amber-800 dark:text-amber-400 font-bold">Total {config.taxLabel || "Tax"} Collected</span>
                    <span className="font-bold font-mono text-amber-600 dark:text-amber-400">{formatCurrency(totalTaxCollected, countryCode)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-b border-slate-100 pb-2 mt-2">
                    <span className="text-slate-500 font-medium">Taxable Revenue (Net)</span>
                    <span className="font-bold font-mono text-slate-800 dark:text-white">{formatCurrency(totalPaid - totalTaxCollected, countryCode)}</span>
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-slate-500 leading-relaxed italic">
                      Tax compliance estimate based on settled transactions. Tax Rate applied: {((hospitalDetails.taxRate || config.taxRate) * 100).toFixed(1)}% {config.taxLabel}.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- SUB-TAB: CLINIC SETTINGS --- */}
      {activeSubTab === "settings" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-xl p-5 shadow-sm">
            <h2 className="font-bold text-slate-900 dark:text-white text-base mb-4 flex items-center gap-1.5">
              <Settings className="w-5 h-5 text-teal-600" />
              Configure Hospital Parameters
            </h2>

            <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-500 font-semibold uppercase mb-1">Hospital Clinical Name *</label>
                <input
                  type="text"
                  required
                  value={setHospName}
                  onChange={(e) => setSetHospName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 font-semibold uppercase mb-1">Administrative Email *</label>
                  <input
                    type="email"
                    required
                    value={setHospEmail}
                    onChange={(e) => setSetHospEmail(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold uppercase mb-1">Contact Hotline *</label>
                  <input
                    type="text"
                    required
                    value={setHospPhone}
                    onChange={(e) => setSetHospPhone(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 font-semibold uppercase mb-1">Default Country Presets (Locked)</label>
                  <input
                    type="text"
                    disabled
                    value={`${hospitalDetails.countryCode} Preset (Tax: ${hospitalDetails.taxSystem})`}
                    className="w-full px-3.5 py-2 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-400 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold uppercase mb-1">Local Tax setup (%)</label>
                  <input
                    type="number"
                    value={setHospTaxRate}
                    onChange={(e) => setSetHospTaxRate(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 font-semibold uppercase mb-1">Physical Address Address</label>
                <textarea
                  value={setHospAddress}
                  onChange={(e) => setSetHospAddress(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 h-16 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Hospital Logo</label>
                <div className="flex items-center gap-4">
                  {setHospLogo && (
                    <div className="relative group">
                      <img src={setHospLogo} alt="Logo Preview" className="w-10 h-10 object-contain bg-white rounded-md border border-slate-200" />
                      <button
                        type="button"
                        onClick={() => setSetHospLogo("")}
                        className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full p-0.5 shadow-sm hover:bg-rose-600 transition"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="w-full text-sm text-slate-500 dark:text-slate-400
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0
                      file:text-xs file:font-semibold
                      file:bg-teal-50 file:text-teal-700
                      dark:file:bg-teal-900/30 dark:file:text-teal-400
                      hover:file:bg-teal-100 dark:hover:file:bg-teal-900/50"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-lg transition shadow-sm flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  Save Clinic Parameters
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 rounded-xl p-5 shadow-sm space-y-6">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white text-base mb-3 flex items-center gap-1.5">
                <ShieldCheck className="w-5 h-5 text-teal-600" />
                Operational Divisions
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Active divisions and clinical sections initialized for CareMatrix tenant isolation:
              </p>

              <div className="flex flex-wrap gap-2">
                {hospitalDetails.departments.map((dept, idx) => (
                  <span key={idx} className="px-2.5 py-1 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 font-semibold text-xs rounded border border-teal-200/50">
                    {dept}
                  </span>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-700 pt-6">
              <h3 className="font-bold text-slate-800 dark:text-white text-base mb-3 flex items-center gap-1.5">
                <Database className="w-5 h-5 text-teal-600" />
                System Backup & Restore
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                Export a full JSON backup of patients, clinical logs, pharmacy inventory, staff payroll records, and billing transactions, or restore them.
              </p>

              {backupSuccess && (
                <div className="p-3 mb-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs rounded-lg">
                  Success! CareMatrix system backup restored successfully. Real-time lists updated.
                </div>
              )}
              {backupError && (
                <div className="p-3 mb-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs rounded-lg">
                  {backupError}
                </div>
              )}

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleBackupDownload}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download System Backup
                </button>

                <label className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer shadow-3xs">
                  <Upload className="w-3.5 h-3.5" />
                  Upload & Restore Backup
                  <input type="file" accept=".json" onChange={handleBackupUpload} className="hidden" />
                </label>
              </div>
            </div>

            <div className="border-t border-rose-100 dark:border-rose-950/40 pt-6">
              <h3 className="font-bold text-rose-700 dark:text-rose-400 text-base mb-3 flex items-center gap-1.5">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                Master Reset (Danger Zone)
              </h3>
              <p className="text-xs text-rose-600/80 dark:text-rose-400/80 leading-relaxed mb-4">
                Completely erase all active clinical transactions, patient logs, bills, pharmacy inventory, and medical sessions. This action requires Hospital Admin authorization.
              </p>

              {resetSuccess && (
                <div className="p-3 mb-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs rounded-lg">
                  Success! Hospital data has been reset to factory defaults.
                </div>
              )}
              {resetError && (
                <div className="p-3 mb-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs rounded-lg">
                  {resetError}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setResetConfirmPassword("");
                  setResetError("");
                  setShowResetModal(true);
                }}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Reset Hospital Data
              </button>
            </div>
          </div>
        </div>
      )}
      {/* --- MASTER RESET CONFIRMATION MODAL --- */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-rose-100 dark:border-rose-950/40 flex justify-between items-center">
              <h3 className="font-bold text-rose-700 dark:text-rose-400 text-lg flex items-center gap-1.5">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                Confirm Master Reset
              </h3>
              <button 
                onClick={() => {
                  setShowResetModal(false);
                  setResetConfirmPassword("");
                  setResetError("");
                }} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleMasterReset} className="p-6 space-y-4">
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-xl text-rose-800 dark:text-rose-300 text-xs leading-relaxed">
                <strong>CRITICAL WARNING:</strong> This will permanently delete all clinical logs, OPD sessions, IPD entries, patient files, lab reports, invoices, payroll entries, expenses, and inventory items for this clinic. Only the admin accounts will be retained.
              </div>

              {resetError && (
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs rounded-lg">
                  {resetError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Authorize with Hospital Admin Password
                </label>
                <input
                  required
                  type="password"
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  placeholder="Enter admin password to confirm"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(false);
                    setResetConfirmPassword("");
                    setResetError("");
                  }}
                  className="flex-1 px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition shadow-sm"
                >
                  Verify & Reset All Data
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD STAFF MODAL --- */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 dark:text-white text-lg">Onboard New Staff Member</h3>
              <button onClick={() => setShowAddStaffModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddStaff} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Full Name</label>
                  <input
                    required
                    type="text"
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                    placeholder="e.g. Dr. John Doe"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">System Role</label>
                  <select
                    value={newStaffRole}
                    onChange={(e) => setNewStaffRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                  >
                    {Object.values(UserRole)
                      .filter(r => r !== UserRole.SUPER_ADMIN && r !== UserRole.PATIENT)
                      .map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))
                    }
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Department</label>
                  <select
                    value={newStaffDept}
                    onChange={(e) => setNewStaffDept(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                  >
                    {hospitalDetails.departments.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                {[
                  UserRole.DOCTOR,
                  UserRole.PATHOLOGIST,
                  UserRole.RADIOLOGIST,
                  UserRole.SURGEON,
                  UserRole.CARDIOLOGIST,
                  UserRole.PEDIATRICIAN,
                  UserRole.DENTIST,
                  UserRole.PSYCHIATRIST,
                  UserRole.ORTHOPEDIC,
                  UserRole.DERMATOLOGIST,
                  UserRole.NEUROLOGIST,
                  UserRole.OPHTHALMOLOGIST,
                  UserRole.GYNECOLOGIST,
                  UserRole.ANESTHESIOLOGIST,
                  UserRole.GENERAL_PRACTITIONER,
                  UserRole.ENT_SPECIALIST,
                  UserRole.ONCOLOGIST
                ].includes(newStaffRole) && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Specialization</label>
                    <input
                      type="text"
                      value={newStaffSpec}
                      onChange={(e) => setNewStaffSpec(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                      placeholder="e.g. Cardiologist"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Monthly Salary</label>
                  <input
                    required
                    type="number"
                    value={newStaffSalary}
                    onChange={(e) => setNewStaffSalary(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Email Address (Login ID)</label>
                  <input
                    required
                    type="email"
                    value={newStaffEmail}
                    onChange={(e) => setNewStaffEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                    placeholder="doctor@hospital.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Phone</label>
                  <input
                    required
                    type="text"
                    value={newStaffPhone}
                    onChange={(e) => setNewStaffPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition shadow-sm"
                >
                  Onboard Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: CUSTOM SALARY AND COMPONENTS --- */}
      {showSalaryModal && selectedEmpForSalary && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700/60 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Process Detailed Staff Payroll</h3>
                <p className="text-xs text-slate-400 font-semibold">{selectedEmpForSalary.name} ({selectedEmpForSalary.role})</p>
              </div>
              <button
                onClick={() => {
                  setShowSalaryModal(false);
                  setSelectedEmpForSalary(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmSalaryDisbursal} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Salary Release Month</label>
                  <input
                    required
                    type="month"
                    value={salaryMonth}
                    onChange={(e) => setSalaryMonth(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500">Basic Salary ({COUNTRIES[countryCode]?.currency || "$"})</label>
                  <input
                    required
                    type="number"
                    value={salaryBasic}
                    onChange={(e) => setSalaryBasic(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-700/60 pt-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Earnings and Allowances</span>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">House Rent Allowance (HRA)</label>
                    <input
                      type="number"
                      value={salaryHra}
                      onChange={(e) => setSalaryHra(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Dearness Allowance (DA)</label>
                    <input
                      type="number"
                      value={salaryDa}
                      onChange={(e) => setSalaryDa(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Performance Bonus</label>
                    <input
                      type="number"
                      value={salaryBonus}
                      onChange={(e) => setSalaryBonus(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Overtime Allowance</label>
                    <input
                      type="number"
                      value={salaryOvertime}
                      onChange={(e) => setSalaryOvertime(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-700/60 pt-3">
                <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block mb-2">Salary Deductions</span>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Provident Fund (PF) Deduction</label>
                    <input
                      type="number"
                      value={salaryPf}
                      onChange={(e) => setSalaryPf(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500 text-rose-600 dark:text-rose-400 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Professional Tax (Hospital Deducted)</label>
                    <input
                      type="number"
                      value={salaryProfTax}
                      onChange={(e) => setSalaryProfTax(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500 text-rose-600 dark:text-rose-400 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Live Net Pay Estimate Display */}
              <div className="p-4 bg-teal-50 dark:bg-teal-950/40 rounded-xl border border-teal-100/50 dark:border-teal-900/50 flex justify-between items-center transition">
                <div>
                  <div className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider">Estimated Net Disbursal</div>
                  <div className="text-[11px] text-slate-400 font-semibold mt-0.5">Basic + HRA + DA + Bonus + O.T - PF - P.Tax</div>
                </div>
                <div className="text-xl font-bold font-mono text-teal-600 dark:text-teal-400">
                  {formatCurrency(
                    (Number(salaryBasic) || 0) +
                    (Number(salaryHra) || 0) +
                    (Number(salaryDa) || 0) +
                    (Number(salaryBonus) || 0) +
                    (Number(salaryOvertime) || 0) -
                    (Number(salaryPf) || 0) -
                    (Number(salaryProfTax) || 0),
                    countryCode
                  )}
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => {
                    setShowSalaryModal(false);
                    setSelectedEmpForSalary(null);
                  }}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition shadow-sm flex items-center gap-1"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Release & Print Slip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
