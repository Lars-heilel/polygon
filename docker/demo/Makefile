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
	@ts=$$(date +%Y%m%d_%H%M%S); \
	for db in polygon polygon_auth polygon_user polygon_chat polygon_notification polygon_media; do \
		echo "Dumping $$db..."; \
		docker exec polygon-demo-postgres pg_dump -U polygon -d $$db -Fc > backups/$${db}_$${ts}.dump; \
	done; \
	echo "Backup complete: backups/*_$${ts}.dump"

clean:
	rm -rf nginx/html/
