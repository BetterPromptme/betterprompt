const formatCredits = (credits: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "decimal",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(credits);
};

export default formatCredits;
