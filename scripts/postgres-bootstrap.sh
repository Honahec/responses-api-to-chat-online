#!/bin/sh
set -eu

: "${POSTGRES_HOST:=postgres}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
: "${POSTGRES_BOOTSTRAP_DB:=postgres}"
: "${POSTGRES_BOOTSTRAP_USER:=$POSTGRES_USER}"
: "${POSTGRES_BOOTSTRAP_PASSWORD:=$POSTGRES_PASSWORD}"

export PGPASSWORD="$POSTGRES_BOOTSTRAP_PASSWORD"

quote_ident() {
  printf '"%s"' "$(printf '%s' "$1" | sed 's/"/""/g')"
}

quote_literal() {
  printf "'%s'" "$(printf '%s' "$1" | sed "s/'/''/g")"
}

TARGET_USER_IDENT="$(quote_ident "$POSTGRES_USER")"
TARGET_USER_LITERAL="$(quote_literal "$POSTGRES_USER")"
TARGET_PASSWORD_LITERAL="$(quote_literal "$POSTGRES_PASSWORD")"
TARGET_DB_IDENT="$(quote_ident "$POSTGRES_DB")"
TARGET_DB_LITERAL="$(quote_literal "$POSTGRES_DB")"

echo "Waiting for postgres at ${POSTGRES_HOST}:${POSTGRES_PORT}"
until pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_BOOTSTRAP_USER" -d "$POSTGRES_BOOTSTRAP_DB" >/dev/null 2>&1; do
  sleep 1
done

echo "Ensuring role ${POSTGRES_USER}"
ROLE_EXISTS="$(psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_BOOTSTRAP_USER" -d "$POSTGRES_BOOTSTRAP_DB" \
  -tAc "select 1 from pg_roles where rolname = ${TARGET_USER_LITERAL}")"

if [ "$ROLE_EXISTS" = "1" ]; then
  psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_BOOTSTRAP_USER" -d "$POSTGRES_BOOTSTRAP_DB" -v ON_ERROR_STOP=1 \
    -c "alter role ${TARGET_USER_IDENT} login password ${TARGET_PASSWORD_LITERAL}"
else
  psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_BOOTSTRAP_USER" -d "$POSTGRES_BOOTSTRAP_DB" -v ON_ERROR_STOP=1 \
    -c "create role ${TARGET_USER_IDENT} login password ${TARGET_PASSWORD_LITERAL}"
fi

DB_EXISTS="$(psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_BOOTSTRAP_USER" -d "$POSTGRES_BOOTSTRAP_DB" \
  -tAc "select 1 from pg_database where datname = ${TARGET_DB_LITERAL}")"

if [ "$DB_EXISTS" != "1" ]; then
  echo "Creating database ${POSTGRES_DB}"
  psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_BOOTSTRAP_USER" -d "$POSTGRES_BOOTSTRAP_DB" -v ON_ERROR_STOP=1 \
    -c "create database ${TARGET_DB_IDENT} owner ${TARGET_USER_IDENT}"
fi

echo "Ensuring database ownership and privileges"
psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_BOOTSTRAP_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 <<SQL
alter database ${TARGET_DB_IDENT} owner to ${TARGET_USER_IDENT};
grant all privileges on database ${TARGET_DB_IDENT} to ${TARGET_USER_IDENT};
grant all on schema public to ${TARGET_USER_IDENT};
grant all privileges on all tables in schema public to ${TARGET_USER_IDENT};
grant all privileges on all sequences in schema public to ${TARGET_USER_IDENT};
grant all privileges on all functions in schema public to ${TARGET_USER_IDENT};
alter default privileges in schema public grant all on tables to ${TARGET_USER_IDENT};
alter default privileges in schema public grant all on sequences to ${TARGET_USER_IDENT};
alter default privileges in schema public grant all on functions to ${TARGET_USER_IDENT};
SQL

echo "Ensuring ownership of existing public schema objects"
psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_BOOTSTRAP_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 <<SQL
select format('alter table if exists %I.%I owner to ${TARGET_USER_IDENT};', schemaname, tablename)
from pg_tables
where schemaname = 'public'
\gexec

select format('alter sequence if exists %I.%I owner to ${TARGET_USER_IDENT};', sequence_schema, sequence_name)
from information_schema.sequences
where sequence_schema = 'public'
\gexec

select format('alter function %s owner to ${TARGET_USER_IDENT};', oid::regprocedure)
from pg_proc
where pronamespace = 'public'::regnamespace
\gexec
SQL

echo "Postgres bootstrap complete"
