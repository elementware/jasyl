#!/bin/bash
YELLOW="\033[1;33m"
echo -e "\n${YELLOW}▶ Логи JASYL...${NC}"
docker-compose logs -f
