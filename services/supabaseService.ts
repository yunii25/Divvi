
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { Friend, Expense } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://leklodiatxgtlgcusgyh.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxla2xvZGlhdHhndGxnY3VzZ3loIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NjI1MDYsImV4cCI6MjA4NzAzODUwNn0.aZwDr0_n6G89RPirAulnKO0w8b5sX6YCob_ZLZVV4n8";

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper to map DB row to JS Expense object
const mapExpenseFromDB = (row: any): Expense => ({
  id: row.id,
  description: row.description,
  amount: parseFloat(row.amount),
  payerId: row.payer_id,
  date: row.date,
  splits: row.splits,
  splitType: row.split_type,
  status: row.status
});

// Helper to map JS Expense to DB row
const mapExpenseToDB = (exp: Partial<Expense>) => {
  const row: any = {};
  if (exp.description !== undefined) row.description = exp.description;
  if (exp.amount !== undefined) row.amount = exp.amount;
  if (exp.payerId !== undefined) row.payer_id = exp.payerId;
  if (exp.date !== undefined) row.date = exp.date;
  if (exp.splits !== undefined) row.splits = exp.splits;
  if (exp.splitType !== undefined) row.split_type = exp.splitType;
  if (exp.status !== undefined) row.status = exp.status;
  return row;
};

export const auth = {
  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getUser(): Promise<User | null> {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  onAuthStateChange(callback: (user: User | null) => void) {
    return supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ?? null);
    });
  }
};

export const db = {
  // Friends
  async getFriends(): Promise<Friend[]> {
    const { data, error } = await supabase.from('friends').select('*').order('created_at', { ascending: true });
    if (error) {
      console.error("Supabase Error (getFriends):", error);
      throw new Error(`Failed to load friends: ${error.message}`);
    }
    return data || [];
  },

  async addFriend(name: string): Promise<Friend> {
    const { data, error } = await supabase.from('friends').insert([{ name }]).select().single();
    if (error) throw error;
    return data;
  },

  async updateFriend(id: string, name: string): Promise<void> {
    const { error } = await supabase.from('friends').update({ name }).eq('id', id);
    if (error) throw error;
  },

  async deleteFriend(id: string): Promise<void> {
    const { error } = await supabase.from('friends').delete().eq('id', id);
    if (error) throw error;
  },

  // Expenses
  async getExpenses(): Promise<Expense[]> {
    const { data, error } = await supabase.from('expenses').select('*').order('date', { ascending: false });
    if (error) {
      console.error("Supabase Error (getExpenses):", error);
      throw new Error(`Failed to load expenses: ${error.message}`);
    }
    return (data || []).map(mapExpenseFromDB);
  },

  async addExpense(expense: Omit<Expense, 'id'>): Promise<Expense> {
    const dbRow = mapExpenseToDB(expense);
    const { data, error } = await supabase.from('expenses').insert([dbRow]).select().single();
    if (error) {
      console.error("Add Expense Error Details:", error);
      throw error;
    }
    return mapExpenseFromDB(data);
  },

  async updateExpense(id: string, expense: Partial<Expense>): Promise<void> {
    const dbRow = mapExpenseToDB(expense);
    const { error } = await supabase.from('expenses').update(dbRow).eq('id', id);
    if (error) throw error;
  },

  async deleteExpense(id: string): Promise<void> {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
  }
};
