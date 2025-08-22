export { worker } from "./browser";
export { handlers } from "./handlers";
export { db, seedDatabase, resetDatabase } from "./db";

// Initialize the mock database with seed data
import { seedDatabase } from "./db";

if (
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_USE_MOCK === "true"
) {
  seedDatabase();
}
