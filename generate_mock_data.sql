-- ==========================================================
-- NEO-MANHWA: 100+ MOCK DATA GENERATOR
-- Run this script in your Supabase SQL Editor to instantly
-- generate 100 diverse users, 300 comments, and library data!
-- ==========================================================

DO $$
DECLARE
    i INT;
    new_user_id UUID;
    manhwa_ids UUID[];
    user_ids UUID[];
    target_manhwa UUID;
    target_user UUID;
    new_comment_id UUID;
    random_role TEXT;
    
    -- Arrays of fake data for realism
    first_names TEXT[] := ARRAY['Jinwoo', 'Dokja', 'Baam', 'Mori', 'Arthur', 'Tessia', 'Yoo', 'Cha', 'Haein', 'Igris', 'Beru', 'Shadow', 'Iron', 'Tank', 'Kaisel'];
    last_names TEXT[] := ARRAY['Sung', 'Kim', 'Lee', 'Park', 'Choi', 'Jeong', 'Kang', 'Jo', 'Yoon', 'Jang', 'Lim', 'Han', 'Oh', 'Seo', 'Shin'];
    comments_text TEXT[] := ARRAY[
        'This chapter was absolutely insane! The art is top tier.',
        'I cant believe it ended on a cliffhanger again...',
        'The character development here is so good.',
        'Does anyone know when the next chapter drops?',
        'I read the light novel, and trust me, it gets even better.',
        'The pacing feels a bit slow right now, but I still love it.',
        'Masterpiece. 10/10.',
        'Im re-reading this for the 3rd time.',
        'The villain is actually making sense right now.',
        'This is exactly why this is my favorite manhwa.'
    ];
    statuses TEXT[] := ARRAY['reading', 'completed', 'on_hold', 'plan_to_read', 'dropped'];
    
BEGIN
    ---------------------------------------------------------
    -- 1. GENERATE 100 USERS
    ---------------------------------------------------------
    FOR i IN 1..100 LOOP
        new_user_id := gen_random_uuid();
        
        -- Determine role (5 Mods, 15 Contributors, 80 Users)
        IF i <= 5 THEN
            random_role := 'moderator';
        ELSIF i <= 20 THEN
            random_role := 'contributor';
        ELSE
            random_role := 'user';
        END IF;

        INSERT INTO public.users (id, username, email, password_hash, avatar_url, role)
        VALUES (
            new_user_id,
            -- Random username e.g. "ShadowKim_42"
            first_names[ceil(random() * array_length(first_names, 1))] || 
            last_names[ceil(random() * array_length(last_names, 1))] || '_' || floor(random() * 9999)::text,
            
            -- Unique email
            'user_test_' || i || '_' || substr(md5(random()::text), 1, 5) || '@neomanhwa.test',
            
            -- Fake password hash
            '$2a$12$eX4mpleH4shUserSecretKey...',
            
            -- Random avatar
            'https://i.pravatar.cc/150?u=' || new_user_id::text,
            
            random_role::user_role
        );
    END LOOP;

    ---------------------------------------------------------
    -- 2. FETCH EXISTING IDS
    ---------------------------------------------------------
    SELECT array_agg(id) INTO manhwa_ids FROM public.manhwa;
    SELECT array_agg(id) INTO user_ids FROM public.users WHERE email LIKE '%@neomanhwa.test%';

    ---------------------------------------------------------
    -- 3. GENERATE 300 REALISTIC COMMENTS
    ---------------------------------------------------------
    IF array_length(manhwa_ids, 1) > 0 AND array_length(user_ids, 1) > 0 THEN
        FOR i IN 1..300 LOOP
            target_manhwa := manhwa_ids[ceil(random() * array_length(manhwa_ids, 1))];
            target_user := user_ids[ceil(random() * array_length(user_ids, 1))];
            
            INSERT INTO public.comments (id, manhwa_id, user_id, content)
            VALUES (
                gen_random_uuid(),
                target_manhwa,
                target_user,
                comments_text[ceil(random() * array_length(comments_text, 1))]
            );
        END LOOP;
    END IF;

    ---------------------------------------------------------
    -- 4. GENERATE 500 USER LIBRARY ENTRIES (Reading lists)
    ---------------------------------------------------------
    IF array_length(manhwa_ids, 1) > 0 AND array_length(user_ids, 1) > 0 THEN
        FOR i IN 1..500 LOOP
            target_manhwa := manhwa_ids[ceil(random() * array_length(manhwa_ids, 1))];
            target_user := user_ids[ceil(random() * array_length(user_ids, 1))];
            
            -- Use ON CONFLICT DO NOTHING in case the same user gets the same manhwa twice
            INSERT INTO public.user_library (user_id, manhwa_id, status, current_chapter, score)
            VALUES (
                target_user,
                target_manhwa,
                statuses[ceil(random() * array_length(statuses, 1))]::library_status,
                floor(random() * 50)::INT,
                CASE WHEN random() > 0.5 THEN floor(random() * 5 + 1)::INT ELSE NULL END
            )
            ON CONFLICT (user_id, manhwa_id) DO NOTHING;
        END LOOP;
    END IF;

END $$;
