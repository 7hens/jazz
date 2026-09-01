-- 迁移: token 认证。会话由 env ADMIN_TOKEN 直接校验(cookie 存 token),
-- sessions 表不再使用。
DROP TABLE IF EXISTS sessions;
