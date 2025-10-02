export const calculatePanelsPerDay = (totalPanels: number, remainingDays: number) => {
  if (remainingDays <= 0) {
    return totalPanels;
  }

  return Math.ceil(totalPanels / remainingDays);
};
