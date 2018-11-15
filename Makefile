electron_ver = v3.0.6

cache_macos:
	@echo "preparing the macOS build cache"
	mkdir -p buildcache
	if [ ! -f buildcache/electron-$(electron_ver)-darwin-x64.zip ]; then \
    curl -q -o buildcache/electron-$(electron_ver)-darwin-x64.zip https://github.com/electron/electron/releases/download/$(electron_ver)/electron-$(electron_ver)-darwin-x64.zip -L; \
	fi

macos: cache_macos
	@echo "Building the app for macOS"
	rm -rf tmp_mac
	mkdir -p tmp_mac
	unzip buildcache/electron-$(electron_ver)-darwin-x64.zip -d tmp_mac/
	cp -r src/ tmp_mac/Electron.app/Contents/Resources/app
	mkdir -p build
	rm -rf build/Electron.app
	mv tmp_mac/Electron.app build/Electron.app
	rm -rf tmp_mac

clean:
	rm -rf tmp_mac
	rm -rf buildcache
	rm -rf build
