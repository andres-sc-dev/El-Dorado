/* El Dorado · SQL Server · identidad.
   Script idempotente: se puede ejecutar varias veces sin error ni duplicados.
   Lo ejecuta el servicio db-init con sqlcmd (SQL Server no corre scripts de inicio solo). */

IF DB_ID(N'el_dorado') IS NULL
  CREATE DATABASE el_dorado;
GO

USE el_dorado;
GO

/* ---------- Catálogos ---------- */

IF OBJECT_ID(N'dbo.user_status', N'U') IS NULL
  CREATE TABLE dbo.user_status (
    id_status_user TINYINT      NOT NULL CONSTRAINT pk_user_status PRIMARY KEY,
    -- NVARCHAR: nombre legible de longitud variable.
    name           NVARCHAR(30) NOT NULL CONSTRAINT uq_user_status_name UNIQUE
  );
GO

IF OBJECT_ID(N'dbo.role', N'U') IS NULL
  CREATE TABLE dbo.role (
    id_role TINYINT      NOT NULL CONSTRAINT pk_role PRIMARY KEY,
    code    CHAR(3)      NOT NULL CONSTRAINT uq_role_code UNIQUE,  -- USR, ADM
    -- NVARCHAR: nombre legible de longitud variable.
    name    NVARCHAR(30) NOT NULL
  );
GO

IF OBJECT_ID(N'dbo.document_type', N'U') IS NULL
  CREATE TABLE dbo.document_type (
    id_document_type TINYINT      NOT NULL CONSTRAINT pk_document_type PRIMARY KEY,
    -- VARCHAR: los códigos oficiales no tienen la misma longitud (CC, CE, PEP, NIT).
    code             VARCHAR(5)   NOT NULL CONSTRAINT uq_document_type_code UNIQUE,
    -- NVARCHAR: nombre legible con tildes.
    name             NVARCHAR(50) NOT NULL
  );
GO

/* ---------- Usuarios ---------- */

IF OBJECT_ID(N'dbo.users', N'U') IS NULL
  CREATE TABLE dbo.users (
    id            INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_users PRIMARY KEY,
    -- NVARCHAR: el usuario lo elige la persona; es la clave natural que usan los otros motores.
    username      NVARCHAR(50)  NOT NULL CONSTRAINT uq_users_username UNIQUE,
    -- NVARCHAR: un correo tiene longitud variable.
    email         NVARCHAR(150) NOT NULL CONSTRAINT uq_users_email UNIQUE,
    -- bcrypt siempre produce 60 caracteres, por eso CHAR y no VARCHAR.
    password_hash CHAR(60)      NOT NULL,
    status        TINYINT       NOT NULL CONSTRAINT df_users_status DEFAULT (1)
                  CONSTRAINT fk_users_status REFERENCES dbo.user_status (id_status_user),
    role_id       TINYINT       NOT NULL CONSTRAINT df_users_role DEFAULT (1)
                  CONSTRAINT fk_users_role REFERENCES dbo.role (id_role),
    created_at    DATETIME2(0)  NOT NULL CONSTRAINT df_users_created_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT ck_users_username CHECK (LEN(username) >= 3),
    CONSTRAINT ck_users_email CHECK (email LIKE N'%_@_%._%')
  );
GO

IF OBJECT_ID(N'dbo.customer', N'U') IS NULL
  CREATE TABLE dbo.customer (
    id               INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_customer PRIMARY KEY,
    user_id          INT           NOT NULL CONSTRAINT uq_customer_user UNIQUE
                     CONSTRAINT fk_customer_user REFERENCES dbo.users (id) ON DELETE CASCADE,
    -- NVARCHAR: nombres con tildes y longitud variable.
    full_name        NVARCHAR(150) NOT NULL,
    document_type_id TINYINT       NOT NULL CONSTRAINT df_customer_document_type DEFAULT (1)
                     CONSTRAINT fk_customer_document_type REFERENCES dbo.document_type (id_document_type),
    -- VARCHAR: un pasaporte tiene letras y longitud variable; una cédula no cabe en un tipo numérico
    -- sin perder ceros a la izquierda. Se guarda sin puntos: el formato es tarea de la interfaz.
    document_number  VARCHAR(20)   NOT NULL,
    birth_date       DATE          NOT NULL,
    -- VARCHAR: los teléfonos tienen longitud variable y pueden incluir el prefijo +57.
    phone            VARCHAR(20)   NULL,
    -- NVARCHAR: direcciones con tildes y longitud variable.
    address          NVARCHAR(200) NULL,
    CONSTRAINT uq_customer_document UNIQUE (document_type_id, document_number),
    CONSTRAINT ck_customer_document_digits CHECK (document_type_id <> 1 OR document_number NOT LIKE '%[^0-9]%')
  );
GO

IF OBJECT_ID(N'dbo.login_history', N'U') IS NULL
  CREATE TABLE dbo.login_history (
    id         BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_login_history PRIMARY KEY,
    user_id    INT          NOT NULL CONSTRAINT fk_login_history_user REFERENCES dbo.users (id) ON DELETE CASCADE,
    login_time DATETIME2(0) NOT NULL CONSTRAINT df_login_history_time DEFAULT (SYSUTCDATETIME()),
    -- VARCHAR: una IP mide entre 7 (IPv4) y 45 caracteres (IPv6).
    ip_address VARCHAR(45)  NULL,
    successful BIT          NOT NULL
  );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_login_history_user_time')
  CREATE INDEX ix_login_history_user_time ON dbo.login_history (user_id, login_time DESC);
GO

/* ---------- Datos de los catálogos ---------- */

MERGE dbo.user_status AS target
USING (VALUES (0, N'Inactive'), (1, N'Active'), (2, N'Blocked')) AS source (id, name)
  ON target.id_status_user = source.id
WHEN MATCHED THEN UPDATE SET name = source.name
WHEN NOT MATCHED THEN INSERT (id_status_user, name) VALUES (source.id, source.name);
GO

MERGE dbo.role AS target
USING (VALUES (1, 'USR', N'Usuario'), (2, 'ADM', N'Administrador')) AS source (id, code, name)
  ON target.id_role = source.id
WHEN MATCHED THEN UPDATE SET code = source.code, name = source.name
WHEN NOT MATCHED THEN INSERT (id_role, code, name) VALUES (source.id, source.code, source.name);
GO

MERGE dbo.document_type AS target
USING (VALUES
  (1, 'CC',  N'Cédula de ciudadanía'),
  (2, 'CE',  N'Cédula de extranjería'),
  (3, 'PA',  N'Pasaporte'),
  (4, 'PEP', N'Permiso especial de permanencia')
) AS source (id, code, name)
  ON target.id_document_type = source.id
WHEN MATCHED THEN UPDATE SET code = source.code, name = source.name
WHEN NOT MATCHED THEN INSERT (id_document_type, code, name) VALUES (source.id, source.code, source.name);
GO
