public: index.html css
	mkdir -p public; \
	rsync -rLv index.html songs css public/

node_modules:
	bun install --frozen-lockfile

index.html: template.html build.js songs node_modules
	bun run build.js
