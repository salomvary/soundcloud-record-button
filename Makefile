deploy:
	cd dist; git clean -f; git rm -rf * || true
	cp -v `git ls-files *.{html,js,css}` dist/
	cp config.production.js dist/config.js
	cd dist; git add -A
	cd dist; git commit -m "update"; git push
