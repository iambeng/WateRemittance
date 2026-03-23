export interface Member {
  id: string;
  memberId: string;
  name: string;
  address: string;
  lateralNumber: string;
  status: 'Active' | 'Padlocked';
  createdAt: string;
}

export interface Bill {
  id: string;
  memberId: string;
  readingDateStart: string;
  readingDateEnd: string;
  previousReading: number;
  currentReading: number;
  consumption: number;
  penalty: number;
  monthlyDues: number;
  others: number;
  deductionType: 'Consumer' | 'Others (Manual)';
  totalAmount: number;
  statusTag: 'Regular' | 'For Penalty' | 'For Disconnection';
  status: 'Paid' | 'Unpaid';
  createdAt: string;
}

export interface Settings {
  excessRate: number;
  baseRate: number;
  fixedDues: number;
  companyName?: string;
  companyLogo?: string;
  tagline?: string;
}
