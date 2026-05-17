-- 콜라·제로콜라·사이다·커피·샐러드·감자튀김 복구 (이미 같은 name 이 있으면 건너뜀)
USE senior_kiosk;

UPDATE menu SET name = '불고기버거' WHERE name = '불고기 버거';
UPDATE menu SET name = '치킨버거' WHERE name = '치킨 버거';
UPDATE menu SET name = '에그버거', keywords = '에그,에그버거,egg,새우,새우버거,shrimp,슈림프' WHERE name = '새우버거';
UPDATE menu SET name = '크림 새우버거', keywords = '크림,크림새우,새우,슈림프,cream,shrimp' WHERE name = '트러플 새우버거';
UPDATE menu SET name = '베이컨 불고기버거', keywords = '베이컨,불고기,베이컨불고기버거,bacon,bulgogi,토마토' WHERE name = '베이컨 디럭스 버거';
UPDATE menu SET name = '치즈 불고기버거', keywords = '치즈,치즈불고기버거,불고기,cheese,bulgogi' WHERE name = '모짜렐라 치즈 불고기 버거';
UPDATE menu SET name = '더블 불고기버거', keywords = '더블,더블불고기버거,불고기,double,bulgogi' WHERE name = '트리플 불고기 버거';
UPDATE menu SET name = '버섯 불고기버거', keywords = '버섯,버섯불고기버거,불고기,머쉬룸,머시룸,mushroom' WHERE name = '머쉬룸버거';

INSERT INTO menu (name, price, keywords)
SELECT '마늘 불고기버거', 5300, '마늘,마늘불고기버거,불고기,garlic,bulgogi'
WHERE NOT EXISTS (SELECT 1 FROM menu m WHERE m.name = '마늘 불고기버거');

INSERT INTO menu (name, price, keywords)
SELECT '에그버거', 6000, '에그,에그버거,egg,새우,새우버거,shrimp,슈림프'
WHERE NOT EXISTS (SELECT 1 FROM menu m WHERE m.name = '에그버거');

INSERT INTO menu (name, price, keywords)
SELECT '콜라', 2500, '콜라,코크,coke,콜라주,탄산'
WHERE NOT EXISTS (SELECT 1 FROM menu m WHERE m.name = '콜라');

INSERT INTO menu (name, price, keywords)
SELECT '제로콜라', 2500, '제로콜라,제로,zero,제로코크,다이어트콜라'
WHERE NOT EXISTS (SELECT 1 FROM menu m WHERE m.name = '제로콜라');

INSERT INTO menu (name, price, keywords)
SELECT '사이다', 2500, '사이다,cider,사이다주,soda,스프라이트'
WHERE NOT EXISTS (SELECT 1 FROM menu m WHERE m.name = '사이다');

INSERT INTO menu (name, price, keywords)
SELECT '제로사이다', 2500, '제로사이다,제로,zero,cider,soda'
WHERE NOT EXISTS (SELECT 1 FROM menu m WHERE m.name = '제로사이다');

INSERT INTO menu (name, price, keywords)
SELECT '아메리카노', 2500, '아메리카노,아메,americano,coffee,커피'
WHERE NOT EXISTS (SELECT 1 FROM menu m WHERE m.name = '아메리카노');

UPDATE menu
SET name = '아메리카노',
    keywords = '아메리카노,아메,americano,coffee,커피'
WHERE name = '커피';

INSERT INTO menu (name, price, keywords)
SELECT '코울슬로', 3000, '코울슬로,coleslaw,샐러드,salad'
WHERE NOT EXISTS (SELECT 1 FROM menu m WHERE m.name = '코울슬로');

UPDATE menu
SET name = '코울슬로',
    keywords = '코울슬로,coleslaw,샐러드,salad'
WHERE name = '샐러드';

INSERT INTO menu (name, price, keywords)
SELECT '감자튀김', 2500, '감자튀김,감튀,프렌치프라이,french,fries,후라이드,포테이토'
WHERE NOT EXISTS (SELECT 1 FROM menu m WHERE m.name = '감자튀김');
