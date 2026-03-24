import React, { useState, useCallback } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Settings } from '../types';
import { Save, Info, X, Crop, RotateCcw, ListPlus, Trash2, ChevronRight, Calculator, Palette, Settings2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Cropper, { Point, Area } from 'react-easy-crop';
import getCroppedImg from '../lib/cropImage';
import { toast } from 'sonner';

export default function AdminSettings({ settings }: { settings: Settings | null }) {
  const [formData, setFormData] = useState<Settings>(settings || {
    baseRate: 100,
    excessRate: 30,
    fixedDues: 10
  });
  const [saving, setSaving] = useState(false);
  
  // Cropping State
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [newLateral, setNewLateral] = useState('');
  const [activeModal, setActiveModal] = useState<'billing' | 'report' | 'system' | null>(null);

  const addLateral = () => {
    if (newLateral.trim()) {
      const currentLaterals = formData.lateralNumbers || [];
      if (!currentLaterals.includes(newLateral.trim())) {
        setFormData({
          ...formData,
          lateralNumbers: [...currentLaterals, newLateral.trim()]
        });
        setNewLateral('');
      }
    }
  };

  const removeLateral = (lateral: string) => {
    setFormData({
      ...formData,
      lateralNumbers: (formData.lateralNumbers || []).filter(l => l !== lateral)
    });
  };

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropSave = async () => {
    if (imageToCrop && croppedAreaPixels) {
      try {
        const croppedImage = await getCroppedImg(
          imageToCrop,
          croppedAreaPixels,
          rotation
        );
        if (croppedImage) {
          setFormData({ ...formData, companyLogo: croppedImage });
          setImageToCrop(null);
          setRotation(0);
          setZoom(1);
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'global'), formData);
      toast.success('System settings saved successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {/* Billing Trigger */}
        <button
          onClick={() => setActiveModal('billing')}
          className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 text-left hover:ring-4 hover:ring-cyan-500/10 transition-all group"
        >
          <div className="bg-cyan-100 p-4 rounded-2xl text-cyan-600 w-fit mb-6 group-hover:scale-110 transition-transform">
            <Calculator size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Billing Configuration</h3>
          <p className="text-sm text-slate-500 mb-6">Rates, consumption rules, and fixed dues.</p>
          <div className="flex items-center text-cyan-600 font-bold text-sm">
            Configure <ChevronRight size={16} className="ml-1" />
          </div>
        </button>

        {/* Report Trigger */}
        <button
          onClick={() => setActiveModal('report')}
          className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 text-left hover:ring-4 hover:ring-cyan-500/10 transition-all group"
        >
          <div className="bg-cyan-100 p-4 rounded-2xl text-cyan-600 w-fit mb-6 group-hover:scale-110 transition-transform">
            <Palette size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Report Customization</h3>
          <p className="text-sm text-slate-500 mb-6">Logos, company names, and receipt tags.</p>
          <div className="flex items-center text-cyan-600 font-bold text-sm">
            Configure <ChevronRight size={16} className="ml-1" />
          </div>
        </button>

        {/* System Trigger */}
        <button
          onClick={() => setActiveModal('system')}
          className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 text-left hover:ring-4 hover:ring-cyan-500/10 transition-all group"
        >
          <div className="bg-cyan-100 p-4 rounded-2xl text-cyan-600 w-fit mb-6 group-hover:scale-110 transition-transform">
            <Settings2 size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">System Options</h3>
          <p className="text-sm text-slate-500 mb-6">Laterals, dropdowns, and defaults.</p>
          <div className="flex items-center text-cyan-600 font-bold text-sm">
            Configure <ChevronRight size={16} className="ml-1" />
          </div>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <AnimatePresence>
          {activeModal === 'billing' && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
              >
                <div className="p-6 sm:p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="bg-cyan-600 p-3 rounded-2xl text-white shadow-lg shadow-cyan-200">
                      <Calculator size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Billing Configuration</h2>
                      <p className="text-xs sm:text-sm text-slate-500 font-medium">Manage rates and consumption rules</p>
                    </div>
                  </div>
                  <button onClick={() => setActiveModal(null)} className="p-2 sm:p-3 hover:bg-slate-100 rounded-2xl transition-all text-slate-400">
                    <X size={24} />
                  </button>
                </div>
                <div className="p-6 sm:p-8 overflow-y-auto space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Base Rate (0-3 m³)</label>
                    <div className="relative group">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 group-focus-within:text-cyan-600 transition-colors">₱</span>
                      <input
                        required
                        type="number"
                        value={isNaN(formData.baseRate) ? '' : formData.baseRate}
                        onChange={(e) => setFormData({ ...formData, baseRate: e.target.value === '' ? NaN : parseFloat(e.target.value) })}
                        className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border-2 border-transparent rounded-2xl font-bold text-lg text-slate-700 focus:bg-white focus:border-cyan-500/20 focus:ring-4 focus:ring-cyan-500/5 outline-none transition-all"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium mt-1 ml-1">Minimum charge applied to consumption up to 3 cubic meters.</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Excess Rate (per m³)</label>
                    <div className="relative group">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 group-focus-within:text-cyan-600 transition-colors">₱</span>
                      <input
                        required
                        type="number"
                        value={isNaN(formData.excessRate) ? '' : formData.excessRate}
                        onChange={(e) => setFormData({ ...formData, excessRate: e.target.value === '' ? NaN : parseFloat(e.target.value) })}
                        className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border-2 border-transparent rounded-2xl font-bold text-lg text-slate-700 focus:bg-white focus:border-cyan-500/20 focus:ring-4 focus:ring-cyan-500/5 outline-none transition-all"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium mt-1 ml-1">Charge for every cubic meter consumed beyond the initial 3m³.</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Fixed Monthly Dues</label>
                    <div className="relative group">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 group-focus-within:text-cyan-600 transition-colors">₱</span>
                      <input
                        required
                        type="number"
                        value={isNaN(formData.fixedDues) ? '' : formData.fixedDues}
                        onChange={(e) => setFormData({ ...formData, fixedDues: e.target.value === '' ? NaN : parseFloat(e.target.value) })}
                        className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border-2 border-transparent rounded-2xl font-bold text-lg text-slate-700 focus:bg-white focus:border-cyan-500/20 focus:ring-4 focus:ring-cyan-500/5 outline-none transition-all"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium mt-1 ml-1">Standard maintenance fee applied to every bill.</p>
                  </div>

                  <div className="bg-cyan-50/50 border border-cyan-100 rounded-2xl p-5 flex gap-4">
                    <div className="bg-cyan-100 p-2 rounded-xl text-cyan-600 shrink-0 h-fit">
                      <Info size={20} />
                    </div>
                    <div className="text-xs text-cyan-800 font-medium leading-relaxed">
                      <strong className="text-cyan-900 block mb-1">Calculation Rule:</strong>
                      Total = Base Rate + (Excess Consumption × Excess Rate) + Monthly Dues + Penalties (if applicable).
                    </div>
                  </div>
                </div>
                <div className="p-6 sm:p-8 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-slate-800 transition-all"
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {activeModal === 'report' && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
              >
                <div className="p-6 sm:p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="bg-cyan-600 p-3 rounded-2xl text-white shadow-lg shadow-cyan-200">
                      <Palette size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Report Customization</h2>
                      <p className="text-xs sm:text-sm text-slate-500 font-medium">Personalize your receipts and reports</p>
                    </div>
                  </div>
                  <button onClick={() => setActiveModal(null)} className="p-2 sm:p-3 hover:bg-slate-100 rounded-2xl transition-all text-slate-400">
                    <X size={24} />
                  </button>
                </div>
                <div className="p-6 sm:p-8 overflow-y-auto space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Company Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Aquaflow Water District"
                      value={formData.companyName || ''}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      className="w-full px-4 py-3.5 bg-slate-50 border-2 border-transparent rounded-2xl font-bold text-slate-700 focus:bg-white focus:border-cyan-500/20 focus:ring-4 focus:ring-cyan-500/5 outline-none transition-all"
                    />
                    <p className="text-[11px] text-slate-400 font-medium mt-1 ml-1">This name will appear on all reports and receipts.</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Tagline</label>
                    <input
                      type="text"
                      placeholder="e.g. Pure Water, Pure Life"
                      value={formData.tagline || ''}
                      onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                      className="w-full px-4 py-3.5 bg-slate-50 border-2 border-transparent rounded-2xl font-bold text-slate-700 focus:bg-white focus:border-cyan-500/20 focus:ring-4 focus:ring-cyan-500/5 outline-none transition-all"
                    />
                    <p className="text-[11px] text-slate-400 font-medium mt-1 ml-1">A short slogan or motto for your company.</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Company Logo</label>
                    <div className="space-y-4">
                      <div className="flex gap-3">
                        <input
                          type="text"
                          placeholder="https://example.com/logo.png"
                          value={formData.companyLogo || ''}
                          onChange={(e) => setFormData({ ...formData, companyLogo: e.target.value })}
                          className="flex-1 px-4 py-3.5 bg-slate-50 border-2 border-transparent rounded-2xl font-medium text-sm text-slate-700 focus:bg-white focus:border-cyan-500/20 focus:ring-4 focus:ring-cyan-500/5 outline-none transition-all"
                        />
                        <label className="bg-slate-100 text-slate-600 px-6 py-3.5 rounded-2xl font-bold uppercase tracking-wider text-[11px] cursor-pointer hover:bg-slate-200 transition-all flex items-center border border-slate-200">
                          Upload
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setImageToCrop(reader.result as string);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                      </div>
                      {formData.companyLogo && (
                        <div className="p-6 border-2 border-dashed border-slate-200 rounded-3xl flex items-center justify-center bg-slate-50/50 group relative overflow-hidden">
                          <img src={formData.companyLogo} alt="Logo Preview" className="h-20 object-contain relative z-10" referrerPolicy="no-referrer" />
                          <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                             <button 
                               type="button"
                               onClick={() => setImageToCrop(formData.companyLogo || null)}
                               className="bg-cyan-600 text-white p-2 rounded-xl shadow-lg shadow-cyan-200 hover:bg-cyan-700 transition-all"
                               title="Recrop Logo"
                             >
                               <Crop size={16} />
                             </button>
                             <button 
                               type="button"
                               onClick={() => setFormData({ ...formData, companyLogo: '' })}
                               className="bg-rose-500 text-white p-2 rounded-xl shadow-lg shadow-rose-200 hover:bg-rose-600 transition-all"
                               title="Remove Logo"
                             >
                               <X size={16} />
                             </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium mt-1 ml-1">Direct link to your logo or upload a local file with cropping.</p>
                  </div>
                </div>
                <div className="p-6 sm:p-8 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-slate-800 transition-all"
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {activeModal === 'system' && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
              >
                <div className="p-6 sm:p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="bg-cyan-600 p-3 rounded-2xl text-white shadow-lg shadow-cyan-200">
                      <Settings2 size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">System Options</h2>
                      <p className="text-xs sm:text-sm text-slate-500 font-medium">Manage dropdown options and system defaults</p>
                    </div>
                  </div>
                  <button onClick={() => setActiveModal(null)} className="p-2 sm:p-3 hover:bg-slate-100 rounded-2xl transition-all text-slate-400">
                    <X size={24} />
                  </button>
                </div>
                <div className="p-6 sm:p-8 overflow-y-auto space-y-6">
                  <div className="space-y-4">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Lateral Numbers</label>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        placeholder="Add new lateral (e.g. Lateral 7)"
                        value={newLateral}
                        onChange={(e) => setNewLateral(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addLateral())}
                        className="flex-1 px-4 py-3.5 bg-slate-50 border-2 border-transparent rounded-2xl font-bold text-slate-700 focus:bg-white focus:border-cyan-500/20 focus:ring-4 focus:ring-cyan-500/5 outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={addLateral}
                        className="bg-cyan-600 text-white px-6 py-3.5 rounded-2xl font-bold uppercase tracking-wider text-[11px] hover:bg-cyan-700 transition-all shadow-lg shadow-cyan-200"
                      >
                        Add
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                      {(formData.lateralNumbers || []).map((lateral) => (
                        <div 
                          key={lateral}
                          className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl group hover:bg-white hover:border-cyan-200 transition-all"
                        >
                          <span className="text-sm font-bold text-slate-700">{lateral}</span>
                          <button
                            type="button"
                            onClick={() => removeLateral(lateral)}
                            className="text-slate-400 hover:text-rose-500 p-1 rounded-lg hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                      {(formData.lateralNumbers || []).length === 0 && (
                        <div className="col-span-full py-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                          <p className="text-sm text-slate-400 font-medium">No lateral numbers configured yet.</p>
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium mt-1 ml-1">These options will appear in the "Lateral Number" dropdown when registering new members.</p>
                  </div>
                </div>
                <div className="p-6 sm:p-8 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-slate-800 transition-all"
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Cropping Modal */}
        {imageToCrop && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <div className="p-6 sm:p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="bg-cyan-100 p-2.5 rounded-2xl text-cyan-600">
                    <Crop size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-800 tracking-tight">Crop Your Logo</h3>
                    <p className="text-xs text-slate-500 font-medium">Adjust position and zoom for the perfect fit</p>
                  </div>
                </div>
                <button 
                  onClick={() => setImageToCrop(null)}
                  className="p-2 sm:p-3 hover:bg-slate-100 rounded-2xl transition-all text-slate-400"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="relative flex-1 bg-slate-50 min-h-[300px] sm:min-h-[400px]">
                <Cropper
                  image={imageToCrop}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={1}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                />
              </div>

              <div className="p-6 sm:p-8 bg-white border-t border-slate-100 space-y-6 shrink-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Zoom</label>
                      <span className="text-[10px] font-bold text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-full">{Math.round(zoom * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      value={zoom}
                      min={1}
                      max={3}
                      step={0.1}
                      aria-labelledby="Zoom"
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-cyan-600"
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Rotation</label>
                      <button 
                        onClick={() => setRotation(0)}
                        className="text-slate-400 hover:text-cyan-600 transition-colors"
                      >
                        <RotateCcw size={14} />
                      </button>
                    </div>
                    <input
                      type="range"
                      value={rotation}
                      min={0}
                      max={360}
                      step={1}
                      aria-labelledby="Rotation"
                      onChange={(e) => setRotation(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-cyan-600"
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setImageToCrop(null)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold uppercase tracking-widest hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCropSave}
                    className="flex-1 py-4 bg-cyan-600 text-white rounded-2xl font-bold uppercase tracking-widest hover:bg-cyan-700 shadow-lg shadow-cyan-200 transition-all"
                  >
                    Apply Crop
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-cyan-600 text-white py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-cyan-700 hover:shadow-lg hover:shadow-cyan-200 transition-all disabled:opacity-50 active:scale-[0.98]"
        >
          {saving ? 'Saving Changes...' : 'Save All Configuration'}
        </button>
      </form>
    </div>
  );
}
