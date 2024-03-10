CREATE TABLE users (
    email VARCHAR(255) PRIMARY KEY,
    password VARCHAR(255) NOT NULL
);

CREATE TABLE user_data (
    user_email VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    rating INT,
    FOREIGN KEY (user_email) REFERENCES users(email)
);