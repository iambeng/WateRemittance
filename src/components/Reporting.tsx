import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Member, Bill } from '../types';
import { Download, Filter, Search, FileDown } from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Reporting() {
  const [members, setMembers] = useState<Member[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [filters, setFilters] = useState({
    month: format(new Date(), 'MM'),
    year: format(new Date(), 'yyyy'),
    lateral: ''
  });
  const [selectedBills, setSelectedBills] = useState<string[]>([]);

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

  const toggleSelect = (id: string) => {
    setSelectedBills(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const generatePDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const billsToPrint = bills.filter(b => selectedBills.includes(b.id));
    
    if (billsToPrint.length === 0) return;

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
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('AQUAFLOW', x + receiptWidth / 2, y + 10, { align: 'center' });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('WATER BILL RECEIPT', x + receiptWidth / 2, y + 15, { align: 'center' });

      // Member Info
      doc.setFontSize(7);
      doc.text(`ID: ${bill.memberId}`, x + 5, y + 25);
      doc.text(`Lateral: ${member?.lateralNumber || 'N/A'}`, x + 5, y + 30);
      doc.setFont('helvetica', 'bold');
      doc.text(`NAME: ${member?.name || 'Unknown'}`, x + 5, y + 35);
      doc.setFont('helvetica', 'normal');
      doc.text(`Address: ${member?.address || 'N/A'}`, x + 5, y + 40, { maxWidth: 80 });

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
      
      if (bill.others > 0) {
        doc.text('DEDUCTION (OTHERS):', x + 5, y + 95);
        doc.text(`-P${bill.others.toFixed(2)}`, x + receiptWidth - 25, y + 95, { align: 'right' });
      }
      
      // Total
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('TOTAL AMOUNT:', x + 5, y + 105);
      doc.text(`P${bill.totalAmount.toFixed(2)}`, x + receiptWidth - 25, y + 105, { align: 'right' });

      // Footer
      doc.setFontSize(6);
      doc.setFont('helvetica', 'italic');
      doc.text(`Status: ${bill.statusTag} | Payment: ${bill.status}`, x + 5, y + 115);
      doc.text('Please pay on or before the 20th to avoid penalties.', x + 5, y + 120);
      doc.text(`Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, x + 5, y + 125);
    });

    doc.save(`Water_Bills_${filters.month}_${filters.year}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#141414] p-6 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Month</label>
            <select 
              value={filters.month}
              onChange={(e) => setFilters({ ...filters, month: e.target.value })}
              className="p-2 border border-[#141414] font-mono text-sm outline-none bg-white"
            >
              {Array.from({ length: 12 }, (_, i) => {
                const m = (i + 1).toString().padStart(2, '0');
                return <option key={m} value={m}>{format(new Date(2000, i, 1), 'MMMM')}</option>;
              })}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Year</label>
            <select 
              value={filters.year}
              onChange={(e) => setFilters({ ...filters, year: e.target.value })}
              className="p-2 border border-[#141414] font-mono text-sm outline-none bg-white"
            >
              {['2024', '2025', '2026'].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Lateral</label>
            <select 
              value={filters.lateral}
              onChange={(e) => setFilters({ ...filters, lateral: e.target.value })}
              className="p-2 border border-[#141414] font-mono text-sm outline-none bg-white"
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
          <button
            onClick={generatePDF}
            disabled={selectedBills.length === 0}
            className="flex items-center gap-2 bg-[#141414] text-white px-6 py-2 font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <FileDown size={18} />
            Export PDF ({selectedBills.length})
          </button>
        </div>
      </div>

      <div className="bg-white border border-[#141414] shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-bottom border-[#141414] bg-gray-50">
                <th className="p-4 w-10">
                  <input 
                    type="checkbox" 
                    onChange={(e) => {
                      if (e.target.checked) setSelectedBills(filteredBills.map(b => b.id));
                      else setSelectedBills([]);
                    }}
                    checked={selectedBills.length === filteredBills.length && filteredBills.length > 0}
                  />
                </th>
                <th className="p-4 font-serif italic text-xs uppercase tracking-wider opacity-50">Member</th>
                <th className="p-4 font-serif italic text-xs uppercase tracking-wider opacity-50">Lateral</th>
                <th className="p-4 font-serif italic text-xs uppercase tracking-wider opacity-50">Consumption</th>
                <th className="p-4 font-serif italic text-xs uppercase tracking-wider opacity-50">Amount</th>
                <th className="p-4 font-serif italic text-xs uppercase tracking-wider opacity-50">Payment</th>
                <th className="p-4 font-serif italic text-xs uppercase tracking-wider opacity-50">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141414]">
              {filteredBills.map((bill) => {
                const member = members.find(m => m.memberId === bill.memberId);
                return (
                  <tr key={bill.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="p-4">
                      <input 
                        type="checkbox" 
                        checked={selectedBills.includes(bill.id)}
                        onChange={() => toggleSelect(bill.id)}
                      />
                    </td>
                    <td className="p-4">
                      <p className="font-bold">{member?.name || 'Unknown'}</p>
                      <p className="text-[10px] font-mono text-gray-500">{bill.memberId}</p>
                    </td>
                    <td className="p-4 font-mono text-sm">{member?.lateralNumber || '-'}</td>
                    <td className="p-4 font-mono text-sm">{bill.consumption} m³</td>
                    <td className="p-4 font-bold font-serif italic">₱{bill.totalAmount.toFixed(2)}</td>
                    <td className="p-4">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 border ${
                        bill.status === 'Paid' ? 'bg-green-100 text-green-800 border-green-800' : 'bg-red-100 text-red-800 border-red-800'
                      }`}>
                        {bill.status}
                      </span>
                    </td>
                    <td className="p-4 text-xs font-mono text-gray-500">
                      {format(new Date(bill.readingDateEnd), 'MMM d, yyyy')}
                    </td>
                  </tr>
                );
              })}
              {filteredBills.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-gray-500 font-mono text-sm">
                    No records found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
