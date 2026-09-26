CREATE TABLE categories (
    id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL,
    description VARCHAR(500) NULL,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_categories_name UNIQUE (name),
    CONSTRAINT uk_categories_slug UNIQUE (slug)
);

CREATE TABLE courses (
    id BIGINT NOT NULL AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(200) NOT NULL,
    description VARCHAR(2000) NULL,
    category_id BIGINT NOT NULL,
    price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    original_price DECIMAL(12, 2) NULL,
    level VARCHAR(20) NOT NULL DEFAULT 'BEGINNER',
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    thumbnail_url VARCHAR(500) NULL,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_courses_slug UNIQUE (slug),
    CONSTRAINT fk_courses_category FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE INDEX idx_courses_category ON courses(category_id);
