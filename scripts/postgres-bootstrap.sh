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

echo "Waiting for postgres at ${POSTGRES_HOST}:${POSTGRES_PORT}"
until pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_BOOTSTRAP_USER" -d "$POSTGRES_BOOTSTRAP_DB" >/dev/null 2>&1; do
  sleep 1
done

echo "Ensuring role ${POSTGRES_USER}"
psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_BOOTSTRAP_USER" -d "$POSTGRES_BOOTSTRAP_DB" \
  -v target_user="$POSTGRES_USER" \
  -v target_password="$POSTGRES_PASSWORD" \
  -v ON_ERROR_STOP=1 <<'SQL'
do $$
begin
  if not exists (select 1 from pg_roles where rolname = :'target_user') then
    execute format('create role %I login password %L', :'target_user', :'target_password');
  else
    execute format('alter role %I login password %L', :'target_user', :'target_password');
  end if;
end
$$;
SQL

DB_EXISTS="$(psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_BOOTSTRAP_USER" -d "$POSTGRES_BOOTSTRAP_DB" \
  -v target_db="$POSTGRES_DB" \
  -tAc "select 1 from pg_database where datname = :'target_db'")"

if [ "$DB_EXISTS" != "1" ]; then
  echo "Creating database ${POSTGRES_DB}"
  psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_BOOTSTRAP_USER" -d "$POSTGRES_BOOTSTRAP_DB" \
    -v target_db="$POSTGRES_DB" \
    -v target_user="$POSTGRES_USER" \
    -v ON_ERROR_STOP=1 \
    -c 'create database :"target_db" owner :"target_user"'
fi

echo "Ensuring database ownership and privileges"
psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_BOOTSTRAP_USER" -d "$POSTGRES_DB" \
  -v target_db="$POSTGRES_DB" \
  -v target_user="$POSTGRES_USER" \
  -v ON_ERROR_STOP=1 <<'SQL'
alter database :"target_db" owner to :"target_user";
grant all privileges on database :"target_db" to :"target_user";
grant all on schema public to :"target_user";
SQL

echo "Postgres bootstrap complete"
