export const roundMoney = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

export const formatMoney = (value: number) =>
  roundMoney(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const toMoneyString = (value: number) => roundMoney(value).toFixed(2);
