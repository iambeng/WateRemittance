import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, query, orderBy, where, doc, updateDoc } from 'firebase/firestore';
import { Member, Bill, Settings } from '../types';
import { Calculator, History, Plus, X, Receipt, ArrowRight, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, isAfter, getDate } from 'date-fns';

export default function BillingDashboard({ isAdmin, settings }: { isAdmin: boolean, settings: Settings | null }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    readingDateStart: format(new Date(), 'yyyy-MM-dd'),
    readingDateEnd: format(new Date(), 'yyyy-MM-dd'),
    previousReading: 0,
    currentReading: 0,
    deductionType: 'Others (Manual)' as 'Consumer' | 'Others (Manual)',
    others: 0
  });

  useEffect(() => {
    const unsubMembers = onSnapshot(collection(db, 'members'), (snapshot) => {
      setMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Member[]);
    });

    const unsubBills = onSnapshot(query(collection(db, 'bills'), orderBy('createdAt', 'desc')), (snapshot) => {
      setBills(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Bill[]);
    });

    return () => {
      unsubMembers();
      unsubBills();
    };
  }, []);

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

    // Check if member has any unpaid bills
    const hasUnpaidBills = bills.some(b => b.memberId === selectedMember.memberId && b.status === 'Unpaid');
    
    if (hasUnpaidBills) {
      penalty = 20;
    }

    if (dayOfMonth >= 18 && dayOfMonth <= 20) {
      statusTag = 'Regular';
    } else if (dayOfMonth >= 21 && dayOfMonth <= 25) {
      statusTag = 'For Penalty';
    } else if (dayOfMonth >= 26) {
      statusTag = 'For Disconnection';
    }

    const others = isNaN(formData.others) ? 0 : formData.others;
    const totalAmount = baseAmount + excessAmount + settings.fixedDues + penalty - others;

    return {
      consumption,
      penalty,
      monthlyDues: settings.fixedDues,
      totalAmount,
      statusTag,
      others
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
      setIsModalOpen(false);
      setFormData({
        readingDateStart: format(new Date(), 'yyyy-MM-dd'),
        readingDateEnd: format(new Date(), 'yyyy-MM-dd'),
        previousReading: 0,
        currentReading: 0,
        deductionType: 'Others (Manual)',
        others: 0
      });
    } catch (error) {
      console.error("Error creating bill:", error);
    }
  };

  const handleMarkAsPaid = async (billId: string) => {
    try {
      await updateDoc(doc(db, 'bills', billId), {
        status: 'Paid'
      });
    } catch (error) {
      console.error("Error updating bill status:", error);
    }
  };

  const memberBills = bills.filter(b => b.memberId === selectedMember?.memberId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Member List for Selection */}
      <div className="lg:col-span-1 space-y-4">
        <h3 className="text-lg font-bold font-serif italic uppercase tracking-tight">Select Member</h3>
        <div className="bg-white border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] max-h-[600px] overflow-y-auto">
          {members.map(member => (
            <button
              key={member.id}
              onClick={() => setSelectedMember(member)}
              className={`w-full p-4 text-left border-b border-[#141414] last:border-0 transition-colors flex justify-between items-center ${
                selectedMember?.id === member.id ? 'bg-[#141414] text-white' : 'hover:bg-gray-50'
              }`}
            >
              <div>
                <p className="font-bold">{member.name}</p>
                <p className={`text-[10px] font-mono uppercase ${selectedMember?.id === member.id ? 'text-gray-400' : 'text-gray-500'}`}>
                  {member.memberId} • {member.lateralNumber}
                </p>
              </div>
              <ArrowRight size={16} className={selectedMember?.id === member.id ? 'opacity-100' : 'opacity-0'} />
            </button>
          ))}
        </div>
      </div>

      {/* Member Dashboard */}
      <div className="lg:col-span-2 space-y-6">
        {selectedMember ? (
          <>
            <div className="bg-white border border-[#141414] p-6 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-3xl font-bold font-serif italic tracking-tighter">{selectedMember.name}</h2>
                  <p className="font-mono text-xs uppercase text-gray-500 mt-1">
                    ID: {selectedMember.memberId} • Lateral: {selectedMember.lateralNumber}
                  </p>
                  <p className="text-sm text-gray-600 mt-2">{selectedMember.address}</p>
                </div>
                <div className="text-right">
                  <span className={`px-3 py-1 text-xs font-bold uppercase tracking-widest border ${
                    selectedMember.status === 'Active' 
                      ? 'bg-green-100 text-green-800 border-green-800' 
                      : 'bg-red-100 text-red-800 border-red-800'
                  }`}>
                    {selectedMember.status}
                  </span>
                </div>
              </div>

              {isAdmin && (
                <button
                  onClick={() => {
                    const lastBill = bills.find(b => b.memberId === selectedMember.memberId);
                    const isLineMember = selectedMember.name.includes('Line 1') || selectedMember.name.includes('Line 3');
                    setFormData(prev => ({
                      ...prev,
                      previousReading: lastBill ? lastBill.currentReading : 0,
                      currentReading: lastBill ? lastBill.currentReading : 0,
                      deductionType: isLineMember ? 'Consumer' : 'Others (Manual)',
                      others: isLineMember ? 10 : 0
                    }));
                    setIsModalOpen(true);
                  }}
                  className="flex items-center gap-2 bg-[#141414] text-white px-6 py-2 font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors"
                >
                  <Calculator size={18} />
                  New Reading
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <History size={20} />
                <h3 className="text-lg font-bold font-serif italic uppercase tracking-tight">Billing History</h3>
              </div>
              
              <div className="space-y-4">
                {memberBills.length > 0 ? (
                  memberBills.map(bill => (
                    <div key={bill.id} className="bg-white border border-[#141414] p-4 flex flex-col md:flex-row justify-between gap-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 flex-1">
                      <div>
                        <p className="text-[10px] font-mono uppercase text-gray-500">Period</p>
                        <p className="text-xs font-bold">{format(new Date(bill.readingDateStart), 'MMM d')} - {format(new Date(bill.readingDateEnd), 'MMM d, yyyy')}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-mono uppercase text-gray-500">Readings</p>
                        <p className="text-xs font-bold">{bill.previousReading} → {bill.currentReading} m³</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-mono uppercase text-gray-500">Consumption</p>
                        <p className="text-xs font-bold">{bill.consumption} m³</p>
                      </div>
                    </div>
                      <div className="text-right border-t md:border-t-0 md:border-l border-[#141414] pt-4 md:pt-0 md:pl-6 flex flex-col justify-between items-end">
                        <div>
                          <p className="text-[10px] font-mono uppercase text-gray-500">Total Amount</p>
                          <p className="text-xl font-bold font-serif italic">₱{bill.totalAmount.toFixed(2)}</p>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 border ${
                            bill.status === 'Paid' ? 'bg-green-100 text-green-800 border-green-800' : 'bg-red-100 text-red-800 border-red-800'
                          }`}>
                            {bill.status}
                          </span>
                          {isAdmin && bill.status === 'Unpaid' && (
                            <button
                              onClick={() => handleMarkAsPaid(bill.id)}
                              className="text-[10px] font-bold uppercase underline hover:text-gray-600"
                            >
                              Mark as Paid
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-white border border-dashed border-[#141414] p-12 text-center">
                    <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 font-mono text-sm">No billing records found for this member.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center bg-white border border-dashed border-[#141414] p-12 text-center">
            <div className="max-w-xs">
              <UserPlus className="w-16 h-16 text-gray-300 mx-auto mb-6" />
              <h3 className="text-xl font-bold font-serif italic mb-2">No Member Selected</h3>
              <p className="text-gray-500 font-mono text-sm">Select a member from the list to view their profile and billing history.</p>
            </div>
          </div>
        )}
      </div>

      {/* Reading Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border-2 border-[#141414] shadow-[12px_12px_0px_0px_rgba(20,20,20,1)] w-full max-w-lg p-8"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold font-serif italic uppercase tracking-tight">New Reading</h3>
                <button onClick={() => setIsModalOpen(false)} className="hover:rotate-90 transition-transform">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Start Date</label>
                    <input
                      required
                      type="date"
                      value={formData.readingDateStart}
                      onChange={(e) => setFormData({ ...formData, readingDateStart: e.target.value })}
                      className="w-full p-2 border border-[#141414] font-mono text-sm focus:ring-2 focus:ring-[#141414] outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-gray-500">End Date</label>
                    <input
                      required
                      type="date"
                      value={formData.readingDateEnd}
                      onChange={(e) => setFormData({ ...formData, readingDateEnd: e.target.value })}
                      className="w-full p-2 border border-[#141414] font-mono text-sm focus:ring-2 focus:ring-[#141414] outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Prev Reading (m³)</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      value={isNaN(formData.previousReading) ? '' : formData.previousReading}
                      onChange={(e) => setFormData({ ...formData, previousReading: e.target.value === '' ? NaN : parseFloat(e.target.value) })}
                      className="w-full p-2 border border-[#141414] font-mono text-sm focus:ring-2 focus:ring-[#141414] outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Curr Reading (m³)</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      value={isNaN(formData.currentReading) ? '' : formData.currentReading}
                      onChange={(e) => setFormData({ ...formData, currentReading: e.target.value === '' ? NaN : parseFloat(e.target.value) })}
                      className="w-full p-2 border border-[#141414] font-mono text-sm focus:ring-2 focus:ring-[#141414] outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Deduction Type</label>
                    <select
                      value={formData.deductionType}
                      onChange={(e) => {
                        const type = e.target.value as 'Consumer' | 'Others (Manual)';
                        setFormData({ 
                          ...formData, 
                          deductionType: type,
                          others: type === 'Consumer' ? 10 : formData.others
                        });
                      }}
                      className="w-full p-2 border border-[#141414] font-mono text-sm focus:ring-2 focus:ring-[#141414] outline-none bg-white"
                    >
                      <option value="Consumer">Consumer (-10)</option>
                      <option value="Others (Manual)">Others (Manual)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Others / Deduction (₱)</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      disabled={formData.deductionType === 'Consumer'}
                      value={isNaN(formData.others) ? '' : formData.others}
                      onChange={(e) => setFormData({ ...formData, others: e.target.value === '' ? NaN : parseFloat(e.target.value) })}
                      className={`w-full p-2 border border-[#141414] font-mono text-sm focus:ring-2 focus:ring-[#141414] outline-none ${formData.deductionType === 'Consumer' ? 'bg-gray-50 text-gray-500' : ''}`}
                    />
                  </div>
                </div>

                {/* Live Calculation Preview */}
                {settings && (
                  <div className="bg-gray-50 border border-[#141414] p-4 font-mono text-xs space-y-2">
                    <div className="flex justify-between">
                      <span>Consumption:</span>
                      <span className="font-bold">{calculateBill()?.consumption.toFixed(2)} m³</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Base Rate (0-3 m³):</span>
                      <span>₱{settings.baseRate.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Excess:</span>
                      <span>₱{((calculateBill()?.totalAmount || 0) - settings.baseRate - settings.fixedDues - (calculateBill()?.penalty || 0)).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Monthly Dues:</span>
                      <span>₱{settings.fixedDues.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-blue-600">
                      <span>Deduction (Others):</span>
                      <span>-₱{calculateBill()?.others.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-orange-600">
                      <span>Penalty:</span>
                      <span>₱{calculateBill()?.penalty.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-gray-300 pt-2 flex justify-between text-sm font-bold">
                      <span>Estimated Total:</span>
                      <span className="font-serif italic text-lg">₱{calculateBill()?.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-[#141414] text-white py-3 font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors mt-6"
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
