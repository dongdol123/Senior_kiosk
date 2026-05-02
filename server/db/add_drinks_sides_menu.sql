-- 콜라·제로콜라·사이다·커피·샐러드·감자튀김 복구 (이미 같은 name 이 있으면 건너뜀)
USE senior_kiosk;

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
SELECT '커피', 2500, '커피,coffee,아메리카노,아메,핫커피'
WHERE NOT EXISTS (SELECT 1 FROM menu m WHERE m.name = '커피');

INSERT INTO menu (name, price, keywords)
SELECT '샐러드', 3000, '샐러드,salad,그린샐러드,야채샐러드'
WHERE NOT EXISTS (SELECT 1 FROM menu m WHERE m.name = '샐러드');

INSERT INTO menu (name, price, keywords)
SELECT '감자튀김', 2500, '감자튀김,감튀,프렌치프라이,french,fries,후라이드,포테이토'
WHERE NOT EXISTS (SELECT 1 FROM menu m WHERE m.name = '감자튀김');
