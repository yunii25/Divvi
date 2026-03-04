
export interface Friend {
  id: string;
  name: string;
  avatar?: string;
  role?: 'admin' | 'user';
  pin?: string;
}

export interface ExpenseSplit {
  friendId: string;
  amount: number;
  isPaid: boolean;
  paidAt?: string;
  paidBy?: string;
}

export interface HistoryEntry {
  id: string;
  userId: string;
  action: string;
  timestamp: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  payerId: string;
  date: string;
  splits: ExpenseSplit[];
  splitType: 'equal' | 'custom';
  status: 'pending' | 'settled';
  notes?: string;
  proofOfPayment?: string[];
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
  history?: HistoryEntry[];
}

export interface Balance {
  friendId: string;
  paid: number;
  owed: number;
  net: number;
}

export interface Settlement {
  fromId: string;
  toId: string;
  amount: number;
}
