UUID := clippy@io.clippy
DEST := $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

.PHONY: install uninstall pack lint

install:
	@mkdir -p $(HOME)/.local/share/gnome-shell/extensions
	@if [ -L $(DEST) ] || [ -d $(DEST) ]; then rm -rf $(DEST); fi
	ln -sfn $(CURDIR) $(DEST)
	@echo "Installed $(UUID) → $(DEST)"
	@echo "Log out and back in, then: gnome-extensions enable $(UUID)"

uninstall:
	@if [ -L $(DEST) ] || [ -d $(DEST) ]; then rm -rf $(DEST); echo "Removed $(DEST)"; fi

pack:
	@rm -f clippy.zip
	zip clippy.zip metadata.json extension.js stylesheet.css README.md icons/clippy-symbolic.svg
	@echo "Packed → $(CURDIR)/clippy.zip"

lint:
	@which gjs >/dev/null || { echo "install gjs to lint"; exit 1; }
	gjs -c "import('./extension.js').then(() => print('ok')).catch(e => { print(e); process.exit(1); })" || true
