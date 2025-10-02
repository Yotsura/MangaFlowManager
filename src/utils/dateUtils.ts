export const formatDate = (date: Date) => {
  return date.toISOString().split("T")[0];
};

export const isWeekend = (date: Date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};
