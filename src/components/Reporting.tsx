import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { Member, Bill } from '../types';
import { Download, Filter, Search, FileDown, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

import { Settings } from '../types';

const ITEMS_PER_PAGE = 10;

const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
};

export default function Reporting({ settings, isAdmin }: { settings: Settings | null, isAdmin: boolean }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [filters, setFilters] = useState({
    month: format(new Date(), 'MM'),
    year: format(new Date(), 'yyyy'),
    lateral: ''
  });
  const [selectedBills, setSelectedBills] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string | 'bulk', isOpen: boolean }>({ id: '', isOpen: false });
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  useEffect(() => {
    const unsubMembers = onSnapshot(collection(db, 'members'), (snapshot) => {
      setMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Member[]);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'members');
    });

    const unsubBills = onSnapshot(query(collection(db, 'bills'), orderBy('createdAt', 'desc')), (snapshot) => {
      setBills(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Bill[]);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'bills');
    });

    return () => {
      unsubMembers();
      unsubBills();
    };
  }, []);

  const filteredBills = bills.filter(bill => {
    const billDate = new Date(bill.readingDateEnd);
    const billMonth = format(billDate, 'MM');
    const billYear = format(billDate, 'yyyy');
    const member = members.find(m => m.memberId === bill.memberId);
    
    return (
      billMonth === filters.month &&
      billYear === filters.year &&
      (filters.lateral === '' || member?.lateralNumber === filters.lateral)
    );
  });

  const totalPages = Math.ceil(filteredBills.length / ITEMS_PER_PAGE);
  const paginatedBills = filteredBills.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const toggleSelect = (id: string) => {
    setSelectedBills(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleDeleteBills = async () => {
    if (selectedBills.length === 0) return;
    
    try {
      await Promise.all(selectedBills.map(id => deleteDoc(doc(db, 'bills', id))));
      toast.success(`${selectedBills.length} records deleted successfully`);
      setSelectedBills([]);
      setConfirmDelete({ id: '', isOpen: false });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'bills/bulk');
      toast.error('Failed to delete records');
    }
  };

  const handleDeleteSingle = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'bills', id));
      setSelectedBills(prev => prev.filter(i => i !== id));
      setConfirmDelete({ id: '', isOpen: false });
      toast.success('Record deleted successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `bills/${id}`);
      toast.error('Failed to delete record');
    }
  };

  const generatePDF = async () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const billsToPrint = bills.filter(b => selectedBills.includes(b.id));
    
    if (billsToPrint.length === 0) return;

    let logoImg: HTMLImageElement | null = null;
    if (settings?.companyLogo) {
      try {
        logoImg = await loadImage(settings.companyLogo);
      } catch (e) {
        console.error("Failed to load logo", e);
      }
    }

    const receiptWidth = 90;
    const receiptHeight = 130;
    const margin = 10;

    billsToPrint.forEach((bill, index) => {
      const pageIndex = Math.floor(index / 4);
      const posIndex = index % 4;
      
      if (index > 0 && posIndex === 0) {
        doc.addPage();
      }

      const x = margin + (posIndex % 2) * (receiptWidth + margin);
      const y = margin + Math.floor(posIndex / 2) * (receiptHeight + margin);

      const member = members.find(m => m.memberId === bill.memberId);

      // Receipt Border
      doc.setDrawColor(20, 20, 20);
      doc.rect(x, y, receiptWidth, receiptHeight);

      // Header
      let currentY = y + 8;

      if (logoImg) {
        const logoSize = 10;
        doc.addImage(logoImg, 'PNG', x + (receiptWidth / 2) - (logoSize / 2), currentY - 4, logoSize, logoSize);
        currentY += 10;
      }

      const companyName = settings?.companyName?.toUpperCase() || 'AQUAFLOW';
      doc.setFont('helvetica', 'bold');
      
      // Dynamic font size for company name to prevent overlap
      let nameFontSize = 14;
      if (companyName.length > 20) nameFontSize = 11;
      if (companyName.length > 30) nameFontSize = 9;
      
      doc.setFontSize(nameFontSize);
      doc.text(companyName, x + receiptWidth / 2, currentY, { align: 'center' });
      
      currentY += 4;
      if (settings?.tagline) {
        doc.setFontSize(6);
        doc.setFont('helvetica', 'italic');
        doc.text(settings.tagline, x + receiptWidth / 2, currentY, { align: 'center' });
        currentY += 4;
      } else {
        currentY += 1;
      }

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('WATER INVOICE', x + receiptWidth / 2, currentY, { align: 'center' });

      // Member Info
      doc.setFontSize(7);
      doc.text(`ID: ${bill.memberId}`, x + 5, y + 27);
      doc.text(`Lateral: ${member?.lateralNumber || 'N/A'}`, x + 5, y + 31);
      doc.setFont('helvetica', 'bold');
      doc.text(`NAME: ${member?.name || 'Unknown'}`, x + 5, y + 36);
      doc.setFont('helvetica', 'normal');
      doc.text(`Address: ${member?.address || 'N/A'}`, x + 5, y + 41, { maxWidth: 80 });

      // Billing Details
      doc.line(x + 5, y + 45, x + receiptWidth - 5, y + 45);
      doc.text('READING PERIOD:', x + 5, y + 50);
      doc.setFont('helvetica', 'bold');
      doc.text(`${format(new Date(bill.readingDateStart), 'MM/dd')} - ${format(new Date(bill.readingDateEnd), 'MM/dd/yyyy')}`, x + 5, y + 55);
      
      doc.setFont('helvetica', 'normal');
      doc.text('PREVIOUS READING:', x + 5, y + 65);
      doc.text(`${bill.previousReading} m3`, x + receiptWidth - 25, y + 65, { align: 'right' });
      doc.text('CURRENT READING:', x + 5, y + 70);
      doc.text(`${bill.currentReading} m3`, x + receiptWidth - 25, y + 70, { align: 'right' });
      doc.text('CONSUMPTION:', x + 5, y + 75);
      doc.setFont('helvetica', 'bold');
      doc.text(`${bill.consumption} m3`, x + receiptWidth - 25, y + 75, { align: 'right' });

      // Charges
      doc.setFont('helvetica', 'normal');
      doc.line(x + 5, y + 80, x + receiptWidth - 5, y + 80);
      doc.text('MONTHLY DUES:', x + 5, y + 85);
      doc.text(`P${bill.monthlyDues.toFixed(2)}`, x + receiptWidth - 25, y + 85, { align: 'right' });
      doc.text('PENALTY:', x + 5, y + 90);
      doc.text(`P${bill.penalty.toFixed(2)}`, x + receiptWidth - 25, y + 90, { align: 'right' });
      
      if (bill.others !== 0) {
        const isDeduction = bill.others > 0;
        doc.text(isDeduction ? 'DEDUCTION:' : 'ADDITIONAL:', x + 5, y + 95);
        doc.text(`${isDeduction ? '-' : '+'}P${Math.abs(bill.others).toFixed(2)}`, x + receiptWidth - 25, y + 95, { align: 'right' });
      }

      if (bill.adjustment && bill.adjustment !== 0) {
        doc.text('OTHER DEDUCTION:', x + 5, y + 100);
        doc.text(`-P${Math.abs(bill.adjustment).toFixed(2)}`, x + receiptWidth - 25, y + 100, { align: 'right' });
      }
      
      // Total
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('TOTAL AMOUNT:', x + 5, y + 110);
      doc.text(`P${bill.totalAmount.toFixed(2)}`, x + receiptWidth - 25, y + 110, { align: 'right' });

      // Footer
      doc.setFontSize(6);
      doc.setFont('helvetica', 'italic');
      doc.text(`Status: ${bill.statusTag} | Payment: ${bill.status}`, x + 5, y + 120);
      doc.text('Please pay on or before the 20th to avoid penalties.', x + 5, y + 123);
      doc.text(`Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, x + 5, y + 126);
    });

    doc.save(`Water_Invoices_${filters.month}_${filters.year}.pdf`);
    toast.success(`Exported ${billsToPrint.length} invoices to PDF`);
  };

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {confirmDelete.isOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl shadow-slate-900/20 w-full max-w-sm p-6 sm:p-8 border border-slate-100"
            >
              <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <Trash2 className="text-rose-500" size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 text-center mb-2">Confirm Delete</h3>
              <p className="text-sm font-medium text-slate-50 text-center mb-8 bg-rose-500/5 py-3 px-4 rounded-xl text-rose-600">
                Are you sure you want to delete {confirmDelete.id === 'bulk' ? `${selectedBills.length} selected records` : 'this record'}? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete({ id: '', isOpen: false })}
                  className="flex-1 bg-slate-100 text-slate-600 py-3.5 rounded-2xl font-bold uppercase tracking-wider text-[11px] hover:bg-slate-200 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={() => confirmDelete.id === 'bulk' ? handleDeleteBills() : handleDeleteSingle(confirmDelete.id)}
                  className="flex-1 bg-rose-500 text-white py-3.5 rounded-2xl font-bold uppercase tracking-wider text-[11px] hover:bg-rose-600 shadow-lg shadow-rose-200 transition-all active:scale-95"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-4 sm:p-6 border border-slate-100">
        <div className="flex flex-wrap gap-4 sm:gap-6 items-end">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Month</label>
            <select 
              value={filters.month}
              onChange={(e) => setFilters({ ...filters, month: e.target.value })}
              className="w-40 px-4 py-2.5 bg-slate-50 border-2 border-transparent rounded-2xl font-bold text-sm text-slate-700 focus:bg-white focus:border-cyan-500/20 focus:ring-4 focus:ring-cyan-500/5 outline-none transition-all appearance-none cursor-pointer"
            >
              {Array.from({ length: 12 }, (_, i) => {
                const m = (i + 1).toString().padStart(2, '0');
                return <option key={m} value={m}>{format(new Date(2000, i, 1), 'MMMM')}</option>;
              })}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Year</label>
            <select 
              value={filters.year}
              onChange={(e) => setFilters({ ...filters, year: e.target.value })}
              className="w-32 px-4 py-2.5 bg-slate-50 border-2 border-transparent rounded-2xl font-bold text-sm text-slate-700 focus:bg-white focus:border-cyan-500/20 focus:ring-4 focus:ring-cyan-500/5 outline-none transition-all appearance-none cursor-pointer"
            >
              {['2024', '2025', '2026'].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Lateral</label>
            <select 
              value={filters.lateral}
              onChange={(e) => setFilters({ ...filters, lateral: e.target.value })}
              className="w-48 px-4 py-2.5 bg-slate-50 border-2 border-transparent rounded-2xl font-bold text-sm text-slate-700 focus:bg-white focus:border-cyan-500/20 focus:ring-4 focus:ring-cyan-500/5 outline-none transition-all appearance-none cursor-pointer"
            >
              <option value="">All Laterals</option>
              <option value="Mainline">Mainline</option>
              <option value="Lateral 1">Lateral 1</option>
              <option value="Lateral 2">Lateral 2</option>
              <option value="Lateral 3">Lateral 3</option>
              <option value="Lateral 4">Lateral 4</option>
              <option value="Lateral 5">Lateral 5</option>
              <option value="Lateral 6">Lateral 6</option>
            </select>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 ml-auto w-full sm:w-auto">
            <button
              onClick={generatePDF}
              disabled={selectedBills.length === 0}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-cyan-600 text-white px-6 py-2.5 rounded-2xl font-bold uppercase tracking-wider text-[11px] hover:bg-cyan-700 shadow-lg shadow-cyan-200 transition-all disabled:opacity-50 active:scale-95"
            >
              <FileDown size={18} />
              Export PDF ({selectedBills.length})
            </button>
            {isAdmin && selectedBills.length > 0 && (
              <button
                onClick={() => setConfirmDelete({ id: 'bulk', isOpen: true })}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-rose-500 text-white px-6 py-2.5 rounded-2xl font-bold uppercase tracking-wider text-[11px] hover:bg-rose-600 shadow-lg shadow-rose-200 transition-all active:scale-95"
              >
                <Trash2 size={18} />
                Delete Selected
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="p-5 w-10">
                  <div className="flex items-center justify-center">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                      onChange={(e) => {
                        if (e.target.checked) setSelectedBills(filteredBills.map(b => b.id));
                        else setSelectedBills([]);
                      }}
                      checked={selectedBills.length === filteredBills.length && filteredBills.length > 0}
                    />
                  </div>
                </th>
                <th className="p-5 text-[11px] font-bold uppercase tracking-widest text-slate-400">Member</th>
                <th className="p-5 text-[11px] font-bold uppercase tracking-widest text-slate-400">Lateral</th>
                <th className="p-5 text-[11px] font-bold uppercase tracking-widest text-slate-400">Consumption</th>
                <th className="p-5 text-[11px] font-bold uppercase tracking-widest text-slate-400">Amount</th>
                <th className="p-5 text-[11px] font-bold uppercase tracking-widest text-slate-400">Payment</th>
                <th className="p-5 text-[11px] font-bold uppercase tracking-widest text-slate-400">Date</th>
                {isAdmin && <th className="p-5 text-[11px] font-bold uppercase tracking-widest text-slate-400">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedBills.map((bill) => {
                const member = members.find(m => m.memberId === bill.memberId);
                return (
                  <tr key={bill.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-5">
                      <div className="flex items-center justify-center">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                          checked={selectedBills.includes(bill.id)}
                          onChange={() => toggleSelect(bill.id)}
                        />
                      </div>
                    </td>
                    <td className="p-5">
                      <p className="font-bold text-slate-700">{member?.name || 'Unknown'}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{bill.memberId}</p>
                    </td>
                    <td className="p-5">
                      <span className="px-3 py-1 bg-slate-100 rounded-lg text-[11px] font-bold text-slate-600 uppercase tracking-tight">
                        {member?.lateralNumber || '-'}
                      </span>
                    </td>
                    <td className="p-5">
                      <span className="font-bold text-slate-700">{bill.consumption}</span>
                      <span className="text-[10px] font-bold text-slate-400 ml-1 uppercase">m³</span>
                    </td>
                    <td className="p-5">
                      <span className="text-cyan-600 font-bold">₱{bill.totalAmount.toFixed(2)}</span>
                    </td>
                    <td className="p-5">
                      <span className={`text-[10px] font-bold uppercase px-3 py-1 rounded-full ${
                        bill.status === 'Paid' 
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                          : 'bg-rose-50 text-rose-600 border border-rose-100'
                      }`}>
                        {bill.status}
                      </span>
                    </td>
                    <td className="p-5">
                      <span className="text-[11px] font-bold text-slate-400 uppercase">
                        {format(new Date(bill.readingDateEnd), 'MMM d, yyyy')}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="p-5">
                        <button
                          onClick={() => setConfirmDelete({ id: bill.id, isOpen: true })}
                          className="text-slate-400 hover:text-rose-500 transition-colors p-2 hover:bg-rose-50 rounded-xl"
                          title="Delete Record"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {paginatedBills.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="p-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300">
                        <Search size={32} />
                      </div>
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No records found</p>
                      <p className="text-xs text-slate-400">Try adjusting your filters</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {filteredBills.length > 0 && (
          <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              Showing <span className="text-slate-700">{Math.min(filteredBills.length, (currentPage - 1) * ITEMS_PER_PAGE + 1)}</span> to <span className="text-slate-700">{Math.min(filteredBills.length, currentPage * ITEMS_PER_PAGE)}</span> of <span className="text-slate-700">{filteredBills.length}</span> records
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:bg-white hover:text-cyan-600 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
              >
                <ChevronLeft size={18} />
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => {
                  if (
                    pageNum === 1 || 
                    pageNum === totalPages || 
                    (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-9 h-9 rounded-xl text-[11px] font-bold transition-all ${
                          currentPage === pageNum
                            ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-200'
                            : 'text-slate-400 hover:bg-white hover:text-cyan-600 border border-transparent hover:border-slate-200'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  } else if (
                    pageNum === currentPage - 2 || 
                    pageNum === currentPage + 2
                  ) {
                    return <span key={pageNum} className="text-slate-300 px-1">...</span>;
                  }
                  return null;
                })}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:bg-white hover:text-cyan-600 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
