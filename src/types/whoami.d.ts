export type TUserIdentity = {
  username: string;
  displayName: string;
  userFlags: number;
};

export type TWhoamiDependencies = {
  getCurrentUser: () => Promise<TUserIdentity>;
};
