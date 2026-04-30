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

-- 메뉴 시드: 기존 메뉴 + 키오스크 추가 메뉴 (전체 파일을 다시 넣을 때만 실행; 이미 DB가 있으면 아래 "추가만" 구문 참고)
INSERT INTO menu (name, price, keywords) VALUES
('불고기 버거', 5000, '불고기,불고기버거,불버거,bulgogi,불거지'),
('치킨 버거', 4800, '치킨,치킨버거,치버거,chicken,치킨보거'),
('트러플 새우버거', 6500, '트러플,트러플새우,새우,고급새우,트룰플,트룰피,슈림프,truffle,shrimp'),
('칠리 새우버거', 6200, '칠리,칠리새우,매운새우,매운거,shrimp,chili,매콤,칠리버거'),
('치즈버거', 4800, '치즈,치즈버거,cheese,치즈버,치즈보거'),
('베이컨 디럭스 버거', 4600, '베이컨,디럭스,bacon,deluxe,토마토'),
('모짜렐라 치즈 불고기 버거 세트', 4800, '모짜렐라,모짜,불고기,치즈'),
('트리플 불고기 버거', 5500, '트리플,triple'),
('머쉬룸 버거', 6000, '머쉬룸,머시룸,mushroom'),
('치킨윙 4개', 4000, '치킨윙,윙,wing'),
('해쉬브라운', 2500, '해쉬,해시,hash,브라운,해쉬브라운'),
('카페라떼', 2500, '카페라떼,라떼,latte,카페'),
('아이스티', 2500, '아이스티,티,iced,icetea,ice tea');

-- 이미 운영 중인 DB에 "추가만" 할 때는 위 INSERT 대신 아래만 실행하면 됩니다 (이름이 겹치면 에러 나므로 이미 있으면 생략).
-- INSERT INTO menu (name, price, keywords) VALUES
-- ('베이컨 디럭스 버거', 4600, '베이컨,디럭스,bacon,deluxe,토마토'),
-- ('모짜렐라 치즈 불고기 버거 세트', 4800, '모짜렐라,모짜,불고기,치즈'),
-- ('트리플 불고기 버거', 5500, '트리플,triple'),
-- ('머쉬룸 버거', 6000, '머쉬룸,머시룸,mushroom'),
-- ('치킨윙 4개', 4000, '치킨윙,윙,wing'),
-- ('해쉬브라운', 2500, '해쉬,해시,hash,브라운,해쉬브라운'),
-- ('카페라떼', 2500, '카페라떼,라떼,latte,카페'),
-- ('아이스티', 2500, '아이스티,티,iced,icetea,ice tea');

