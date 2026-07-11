CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

CREATE TABLE companies (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id TEXT UNIQUE,
    name        TEXT NOT NULL,
    description TEXT,
    embedding   vector(512),
    search_embedding vector(512),
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON companies USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
CREATE INDEX ON companies USING ivfflat (search_embedding vector_cosine_ops)
    WITH (lists = 100);

-- Tags as rows, not columns — adding a new axis never requires ALTER TABLE
CREATE TABLE tags (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id    UUID REFERENCES companies(id) ON DELETE CASCADE,
    taxonomy_axis TEXT NOT NULL,
    tag_value     TEXT NOT NULL,
    source        TEXT NOT NULL CHECK (source IN ('knn_classifier', 'llm', 'human')),
    confidence    FLOAT,
    reasoning     TEXT,
    is_accepted   BOOLEAN DEFAULT NULL,  -- NULL=pending, TRUE=accepted, FALSE=rejected
    created_at    TIMESTAMPTZ DEFAULT now(),
    UNIQUE (company_id, taxonomy_axis, tag_value, source)
);

CREATE INDEX ON tags (company_id);
CREATE INDEX ON tags (taxonomy_axis, is_accepted);

CREATE TABLE feedback (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_id        UUID REFERENCES tags(id) ON DELETE CASCADE,
    analyst_id    TEXT,
    original_tag  TEXT,
    corrected_tag TEXT,
    ruling_embedding vector(512),
    created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON feedback USING ivfflat (ruling_embedding vector_cosine_ops)
    WITH (lists = 100);
