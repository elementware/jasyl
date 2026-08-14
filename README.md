# 🌿 JASYL – Intelligent Green Space Monitoring System

[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://jasyl.vercel.app)
[![Render](https://img.shields.io/badge/Backend%20on-Render-46b4b4?style=for-the-badge&logo=render)](https://jasyl-3.onrender.com)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)
[![Status](https://img.shields.io/badge/Status-MVP%20Ready-brightgreen?style=for-the-badge)](https://github.com/your-username/jasyl)

> **JASYL** (каз. «Зелёный») — MVP системы мониторинга и учёта зелёных насаждений с использованием компьютерного зрения. Проект разработан в рамках хакатона и предназначен для коммунальных служб и специалистов по благоустройству.

---

## 🚀 Демо

- **Frontend:** [https://jasyl.vercel.app](https://jasyl.vercel.app)
- **Backend API:** [https://jasyl-3.onrender.com](https://jasyl-3.onrender.com)
- **API Документация:** [https://jasyl-3.onrender.com/docs](https://jasyl-3.onrender.com/docs)

> ⚠️ **Важно:** Бэкенд использует память (in-memory) для хранения данных. При перезапуске сервера все данные сбрасываются. Это нормально для MVP.

---

## 📋 Функциональность MVP

### Основные возможности
- 📸 **Загрузка фото дерева** (камера или галерея) с автоматическим анализом состояния (заглушка AI).
- 🗺️ **Интерактивная карта** (OpenStreetMap) с маркерами деревьев, цвет которых отражает состояние.
- 🌳 **Цифровой паспорт дерева** с фото, видом, состоянием, координатами, историей осмотров и рекомендациями.
- 📋 **Заявки на работы** с приоритетом, статусом и привязкой к дереву.
- 📊 **Аналитика** (статистика состояний, прогноз) – визуализация на Dashboard.
- 📱 **Адаптивный дизайн** (Apple/Material Style) и поддержка мобильных устройств.
- 🔄 **Офлайн-режим** (сохранение фото в IndexedDB, синхронизация при появлении интернета).

### Что в MVP реализовано, но требует доработки
- AI-анализ – заглушка (возвращает случайное состояние). Реальная модель подключается отдельно.
- Хранение данных – in-memory, без постоянной базы. Для продакшена нужна PostgreSQL.
- Аутентификация – отсутствует (для MVP не требовалась).

---

## 🛠️ Технологический стек

| Компонент | Технологии |
|-----------|------------|
| **Frontend** | HTML5, Tailwind CSS, Vanilla JavaScript, Leaflet.js, Chart.js |
| **Backend** | Python 3.11, FastAPI, Uvicorn |
| **Хостинг** | Vercel (Frontend), Render.com (Backend) |
| **Офлайн-хранилище** | IndexedDB, localStorage |
| **Карта** | OpenStreetMap (Leaflet) |
| **Статика** | Nginx (локально), Vercel для продакшена |

---

## 📁 Структура проекта

