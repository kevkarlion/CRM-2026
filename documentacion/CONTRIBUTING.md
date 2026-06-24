# Contributing — CRM 2026

> **Última actualización**: 2026-06-24

## Stack

| Herramienta | Versión |
|-------------|---------|
| Node.js | 20.x |
| TypeScript | ^5.7.0 |
| MongoDB | 8+ (Mongoose ^8.9.0) |
| Tests | Vitest ^3.0.0 |

## Setup Local

```bash
# 1. Clonar el repositorio
git clone <repo-url>
cd crm-2026

# 2. Instalar dependencias
npm ci

# 3. Variables de entorno (opcional para tests de integración)
export MONGODB_URI="mongodb://localhost:27017/crm-2026-test"
```

## Comandos Útiles

```bash
# Tests unitarios
npm test                    # Una vez
npm run test:watch          # Modo watch
npm run test:ui             # UI Vitest

# TypeScript
npx tsc --noEmit           # Type check (sin compilar)
npx tsc                    # Compilar a dist/

# Lint (no configurado aún)
```

## Tests

El proyecto tiene **295+ tests** organizados en **18 suites**:

| Módulo | Tests | Archivos |
|--------|-------|----------|
| quotes | 98 | 5 |
| leads | 93 | 6 |
| operations | 65 | 5 |
| loggers | 12 | 1 |
| schemas (integration) | 22 | 1 |

Ejecutar `npm test` antes de pushear cualquier cambio.

## Estrategia de Ramas

```
main ─── tags: v0.1.0 ... v0.5.0
  │
  ├── feature/<nombre>          # Feature branches → main
  └── pr/<numero>-<desc>        # PR branches (feature-branch-chain)
```

### Stacked PRs (Stacked-to-main)

Para cambios grandes, usar PRs encadenados que mergean directamente a `main`:

1. PR #1: Merge feature base a main
2. PR #2: Siguiente capa sobre main
3. PR #3: Capa final sobre main

### Feature-Branch-Chain

Alternativa para cambios que requieren coordinación:

```
feature/<tracker>                  # Rama tracker (única que mergea a main)
├── pr/1-foundation                # PR #1 → tracker
├── pr/2-services                  # PR #2 → pr/1-foundation
└── pr/3-routes                    # PR #3 → pr/2-services
```

Merge del tracker a main con `--no-ff`.

## Convención de Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: agregar módulo de cotizaciones
fix(quotes): corregir cálculo de subtotal en items vacíos
chore: actualizar dependencias
docs: agregar documentación de CI
refactor(operations): extraer state machine a helper
test(leads): agregar test de conversión con rollback
```

## CI Pipeline

Ver [`CI.md`](./CI.md) para detalles del pipeline de integración continua.
