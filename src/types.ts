export interface Env {
  DB: D1Database;
  SECRET_KEY?: string;
  DISABLE_CSRF?: string;
  ASSETS: Fetcher;
}

export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface Post {
  id: number;
  author_id: number;
  title: string;
  body: string;
  created_at: string;
  updated_at: string | null;
  author?: string;
}

export interface Comment {
  id: number;
  post_id: number;
  user_id: number;
  body: string;
  created_at: string;
  author?: string;
}

export interface ReactionCounts {
  like: number;
  dislike: number;
}

export type AppVariables = {
  userId: number | null;
  username: string | null;
  csrfToken: string;
  csrfEnabled: boolean;
  csrfCookie: string | null;
  secure: boolean;
};
