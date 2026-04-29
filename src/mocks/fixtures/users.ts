import type { User } from "@/types";

export const users: User[] = [
  {
    id: "u-admin",
    email: "admin@example.com",
    name: "Admin Tanaka",
    role: "admin",
    department: "Executive",
  },
  {
    id: "u-user1",
    email: "user1@example.com",
    name: "Hanako Sato",
    role: "user",
    department: "MarketIntelligence",
  },
  {
    id: "u-owner1",
    email: "owner1@example.com",
    name: "Taro Yamamoto",
    role: "user",
    department: "Executive",
  },
];

export const credentials: Record<string, string> = {
  "admin@example.com": "admin123",
  "user1@example.com": "user123",
  "owner1@example.com": "owner123",
};
