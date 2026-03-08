import { createClient } from '@supabase/supabase-js';

// @ts-ignore
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
// @ts-ignore
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const db = {
  async getFriends() {
    const { data, error } = await supabase.from('friends').select('*');
    if (error) throw error;
    return data;
  },
  async addFriend(name: string) {
    const { data, error } = await supabase.from('friends').insert([{ name }]).select().single();
    if (error) throw error;
    return data;
  },
  async updateFriend(id: string, updates: any) {
    const { data, error } = await supabase.from('friends').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async deleteFriend(id: string) {
    const { error } = await supabase.from('friends').delete().eq('id', id);
    if (error) throw error;
  },
  async getExpenses() {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      // Fallback to 'date' if 'created_at' fails, or just throw
      const { data: data2, error: error2 } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });
      
      if (error2) throw error;
      return data2.map(mapExpenseFromDB);
    }
    
    return data.map(mapExpenseFromDB);
  },
  async addExpense(expense: any) {
    const dbData = mapExpenseToDB(expense);
    const { data, error } = await supabase.from('expenses').insert([dbData]).select().single();
    if (error) throw error;
    return mapExpenseFromDB(data);
  },
  async updateExpense(id: string, updates: any) {
    const dbUpdates = mapExpenseToDB(updates);
    const { data, error } = await supabase.from('expenses').update(dbUpdates).eq('id', id).select().single();
    if (error) throw error;
    return mapExpenseFromDB(data);
  },
  async deleteExpense(id: string) {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
  }
};

function mapExpenseToDB(expense: any) {
  const mapped: any = { ...expense };
  if (expense.payerId !== undefined) { mapped.payer_id = expense.payerId; delete mapped.payerId; }
  if (expense.splitType !== undefined) { mapped.split_type = expense.splitType; delete mapped.splitType; }
  if (expense.proofOfPayment !== undefined) { mapped.proof_of_payment = expense.proofOfPayment; delete mapped.proofOfPayment; }
  if (expense.createdBy !== undefined) { mapped.created_by = expense.createdBy; delete mapped.createdBy; }
  if (expense.createdAt !== undefined) { mapped.created_at = expense.createdAt; delete mapped.createdAt; }
  if (expense.updatedBy !== undefined) { mapped.updated_by = expense.updatedBy; delete mapped.updatedBy; }
  if (expense.updatedAt !== undefined) { mapped.updated_at = expense.updatedAt; delete mapped.updatedAt; }
  return mapped;
}

function mapExpenseFromDB(dbExpense: any) {
  if (!dbExpense) return null;
  const mapped: any = { ...dbExpense };
  if (dbExpense.payer_id !== undefined) { mapped.payerId = dbExpense.payer_id; delete mapped.payer_id; }
  if (dbExpense.split_type !== undefined) { mapped.splitType = dbExpense.split_type; delete mapped.split_type; }
  if (dbExpense.proof_of_payment !== undefined) { mapped.proofOfPayment = dbExpense.proof_of_payment; delete mapped.proof_of_payment; }
  if (dbExpense.created_by !== undefined) { mapped.createdBy = dbExpense.created_by; delete mapped.created_by; }
  if (dbExpense.created_at !== undefined) { mapped.createdAt = dbExpense.created_at; delete mapped.created_at; }
  if (dbExpense.updated_by !== undefined) { mapped.updatedBy = dbExpense.updated_by; delete mapped.updated_by; }
  if (dbExpense.updated_at !== undefined) { mapped.updatedAt = dbExpense.updated_at; delete mapped.updated_at; }
  return mapped;
}
