SOURCES := $(wildcard */*.md)
TARGETS := $(addprefix public/, $(SOURCES:.md=/index.html))

public: index.html css $(TARGETS)
	mkdir -p public; \
	rsync -rLv index.html css public/

node_modules:
	bun install --frozen-lockfile

public/%/index.html: %.md index.html
	@mkdir -p 'public/$*'
	# cp index.html '$@'
	bun run build/args.js '$<' -o '$@'

index.html: template.html build.js node_modules $(SOURCES)
	bun run build.js
