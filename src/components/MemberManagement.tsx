import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { Member } from '../types';
import { Plus, Search, Edit2, Trash2, UserPlus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function MemberManagement({ isAdmin }: { isAdmin: boolean }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [formData, setFormData] = useState({
    memberId: '',
    name: '',
    address: '',
    lateralNumber: '',
    status: 'Active' as const
  });

  useEffect(() => {
    const q = query(collection(db, 'members'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const membersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Member[];
      setMembers(membersData);
    });
    return unsubscribe;
  }, []);

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) || 
    m.memberId.toLowerCase().includes(search.toLowerCase())
  );

  const generateMemberId = () => {
    const year = new Date().getFullYear();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `MBR-${year}-${random}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    try {
      if (editingMember) {
        await updateDoc(doc(db, 'members', editingMember.id), formData);
      } else {
        const baseName = formData.name.trim();
        // Find existing members with same base name or "baseName Line X"
        const sameBaseMembers = members.filter(m => {
          const name = m.name.trim();
          return name === baseName || name.startsWith(baseName + " Line ");
        });

        let finalName = baseName;
        if (sameBaseMembers.length > 0) {
          // If only one exists and it doesn't have "Line X" yet
          if (sameBaseMembers.length === 1 && sameBaseMembers[0].name.trim() === baseName) {
            await updateDoc(doc(db, 'members', sameBaseMembers[0].id), {
              name: `${baseName} Line 1`
            });
            finalName = `${baseName} Line 2`;
          } else {
            // Find the highest line number to be safe, or just use length + 1
            // Using length + 1 as requested: "increment to Line 2 and so on"
            finalName = `${baseName} Line ${sameBaseMembers.length + 1}`;
          }
        }

        const newMemberId = generateMemberId();
        await addDoc(collection(db, 'members'), {
          ...formData,
          name: finalName,
          memberId: newMemberId,
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
      setEditingMember(null);
      setFormData({ memberId: '', name: '', address: '', lateralNumber: '', status: 'Active' });
    } catch (error) {
      console.error("Error saving member:", error);
    }
  };

  const handleEdit = (member: Member) => {
    setEditingMember(member);
    setFormData({
      memberId: member.memberId,
      name: member.name,
      address: member.address,
      lateralNumber: member.lateralNumber,
      status: member.status
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin || !window.confirm('Are you sure you want to delete this member?')) return;
    try {
      await deleteDoc(doc(db, 'members', id));
    } catch (error) {
      console.error("Error deleting member:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search by ID or Name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-[#115E59] font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#115E59]"
          />
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              setEditingMember(null);
              setFormData({ memberId: '', name: '', address: '', lateralNumber: '', status: 'Active' });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-[#115E59] text-white px-6 py-2 font-bold uppercase tracking-widest hover:bg-teal-800 transition-colors"
          >
            <UserPlus size={18} />
            Add Member
          </button>
        )}
      </div>

      <div className="bg-white border border-[#115E59] shadow-[8px_8px_0px_0px_rgba(17,94,89,1)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-bottom border-[#115E59] bg-gray-50">
                <th className="p-4 font-serif italic text-xs uppercase tracking-wider opacity-50">ID</th>
                <th className="p-4 font-serif italic text-xs uppercase tracking-wider opacity-50">Name</th>
                <th className="p-4 font-serif italic text-xs uppercase tracking-wider opacity-50">Address</th>
                <th className="p-4 font-serif italic text-xs uppercase tracking-wider opacity-50">Lateral</th>
                <th className="p-4 font-serif italic text-xs uppercase tracking-wider opacity-50">Status</th>
                {isAdmin && <th className="p-4 font-serif italic text-xs uppercase tracking-wider opacity-50">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#115E59]">
              {filteredMembers.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="p-4 font-mono text-sm font-bold">{member.memberId}</td>
                  <td className="p-4 font-bold">{member.name}</td>
                  <td className="p-4 text-sm text-gray-600">{member.address}</td>
                  <td className="p-4 font-mono text-sm">{member.lateralNumber}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-tighter border ${
                      member.status === 'Active' 
                        ? 'bg-green-100 text-green-800 border-green-800' 
                        : 'bg-red-100 text-red-800 border-red-800'
                    }`}>
                      {member.status}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleEdit(member)}
                          className="p-1 hover:bg-[#115E59] hover:text-white border border-transparent hover:border-[#115E59] transition-all"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(member.id)}
                          className="p-1 hover:bg-red-600 hover:text-white border border-transparent hover:border-red-600 transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border-2 border-[#115E59] shadow-[12px_12px_0px_0px_rgba(17,94,89,1)] w-full max-w-lg p-8"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold font-serif italic uppercase tracking-tight">
                  {editingMember ? 'Edit Member' : 'New Member'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="hover:rotate-90 transition-transform">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Member ID</label>
                    <input
                      disabled
                      type="text"
                      placeholder="Auto-generated"
                      value={editingMember ? formData.memberId : ''}
                      className="w-full p-2 border border-[#115E59] font-mono text-sm bg-gray-50 text-gray-400 cursor-not-allowed outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Lateral Number</label>
                    <select
                      required
                      value={formData.lateralNumber}
                      onChange={(e) => setFormData({ ...formData, lateralNumber: e.target.value })}
                      className="w-full p-2 border border-[#115E59] font-mono text-sm focus:ring-2 focus:ring-[#115E59] outline-none appearance-none bg-white"
                    >
                      <option value="">Select Lateral</option>
                      <option value="Mainline">Mainline</option>
                      <option value="Lateral 1">Lateral 1</option>
                      <option value="Lateral 2">Lateral 2</option>
                      <option value="Lateral 3">Lateral 3</option>
                      <option value="Lateral 4">Lateral 4</option>
                      <option value="Lateral 5">Lateral 5</option>
                      <option value="Lateral 6">Lateral 6</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Full Name</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-2 border border-[#115E59] font-mono text-sm focus:ring-2 focus:ring-[#115E59] outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Address</label>
                  <textarea
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full p-2 border border-[#115E59] font-mono text-sm focus:ring-2 focus:ring-[#115E59] outline-none h-24"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'Active' | 'Padlocked' })}
                    className="w-full p-2 border border-[#115E59] font-mono text-sm focus:ring-2 focus:ring-[#115E59] outline-none appearance-none bg-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Padlocked">Padlocked</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#115E59] text-white py-3 font-bold uppercase tracking-widest hover:bg-teal-800 transition-colors mt-6"
                >
                  {editingMember ? 'Update Profile' : 'Register Member'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
