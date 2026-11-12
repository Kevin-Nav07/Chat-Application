-- =============================================================================
-- Schema Definition for Ember Chat Application Database
-- Recreates all tables, enums, relationships, and performance indexes
-- =============================================================================

-- 1. Custom Enum for Friendship State
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'friendship_status') THEN
        CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'blocked');
    END IF;
END $$;

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    passwordhash VARCHAR(255) NOT NULL
);

-- 3. Refresh Tokens Table (stores hashed rotation tokens for authentication)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    tokenhash TEXT NOT NULL,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expiration TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Friendships Table (bidirectional request tracking)
CREATE TABLE IF NOT EXISTS friendships (
    id SERIAL PRIMARY KEY,
    sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status friendship_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_friendship UNIQUE (sender_id, receiver_id)
);

-- 5. Rooms Table (direct message conversations or group chats)
CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    room_type VARCHAR(50) NOT NULL, -- 'direct' or 'group'
    name VARCHAR(100), -- room title (optional for direct messages)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Room Members Junction Table (maps enrolled users to rooms)
CREATE TABLE IF NOT EXISTS room_members (
    room_id INT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_message_id INT, -- tracks read horizon for unread markers
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (room_id, user_id)
);

-- 7. Messages Table (chronological message records)
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    room_id INT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- sender ID
    content TEXT NOT NULL, -- message body text
    message_type VARCHAR(50) NOT NULL DEFAULT 'text', -- 'text' or future media types
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for Query Performance and Cursor Pagination
CREATE INDEX IF NOT EXISTS idx_messages_room_order 
    ON messages(room_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_room_members_user 
    ON room_members(user_id);

CREATE INDEX IF NOT EXISTS idx_friendships_lookup 
    ON friendships(sender_id, receiver_id);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
    ON refresh_tokens(user_id);

-- 8. Row Level Security (RLS)
-- Supabase automatically offers a public REST API (PostgREST) for every table in the public schema. Anyone holding
-- the project's anon or publishable key could use it to read or change these tables, password hashes included.
-- Turning RLS on with NO policies makes that API return nothing for those keys.
-- The Node server is unaffected: it connects as the role that owns these tables, and owners skip RLS
-- (unless FORCE ROW LEVEL SECURITY is used, which it is not). Safe to run more than once.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

