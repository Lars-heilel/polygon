ROOT_DIR := $(abspath $(dir $(lastword $(MAKEFILE_LIST)))/../..)
ENV_FILE := ../../.env.production

.PHONY: build start stop restart logs backup clean

build:
	cd $(ROOT_DIR) && NODE_ENV=production npx nx build @org/messenger --mode production
	mkdir -p nginx/html
	cp -r $(ROOT_DIR)/apps/client/messenger/dist/* nginx/html/
	docker compose --env-file $(ENV_FILE) build

start:
	docker compose --env-file $(ENV_FILE) up -d

stop:
	docker compose down

restart: stop start

logs:
	docker compose logs -f

backup:
	@mkdir -p backups
	docker exec polygon-postgres pg_dump -U polygon -d polygon -Fc > backups/polygon_$$(date +%Y%m%d_%H%M%S).dump

clean:
	rm -rf nginx/html/
