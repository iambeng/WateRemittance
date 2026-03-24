import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { Member, Settings } from '../types';
import { Plus, Search, Edit2, Trash2, UserPlus, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export default function MemberManagement({ isAdmin, settings }: { isAdmin: boolean, settings: Settings | null }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [formData, setFormData] = useState({
    memberId: '',
    name: '',
    address: '',
    lateralNumber: '',
    status: 'Active' as const,
    initialReading: 0
  });

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);

  useEffect(() => {
    const membersPath = 'members';
    const q = query(collection(db, 'members'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const membersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Member[];
      setMembers(membersData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, membersPath);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) || 
    m.memberId.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filteredMembers.length / ITEMS_PER_PAGE);
  const paginatedMembers = filteredMembers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
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
        toast.success('Member profile updated successfully');
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
            }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `members/${sameBaseMembers[0].id}`));
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
        toast.success('New member registered successfully');
      }
      setIsModalOpen(false);
      setEditingMember(null);
      setFormData({ memberId: '', name: '', address: '', lateralNumber: '', status: 'Active', initialReading: 0 });
    } catch (error) {
      handleFirestoreError(error, editingMember ? OperationType.UPDATE : OperationType.CREATE, editingMember ? `members/${editingMember.id}` : 'members');
      toast.error('Failed to save member details');
    }
  };

  const handleEdit = (member: Member) => {
    setEditingMember(member);
    setFormData({
      memberId: member.memberId,
      name: member.name,
      address: member.address,
      lateralNumber: member.lateralNumber,
      status: member.status,
      initialReading: member.initialReading || 0
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    setMemberToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!memberToDelete) return;
    try {
      await deleteDoc(doc(db, 'members', memberToDelete));
      setIsDeleteModalOpen(false);
      setMemberToDelete(null);
      toast.success('Member deleted successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `members/${memberToDelete}`);
      toast.error('Failed to delete member');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-80 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-[#0891B2] transition-colors" />
          <input
            type="text"
            placeholder="Search by ID or Name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-[#0891B2] transition-all shadow-sm"
          />
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              setEditingMember(null);
              setFormData({ memberId: '', name: '', address: '', lateralNumber: '', status: 'Active', initialReading: 0 });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-[#0891B2] text-white px-6 py-2.5 rounded-xl font-bold tracking-wide hover:bg-[#06B6D4] transition-all shadow-md hover:shadow-lg active:scale-[0.98] text-sm"
          >
            <UserPlus size={18} />
            Add Member
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Member ID</th>
                <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Name</th>
                <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Address</th>
                <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Lateral</th>
                <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                {isAdmin && <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedMembers.map((member) => (
                <tr key={member.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="py-2.5 px-4 font-mono text-xs font-bold text-slate-700">{member.memberId}</td>
                  <td className="py-2.5 px-4 font-bold text-slate-900 text-sm">{member.name}</td>
                  <td className="py-2.5 px-4 text-xs text-slate-500 max-w-xs truncate">{member.address}</td>
                  <td className="py-2.5 px-4 font-medium text-slate-600 text-xs">{member.lateralNumber}</td>
                  <td className="py-2.5 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                      member.status === 'Active' 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-rose-100 text-rose-700'
                    }`}>
                      {member.status}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="py-2.5 px-4">
                      <div className="flex gap-1 justify-end">
                        <button 
                          onClick={() => handleEdit(member)}
                          className="p-1.5 text-slate-400 hover:text-[#0891B2] hover:bg-cyan-50 rounded-lg transition-all"
                          title="Edit Member"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(member.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          title="Delete Member"
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

      {/* Pagination Controls */}
      {filteredMembers.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-2 py-1">
          <p className="text-xs text-slate-500 font-medium">
            Showing <span className="font-bold text-slate-900">{Math.min(filteredMembers.length, (currentPage - 1) * ITEMS_PER_PAGE + 1)}</span> to <span className="font-bold text-slate-900">{Math.min(filteredMembers.length, currentPage * ITEMS_PER_PAGE)}</span> of <span className="font-bold text-slate-900">{filteredMembers.length}</span> members
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
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
      )}

      {/* Registration Modal */}
      <AnimatePresence>
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
                  <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                    {editingMember ? 'Edit Member' : 'Register Member'}
                  </h3>
                  <p className="text-sm text-slate-500 font-medium mt-1">
                    {editingMember ? 'Update existing member details' : 'Add a new member to the system'}
                  </p>
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
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">Member ID</label>
                    <input
                      disabled
                      type="text"
                      placeholder="Auto-generated"
                      value={editingMember ? formData.memberId : ''}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-400 cursor-not-allowed outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">Lateral Number</label>
                    <div className="relative">
                      <select
                        required
                        value={formData.lateralNumber}
                        onChange={(e) => setFormData({ ...formData, lateralNumber: e.target.value })}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-cyan-500/10 focus:border-[#0891B2] outline-none appearance-none cursor-pointer"
                      >
                        <option value="">Select Lateral</option>
                        {settings?.lateralNumbers && settings.lateralNumbers.length > 0 ? (
                          settings.lateralNumbers.map(l => (
                            <option key={l} value={l}>{l}</option>
                          ))
                        ) : (
                          <>
                            <option value="Mainline">Mainline</option>
                            <option value="Lateral 1">Lateral 1</option>
                            <option value="Lateral 2">Lateral 2</option>
                            <option value="Lateral 3">Lateral 3</option>
                            <option value="Lateral 4">Lateral 4</option>
                            <option value="Lateral 5">Lateral 5</option>
                            <option value="Lateral 6">Lateral 6</option>
                          </>
                        )}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <Plus size={16} className="rotate-45" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">Full Name</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-cyan-500/10 focus:border-[#0891B2] outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">Address</label>
                  <textarea
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-cyan-500/10 focus:border-[#0891B2] outline-none h-28 transition-all resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">Status</label>
                    <div className="relative">
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as 'Active' | 'Padlocked' })}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-cyan-500/10 focus:border-[#0891B2] outline-none appearance-none cursor-pointer"
                      >
                        <option value="Active">Active</option>
                        <option value="Padlocked">Padlocked</option>
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <Plus size={16} className="rotate-45" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">Initial Reading (m³)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.initialReading}
                      onChange={(e) => setFormData({ ...formData, initialReading: parseFloat(e.target.value) || 0 })}
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-cyan-500/10 focus:border-[#0891B2] outline-none transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#0891B2] text-white py-4 rounded-2xl font-bold tracking-wide hover:bg-[#06B6D4] transition-all shadow-lg hover:shadow-cyan-900/20 mt-4 active:scale-[0.98]"
                >
                  {editingMember ? 'Update Profile' : 'Register Member'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-10 text-center border border-slate-100"
            >
              <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-10 h-10 text-rose-500" />
              </div>
              <h3 className="text-2xl font-extrabold text-slate-900 mb-2">Delete Member?</h3>
              <p className="text-slate-500 mb-8 leading-relaxed">
                This action cannot be undone. All billing history for this member will also be removed.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 px-6 py-4 rounded-2xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-6 py-4 rounded-2xl font-bold text-white bg-rose-500 hover:bg-rose-600 transition-colors shadow-lg shadow-rose-200"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
