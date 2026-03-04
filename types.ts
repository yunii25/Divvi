
export interface Friend {
  id: string;
  name: string;
  avatar?: string;
}

export interface ExpenseSplit {
  friendId: string;
  amount: number;
  isPaid: boolean;
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
