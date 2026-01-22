-- MySQL Database Schema for Senior Kiosk

CREATE DATABASE IF NOT EXISTS senior_kiosk CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE senior_kiosk;

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  user_message TEXT,
  assistant_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_session (session_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Carts table
CREATE TABLE IF NOT EXISTS carts (
  session_id VARCHAR(255) PRIMARY KEY,
  items_json TEXT,
  total INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Orders table (for future use)
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  items_json TEXT,
  total INT DEFAULT 0,
  status ENUM('pending', 'completed', 'cancelled') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  INDEX idx_session (session_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Menu table
CREATE TABLE IF NOT EXISTS menu (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price INT NOT NULL,
  keywords TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert menu data
INSERT INTO menu (name, price, keywords)
VALUES
("불고기 버거", 5000, "불고기,불고기버거,불버거,bulgogi,불거지"),
("치킨 버거", 4800, "치킨,치킨버거,치버거,chicken,치킨보거"),
("트러플 새우버거", 6500, "트러플,트러플새우,새우,고급새우,트룰플,트룰피,슈림프,truffle,shrimp"),
("칠리 새우버거", 6200, "칠리,칠리새우,매운새우,매운거,shrimp,chili,매콤,칠리버거"),
("치즈버거", 4800, "치즈,치즈버거,cheese,치즈버,치즈보거")
ON DUPLICATE KEY UPDATE name=VALUES(name), price=VALUES(price), keywords=VALUES(keywords);

