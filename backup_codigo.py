#!/usr/bin/env python3
"""
Backup del código del proyecto (modo terminal).
Incluye TODO lo necesario para redesplegar: código fuente, configs, package.json,
lock files, Prisma, Docker, docs, assets (client/public, img), scripts.
Excluye SOLO: node_modules (npm), .git, backups/, dist/build (regenerables),
archivos .env con secretos, cachés y entornos virtuales.
"""
import sys
import tarfile
from datetime import datetime
from pathlib import Path

# Raíz del proyecto (carpeta donde está este script)
PROJECT_ROOT = Path(__file__).resolve().parent
BACKUPS_DEV = PROJECT_ROOT / "backups" / "dev"

# Solo carpetas que no son código ni esenciales para desplegar
EXCLUDE_DIRS = {
    "node_modules",   # instalado con npm install
    ".git",           # control de versiones (se puede re-inicializar)
    "backups",        # salida de backups
    "dist",           # compilado (npm run build)
    "build",          # compilado
    "__pycache__",    # caché Python
    ".idea",          # IDE
    ".vscode",        # IDE (opcional: quitar si quieres guardar config del editor)
    "venv",           # entorno virtual Python
    ".venv",
    ".vite",          # caché Vite (dentro de client si existe fuera de node_modules)
}

# Solo archivos con secretos (nunca subir)
EXCLUDE_FILES = {".env", ".env.local", ".env.bak"}


def filter_tar(tarinfo):
    """
    Excluir únicamente: rutas que contengan EXCLUDE_DIRS, o archivos con secretos/logs.
    Se INCLUYEN: .gitignore, .dockerignore, .env.example, .nvmrc, package-lock.json,
    todo el código (src/), prisma/, client/public/, Dockerfile*, docker-compose, etc.
    """
    name = tarinfo.name.replace("\\", "/")
    parts = name.split("/")
    for part in parts:
        if part in EXCLUDE_DIRS:
            return None
    # Archivos con secretos o logs
    if tarinfo.isfile():
        basename = name.split("/")[-1]
        if basename in EXCLUDE_FILES or basename.endswith(".log"):
            return None
    return tarinfo


def main():
    print("Backup código (todo lo necesario para redesplegar)")
    print("--------------------------------------------------")

    BACKUPS_DEV.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    tar_name = f"backup_codigo_{timestamp}.tar"
    tar_path = BACKUPS_DEV / tar_name

    try:
        print("[1/2] Comprimiendo proyecto...")
        with tarfile.open(tar_path, "w") as tar:
            for item in sorted(PROJECT_ROOT.iterdir()):
                if item.name in EXCLUDE_DIRS:
                    continue
                arc = item.relative_to(PROJECT_ROOT)
                tar.add(item, arcname=arc, filter=filter_tar)

        print("[2/2] Listo.")
        print(f"Guardado en: {tar_path}")
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
