# MySQL 비밀번호 제거 방법

## 문제
```
❌ MySQL connection error: Access denied for user 'root'@'localhost' (using password: NO)
```

`.env.local`에 `DB_PASSWORD=`로 설정되어 있지만, MySQL root 계정에 비밀번호가 설정되어 있어 접속이 거부됩니다.

## 해결 방법: MySQL Workbench 사용

### 1. MySQL Workbench 실행 및 접속
- MySQL Workbench를 실행하세요
- 기존 연결이 있다면 연결하세요 (비밀번호 입력 필요)
- 또는 새 연결을 만들어서 접속하세요

### 2. SQL 쿼리 실행
MySQL Workbench에서 다음 SQL을 실행하세요:

```sql
-- 비밀번호 제거 (빈 문자열로 설정)
ALTER USER 'root'@'localhost' IDENTIFIED BY '';
FLUSH PRIVILEGES;
```

### 3. 접속 테스트
터미널에서 다음 명령어로 테스트:

```bash
mysql -u root
```

비밀번호 입력 없이 접속되면 성공입니다.

### 4. 서버 재시작
```bash
npm run dev:all
```

이제 `✅ MySQL connected` 메시지가 표시됩니다.

## 대안: 터미널에서 직접 해결

만약 MySQL Workbench로 접속할 수 없다면:

### 방법 1: sudo로 접속
```bash
sudo mysql -u root
```

접속 후:
```sql
ALTER USER 'root'@'localhost' IDENTIFIED BY '';
FLUSH PRIVILEGES;
exit;
```

### 방법 2: MySQL 서비스 재시작 후 접속
```bash
# MySQL 서비스 중지
sudo /usr/local/mysql/support-files/mysql.server stop

# skip-grant-tables 모드로 시작
sudo mysqld_safe --skip-grant-tables --skip-networking &

# 접속
mysql -u root

# 비밀번호 제거
FLUSH PRIVILEGES;
ALTER USER 'root'@'localhost' IDENTIFIED BY '';
FLUSH PRIVILEGES;
exit;

# MySQL 정상 모드로 재시작
sudo /usr/local/mysql/support-files/mysql.server restart
```
