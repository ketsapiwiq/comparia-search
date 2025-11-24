-- Initialize PostgreSQL database with vector and full-text search extensions
-- This script runs automatically when the container starts

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create conversations table with vector and full-text search capabilities
CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    timestamp BIGINT NOT NULL,
    model_a_name TEXT NOT NULL,
    model_b_name TEXT NOT NULL,
    conversation_a JSONB NOT NULL,
    conversation_b JSONB NOT NULL,
    conv_turns INTEGER NOT NULL,
    system_prompt_a TEXT,
    system_prompt_b TEXT,
    conversation_pair_id TEXT NOT NULL,
    conv_a_id TEXT NOT NULL,
    conv_b_id TEXT NOT NULL,
    session_hash TEXT NOT NULL,
    visitor_id TEXT,
    ip TEXT,
    model_pair_name TEXT NOT NULL,
    opening_msg TEXT NOT NULL,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    mode TEXT,
    custom_models_selection JSONB,
    short_summary TEXT,
    keywords TEXT[],
    categories TEXT[],
    languages TEXT[],
    pii_analyzed BOOLEAN NOT NULL DEFAULT FALSE,
    contains_pii BOOLEAN,
    total_conv_a_output_tokens INTEGER,
    total_conv_b_output_tokens INTEGER,
    ip_map TEXT,
    postprocess_failed BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Vector fields for embedding search (mxbai-large = 1024 dimensions)
    summary_embedding vector(1024),
    content_embedding vector(1024),
    
    -- Full-text search field
    search_content TEXT,
    
    -- Timestamps for tracking
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp);
CREATE INDEX IF NOT EXISTS idx_conversations_model_a ON conversations(model_a_name);
CREATE INDEX IF NOT EXISTS idx_conversations_model_b ON conversations(model_b_name);
CREATE INDEX IF NOT EXISTS idx_conversations_categories ON conversations USING GIN(categories);
CREATE INDEX IF NOT EXISTS idx_conversations_keywords ON conversations USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_conversations_languages ON conversations USING GIN(languages);

-- Vector similarity indexes (IVFFlat for approximate nearest neighbor)
CREATE INDEX IF NOT EXISTS idx_conversations_summary_embedding 
    ON conversations USING ivfflat (summary_embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_conversations_content_embedding 
    ON conversations USING ivfflat (content_embedding vector_cosine_ops)
    WITH (lists = 100);

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_conversations_search_content_gin 
    ON conversations USING GIN(to_tsvector('english', search_content));

CREATE INDEX IF NOT EXISTS idx_conversations_search_content_trgm 
    ON conversations USING GIN(search_content gin_trgm_ops);

-- Function to update search_content and timestamps
CREATE OR REPLACE FUNCTION update_conversation_search_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Update search_content with all searchable text
    NEW.search_content := COALESCE(NEW.short_summary, '') || ' ' ||
        array_to_string(COALESCE(NEW.keywords, '{}'), ' ') || ' ' ||
        array_to_string(COALESCE(NEW.categories, '{}'), ' ') || ' ' ||
        COALESCE(NEW.opening_msg, '') || ' ' ||
        COALESCE(NEW.model_a_name, '') || ' ' ||
        COALESCE(NEW.model_b_name, '') || ' ' ||
        -- Extract content from conversations
        COALESCE(
            (SELECT string_agg(content, ' ') 
             FROM jsonb_array_elements(NEW.conversation_a) 
             WHERE content->>'role' = 'assistant'), ''
        ) || ' ' ||
        COALESCE(
            (SELECT string_agg(content, ' ') 
             FROM jsonb_array_elements(NEW.conversation_b) 
             WHERE content->>'role' = 'assistant'), ''
        );
    
    -- Update timestamp
    NEW.updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update search fields
DROP TRIGGER IF EXISTS update_conversation_search_trigger ON conversations;
CREATE TRIGGER update_conversation_search_trigger
    BEFORE INSERT OR UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_conversation_search_fields();

-- Function for hybrid search (combines vector and full-text search)
CREATE OR REPLACE FUNCTION hybrid_search(
    query_text TEXT,
    query_embedding vector(1024),
    limit_value INTEGER DEFAULT 20,
    offset_value INTEGER DEFAULT 0,
    vector_weight FLOAT DEFAULT 0.7,
    fulltext_weight FLOAT DEFAULT 0.3
)
RETURNS TABLE (
    id INTEGER,
    timestamp BIGINT,
    model_a_name TEXT,
    model_b_name TEXT,
    short_summary TEXT,
    keywords TEXT[],
    categories TEXT[],
    languages TEXT[],
    score FLOAT,
    vector_score FLOAT,
    fulltext_score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    WITH 
    -- Vector similarity search
    vector_results AS (
        SELECT 
            id,
            (1 - (summary_embedding <=> query_embedding)) as vector_similarity
        FROM conversations 
        WHERE summary_embedding IS NOT NULL
        ORDER BY summary_embedding <=> query_embedding
        LIMIT limit_value * 3 -- Get more candidates for better hybrid results
    ),
    -- Full-text search
    fulltext_results AS (
        SELECT 
            id,
            ts_rank(to_tsvector('english', search_content), plainto_tsquery('english', query_text)) as ft_rank
        FROM conversations 
        WHERE to_tsvector('english', search_content) @@ plainto_tsquery('english', query_text)
        ORDER BY ft_rank DESC
        LIMIT limit_value * 3
    ),
    -- Combine and normalize scores
    combined_results AS (
        SELECT 
            COALESCE(v.id, f.id) as id,
            COALESCE(v.vector_similarity, 0) as vector_score,
            COALESCE(f.ft_rank, 0) as fulltext_score,
            CASE 
                WHEN v.id IS NOT NULL AND f.id IS NOT NULL THEN 
                    (v.vector_similarity * vector_weight + f.ft_rank * fulltext_weight)
                WHEN v.id IS NOT NULL THEN v.vector_similarity * vector_weight
                ELSE f.ft_rank * fulltext_weight
            END as combined_score
        FROM vector_results v
        FULL OUTER JOIN fulltext_results f ON v.id = f.id
        WHERE (v.vector_similarity > 0.3 OR f.ft_rank > 0.1) -- Minimum relevance thresholds
    )
    SELECT 
        c.id,
        c.timestamp,
        c.model_a_name,
        c.model_b_name,
        c.short_summary,
        c.keywords,
        c.categories,
        c.languages,
        cr.combined_score as score,
        cr.vector_score,
        cr.fulltext_score
    FROM combined_results cr
    JOIN conversations c ON cr.id = c.id
    ORDER BY cr.combined_score DESC
    LIMIT limit_value
    OFFSET offset_value;
END;
$$ LANGUAGE plpgsql;

-- Function for pure vector search
CREATE OR REPLACE FUNCTION vector_search(
    query_embedding vector(1024),
    limit_value INTEGER DEFAULT 20,
    offset_value INTEGER DEFAULT 0,
    similarity_threshold FLOAT DEFAULT 0.3
)
RETURNS TABLE (
    id INTEGER,
    timestamp BIGINT,
    model_a_name TEXT,
    model_b_name TEXT,
    short_summary TEXT,
    keywords TEXT[],
    categories TEXT[],
    languages TEXT[],
    score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.timestamp,
        c.model_a_name,
        c.model_b_name,
        c.short_summary,
        c.keywords,
        c.categories,
        c.languages,
        (1 - (c.summary_embedding <=> query_embedding)) as score
    FROM conversations c
    WHERE c.summary_embedding IS NOT NULL
        AND (1 - (c.summary_embedding <=> query_embedding)) > similarity_threshold
    ORDER BY c.summary_embedding <=> query_embedding
    LIMIT limit_value
    OFFSET offset_value;
END;
$$ LANGUAGE plpgsql;

-- Function for pure full-text search
CREATE OR REPLACE FUNCTION fulltext_search(
    query_text TEXT,
    limit_value INTEGER DEFAULT 20,
    offset_value INTEGER DEFAULT 0
)
RETURNS TABLE (
    id INTEGER,
    timestamp BIGINT,
    model_a_name TEXT,
    model_b_name TEXT,
    short_summary TEXT,
    keywords TEXT[],
    categories TEXT[],
    languages TEXT[],
    score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.timestamp,
        c.model_a_name,
        c.model_b_name,
        c.short_summary,
        c.keywords,
        c.categories,
        c.languages,
        ts_rank(to_tsvector('english', c.search_content), plainto_tsquery('english', query_text)) as score
    FROM conversations c
    WHERE to_tsvector('english', c.search_content) @@ plainto_tsquery('english', query_text)
    ORDER BY score DESC
    LIMIT limit_value
    OFFSET offset_value;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO comparia_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO comparia_user;

-- Insert sample data for testing
INSERT INTO conversations (
    id, timestamp, model_a_name, model_b_name, 
    conversation_a, conversation_b, conv_turns,
    conversation_pair_id, conv_a_id, conv_b_id, session_hash,
    model_pair_name, opening_msg, short_summary, keywords, categories, languages
) VALUES 
(
    1, 
    EXTRACT(EPOCH FROM NOW()) * 1000,
    'gpt-4', 
    'claude-3',
    '[{"role": "user", "content": "Hello, how are you?"}, {"role": "assistant", "content": "I\\'m doing well, thank you for asking!"}]',
    '[{"role": "user", "content": "Hello, how are you?"}, {"role": "assistant", "content": "I\\'m doing great, thanks for your message!"}]',
    2,
    'test-pair-1',
    'test-a-1',
    'test-b-1',
    'test-session',
    '{gpt-4,claude-3}',
    'Hello, how are you?',
    'A simple greeting conversation between AI models',
    ARRAY['greeting', 'ai', 'test'],
    ARRAY['test'],
    ARRAY['en']
) ON CONFLICT (id) DO NOTHING;

COMMIT;