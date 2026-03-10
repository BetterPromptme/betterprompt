export type TCreditBalance = {
  credits: number;
};

export type TCreditsDependencies = {
  getCredits: () => Promise<TCreditBalance>;
};
