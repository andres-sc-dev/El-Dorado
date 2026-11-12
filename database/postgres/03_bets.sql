-- El Dorado · PostgreSQL · funciones de dinero (Fase 2).
-- Script idempotente: CREATE OR REPLACE, IF NOT EXISTS y ON CONFLICT. Se puede repetir sin cambiar nada.
-- Toda operación que mueve saldo vive aquí. Node solo hace SELECT fn_...(...).
--
-- Cómo se reportan los errores: RAISE EXCEPTION con SQLSTATE P0001, el MESSAGE es un
-- código estable (INSUFFICIENT_FUNDS, STAKE_OUT_OF_RANGE...) y el DETAIL un texto para la persona.
-- La API traduce el código a HTTP (400, 403, 404 o 409).
--
-- Orden de bloqueo en todas las funciones: primero la fila de account (FOR UPDATE) y después
-- la de bet. Siempre el mismo orden, así dos operaciones no se bloquean en círculo (deadlock).

-- ---------- Límites de apuesta ----------

-- Una fila por moneda. El backend la sincroniza con BET_MIN_COP y BET_MAX_COP al arrancar
-- (npm run seed:demo), y fn_crear_apuesta la lee en cada apuesta.
CREATE TABLE IF NOT EXISTS bet_limit (
  currency   CHAR(3)       PRIMARY KEY,
  min_stake  NUMERIC(14,2) NOT NULL CHECK (min_stake > 0),
  max_stake  NUMERIC(14,2) NOT NULL,
  updated_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT ck_bet_limit_range CHECK (max_stake >= min_stake)
);

INSERT INTO bet_limit (currency, min_stake, max_stake) VALUES ('COP', 1000, 500000)
ON CONFLICT (currency) DO NOTHING;

-- Tope duro dentro de la tabla bet: aunque alguien llame la función con otros límites,
-- la base de datos no guarda una apuesta fuera de 1.000 - 500.000 COP.
-- Si se suben BET_MAX_COP o se baja BET_MIN_COP en el .env, hay que cambiar también este CHECK.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_bet_stake_limits') THEN
    ALTER TABLE bet ADD CONSTRAINT ck_bet_stake_limits CHECK (stake BETWEEN 1000 AND 500000);
  END IF;
END
$$;

-- ---------- Ayudas internas ----------

-- Lanza un error de negocio con código estable y mensaje legible.
CREATE OR REPLACE FUNCTION fn_raise(p_code TEXT, p_detail TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = p_code, DETAIL = p_detail;
END
$$;

CREATE OR REPLACE FUNCTION fn_movement_type(p_code TEXT)
RETURNS SMALLINT LANGUAGE sql STABLE AS $$
  SELECT id_movement FROM movement_type WHERE code = p_code
$$;

CREATE OR REPLACE FUNCTION fn_bet_status(p_code TEXT)
RETURNS SMALLINT LANGUAGE sql STABLE AS $$
  SELECT id_status_bet FROM bet_status WHERE code = p_code
$$;

-- true si el monto es positivo y tiene máximo 2 decimales.
-- NUMERIC(14,2) redondea en silencio (1000.129 se guardaría como 1000.13): por eso se valida antes.
CREATE OR REPLACE FUNCTION fn_is_money(p_amount NUMERIC)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$
  SELECT p_amount IS NOT NULL AND p_amount > 0 AND p_amount = round(p_amount, 2)
$$;

-- Tiquete completo de una apuesta (lo que devuelve la API).
CREATE OR REPLACE FUNCTION fn_bet_ticket(p_bet_id BIGINT, p_created BOOLEAN)
RETURNS JSONB LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'created',          p_created,
    'bet_id',           b.id,
    'ticket_code',      b.ticket_code,
    'username',         a.username,
    'match_code',       l.match_code,
    'market_code',      l.market_code,
    'outcome_code',     l.outcome_code,
    'line',             l.line,
    'stake',            b.stake,
    'odds',             l.odd_value,
    'potential_payout', b.potential_payout,
    'status',           s.code,
    'placed_at',        b.placed_at,
    'balance',          a.balance
  )
  FROM bet b
  JOIN account a    ON a.id = b.account_id
  JOIN bet_leg l    ON l.bet_id = b.id
  JOIN bet_status s ON s.id_status_bet = b.status
  WHERE b.id = p_bet_id
$$;

-- ---------- fn_recargar ----------
-- Suma saldo a una cuenta. Idempotente por p_reference: si la misma referencia
-- (por ejemplo WOMPI:<id de transacción>) llega dos veces, la segunda no suma nada.
CREATE OR REPLACE FUNCTION fn_recargar(p_username TEXT, p_amount NUMERIC, p_reference TEXT)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_account  account%ROWTYPE;
  v_existing balance_movement%ROWTYPE;
  v_balance  NUMERIC(14,2);
  v_id       BIGINT;
BEGIN
  IF NOT fn_is_money(p_amount) THEN
    PERFORM fn_raise('INVALID_AMOUNT', 'El monto debe ser mayor que cero y tener máximo 2 decimales.');
  END IF;
  IF p_reference IS NULL OR char_length(p_reference) NOT BETWEEN 3 AND 120 THEN
    PERFORM fn_raise('INVALID_REFERENCE', 'La referencia debe tener entre 3 y 120 caracteres.');
  END IF;

  -- Bloquea la cuenta: dos recargas simultáneas de la misma cuenta se hacen una detrás de otra.
  SELECT * INTO v_account FROM account WHERE username = p_username FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM fn_raise('ACCOUNT_NOT_FOUND', 'La cuenta no existe.');
  END IF;
  IF v_account.status <> 1 THEN
    PERFORM fn_raise('ACCOUNT_INACTIVE', 'La cuenta no está activa.');
  END IF;

  -- Idempotencia: la referencia ya se aplicó.
  SELECT * INTO v_existing FROM balance_movement WHERE reference = p_reference;
  IF FOUND THEN
    IF v_existing.account_id <> v_account.id OR v_existing.amount <> p_amount THEN
      PERFORM fn_raise('REFERENCE_CONFLICT', 'La referencia ya se usó con otra cuenta u otro monto.');
    END IF;
    RETURN jsonb_build_object('credited', false, 'balance', v_account.balance, 'movement_id', v_existing.id);
  END IF;

  v_balance := v_account.balance + p_amount;
  UPDATE account SET balance = v_balance, updated_at = now() WHERE id = v_account.id;
  INSERT INTO balance_movement (account_id, movement_type, amount, resulting_balance, reference)
  VALUES (v_account.id, fn_movement_type('DEPOSIT'), p_amount, v_balance, p_reference)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('credited', true, 'balance', v_balance, 'movement_id', v_id);
END
$$;

-- ---------- fn_crear_apuesta ----------
-- Crea una apuesta simple en una sola transacción: valida, bloquea la cuenta, descuenta el saldo
-- y crea bet, bet_leg y balance_movement. La cuota (p_odds) la lee la API de MySQL, nunca del cliente.
-- La misma p_idempotency_key devuelve la apuesta ya creada (doble clic o reintento de red).
CREATE OR REPLACE FUNCTION fn_crear_apuesta(
  p_username        TEXT,
  p_match_code      TEXT,
  p_market_code     TEXT,
  p_selection       TEXT,
  p_stake           NUMERIC,
  p_odds            NUMERIC,
  p_idempotency_key UUID,
  p_line            NUMERIC DEFAULT 0
)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_account account%ROWTYPE;
  v_limit   bet_limit%ROWTYPE;
  v_bet     bet%ROWTYPE;
  v_leg     bet_leg%ROWTYPE;
  v_balance NUMERIC(14,2);
  v_line    NUMERIC := COALESCE(p_line, 0);
BEGIN
  -- 1. Validaciones que no necesitan bloquear nada.
  IF p_idempotency_key IS NULL THEN
    PERFORM fn_raise('IDEMPOTENCY_KEY_REQUIRED', 'Falta la clave de idempotencia.');
  END IF;
  IF NOT fn_is_money(p_stake) THEN
    PERFORM fn_raise('INVALID_STAKE', 'El monto debe ser mayor que cero y tener máximo 2 decimales.');
  END IF;
  SELECT * INTO v_limit FROM bet_limit WHERE currency = 'COP';
  IF p_stake < v_limit.min_stake OR p_stake > v_limit.max_stake THEN
    PERFORM fn_raise('STAKE_OUT_OF_RANGE',
      format('El monto debe estar entre %s y %s COP.', v_limit.min_stake, v_limit.max_stake));
  END IF;
  IF p_odds IS NULL OR p_odds <= 1 OR p_odds <> round(p_odds, 2) THEN
    PERFORM fn_raise('INVALID_ODDS', 'La cuota debe ser mayor que 1 y tener máximo 2 decimales.');
  END IF;
  IF p_match_code IS NULL OR p_match_code !~ '^[A-Z]{2}[0-9]{6}$' THEN
    PERFORM fn_raise('INVALID_MATCH', 'El código de partido no es válido.');
  END IF;
  IF p_market_code IS NULL OR p_market_code !~ '^[A-Z0-9_]{2,20}$'
     OR p_selection IS NULL OR char_length(p_selection) NOT BETWEEN 1 AND 10 THEN
    PERFORM fn_raise('INVALID_SELECTION', 'El mercado o la selección no son válidos.');
  END IF;

  -- 2. Bloquea la cuenta. Dos apuestas simultáneas del mismo usuario esperan su turno aquí,
  --    así la segunda ve el saldo ya descontado por la primera.
  SELECT * INTO v_account FROM account WHERE username = p_username FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM fn_raise('ACCOUNT_NOT_FOUND', 'La cuenta no existe.');
  END IF;
  IF v_account.status <> 1 THEN
    PERFORM fn_raise('ACCOUNT_INACTIVE', 'La cuenta no está activa.');
  END IF;

  -- 3. Idempotencia, después del bloqueo: un doble clic llega aquí en fila y el segundo
  --    encuentra la apuesta del primero.
  SELECT * INTO v_bet FROM bet WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    SELECT * INTO v_leg FROM bet_leg WHERE bet_id = v_bet.id;
    IF v_bet.account_id <> v_account.id
       OR v_leg.match_code <> p_match_code OR v_leg.market_code <> p_market_code
       OR v_leg.outcome_code <> p_selection OR v_leg.line <> v_line OR v_bet.stake <> p_stake THEN
      PERFORM fn_raise('IDEMPOTENCY_KEY_REUSED', 'La clave de idempotencia ya se usó con otra apuesta.');
    END IF;
    RETURN fn_bet_ticket(v_bet.id, false);
  END IF;

  -- 4. Saldo.
  IF v_account.balance < p_stake THEN
    PERFORM fn_raise('INSUFFICIENT_FUNDS', 'Saldo insuficiente para esta apuesta.');
  END IF;

  -- 5. Escrituras. Si cualquiera falla, la función completa se deshace.
  INSERT INTO bet (account_id, stake, total_odds, potential_payout, status, idempotency_key)
  VALUES (v_account.id, p_stake, p_odds, round(p_stake * p_odds, 2), fn_bet_status('OPEN'), p_idempotency_key)
  RETURNING * INTO v_bet;

  INSERT INTO bet_leg (bet_id, match_code, market_code, outcome_code, line, odd_value, status)
  VALUES (v_bet.id, p_match_code, p_market_code, p_selection, v_line, p_odds, fn_bet_status('OPEN'));

  v_balance := v_account.balance - p_stake;
  UPDATE account SET balance = v_balance, updated_at = now() WHERE id = v_account.id;

  INSERT INTO balance_movement (account_id, movement_type, amount, resulting_balance, reference, bet_id)
  VALUES (v_account.id, fn_movement_type('BET_PLACED'), p_stake, v_balance, 'BET:' || v_bet.ticket_code, v_bet.id);

  RETURN fn_bet_ticket(v_bet.id, true);
END
$$;

-- ---------- fn_liquidar_apuesta ----------
-- Liquida una apuesta ABIERTA con WON (paga stake × cuota), LOST (no paga) o REFUNDED
-- (devuelve el monto). Si la apuesta ya no está abierta no hace nada: repetir es seguro.
CREATE OR REPLACE FUNCTION fn_liquidar_apuesta(p_bet_id BIGINT, p_result TEXT)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_account_id INTEGER;
  v_account    account%ROWTYPE;
  v_bet        bet%ROWTYPE;
  v_amount     NUMERIC(16,2) := 0;
  v_type       TEXT;
  v_prefix     TEXT;
  v_balance    NUMERIC(14,2);
BEGIN
  IF p_result IS NULL OR p_result NOT IN ('WON', 'LOST', 'REFUNDED') THEN
    PERFORM fn_raise('INVALID_RESULT', 'El resultado debe ser WON, LOST o REFUNDED.');
  END IF;

  SELECT account_id INTO v_account_id FROM bet WHERE id = p_bet_id;
  IF NOT FOUND THEN
    PERFORM fn_raise('BET_NOT_FOUND', 'La apuesta no existe.');
  END IF;

  -- Mismo orden que fn_crear_apuesta: cuenta y luego apuesta.
  SELECT * INTO v_account FROM account WHERE id = v_account_id FOR UPDATE;
  SELECT * INTO v_bet FROM bet WHERE id = p_bet_id FOR UPDATE;

  IF v_bet.status <> fn_bet_status('OPEN') THEN
    RETURN jsonb_build_object('settled', false, 'bet_id', p_bet_id, 'payout', 0);
  END IF;

  IF p_result = 'WON' THEN
    v_amount := v_bet.potential_payout; v_type := 'BET_PAYOUT'; v_prefix := 'PAYOUT:';
  ELSIF p_result = 'REFUNDED' THEN
    v_amount := v_bet.stake; v_type := 'BET_REFUND'; v_prefix := 'REFUND:';
  END IF;

  UPDATE bet SET status = fn_bet_status(p_result), settled_at = now() WHERE id = v_bet.id;
  UPDATE bet_leg SET status = fn_bet_status(p_result) WHERE bet_id = v_bet.id;

  IF v_amount > 0 THEN
    v_balance := v_account.balance + v_amount;
    UPDATE account SET balance = v_balance, updated_at = now() WHERE id = v_account.id;
    INSERT INTO balance_movement (account_id, movement_type, amount, resulting_balance, reference, bet_id)
    VALUES (v_account.id, fn_movement_type(v_type), v_amount, v_balance, v_prefix || v_bet.ticket_code, v_bet.id);
  END IF;

  RETURN jsonb_build_object('settled', true, 'bet_id', p_bet_id, 'result', p_result, 'payout', v_amount);
END
$$;

-- ---------- fn_liquidar_partido ----------
-- Liquida todas las apuestas abiertas de un partido en una sola transacción.
-- p_resultado lo arma la API con el marcador y el resultado de cada selección:
--   {"home_goals": 2, "away_goals": 1,
--    "outcomes": [{"market_code": "1X2", "outcome_code": "HOME", "line": 0, "result": "WON"}, ...]}
-- Si falta el resultado de alguna selección apostada, no se liquida nada (error MISSING_RESULT).
CREATE OR REPLACE FUNCTION fn_liquidar_partido(p_match_code TEXT, p_resultado JSONB)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  r          RECORD;
  v_result   TEXT;
  v_res      JSONB;
  v_settled  INTEGER := 0;
  v_won      INTEGER := 0;
  v_lost     INTEGER := 0;
  v_refunded INTEGER := 0;
  v_paid     NUMERIC(16,2) := 0;
BEGIN
  IF p_match_code IS NULL OR p_match_code !~ '^[A-Z]{2}[0-9]{6}$' THEN
    PERFORM fn_raise('INVALID_MATCH', 'El código de partido no es válido.');
  END IF;
  IF p_resultado IS NULL OR jsonb_typeof(p_resultado -> 'outcomes') <> 'array' THEN
    PERFORM fn_raise('INVALID_RESULT', 'Falta la lista de resultados por selección.');
  END IF;

  -- Ordenado por cuenta: los bloqueos se toman siempre en el mismo orden.
  FOR r IN
    SELECT b.id, l.market_code, l.outcome_code, l.line
    FROM bet_leg l
    JOIN bet b ON b.id = l.bet_id
    WHERE l.match_code = p_match_code AND b.status = fn_bet_status('OPEN')
    ORDER BY b.account_id, b.id
  LOOP
    SELECT o ->> 'result' INTO v_result
    FROM jsonb_array_elements(p_resultado -> 'outcomes') AS o
    WHERE o ->> 'market_code' = r.market_code
      AND o ->> 'outcome_code' = r.outcome_code
      AND COALESCE((o ->> 'line')::NUMERIC, 0) = r.line
    LIMIT 1;

    IF v_result IS NULL THEN
      PERFORM fn_raise('MISSING_RESULT',
        format('Falta el resultado de %s / %s / %s.', r.market_code, r.outcome_code, r.line));
    END IF;

    v_res := fn_liquidar_apuesta(r.id, v_result);
    IF (v_res ->> 'settled')::BOOLEAN THEN
      v_settled := v_settled + 1;
      v_paid := v_paid + (v_res ->> 'payout')::NUMERIC;
      IF v_result = 'WON' THEN v_won := v_won + 1;
      ELSIF v_result = 'LOST' THEN v_lost := v_lost + 1;
      ELSE v_refunded := v_refunded + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'match_code', p_match_code,
    'settled',    v_settled,
    'won',        v_won,
    'lost',       v_lost,
    'refunded',   v_refunded,
    'total_paid', v_paid
  );
END
$$;

-- ---------- fn_anular_apuesta ----------
-- Anula una apuesta y reintegra el monto, solo si está ABIERTA.
-- Una apuesta ya liquidada o anulada no se toca (error BET_NOT_OPEN).
CREATE OR REPLACE FUNCTION fn_anular_apuesta(p_bet_id BIGINT, p_reason TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_account_id INTEGER;
  v_account    account%ROWTYPE;
  v_bet        bet%ROWTYPE;
  v_balance    NUMERIC(14,2);
BEGIN
  SELECT account_id INTO v_account_id FROM bet WHERE id = p_bet_id;
  IF NOT FOUND THEN
    PERFORM fn_raise('BET_NOT_FOUND', 'La apuesta no existe.');
  END IF;

  SELECT * INTO v_account FROM account WHERE id = v_account_id FOR UPDATE;
  SELECT * INTO v_bet FROM bet WHERE id = p_bet_id FOR UPDATE;

  IF v_bet.status <> fn_bet_status('OPEN') THEN
    PERFORM fn_raise('BET_NOT_OPEN', 'Solo se puede anular una apuesta abierta.');
  END IF;

  UPDATE bet SET status = fn_bet_status('CANCELLED'), settled_at = now() WHERE id = v_bet.id;
  UPDATE bet_leg SET status = fn_bet_status('CANCELLED') WHERE bet_id = v_bet.id;

  v_balance := v_account.balance + v_bet.stake;
  UPDATE account SET balance = v_balance, updated_at = now() WHERE id = v_account.id;
  INSERT INTO balance_movement (account_id, movement_type, amount, resulting_balance, reference, bet_id)
  VALUES (v_account.id, fn_movement_type('BET_REFUND'), v_bet.stake, v_balance, 'CANCEL:' || v_bet.ticket_code, v_bet.id);

  RETURN jsonb_build_object('cancelled', true, 'bet_id', p_bet_id, 'refunded', v_bet.stake,
                            'balance', v_balance, 'reason', p_reason);
END
$$;
