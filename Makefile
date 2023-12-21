SOURCES := $(wildcard */*.md)

public: index.html css
	mkdir -p public; \
	rsync -rLv index.html css public/

node_modules:
	bun install --frozen-lockfile

index.html: template.html build.js node_modules $(SOURCES)
	bun run build.js
