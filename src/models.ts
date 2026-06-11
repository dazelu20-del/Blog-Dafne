import type { D1Database } from "@cloudflare/workers-types";
import type { Comment, Post, ReactionCounts } from "./types";
import { withForeignKeys } from "./db";
import { escapeLikePattern } from "./utils";

export async function listPosts(db: D1Database): Promise<Post[]> {
  return withForeignKeys(db, async () => {
    const { results } = await db
      .prepare(
        `SELECT p.*, u.username AS author
         FROM posts p
         JOIN users u ON u.id = p.author_id
         ORDER BY p.created_at DESC, p.id DESC`
      )
      .all<Post>();
    return results || [];
  });
}

export async function getPost(db: D1Database, id: number): Promise<Post | null> {
  return withForeignKeys(db, async () => {
    return db
      .prepare(
        `SELECT p.*, u.username AS author
         FROM posts p
         JOIN users u ON u.id = p.author_id
         WHERE p.id = ?`
      )
      .bind(id)
      .first<Post>();
  });
}

export async function createPost(
  db: D1Database,
  authorId: number,
  title: string,
  body: string
): Promise<number> {
  return withForeignKeys(db, async () => {
    const result = await db
      .prepare(
        "INSERT INTO posts (author_id, title, body) VALUES (?, ?, ?)"
      )
      .bind(authorId, title.trim(), body.trim())
      .run();
    return Number(result.meta.last_row_id);
  });
}

export async function updatePost(
  db: D1Database,
  id: number,
  authorId: number,
  title: string,
  body: string
): Promise<boolean> {
  return withForeignKeys(db, async () => {
    const result = await db
      .prepare(
        `UPDATE posts SET title = ?, body = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND author_id = ?`
      )
      .bind(title.trim(), body.trim(), id, authorId)
      .run();
    return (result.meta.changes || 0) > 0;
  });
}

export async function deletePost(
  db: D1Database,
  id: number,
  authorId: number
): Promise<boolean> {
  return withForeignKeys(db, async () => {
    const result = await db
      .prepare("DELETE FROM posts WHERE id = ? AND author_id = ?")
      .bind(id, authorId)
      .run();
    return (result.meta.changes || 0) > 0;
  });
}

export async function searchPosts(
  db: D1Database,
  query: string
): Promise<Post[]> {
  const pattern = `%${escapeLikePattern(query)}%`;
  return withForeignKeys(db, async () => {
    const { results } = await db
      .prepare(
        `SELECT p.*, u.username AS author
         FROM posts p
         JOIN users u ON u.id = p.author_id
         WHERE p.title LIKE ? ESCAPE '\\' COLLATE NOCASE
            OR p.body LIKE ? ESCAPE '\\' COLLATE NOCASE
         ORDER BY p.created_at DESC, p.id DESC`
      )
      .bind(pattern, pattern)
      .all<Post>();
    return results || [];
  });
}

export async function listComments(
  db: D1Database,
  postId: number
): Promise<Comment[]> {
  return withForeignKeys(db, async () => {
    const { results } = await db
      .prepare(
        `SELECT c.*, u.username AS author
         FROM comments c
         JOIN users u ON u.id = c.user_id
         WHERE c.post_id = ?
         ORDER BY c.created_at ASC, c.id ASC`
      )
      .bind(postId)
      .all<Comment>();
    return results || [];
  });
}

export async function createComment(
  db: D1Database,
  postId: number,
  userId: number,
  body: string
): Promise<Comment | null> {
  return withForeignKeys(db, async () => {
    const result = await db
      .prepare(
        "INSERT INTO comments (post_id, user_id, body) VALUES (?, ?, ?)"
      )
      .bind(postId, userId, body.trim())
      .run();
    const id = Number(result.meta.last_row_id);
    return db
      .prepare(
        `SELECT c.*, u.username AS author
         FROM comments c
         JOIN users u ON u.id = c.user_id
         WHERE c.id = ?`
      )
      .bind(id)
      .first<Comment>();
  });
}

export async function getReactionCounts(
  db: D1Database,
  postId: number
): Promise<ReactionCounts> {
  return withForeignKeys(db, async () => {
    const likes = await db
      .prepare(
        "SELECT COUNT(*) AS c FROM reactions WHERE post_id = ? AND kind = 'like'"
      )
      .bind(postId)
      .first<{ c: number }>();
    const dislikes = await db
      .prepare(
        "SELECT COUNT(*) AS c FROM reactions WHERE post_id = ? AND kind = 'dislike'"
      )
      .bind(postId)
      .first<{ c: number }>();
    return { like: likes?.c || 0, dislike: dislikes?.c || 0 };
  });
}

export async function getUserReaction(
  db: D1Database,
  postId: number,
  userId: number
): Promise<"like" | "dislike" | null> {
  return withForeignKeys(db, async () => {
    const row = await db
      .prepare(
        "SELECT kind FROM reactions WHERE post_id = ? AND user_id = ?"
      )
      .bind(postId, userId)
      .first<{ kind: "like" | "dislike" }>();
    return row?.kind || null;
  });
}

export async function toggleReaction(
  db: D1Database,
  postId: number,
  userId: number,
  kind: "like" | "dislike"
): Promise<"like" | "dislike" | null> {
  return withForeignKeys(db, async () => {
    const existing = await getUserReaction(db, postId, userId);
    if (existing === kind) {
      await db
        .prepare("DELETE FROM reactions WHERE post_id = ? AND user_id = ?")
        .bind(postId, userId)
        .run();
      return null;
    }
    if (existing) {
      await db
        .prepare(
          "UPDATE reactions SET kind = ? WHERE post_id = ? AND user_id = ?"
        )
        .bind(kind, postId, userId)
        .run();
    } else {
      await db
        .prepare(
          "INSERT INTO reactions (post_id, user_id, kind) VALUES (?, ?, ?)"
        )
        .bind(postId, userId, kind)
        .run();
    }
    return kind;
  });
}

export async function emailExists(
  db: D1Database,
  email: string
): Promise<boolean> {
  return withForeignKeys(db, async () => {
    const row = await db
      .prepare("SELECT id FROM users WHERE email = ?")
      .bind(email.toLowerCase())
      .first();
    return !!row;
  });
}

export async function usernameExists(
  db: D1Database,
  username: string
): Promise<boolean> {
  return withForeignKeys(db, async () => {
    const row = await db
      .prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE")
      .bind(username)
      .first();
    return !!row;
  });
}
