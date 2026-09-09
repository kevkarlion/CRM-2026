#!/bin/bash
# Backup diario del CRM - MongoDB
# Uso: ./backup-mongo.sh

# Configuración
MONGO_URI="mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test"
BACKUP_DIR="$HOME/backups/crm"
DATE=$(date +%Y%m%d)
TIME=$(date +%H%M%S)
BACKUP_NAME="crm_backup_${DATE}_${TIME}"

# Crear directorio si no existe
mkdir -p "$BACKUP_DIR"

echo "=== Iniciando backup ==="
echo "Fecha: $(date)"
echo "Directorio: $BACKUP_DIR/$BACKUP_NAME"

# Hacer backup
mongodump \
  --uri="$MONGO_URI" \
  --out="$BACKUP_DIR/$BACKUP_NAME" \
  --gzip

# Verificar si fue exitoso
if [ $? -eq 0 ]; then
  echo "✅ Backup exitoso"
  
  # Tamaño del backup
  du -sh "$BACKUP_DIR/$BACKUP_NAME"
  
  # Eliminar backups de más de 7 días
  find "$BACKUP_DIR" -type d -mtime +7 -exec rm -rf {} \; 2>/dev/null
  echo "🗑️  Backups de más de 7 días eliminados"
else
  echo "❌ Error en el backup"
  exit 1
fi

echo "=== Backup completado ==="
