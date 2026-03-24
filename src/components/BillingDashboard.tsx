import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, addDoc, query, orderBy, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Member, Bill, Settings } from '../types';
import { Calculator, History, Plus, X, Receipt, ArrowRight, UserPlus, Trash2, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, isAfter, getDate } from 'date-fns';
import { toast } from 'sonner';

export default function BillingDashboard({ isAdmin, settings }: { isAdmin: boolean, settings: Settings | null }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBills, setSelectedBills] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string | 'bulk', isOpen: boolean }>({ id: '', isOpen: false });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [lateralFilter, setLateralFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  const [formData, setFormData] = useState({
    readingDateStart: format(new Date(), 'yyyy-MM-dd'),
    readingDateEnd: format(new Date(), 'yyyy-MM-dd'),
    previousReading: 0,
    currentReading: 0,
    deductionType: 'Others (Manual)' as 'Consumer (-10)' | 'Penalty (+20)' | 'Others (Manual)',
    others: 0,
    adjustment: 0,
  });

  useEffect(() => {
    const membersPath = 'members';
    const billsPath = 'bills';
    
    const unsubMembers = onSnapshot(query(collection(db, 'members'), orderBy('createdAt', 'desc')), (snapshot) => {
      setMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Member[]);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, membersPath);
    });

    const unsubBills = onSnapshot(query(collection(db, 'bills'), orderBy('createdAt', 'desc')), (snapshot) => {
      setBills(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Bill[]);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, billsPath);
    });

    return () => {
      unsubMembers();
      unsubBills();
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, lateralFilter, statusFilter]);

  const calculateBill = () => {
    if (!settings || !selectedMember) return null;
    
    const prev = isNaN(formData.previousReading) ? 0 : formData.previousReading;
    const curr = isNaN(formData.currentReading) ? 0 : formData.currentReading;
    
    const consumption = Math.max(0, curr - prev);
    const baseConsumption = Math.min(consumption, 3);
    const excessConsumption = Math.max(0, consumption - 3);
    
    let baseAmount = settings.baseRate;
    let excessAmount = excessConsumption * settings.excessRate;
    
    const dayOfMonth = getDate(new Date());
    let penalty = 0;
    let statusTag: Bill['statusTag'] = 'Regular';

    if (dayOfMonth >= 18 && dayOfMonth <= 20) {
      statusTag = 'Regular';
    } else if (dayOfMonth >= 21 && dayOfMonth <= 25) {
      statusTag = 'For Penalty';
    } else if (dayOfMonth >= 26) {
      statusTag = 'For Disconnection';
    }

    let deductionValue = 0;
    if (formData.deductionType === 'Consumer (-10)') {
      deductionValue = 10;
    } else if (formData.deductionType === 'Penalty (+20)') {
      deductionValue = -20;
    } else if (formData.deductionType === 'Others (Manual)') {
      deductionValue = isNaN(formData.others) ? 0 : formData.others;
    }

    const adjustmentValue = isNaN(formData.adjustment) ? 0 : formData.adjustment;

    const totalAmount = baseAmount + excessAmount + settings.fixedDues + penalty - deductionValue - adjustmentValue;

    return {
      consumption,
      penalty,
      monthlyDues: settings.fixedDues,
      totalAmount,
      statusTag,
      others: deductionValue,
      adjustment: adjustmentValue
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !settings) return;

    const calc = calculateBill();
    if (!calc) return;

    try {
      await addDoc(collection(db, 'bills'), {
        memberId: selectedMember.memberId,
        ...formData,
        ...calc,
        status: 'Unpaid',
        createdAt: new Date().toISOString()
      });
      toast.success('Bill generated successfully');
      setIsModalOpen(false);
      setFormData({
        readingDateStart: format(new Date(), 'yyyy-MM-dd'),
        readingDateEnd: format(new Date(), 'yyyy-MM-dd'),
        previousReading: 0,
        currentReading: 0,
        deductionType: 'Others (Manual)',
        others: 0,
        adjustment: 0,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'bills');
      toast.error('Failed to generate bill');
    }
  };

  const handleMarkAsPaid = async (billId: string) => {
    try {
      await updateDoc(doc(db, 'bills', billId), {
        status: 'Paid'
      });
      toast.success('Bill marked as paid');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bills/${billId}`);
      toast.error('Failed to update bill status');
    }
  };

  const handleDeleteBill = async (billId: string) => {
    try {
      await deleteDoc(doc(db, 'bills', billId));
      setSelectedBills(prev => prev.filter(id => id !== billId));
      setConfirmDelete({ id: '', isOpen: false });
      toast.success('Bill record deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `bills/${billId}`);
      toast.error('Failed to delete bill record');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedBills.length === 0) return;
    
    try {
      await Promise.all(selectedBills.map(id => deleteDoc(doc(db, 'bills', id))));
      setSelectedBills([]);
      setConfirmDelete({ id: '', isOpen: false });
      toast.success(`${selectedBills.length} records deleted`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'bills/bulk');
      toast.error('Failed to delete records');
    }
  };

  const toggleSelectBill = (billId: string) => {
    setSelectedBills(prev => 
      prev.includes(billId) ? prev.filter(id => id !== billId) : [...prev, billId]
    );
  };

  const filteredMembers = members.filter(member => {
    const matchesSearch = 
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      member.memberId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLateral = lateralFilter === '' || member.lateralNumber === lateralFilter;
    const matchesStatus = statusFilter === '' || member.status === statusFilter;
    
    return matchesSearch && matchesLateral && matchesStatus;
  });

  const totalPages = Math.ceil(filteredMembers.length / ITEMS_PER_PAGE);
  const paginatedMembers = filteredMembers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const memberBills = bills
    .filter(b => b.memberId === selectedMember?.memberId)
    .sort((a, b) => new Date(b.readingDateEnd).getTime() - new Date(a.readingDateEnd).getTime());

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Member List for Selection */}
      <div className="lg:col-span-1 space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">Select Member</h3>
          
          {/* Filters */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-cyan-500/10 focus:border-[#0891B2] outline-none transition-all"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <select
                  value={lateralFilter}
                  onChange={(e) => setLateralFilter(e.target.value)}
                  className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-cyan-500/10 focus:border-[#0891B2] outline-none appearance-none cursor-pointer"
                >
                  <option value="">All Laterals</option>
                  {settings?.lateralNumbers?.map(num => (
                    <option key={num} value={num}>Lateral {num}</option>
                  ))}
                </select>
                <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
              </div>
              
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full pl-3 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-cyan-500/10 focus:border-[#0891B2] outline-none appearance-none cursor-pointer"
                >
                  <option value="">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Padlocked">Padlocked</option>
                </select>
                <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden divide-y divide-slate-50">
          {paginatedMembers.length > 0 ? (
            paginatedMembers.map(member => (
              <button
                key={member.id}
                onClick={() => setSelectedMember(member)}
                className={`w-full p-4 text-left transition-all flex justify-between items-center group ${
                  selectedMember?.id === member.id 
                    ? 'bg-[#0891B2] text-white shadow-inner' 
                    : 'hover:bg-cyan-50/50'
                }`}
              >
                <div>
                  <p className="font-bold text-sm">{member.name}</p>
                  <p className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${
                    selectedMember?.id === member.id ? 'text-cyan-200' : 'text-slate-400'
                  }`}>
                    {member.memberId} • {member.lateralNumber}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    selectedMember?.id === member.id
                      ? 'bg-white/20 text-white'
                      : member.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                  }`}>
                    {member.status}
                  </span>
                  <ArrowRight 
                    size={18} 
                    className={`transition-all ${
                      selectedMember?.id === member.id 
                        ? 'translate-x-0 opacity-100' 
                        : '-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'
                    }`} 
                  />
                </div>
              </button>
            ))
          ) : (
            <div className="p-10 text-center">
              <p className="text-slate-400 text-sm font-medium">No members found matching your filters.</p>
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        {filteredMembers.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between px-2 py-1">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-[#0891B2] hover:bg-cyan-50 disabled:opacity-50 transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            
            <div className="flex items-center gap-1">
              {[...Array(totalPages)].map((_, i) => {
                const pageNum = i + 1;
                if (
                  pageNum === 1 || 
                  pageNum === totalPages || 
                  (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                        currentPage === pageNum
                          ? 'bg-[#0891B2] text-white shadow-sm'
                          : 'text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                } else if (
                  pageNum === currentPage - 2 || 
                  pageNum === currentPage + 2
                ) {
                  return <span key={pageNum} className="text-slate-300 px-0.5 text-xs">...</span>;
                }
                return null;
              })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-[#0891B2] hover:bg-cyan-50 disabled:opacity-50 transition-all"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Member Dashboard */}
      <div className="lg:col-span-2 space-y-8">
        {selectedMember ? (
          <>
            <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] border border-slate-100 p-6 sm:p-10 shadow-xl shadow-slate-200/50">
              <div className="flex flex-col sm:flex-row justify-between items-start mb-8 gap-4">
                <div>
                  <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">{selectedMember.name}</h2>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2">
                    <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold uppercase tracking-widest">
                      ID: {selectedMember.memberId}
                    </span>
                    <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold uppercase tracking-widest">
                      Lateral: {selectedMember.lateralNumber}
                    </span>
                  </div>
                  <p className="text-slate-500 mt-4 font-medium text-sm sm:text-base">{selectedMember.address}</p>
                </div>
                <div className="sm:text-right">
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                    selectedMember.status === 'Active' 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : 'bg-rose-100 text-rose-700'
                  }`}>
                    {selectedMember.status}
                  </span>
                </div>
              </div>

              {isAdmin && (
                <button
                  onClick={() => {
                    const lastBill = memberBills[0];
                    const isLineMember = selectedMember.name.includes('Line 1') || selectedMember.name.includes('Line 3');
                    
                    let startDate = format(new Date(), 'yyyy-MM-dd');
                    let endDate = format(new Date(), 'yyyy-MM-dd');
                    
                    if (lastBill) {
                      const lastEndDate = new Date(lastBill.readingDateEnd);
                      const nextStartDate = new Date(lastEndDate);
                      nextStartDate.setDate(lastEndDate.getDate() + 1);
                      startDate = format(nextStartDate, 'yyyy-MM-dd');
                      
                      const nextEndDate = new Date(nextStartDate);
                      nextEndDate.setMonth(nextEndDate.getMonth() + 1);
                      endDate = format(nextEndDate, 'yyyy-MM-dd');
                    }

                    setFormData({
                      readingDateStart: startDate,
                      readingDateEnd: endDate,
                      previousReading: lastBill ? lastBill.currentReading : (selectedMember.initialReading || 0),
                      currentReading: lastBill ? lastBill.currentReading : (selectedMember.initialReading || 0),
                      deductionType: isLineMember ? 'Consumer (-10)' : 'Others (Manual)',
                      others: 0,
                      adjustment: 0,
                    });
                    setIsModalOpen(true);
                  }}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#0891B2] text-white px-8 py-3.5 rounded-2xl font-bold tracking-wide hover:bg-[#06B6D4] transition-all shadow-lg hover:shadow-cyan-900/20 active:scale-[0.98]"
                >
                  <Calculator size={20} />
                  New Reading
                </button>
              )}
            </div>

            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-2 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-cyan-50 rounded-xl flex items-center justify-center">
                    <History size={20} className="text-[#0891B2]" />
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Billing History</h3>
                </div>
                {isAdmin && selectedBills.length > 0 && (
                  <button
                    onClick={() => setConfirmDelete({ id: 'bulk', isOpen: true })}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-rose-500 text-white px-5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-rose-600 transition-all shadow-lg shadow-rose-200"
                  >
                    <Trash2 size={16} />
                    Delete ({selectedBills.length})
                  </button>
                )}
              </div>
              
              <div className="space-y-4">
                {memberBills.length > 0 ? (
                  memberBills.map(bill => (
                    <div key={bill.id} className="bg-white rounded-3xl border border-slate-100 p-6 flex flex-col md:flex-row justify-between gap-6 relative group hover:shadow-lg hover:shadow-slate-200/50 transition-all">
                      {isAdmin && (
                        <div className="absolute left-6 top-6 md:static flex items-center">
                          <input 
                            type="checkbox"
                            checked={selectedBills.includes(bill.id)}
                            onChange={() => toggleSelectBill(bill.id)}
                            className="w-5 h-5 rounded-lg border-slate-200 text-[#0891B2] focus:ring-[#0891B2] transition-all cursor-pointer"
                          />
                        </div>
                      )}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 flex-1">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Period</p>
                          <p className="text-sm font-bold text-slate-700">
                            {format(new Date(bill.readingDateStart), 'MMM d')} - {format(new Date(bill.readingDateEnd), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Readings</p>
                          <p className="text-sm font-bold text-slate-700">{bill.previousReading} <ArrowRight size={12} className="inline mx-1 text-slate-300" /> {bill.currentReading} m³</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Consumption</p>
                          <p className="text-sm font-bold text-slate-700">{bill.consumption} m³</p>
                        </div>
                      </div>
                      <div className="text-right border-t md:border-t-0 md:border-l border-slate-100 pt-6 md:pt-0 md:pl-8 flex flex-col justify-between items-end min-w-[140px]">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Total Amount</p>
                          <p className="text-2xl font-extrabold text-slate-900 tracking-tight">₱{bill.totalAmount.toFixed(2)}</p>
                        </div>
                        <div className="mt-4 flex items-center gap-3">
                          <span className={`text-[10px] font-bold uppercase px-3 py-1 rounded-full ${
                            bill.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                          }`}>
                            {bill.status}
                          </span>
                          {isAdmin && bill.status === 'Unpaid' && (
                            <button
                              onClick={() => handleMarkAsPaid(bill.id)}
                              className="text-[10px] font-bold uppercase text-[#0891B2] hover:underline transition-all"
                            >
                              Mark as Paid
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => setConfirmDelete({ id: bill.id, isOpen: true })}
                              className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                              title="Delete Bill"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-16 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Receipt className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-slate-500 font-medium">No billing records found for this member.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center bg-white rounded-[3rem] border-2 border-dashed border-slate-200 p-20 text-center">
            <div className="max-w-xs">
              <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <UserPlus className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-2">No Member Selected</h3>
              <p className="text-slate-500 font-medium">Select a member from the list to view their profile and billing history.</p>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {confirmDelete.isOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-md p-6 sm:p-10 text-center border border-slate-100"
            >
              <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-10 h-10 text-rose-500" />
              </div>
              <h3 className="text-2xl font-extrabold text-slate-900 mb-2">Confirm Delete</h3>
              <p className="text-slate-500 mb-8 leading-relaxed">
                Are you sure you want to delete {confirmDelete.id === 'bulk' ? `${selectedBills.length} selected records` : 'this record'}? This action cannot be undone.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setConfirmDelete({ id: '', isOpen: false })}
                  className="flex-1 px-6 py-4 rounded-2xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => confirmDelete.id === 'bulk' ? handleBulkDelete() : handleDeleteBill(confirmDelete.id)}
                  className="flex-1 px-6 py-4 rounded-2xl font-bold text-white bg-rose-500 hover:bg-rose-600 transition-colors shadow-lg shadow-rose-200"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl w-full max-w-lg p-6 sm:p-10 border border-slate-100 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">New Reading</h3>
                  <p className="text-sm text-slate-500 font-medium mt-1">Generate a new bill for this period</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={24} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">Start Date</label>
                    <input
                      required
                      type="date"
                      value={formData.readingDateStart}
                      onChange={(e) => setFormData({ ...formData, readingDateStart: e.target.value })}
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-cyan-500/10 focus:border-[#0891B2] outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">End Date</label>
                    <input
                      required
                      type="date"
                      value={formData.readingDateEnd}
                      onChange={(e) => setFormData({ ...formData, readingDateEnd: e.target.value })}
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-cyan-500/10 focus:border-[#0891B2] outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">Prev Reading (m³)</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      value={isNaN(formData.previousReading) ? '' : formData.previousReading}
                      onChange={(e) => setFormData({ ...formData, previousReading: e.target.value === '' ? NaN : parseFloat(e.target.value) })}
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-cyan-500/10 focus:border-[#0891B2] outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">Curr Reading (m³)</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      value={isNaN(formData.currentReading) ? '' : formData.currentReading}
                      onChange={(e) => setFormData({ ...formData, currentReading: e.target.value === '' ? NaN : parseFloat(e.target.value) })}
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-cyan-500/10 focus:border-[#0891B2] outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">Deduction Type</label>
                    <div className="relative">
                      <select
                        value={formData.deductionType}
                        onChange={(e) => {
                          const type = e.target.value as 'Consumer (-10)' | 'Penalty (+20)' | 'Others (Manual)';
                          setFormData({ 
                            ...formData, 
                            deductionType: type,
                            others: type === 'Others (Manual)' ? formData.others : 0
                          });
                        }}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-cyan-500/10 focus:border-[#0891B2] outline-none appearance-none cursor-pointer"
                      >
                        <option value="Consumer (-10)">Consumer (-10)</option>
                        <option value="Penalty (+20)">Penalty (+20)</option>
                        <option value="Others (Manual)">Others (Manual)</option>
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <Plus size={16} className="rotate-45" />
                      </div>
                    </div>
                  </div>

                  {formData.deductionType === 'Others (Manual)' && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-2"
                    >
                      <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">Manual Adjustment (₱)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Enter amount (positive for deduction, negative for addition)"
                        value={isNaN(formData.others) ? '' : formData.others}
                        onChange={(e) => setFormData({ ...formData, others: e.target.value === '' ? NaN : parseFloat(e.target.value) })}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-cyan-500/10 focus:border-[#0891B2] outline-none transition-all"
                      />
                      <p className="text-[10px] text-slate-400 ml-1 italic">
                        * Use positive numbers for deductions (e.g., 50) and negative for additions (e.g., -50)
                      </p>
                    </motion.div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">Other Deduction (₱)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Enter other deduction amount"
                      value={isNaN(formData.adjustment) ? '' : formData.adjustment}
                      onChange={(e) => setFormData({ ...formData, adjustment: e.target.value === '' ? NaN : parseFloat(e.target.value) })}
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-cyan-500/10 focus:border-[#0891B2] outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Live Calculation Preview */}
                {settings && (
                  <div className="bg-cyan-50/50 rounded-2xl p-6 space-y-3 border border-cyan-100">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 font-medium">Consumption:</span>
                      <span className="font-bold text-slate-700">{calculateBill()?.consumption.toFixed(2)} m³</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 font-medium">Base Rate (0-3 m³):</span>
                      <span className="font-bold text-slate-700">₱{settings.baseRate.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 font-medium">Excess:</span>
                      <span className="font-bold text-slate-700">₱{((calculateBill()?.totalAmount || 0) - settings.baseRate - settings.fixedDues - (calculateBill()?.penalty || 0)).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 font-medium">Monthly Dues:</span>
                      <span className="font-bold text-slate-700">₱{settings.fixedDues.toFixed(2)}</span>
                    </div>
                    <div className={`flex justify-between text-sm font-bold ${(calculateBill()?.others || 0) >= 0 ? 'text-cyan-600' : 'text-rose-500'}`}>
                      <span>{(calculateBill()?.others || 0) >= 0 ? 'Deduction:' : 'Additional:'}</span>
                      <span>{(calculateBill()?.others || 0) >= 0 ? '-' : '+'}₱{Math.abs(calculateBill()?.others || 0).toFixed(2)}</span>
                    </div>
                    {(calculateBill()?.adjustment || 0) !== 0 && (
                      <div className="flex justify-between text-sm text-cyan-600 font-bold">
                        <span>Other Deduction:</span>
                        <span>-₱{Math.abs(calculateBill()?.adjustment || 0).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm text-rose-500 font-bold">
                      <span>Penalty:</span>
                      <span>₱{calculateBill()?.penalty.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-cyan-200/50 pt-4 flex justify-between items-center mt-2">
                      <span className="text-slate-900 font-extrabold">Estimated Total:</span>
                      <span className="text-3xl font-extrabold text-[#0891B2] tracking-tight">₱{calculateBill()?.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-[#0891B2] text-white py-4 rounded-2xl font-bold tracking-wide hover:bg-[#06B6D4] transition-all shadow-lg hover:shadow-cyan-900/20 mt-4 active:scale-[0.98]"
                >
                  Generate Bill
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
