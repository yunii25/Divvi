
import { Friend, Expense, Balance, Settlement } from "../types";

export const calculateBalances = (friends: Friend[], expenses: Expense[]): Balance[] => {
  const balancesMap: Record<string, { paid: number; owed: number }> = {};

  friends.forEach((f) => {
    balancesMap[f.id] = { paid: 0, owed: 0 };
  });

  // We only care about expenses that aren't globally marked as 'settled'
  // And within those, we track the individual splits that are still 'pending' (isPaid === false)
  expenses.filter(exp => exp.status === 'pending').forEach((exp) => {
    exp.splits.forEach((split) => {
      // If the split is not paid yet, it contributes to the debt/credit
      if (!split.isPaid) {
        // The person who owes the money
        if (balancesMap[split.friendId]) {
          balancesMap[split.friendId].owed += split.amount;
        }
        // The person who is owed the money (the payer)
        if (balancesMap[exp.payerId]) {
          balancesMap[exp.payerId].paid += split.amount;
        }
      }
    });
  });

  return friends.map((f) => {
    const { paid, owed } = balancesMap[f.id];
    // Net: (What others owe me) - (What I owe others)
    // Note: in our loop, 'paid' accumulates what others owe the payer
    // and 'owed' accumulates what the friend owes others.
    return {
      friendId: f.id,
      paid,
      owed,
      net: paid - owed,
    };
  });
};

export const calculateSettlements = (balances: Balance[]): Settlement[] => {
  const settlements: Settlement[] = [];
  const nets = balances
    .map(b => ({ friendId: b.friendId, net: b.net }))
    .filter(b => Math.abs(b.net) > 0.01);

  let creditors = nets.filter(n => n.net > 0).sort((a, b) => b.net - a.net);
  let debtors = nets.filter(n => n.net < 0).sort((a, b) => a.net - b.net);

  let cIdx = 0;
  let dIdx = 0;

  while (cIdx < creditors.length && dIdx < debtors.length) {
    const creditor = creditors[cIdx];
    const debtor = debtors[dIdx];
    const amount = Math.min(creditor.net, Math.abs(debtor.net));

    settlements.push({
      fromId: debtor.friendId,
      toId: creditor.friendId,
      amount: Number(amount.toFixed(2)),
    });

    creditor.net -= amount;
    debtor.net += amount;

    if (Math.abs(creditor.net) < 0.01) cIdx++;
    if (Math.abs(debtor.net) < 0.01) dIdx++;
  }

  return settlements;
};
