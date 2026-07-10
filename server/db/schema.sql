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

-- 메뉴 시드 (운영 덤프 server/db/senior_kiosk.sql 과 동일)
INSERT INTO menu (name, price, keywords) VALUES
('불고기버거', 5000, '불고기,불고기버거,불버거,bulgogi,불거지'),
('치즈 불고기버거', 4800, '치즈,치즈불고기버거,불고기,cheese,bulgogi'),
('치킨버거', 4800, '치킨,치킨버거,치버거,chicken,치킨보거'),
('에그버거', 6000, '에그,에그버거,egg,새우,새우버거,shrimp,슈림프'),
('더블 불고기버거', 5500, '더블,더블불고기버거,불고기,double,bulgogi'),
('베이컨 불고기버거', 4600, '베이컨,불고기,베이컨불고기버거,bacon,bulgogi,토마토'),
('칠리 새우버거', 6200, '칠리,칠리새우,매운새우,매운거,shrimp,chili,매콤,칠리버거'),
('크림 새우버거', 6500, '크림,크림새우,새우,슈림프,cream,shrimp'),
('버섯 불고기버거', 6000, '버섯,버섯불고기버거,불고기,머쉬룸,머시룸,mushroom'),
('마늘 불고기버거', 5300, '마늘,마늘불고기버거,불고기,garlic,bulgogi'),
('콜라', 2000, '콜라,coke,코카콜라'),
('제로콜라', 2000, '제로콜라,제로,coke zero'),
('사이다', 2000, '사이다,sprite'),
('제로사이다', 2000, '제로사이다,제로,sprite zero'),
('아메리카노', 2500, '아메리카노,커피,americano'),
('카페라떼', 2500, '카페라떼,라떼,latte'),
('아이스티', 2500, '아이스티,티,iced tea,icetea'),
('감자튀김', 3000, '감자튀김,감튀,프렌치프라이,french fries'),
('해시브라운', 2500, '해시브라운,해쉬브라운,해시,hashbrown'),
('치킨윙', 4000, '치킨윙,윙,wing'),
('코울슬로', 2000, '코울슬로,샐러드,coleslaw');

