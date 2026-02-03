-- Complex SQL sample for highlighting
-- Database schema for Emacs Themes

BEGIN;

CREATE TABLE IF NOT EXISTS theme_categories (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id INTEGER REFERENCES theme_categories(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    author_email VARCHAR(255),
    is_dark BOOLEAN DEFAULT TRUE,
    stars INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE
);

-- Insert sample data
INSERT INTO theme_categories (slug, display_name) 
VALUES ('minimal', 'Minimalist Themes'), ('colorful', 'Vibrant Themes')
ON CONFLICT (slug) DO NOTHING;

/*
  Complex query with joins and aggregations
*/
SELECT 
    t.name, 
    c.display_name AS category,
    COUNT(t.id) OVER(PARTITION BY c.id) as category_total
FROM themes t
JOIN theme_categories c ON t.category_id = c.id
WHERE t.stars > 10 AND t.is_dark IS TRUE
ORDER BY t.created_at DESC
LIMIT 50;

COMMIT;