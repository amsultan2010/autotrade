-- Drop unused legacy Prisma-style tables (empty; superseded by snake_case schema)
DROP TABLE IF EXISTS public."RefreshToken" CASCADE;
DROP TABLE IF EXISTS public."BrokerCredential" CASCADE;
DROP TABLE IF EXISTS public."AuditLog" CASCADE;
DROP TABLE IF EXISTS public."WatchedSymbol" CASCADE;
DROP TABLE IF EXISTS public."StrategyStat" CASCADE;
DROP TABLE IF EXISTS public."PaperAccount" CASCADE;
DROP TABLE IF EXISTS public."ProviderSetting" CASCADE;
DROP TABLE IF EXISTS public."AppVersion" CASCADE;
DROP TABLE IF EXISTS public."Signal" CASCADE;
DROP TABLE IF EXISTS public."Trade" CASCADE;
DROP TABLE IF EXISTS public."BotSettings" CASCADE;
DROP TABLE IF EXISTS public."Subscription" CASCADE;
DROP TABLE IF EXISTS public."User" CASCADE;
