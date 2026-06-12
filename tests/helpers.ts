import { initSchema } from "../src/db";

export async function resetDb(db: D1Database): Promise<void> {
  await initSchema(db);
  await db.exec("DELETE FROM reactions");
  await db.exec("DELETE FROM comments");
  await db.exec("DELETE FROM posts");
  await db.exec("DELETE FROM users");
}
