/* El Dorado · SQL Server · proveedor de autenticación (Fase 4: inicio de sesión con Google).
   Script idempotente: se puede ejecutar varias veces sin error ni duplicados.
   - Catálogo auth_provider: LOCAL (usuario y contraseña) y GOOGLE (Firebase Authentication).
   - users.auth_provider_id: cómo entra cada usuario. Los usuarios existentes quedan LOCAL.
   - users.password_hash admite NULL, solo para cuentas GOOGLE (no tienen contraseña en El Dorado).
   - users.google_uid: UID de Firebase, único cuando existe. */

-- Los índices filtrados exigen QUOTED_IDENTIFIER y ANSI_NULLS activos (sqlcmd los trae apagados).
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

USE el_dorado;
GO

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* ---------- Catálogo ---------- */

IF OBJECT_ID(N'dbo.auth_provider', N'U') IS NULL
  CREATE TABLE dbo.auth_provider (
    id_auth_provider TINYINT      NOT NULL CONSTRAINT pk_auth_provider PRIMARY KEY,
    -- VARCHAR: los códigos no miden lo mismo (LOCAL tiene 5 letras, GOOGLE 6) y podrían llegar otros.
    code             VARCHAR(10)  NOT NULL CONSTRAINT uq_auth_provider_code UNIQUE,
    -- NVARCHAR: nombre legible con tildes.
    name             NVARCHAR(50) NOT NULL
  );
GO

-- Los id son fijos: el CHECK ck_users_auth_provider de abajo los usa.
MERGE dbo.auth_provider AS target
USING (VALUES (1, 'LOCAL', N'Usuario y contraseña'), (2, 'GOOGLE', N'Cuenta de Google')) AS source (id, code, name)
  ON target.id_auth_provider = source.id
WHEN MATCHED THEN UPDATE SET code = source.code, name = source.name
WHEN NOT MATCHED THEN INSERT (id_auth_provider, code, name) VALUES (source.id, source.code, source.name);
GO

/* ---------- users ---------- */

-- NOT NULL con DEFAULT 1: las filas que ya existen quedan como LOCAL.
IF COL_LENGTH(N'dbo.users', N'auth_provider_id') IS NULL
  ALTER TABLE dbo.users ADD auth_provider_id TINYINT NOT NULL
    CONSTRAINT df_users_auth_provider DEFAULT (1)
    CONSTRAINT fk_users_auth_provider REFERENCES dbo.auth_provider (id_auth_provider);
GO

-- VARCHAR: el UID de Firebase tiene longitud variable (hasta 128 caracteres según la documentación).
IF COL_LENGTH(N'dbo.users', N'google_uid') IS NULL
  ALTER TABLE dbo.users ADD google_uid VARCHAR(128) NULL;
GO

-- Las cuentas GOOGLE no tienen contraseña en El Dorado.
IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.users') AND name = N'password_hash' AND is_nullable = 0
)
  ALTER TABLE dbo.users ALTER COLUMN password_hash CHAR(60) NULL;
GO

-- Único cuando existe: un UNIQUE normal solo admitiría un NULL, por eso es un índice filtrado.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'uq_users_google_uid' AND object_id = OBJECT_ID(N'dbo.users'))
  CREATE UNIQUE INDEX uq_users_google_uid ON dbo.users (google_uid) WHERE google_uid IS NOT NULL;
GO

-- Coherencia por proveedor: LOCAL siempre con contraseña; GOOGLE siempre con UID y sin contraseña.
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'ck_users_auth_provider')
  ALTER TABLE dbo.users ADD CONSTRAINT ck_users_auth_provider CHECK (
    (auth_provider_id = 1 AND password_hash IS NOT NULL)
    OR (auth_provider_id = 2 AND google_uid IS NOT NULL AND password_hash IS NULL)
  );
GO
