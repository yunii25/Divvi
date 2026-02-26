
import { Friend, Expense, Balance, Settlement } from "../types";

export const calculateBalances = (friends: Friend[], expenses: Expense[]): Balance[] => {
  const balancesMap: Record<string, { paid: number; owed: number }> = {};

  friends.forEach((f) => {
    balancesMap[String(f.id)] = { paid: 0, owed: 0 };
  });

  expenses.filter(exp => exp.status === 'pending').forEach((exp) => {
    exp.splits.forEach((split) => {
      if (!split.isPaid) {
        const friendId = String(split.friendId);
        const payerId = String(exp.payerId);

        if (balancesMap[friendId]) {
          balancesMap[friendId].owed += split.amount;
        }
        if (balancesMap[payerId]) {
          balancesMap[payerId].paid += split.amount;
        }
      }
    });
  });

  return friends.map((f) => {
    const friendId = String(f.id);
    const { paid, owed } = balancesMap[friendId] || { paid: 0, owed: 0 };
    return {
      friendId: f.id,
      paid,
      owed,
      net: paid - owed,
    };
  });
};

export const calculateSettlements = (friends: Friend[], expenses: Expense[]): Settlement[] => {
  const pairDebts: Record<string, number> = {};

  expenses.filter(exp => exp.status === 'pending').forEach(exp => {
    exp.splits.forEach(split => {
      if (!split.isPaid && String(split.friendId) !== String(exp.payerId)) {
        const id1 = String(split.friendId);
        const id2 = String(exp.payerId);
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
      settlements.push({ fromId: String(idA), toId: String(idB), amount: Number(netDebt.toFixed(2)) });
    } else {
      settlements.push({ fromId: String(idB), toId: String(idA), amount: Number(Math.abs(netDebt).toFixed(2)) });
    }
  });

  return settlements;
};
