
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
    return {
      friendId: f.id,
      paid,
      owed,
      net: paid - owed,
    };
  });
};

/**
 * Calculates direct settlements between pairs of friends.
 * This avoids global debt minimization which can be confusing.
 * It shows exactly who needs to pay whom based on the net difference between them.
 */
export const calculateSettlements = (friends: Friend[], expenses: Expense[]): Settlement[] => {
  // Use a map to track net debt between pairs: 'friendAId-friendBId'
  // positive value means A owes B, negative means B owes A
  const pairDebts: Record<string, number> = {};

  expenses.filter(exp => exp.status === 'pending').forEach(exp => {
    exp.splits.forEach(split => {
      if (!split.isPaid && split.friendId !== exp.payerId) {
        // friendId owes payerId
        const id1 = split.friendId;
        const id2 = exp.payerId;
        const key = id1 < id2 ? `${id1}_${id2}` : `${id2}_${id1}`;
        const direction = id1 < id2 ? 1 : -1;
        
        pairDebts[key] = (pairDebts[key] || 0) + (split.amount * direction);
      }
    });
  });

  const settlements: Settlement[] = [];
  Object.entries(pairDebts).forEach(([key, netDebt]) => {
    if (Math.abs(netDebt) < 0.01) return;

    const [idA, idB] = key.split('_');
    if (netDebt > 0) {
      // A owes B
      settlements.push({ fromId: idA, toId: idB, amount: Number(netDebt.toFixed(2)) });
    } else {
      // B owes A
      settlements.push({ fromId: idB, toId: idA, amount: Number(Math.abs(netDebt).toFixed(2)) });
    }
  });

  return settlements;
};
