export const dailyRewards = [1, 4, 6, 8, 10, 12, 25];
export const diamondPacks = [
  { id: 'starter', title: '萌新体验包', amount: 600, price: 6, once: true },
  { id: 'd60', title: '60 钻石', amount: 60, price: 1, once: false },
  { id: 'd300', title: '300 钻石', amount: 300, price: 5, once: false },
  { id: 'd680', title: '680 钻石', amount: 680, price: 12, once: false },
  { id: 'd1980', title: '1,980 钻石', amount: 1980, price: 30, once: false },
  { id: 'd3280', title: '3,280 钻石', amount: 3280, price: 50, once: false },
  { id: 'd6480', title: '6,480 钻石', amount: 6480, price: 98, once: false },
];
export type DiamondState = {
  balance: number; checked: boolean; streak: number; reward: number; starterBought: boolean;
  history: { id: string; kind: string; amount: number; created_at: string }[];
};
