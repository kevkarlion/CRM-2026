# CI Pipeline — CRM 2026

> **Última actualización**: 2026-06-24

## Resumen

El proyecto usa **GitHub Actions** como sistema de integración continua.

Archivo: `.github/workflows/ci.yml`

## Disparadores (Triggers)

| Evento | Ramas |
|--------|-------|
| `push` | `main`, `feature/*`, `pr/*` |
| `pull_request` | `main` |

## Jobs

Un solo job `ci` con los siguientes pasos:

| Paso | Comando | Propósito |
|------|---------|-----------|
| Checkout | `actions/checkout@v4` | Clonar el repositorio |
| Setup Node | `actions/setup-node@v4` (20.x, cache npm) | Configurar Node.js con cache |
| Install | `npm ci` | Instalar dependencias desde lockfile |
| Type check | `npx tsc --noEmit` | Verificar tipos TypeScript |
| Test | `npm test` (`vitest run`) | Ejecutar suite completa de tests |
| Build | `npx tsc` | Compilar TypeScript a `dist/` |

## Notas

- **TypeScript errors**: El proyecto tiene errores TSC pre-existentes (~180 en `main`). El pipeline los reportará, pero no bloquean el merge — el proyecto funciona correctamente con Vitest que usa su propia resolución de módulos.
- **Tests**: `npm test` ejecuta `vitest run` con los 295+ tests actuales.
- **Saltar CI**: Incluir `[skip ci]` en el mensaje de commit para omitir la ejecución.

## Ver Resultados

1. Ir a https://github.com/{owner}/crm-2026/actions
2. Seleccionar el workflow run correspondiente
3. Revisar logs de cada paso

## Desarrollo Local

Para verificar antes de pushear:

```bash
# Type check
npx tsc --noEmit

# Tests
npm test

# Build
npx tsc
```
