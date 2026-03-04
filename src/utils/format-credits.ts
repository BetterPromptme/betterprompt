const FACTOR = 1000;

const getDisplayCredits = (credits: number) => {
  return credits / FACTOR;
};

const formatCredits = (credits: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "decimal",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(getDisplayCredits(credits));
};

export default formatCredits;
