
export interface Friend {
  id: number;
  name: string;
  avatar?: string;
  status: number;
}

export interface UserProfile {
  id: number;
  email: string;
  full_name: string;
  avatar_url: string;
  status: number;
}

export interface ExpenseSplit {
  friendId: number;
  amount: number;
  isPaid: boolean;
}

export interface Expense {
  id: number;
  description: string;
  amount: number;
  payerId: number;
  date: string;
  splits: ExpenseSplit[];
  splitType: 'equal' | 'custom';
  status: 'pending' | 'settled';
}

export interface Balance {
  friendId: number;
  paid: number;
  owed: number;
  net: number;
}

export interface Settlement {
  fromId: number;
  toId: number;
  amount: number;
}
