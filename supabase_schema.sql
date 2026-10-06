-- ==========================================================
-- NEO-MANHWA PLATFORM DATABASE SCHEMA (POSTGRESQL / SUPABASE)
-- Fully compliant with specification.MD, Types, and RBAC matrix
-- Run this script in PostgreSQL (psql, pgAdmin, Supabase SQL Editor, DBeaver)
-- ==========================================================

-- ----------------------------------------------------------
-- 0. CLEANUP (OPTIONAL: Drop existing objects in reverse order)
-- ----------------------------------------------------------
DROP TABLE IF EXISTS contributor_drafts CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS comment_votes CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS user_library CASCADE;
DROP TABLE IF EXISTS manhwa CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP TYPE IF EXISTS draft_status CASCADE;
DROP TYPE IF EXISTS vote_type CASCADE;
DROP TYPE IF EXISTS report_status CASCADE;
DROP TYPE IF EXISTS report_reason CASCADE;
DROP TYPE IF EXISTS report_target CASCADE;
DROP TYPE IF EXISTS library_status CASCADE;
DROP TYPE IF EXISTS manhwa_status CASCADE;
DROP TYPE IF EXISTS manhwa_format CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

-- ----------------------------------------------------------
-- 1. EXTENSIONS
-- ----------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------
-- 2. ENUM TYPES
-- ----------------------------------------------------------
CREATE TYPE user_role AS ENUM ('guest', 'user', 'contributor', 'moderator', 'admin');
CREATE TYPE manhwa_format AS ENUM ('manhwa', 'manhua', 'manga');
CREATE TYPE manhwa_status AS ENUM ('ongoing', 'completed', 'hiatus');
CREATE TYPE library_status AS ENUM ('reading', 'plan_to_read', 'completed', 'on_hold', 'dropped');
CREATE TYPE report_target AS ENUM ('comment', 'user', 'manhwa');
CREATE TYPE report_reason AS ENUM ('spam', 'harassment', 'spoilers', 'incorrect_data', 'other');
CREATE TYPE report_status AS ENUM ('pending', 'resolved', 'dismissed');
CREATE TYPE draft_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE vote_type AS ENUM ('up', 'down');

-- ----------------------------------------------------------
-- 3. USERS TABLE
-- ----------------------------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    role user_role NOT NULL DEFAULT 'user',
    strike_count INT NOT NULL DEFAULT 0,
    mute_expires_at TIMESTAMPTZ,
    is_banned BOOLEAN NOT NULL DEFAULT FALSE,
    ban_expires_at TIMESTAMPTZ,
    deletion_requested BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- ----------------------------------------------------------
-- 4. MANHWA TABLE
-- ----------------------------------------------------------
CREATE TABLE manhwa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    alternative_titles JSONB NOT NULL DEFAULT '{"hangul": null, "romanized": null, "english": []}'::jsonb,
    synopsis TEXT NOT NULL,
    authors TEXT[] NOT NULL DEFAULT '{}',
    artists TEXT[] NOT NULL DEFAULT '{}',
    cover_image_url TEXT NOT NULL,
    banner_image_url TEXT,
    format manhwa_format NOT NULL DEFAULT 'manhwa',
    status manhwa_status NOT NULL DEFAULT 'ongoing',
    genres TEXT[] NOT NULL DEFAULT '{}',
    tropes TEXT[] NOT NULL DEFAULT '{}',
    release_year INT NOT NULL,
    total_chapters INT NOT NULL DEFAULT 0,
    official_links JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    rating_avg NUMERIC(3, 2) NOT NULL DEFAULT 0.00,
    rating_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- ----------------------------------------------------------
-- 5. USER LIBRARY & TRACKING
-- ----------------------------------------------------------
CREATE TABLE user_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    manhwa_id UUID NOT NULL REFERENCES manhwa(id) ON DELETE CASCADE,
    status library_status NOT NULL DEFAULT 'reading',
    current_chapter INT NOT NULL DEFAULT 0,
    score INT CHECK (score IS NULL OR (score >= 1 AND score <= 5)),
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, manhwa_id)
);

-- ----------------------------------------------------------
-- 6. COMMENTS (Supports 1-Level Nested Replies & Spoiler Masks)
-- ----------------------------------------------------------
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manhwa_id UUID NOT NULL REFERENCES manhwa(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_spoiler BOOLEAN NOT NULL DEFAULT FALSE,
    upvotes INT NOT NULL DEFAULT 0,
    downvotes INT NOT NULL DEFAULT 0,
    is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- ----------------------------------------------------------
-- 7. COMMENT VOTES
-- ----------------------------------------------------------
CREATE TABLE comment_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote vote_type NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(comment_id, user_id)
);

-- ----------------------------------------------------------
-- 8. MODERATION REPORTS
-- ----------------------------------------------------------
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type report_target NOT NULL,
    target_id UUID NOT NULL,
    target_preview TEXT NOT NULL DEFAULT '',
    reason report_reason NOT NULL,
    details TEXT NOT NULL,
    status report_status NOT NULL DEFAULT 'pending',
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- ----------------------------------------------------------
-- 9. CONTRIBUTOR DRAFTS (Draft & Moderation Pipeline)
-- ----------------------------------------------------------
CREATE TABLE contributor_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contributor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    hangul VARCHAR(255) NOT NULL DEFAULT '',
    format manhwa_format NOT NULL DEFAULT 'manhwa',
    status manhwa_status NOT NULL DEFAULT 'ongoing',
    synopsis TEXT NOT NULL,
    genres TEXT[] NOT NULL DEFAULT '{}',
    total_chapters INT NOT NULL DEFAULT 0,
    submission_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    moderation_status draft_status NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ
);

-- ----------------------------------------------------------
-- 10. TAMPER-EVIDENT AUDIT LOGS
-- ----------------------------------------------------------
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_role user_role NOT NULL,
    action VARCHAR(100) NOT NULL,
    target_entity VARCHAR(100) NOT NULL,
    target_id VARCHAR(100) NOT NULL,
    changes JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------
-- 11. INDEXES FOR HIGH-THROUGHPUT SEARCH & QUERIES
-- ----------------------------------------------------------
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_manhwa_title ON manhwa(title);
CREATE INDEX idx_manhwa_format ON manhwa(format);
CREATE INDEX idx_manhwa_status ON manhwa(status);
CREATE INDEX idx_manhwa_published ON manhwa(is_published);
CREATE INDEX idx_manhwa_genres ON manhwa USING GIN(genres);
CREATE INDEX idx_user_library_user ON user_library(user_id);
CREATE INDEX idx_user_library_manhwa ON user_library(manhwa_id);
CREATE INDEX idx_comments_manhwa ON comments(manhwa_id);
CREATE INDEX idx_comments_parent ON comments(parent_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_drafts_status ON contributor_drafts(moderation_status);

-- ----------------------------------------------------------
-- 12. HELPER FUNCTIONS & TRIGGERS
-- ----------------------------------------------------------

-- Automatic timestamp updater
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_manhwa_updated_at
BEFORE UPDATE ON manhwa
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_library_updated_at
BEFORE UPDATE ON user_library
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at
BEFORE UPDATE ON comments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Automatic calculation of average ratings on manhwa
CREATE OR REPLACE FUNCTION recalculate_manhwa_rating()
RETURNS TRIGGER AS $$
DECLARE
    target_mid UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        target_mid := OLD.manhwa_id;
    ELSE
        target_mid := NEW.manhwa_id;
    END IF;

    UPDATE manhwa
    SET 
        rating_avg = COALESCE((SELECT ROUND(AVG(score)::numeric, 2) FROM user_library WHERE manhwa_id = target_mid AND score IS NOT NULL), 0.00),
        rating_count = (SELECT COUNT(*) FROM user_library WHERE manhwa_id = target_mid AND score IS NOT NULL)
    WHERE id = target_mid;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_recalculate_manhwa_rating
AFTER INSERT OR UPDATE OF score OR DELETE ON user_library
FOR EACH ROW EXECUTE FUNCTION recalculate_manhwa_rating();

-- ==========================================================
-- 13. SEED DATA (Fully populates all users, manhwas, & mock items)
-- ==========================================================

-- 1. Insert Initial Users
INSERT INTO users (id, username, email, password_hash, avatar_url, role) VALUES
('a0000000-0000-0000-0000-000000000001', 'Overlord_Admin', 'admin@neomanhwa.internal', '$2a$12$eX4mpleH4shAdminSecretKey...', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&q=80', 'admin'),
('b0000000-0000-0000-0000-000000000002', 'Gatekeeper_Mod', 'mod@neomanhwa.org', '$2a$12$eX4mpleH4shModSecretKey...', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&q=80', 'moderator'),
('c0000000-0000-0000-0000-000000000003', 'SeoulScribe', 'scribe@neomanhwa.org', '$2a$12$eX4mpleH4shContributorKey...', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&q=80', 'contributor'),
('d0000000-0000-0000-0000-000000000004', 'ShadowMonarch', 'jinwoo@hunter.kr', '$2a$12$eX4mpleH4shUserSecretKey...', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&q=80', 'user'),
('d0000000-0000-0000-0000-000000000005', 'DungeonRunner', 'runner@dungeon.kr', '$2a$12$eX4mpleH4shUserSecretKey...', NULL, 'user');

-- 2. Insert Full Manhwa Collection
INSERT INTO manhwa (id, title, alternative_titles, synopsis, authors, artists, cover_image_url, banner_image_url, format, status, genres, tropes, release_year, total_chapters, official_links, is_published, rating_avg, rating_count) VALUES
(
    '10000000-0000-0000-0000-000000000001',
    'Solo Leveling: Ragnarok',
    '{"hangul": "나 혼자만 레벨업 : 라그나로크", "romanized": "Na Honjaman Rebeleop : Rageunarokeu", "english": ["Only I Level Up: Ragnarok", "Solo Leveling Sequel"]}'::jsonb,
    'Earth faced its greatest catastrophe with the advent of dimensional gates. After the Absolute Beings fell, Suho, son of the Shadow Monarch Sung Jin-woo, awakens in an apocalyptic world where the outer gods seek to consume reality itself.',
    ARRAY['Daul', 'Chugong'],
    ARRAY['Redice Studio'],
    'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&q=85',
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1400&q=80',
    'manhwa',
    'ongoing',
    ARRAY['Action', 'Fantasy', 'Supernatural', 'Dungeon'],
    ARRAY['System Awakening', 'Monarch Bloodline', 'Shadow Necromancy', 'Level Up'],
    2024,
    58,
    '[{"platform": "KakaoPage", "url": "https://page.kakao.com"}, {"platform": "Tapas", "url": "https://tapas.io"}]'::jsonb,
    TRUE,
    4.88,
    1420
),
(
    '20000000-0000-0000-0000-000000000002',
    'Omniscient Reader''s Viewpoint',
    '{"hangul": "전지적 독자 시점", "romanized": "Jeonjijeok Dokja Sijeom", "english": ["ORV", "Omniscient Reader"]}'::jsonb,
    'Dokja was an ordinary office worker whose sole hobby was reading his favorite web novel "Three Ways to Survive the Apocalypse". When the novel suddenly manifests into real life, Dokja is the only human who knows how the world will end.',
    ARRAY['sing N song'],
    ARRAY['Sleepy-C', 'Redice Studio'],
    'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&q=85',
    'https://images.unsplash.com/photo-1511447333015-45b65e60f6d5?w=1400&q=80',
    'manhwa',
    'ongoing',
    ARRAY['Action', 'Fantasy', 'Psychological', 'Sci-Fi'],
    ARRAY['Constellations', 'Scenario Quests', 'Prophetic Knowledge', 'Sacrificial Protagonist'],
    2020,
    228,
    '[{"platform": "Naver Webtoon", "url": "https://comic.naver.com"}, {"platform": "WEBTOON English", "url": "https://webtoons.com"}]'::jsonb,
    TRUE,
    4.96,
    3890
),
(
    '30000000-0000-0000-0000-000000000003',
    'The Greatest Estate Developer',
    '{"hangul": "역대급 영지 설계사", "romanized": "Yeokdaegeup Yeongji Seolgyesa", "english": ["The World''s Best Engineer"]}'::jsonb,
    'Civil engineering student Kim Suho wakes up inside the body of Lloyd Frontera, an indebted, infamous drunkard noble destined for ruin. Armed with high-tier modern civil engineering knowledge, he transforms the territory with sheer mathematical audacity.',
    ARRAY['BK_Moon', 'Lee hyunmin'],
    ARRAY['Kim Hyunsoo'],
    'https://images.unsplash.com/photo-1563089145-599997674d42?w=600&q=85',
    NULL,
    'manhwa',
    'ongoing',
    ARRAY['Comedy', 'Fantasy', 'Adventure'],
    ARRAY['Transmigration', 'Scheming Genius', 'Engineering Magic', 'Face Faults'],
    2021,
    164,
    '[{"platform": "Naver Webtoon", "url": "https://comic.naver.com"}]'::jsonb,
    TRUE,
    4.92,
    2410
),
(
    '40000000-0000-0000-0000-000000000004',
    'Return of the Mount Hua Sect',
    '{"hangul": "화산귀환", "romanized": "Hwasangwihwan", "english": ["Return of the Blossoming Blade"]}'::jsonb,
    'Cheongmyeong, the 13th Disciple of the Great Mount Hua Sect and one of the Three Great Swordsmen, defeated the Heavenly Demon at the summit of Hundred Thousand Mountains. He awakens a century later in the body of a beggar child to find his beloved sect collapsed.',
    ARRAY['Biga'],
    ARRAY['LICO'],
    'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&q=85',
    NULL,
    'manhwa',
    'ongoing',
    ARRAY['Martial Arts', 'Murim', 'Action', 'Comedy'],
    ARRAY['Reincarnation', 'Grandmaster Reborn', 'Plum Blossom Sword', 'Sect Restoration'],
    2021,
    148,
    '[{"platform": "Naver Webtoon", "url": "https://comic.naver.com"}]'::jsonb,
    TRUE,
    4.95,
    3100
),
(
    '50000000-0000-0000-0000-000000000005',
    'S-Classes That I Raised',
    '{"hangul": "내가 키운 S급들", "romanized": "Naega Kiun S-Geupdeul", "english": ["My S-Class Hunters"]}'::jsonb,
    'Han Yoojin is an F-Class hunter whose younger brother is an unrivaled S-Class. After a disastrous dungeon dive sacrifices his brother, Yoojin regresses with the title "Perfect Caregiver" to nurture monsters and supreme awakeners alike.',
    ARRAY['Geunseo'],
    ARRAY['seri', 'biwan'],
    'https://images.unsplash.com/photo-1514539079130-25950c84af65?w=600&q=85',
    NULL,
    'manhwa',
    'ongoing',
    ARRAY['Action', 'Fantasy', 'Drama'],
    ARRAY['Regression', 'Beast Tamer', 'Hunter Guilds', 'Brotherhood'],
    2021,
    130,
    '[{"platform": "Naver Webtoon", "url": "https://comic.naver.com"}]'::jsonb,
    TRUE,
    4.75,
    1890
),
(
    '60000000-0000-0000-0000-000000000006',
    'Nano Machine',
    '{"hangul": "나노마신", "romanized": "Nanomasin", "english": []}'::jsonb,
    'Cheon Yeo-woon, an illegitimate son of the Demonic Cult Lord, lives with constant assassination attempts. A mysterious descendant from the distant future injects seventh-generation Nanomachines into his bloodstream.',
    ARRAY['Hanjung Wolya'],
    ARRAY['Geum Gangbulgoe', 'Redice Studio'],
    'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=600&q=85',
    NULL,
    'manhwa',
    'ongoing',
    ARRAY['Murim', 'Sci-Fi', 'Action', 'Revenge'],
    ARRAY['Nanotech Cultivation', 'Ruthless MC', 'Demonic Cult', 'Sword Qi Simulation'],
    2020,
    212,
    '[{"platform": "Naver Webtoon", "url": "https://comic.naver.com"}]'::jsonb,
    TRUE,
    4.82,
    2740
),
(
    '70000000-0000-0000-0000-000000000007',
    'Tales of Demons and Gods',
    '{"hangul": "요신기", "romanized": "Yaoshenji", "english": ["TDG"]}'::jsonb,
    'Killed by the Sage Emperor and reborn as his 13-year-old self, Nie Li was given a second chance at life. Reincarnated with vast ancient knowledge and the Demon Spirit Book, he sets out to protect Glory City.',
    ARRAY['Mad Snail'],
    ARRAY['Jiang Ruotai'],
    'https://images.unsplash.com/photo-1569701813229-33284b643e3c?w=600&q=85',
    NULL,
    'manhua',
    'ongoing',
    ARRAY['Action', 'Fantasy', 'Adventure'],
    ARRAY['Reincarnation', 'Demon Spirits', 'Cultivation Clans'],
    2015,
    480,
    '[]'::jsonb,
    TRUE,
    4.62,
    1540
),
(
    '80000000-0000-0000-0000-000000000008',
    'Chainsaw Man',
    '{"hangul": "체인소 맨", "romanized": "Che-in-so Maen", "english": []}'::jsonb,
    'Denji is a teenage boy living with a Chainsaw Devil named Pochita. Due to the debt his father left behind, he has been living a rock-bottom life while harvesting devil corpses with Pochita.',
    ARRAY['Tatsuki Fujimoto'],
    ARRAY['Tatsuki Fujimoto'],
    'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600&q=85',
    NULL,
    'manga',
    'ongoing',
    ARRAY['Action', 'Horror', 'Supernatural'],
    ARRAY['Devil Contracts', 'Dark Urban Fantasy', 'Chaos'],
    2018,
    178,
    '[{"platform": "Shonen Jump", "url": "https://mangaplus.shueisha.co.jp"}]'::jsonb,
    TRUE,
    4.90,
    4500
);

-- 3. Insert User Library Entries
INSERT INTO user_library (id, user_id, manhwa_id, status, current_chapter, score, is_favorite) VALUES
('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'reading', 54, 5, TRUE),
('f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', 'reading', 215, 5, TRUE),
('f0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000003', 'completed', 164, 5, FALSE),
('f0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000004', 'on_hold', 89, 4, FALSE);

-- 4. Insert Comments
INSERT INTO comments (id, manhwa_id, user_id, parent_id, content, is_spoiler, upvotes, downvotes, is_hidden) VALUES
('e0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', NULL, 'Suho wielding both the monarch aura and the dual daggers in chapter 52 was peak cinema. Redice studio never misses with the lighting on shadow extraction!', FALSE, 42, 1, FALSE),
('e0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'Agreed, and notice how they adapted the light novel chapter 88 slightly differently to pace the outer god lore better for webtoon readers.', FALSE, 15, 0, FALSE),
('e0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000005', NULL, 'MAJOR SPOILER: Beware, the Grand Priest of the Itarim turns out to be an undercover vessel of the Absolute Being!', TRUE, 8, 14, FALSE),
('e0000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', NULL, 'The 73rd Demon King arc adaptation is unmatched. Kim Dokja’s sacrifice sequence emotionally wrecked me. Five stars without hesitation.', TRUE, 89, 2, FALSE),
('e0000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000004', NULL, 'Lloyd’s facial expressions alone carry this series to legendary status. Javier’s silent suffering next to him is comedy gold.', FALSE, 114, 0, FALSE);

-- 5. Insert Moderation Reports
INSERT INTO reports (id, reporter_id, target_type, target_id, target_preview, reason, details, status) VALUES
('90000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'comment', 'e0000000-0000-0000-0000-000000000003', 'MAJOR SPOILER: Beware, the Grand Priest of the Itarim turns out...', 'spoilers', 'User posted an untagged ending spoiler in early chapter discussion thread.', 'pending'),
('90000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000005', 'manhwa', '30000000-0000-0000-0000-000000000003', 'The Greatest Estate Developer', 'incorrect_data', 'Release year listed as 2021, but web novel adaptation began late 2020.', 'pending');

-- 6. Insert Contributor Drafts
INSERT INTO contributor_drafts (id, contributor_id, title, hangul, format, status, synopsis, genres, total_chapters, moderation_status) VALUES
('80000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'Murim Login', '로그인 무림', 'manhwa', 'ongoing', 'Jin Taekyung is a low-rank hunter in a monster-infested Seoul who accidentally discovers a hyper-realistic VR capsule that connects him directly into a brutal Murim realm.', ARRAY['Murim', 'Action', 'Comedy', 'Level Up'], 190, 'pending');

-- 7. Insert Audit Logs
INSERT INTO audit_logs (id, actor_id, actor_role, action, target_entity, target_id, changes, ip_address, timestamp) VALUES
('70000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'admin', 'ROLE_PROMOTION', 'User', 'b0000000-0000-0000-0000-000000000002', '{"role": {"old": "contributor", "new": "moderator"}}'::jsonb, '192.168.1.100', '2026-10-01 08:14:22+00'),
('70000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'moderator', 'COMMENT_FLAG_HIDE', 'Comment', 'e0000000-0000-0000-0000-000000000003', '{"is_hidden": {"old": false, "new": true}}'::jsonb, '192.168.1.144', '2026-10-02 11:45:10+00'),
('70000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'admin', 'MANHWA_METADATA_UPDATE', 'Manhwa', '10000000-0000-0000-0000-000000000001', '{"total_chapters": {"old": 56, "new": 58}}'::jsonb, '192.168.1.100', '2026-10-03 09:00:00+00');

-- ==========================================================
-- 14. ROW LEVEL SECURITY (RLS) & API SECURITY
-- ==========================================================

-- Enable RLS on all public tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE manhwa ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributor_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Manhwa: Anyone can read, only Admins can write
CREATE POLICY "Public manhwa are viewable by everyone" ON manhwa FOR SELECT USING (is_published = true);
CREATE POLICY "Admins can manage manhwa" ON manhwa FOR ALL USING (
  (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
);

-- Users: Anyone can view profiles, users update their own, Admins manage all
CREATE POLICY "Public user profiles are viewable by everyone" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile (except role)" ON users FOR UPDATE USING (auth.uid() = id) WITH CHECK (role = (SELECT role FROM users WHERE id = auth.uid()));
CREATE POLICY "Admins can manage all users" ON users FOR ALL USING (
  (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
);

-- Comments: Anyone can read, users create, authors/mods/admins manage
CREATE POLICY "Comments are viewable by everyone" ON comments FOR SELECT USING (true);
CREATE POLICY "Users can insert comments" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can edit their own comments" ON comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Moderators and Admins can manage comments" ON comments FOR UPDATE USING (
  (SELECT role FROM users WHERE id = auth.uid()) IN ('moderator', 'admin')
);
CREATE POLICY "Only admins can hard delete comments" ON comments FOR DELETE USING (
  (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
);

