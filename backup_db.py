#!/usr/bin/env python3
"""
Backup de la base de datos PostgreSQL (modo terminal).
Crea un .tar con el volcado SQL en backups/DB/ con fecha y hora en el nombre.
Requiere: pg_dump (herramientas de PostgreSQL) en el PATH.
"""
import os
import re
import subprocess
import sys
import tarfile
from datetime import datetime
from pathlib import Path

# Raíz del proyecto (carpeta donde está este script)
PROJECT_ROOT = Path(__file__).resolve().parent
BACKUPS_DB = PROJECT_ROOT / "backups" / "DB"
SERVER_ENV = PROJECT_ROOT / "server" / ".env"


def load_database_url():
    """Lee DATABASE_URL desde server/.env"""
    if not SERVER_ENV.exists():
        return None
    with open(SERVER_ENV, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line.startswith("DATABASE_URL="):
                value = line.split("=", 1)[1].strip()
                if value.startswith(('"', "'")):
                    value = value[1:-1]
                return value
    return None


def main():
    print("Backup base de datos")
    print("-------------------")

    BACKUPS_DB.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    sql_name = f"dump_{timestamp}.sql"
    tar_name = f"backup_db_{timestamp}.tar"
    sql_path = PROJECT_ROOT / sql_name
    tar_path = BACKUPS_DB / tar_name

    db_url = load_database_url()
    if not db_url:
        print("ERROR: No se encontró DATABASE_URL en server/.env", file=sys.stderr)
        sys.exit(1)

    # Buscar pg_dump
    pg_dump = "pg_dump"
    if os.name == "nt":
        for p in os.environ.get("PATH", "").split(os.pathsep):
            exe = Path(p) / "pg_dump.exe"
            if exe.exists():
                pg_dump = str(exe)
                break

    try:
        print("[1/3] Volcando base de datos...")
        env = os.environ.copy()
        match = re.match(r"postgresql://([^:]+):([^@]+)@", db_url)
        if match:
            env["PGPASSWORD"] = match.group(2)
        proc = subprocess.run(
            [pg_dump, db_url, "-F", "p", "-f", str(sql_path)],
            capture_output=True,
            text=True,
            env=env,
            timeout=300,
        )
        if proc.returncode != 0:
            err = proc.stderr or "pg_dump falló."
            if "not found" in err.lower() or "no se reconoce" in err.lower():
                err = "No se encontró pg_dump. Instala las herramientas de PostgreSQL y añade su carpeta bin al PATH."
            print(f"ERROR: {err}", file=sys.stderr)
            if sql_path.exists():
                sql_path.unlink()
            sys.exit(1)

        print("[2/3] Creando archivo .tar...")
        with tarfile.open(tar_path, "w") as tar:
            tar.add(sql_path, arcname=sql_name)
        sql_path.unlink()

        print("[3/3] Listo.")
        print(f"Guardado en: {tar_path}")
    except subprocess.TimeoutExpired:
        if sql_path.exists():
            sql_path.unlink()
        print("ERROR: El volcado tardó demasiado.", file=sys.stderr)
        sys.exit(1)
    except FileNotFoundError:
        print(
            "ERROR: No se encontró pg_dump. Instala las herramientas de PostgreSQL (cliente) y añade su carpeta bin al PATH.",
            file=sys.stderr,
        )
        sys.exit(1)
    except Exception as e:
        if sql_path.exists():
            sql_path.unlink(missing_ok=True)
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
