
export interface Friend {
  id: string | number;
  name: string;
  avatar?: string;
}

export interface ExpenseSplit {
  friendId: string | number;
  amount: number;
  isPaid: boolean;
}

export interface Expense {
  id: string | number;
  description: string;
  amount: number;
  payerId: string | number;
  date: string;
  splits: ExpenseSplit[];
  splitType: 'equal' | 'custom';
  status: 'pending' | 'settled';
}

export interface Balance {
  friendId: string | number;
  paid: number;
  owed: number;
  net: number;
}

export interface Settlement {
  fromId: string | number;
  toId: string | number;
  amount: number;
}
