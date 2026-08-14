#!/bin/bash
GREEN="\033[0;32m"; BLUE="\033[0;34m"; YELLOW="\033[1;33m"; NC="\033[0m"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  🚀 ЗАПУСК JASYL${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
if ! docker info &> /dev/null; then echo "❌ Docker не запущен"; exit 1; fi
echo -e "\n${YELLOW}▶ Остановка старых контейнеров...${NC}"
docker-compose down 2>/dev/null || true
echo -e "\n${YELLOW}▶ Сборка и запуск...${NC}"
docker-compose up -d --build
echo -e "\n${YELLOW}▶ Ожидание готовности...${NC}"
sleep 10
echo -e "\n${YELLOW}▶ Проверка...${NC}"
curl -s http://localhost:8000/health > /dev/null && echo -e "${GREEN}✅ Backend OK${NC}" || echo "❌ Backend не отвечает"
curl -s http://localhost:5000/health > /dev/null && echo -e "${GREEN}✅ ML OK${NC}" || echo "❌ ML не отвечает"
curl -s http://localhost:3000 > /dev/null && echo -e "${GREEN}✅ Frontend OK${NC}" || echo "❌ Frontend не отвечает"
echo -e "\n${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ JASYL ЗАПУЩЕН!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "🌍 Frontend:  ${GREEN}http://localhost:3000${NC}"
echo -e "🔧 API:       ${GREEN}http://localhost:8000${NC}"
echo -e "📚 API Docs:  ${GREEN}http://localhost:8000/docs${NC}"
echo -e "🤖 ML:        ${GREEN}http://localhost:5000${NC}"
echo -e "🗄️  Postgres:  ${GREEN}localhost:5432${NC}"
echo -e "📦 MinIO:     ${GREEN}http://localhost:9001${NC} (admin/minioadmin)"
echo -e "⚡ Redis:     ${GREEN}localhost:6379${NC}"
echo -e "\n${YELLOW}Логи: docker-compose logs -f${NC}"
echo -e "${YELLOW}Остановка: ./stop.sh${NC}"
