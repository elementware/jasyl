#!/bin/bash
YELLOW="\033[1;33m"; GREEN="\033[0;32m"
echo -e "\n${YELLOW}▶ Остановка JASYL...${NC}"
docker-compose down
echo -e "${GREEN}✅ JASYL остановлен${NC}"
