/* El Dorado · SQL Server · login de la aplicación.
   La API no usa la cuenta sa: usa un login propio con permisos de lectura y escritura.
   sqlcmd reemplaza $(APP_LOGIN) y $(APP_PASSWORD) con las variables de entorno. */

USE master;
GO

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'$(APP_LOGIN)')
  CREATE LOGIN [$(APP_LOGIN)] WITH PASSWORD = N'$(APP_PASSWORD)', DEFAULT_DATABASE = el_dorado, CHECK_POLICY = ON;
ELSE
  ALTER LOGIN [$(APP_LOGIN)] WITH PASSWORD = N'$(APP_PASSWORD)';
GO

USE el_dorado;
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'$(APP_LOGIN)')
  CREATE USER [$(APP_LOGIN)] FOR LOGIN [$(APP_LOGIN)];
GO

ALTER ROLE db_datareader ADD MEMBER [$(APP_LOGIN)];
ALTER ROLE db_datawriter ADD MEMBER [$(APP_LOGIN)];
GO
