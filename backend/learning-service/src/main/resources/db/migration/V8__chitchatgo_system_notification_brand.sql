-- Update only the built-in development system message; preserve learner/admin content.
UPDATE notifications
SET title = 'Hệ thống ChitChatGo hoạt động ổn định'
WHERE type = 'SYSTEM'
  AND title = 'Hệ thống SGSphere hoạt động ổn định'
  AND body = 'Tất cả 6 microservices và cổng API Gateway đã sẵn sàng phục vụ.';
