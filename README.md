# TFC Alloy Calculator

Vue + Electron калькулятор сплавов TerraFirmaCraft.

## Веб-разработка

```bash
npm run dev
```

## Запуск как Electron-приложение

Собирает Vue в `dist` и открывает его в Electron:

```bash
npm run electron
```

## Electron поверх уже запущенного Vite

По умолчанию ожидает Vite на `http://localhost:5173`:

```bash
npm run electron:dev
```

## Сборка desktop-приложения на Windows

Собирает Vue и portable `.exe`. Готовые файлы появятся в `release`.

```bash
npm run desktop:build
```

То же самое, но явно для Windows:

```bash
npm run desktop:build:win
```

Для NSIS-инсталлятора:

```bash
npm run desktop:build:win:installer
```

Если `electron-builder` снова упадет на `Cannot create symbolic link` в `winCodeSign`,
включи Windows Developer Mode или запусти терминал от администратора, затем удали
`C:\Users\Sergei\AppData\Local\electron-builder\Cache\winCodeSign` и повтори команду.

Для явной сборки под Linux:

```bash
npm run desktop:build:linux
```
