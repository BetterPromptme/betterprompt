export const SHARED_FLAGS = {
  json: {
    flag: "--json",
    description: "Output in JSON format",
  },
  remote: {
    flag: "--remote",
    description: "Use remote API endpoint",
  },
  sync: {
    flag: "--sync",
    description: "Wait for completion when possible",
  },
} as const;
