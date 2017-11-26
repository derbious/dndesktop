electron_ver = v1.6.15

cache_macos:
	@echo "preparing the macOS build cache"
	mkdir -p buildcache
	if [ ! -f buildcache/electron-$(electron_ver)-darwin-x64.zip ]; then \
    curl -q -o buildcache/electron-$(electron_ver)-darwin-x64.zip https://github.com/electron/electron/releases/download/$(electron_ver)/electron-$(electron_ver)-darwin-x64.zip -L; \
	fi

cache_windows:
	@echo "preparing the windows build cache"
	mkdir -p buildcache
	if [ ! -f buildcache/electron-$(electron_ver)-win32-x64.zip ]; then \
    curl -q -o buildcache/electron-$(electron_ver)-win32-x64.zip https://github.com/electron/electron/releases/download/$(electron_ver)/electron-$(electron_ver)-win32-x64.zip -L; \
	fi

macos: cache_macos
	@echo "Building the app for macOS"
	rm -rf tmp_mac
	mkdir -p tmp_mac
	unzip buildcache/electron-$(electron_ver)-darwin-x64.zip -d tmp_mac/
	cp -r src/ tmp_mac/Electron.app/Contents/Resources/app
	mkdir -p build
	mv tmp_mac/Electron.app build/Electron.app
	rm -rf tmp_mac

windows: cache_windows
	@echo "Building the app for Windows"
	rm -rf tmp_windows
	mkdir -p tmp_windows/dndesktop
	unzip buildcache/electron-v1.6.15-win32-x64.zip -d tmp_windows/dndesktop
	cp -r src/ tmp_windows/dndesktop/resources/app
	mkdir -p build
	pushd tmp_windows; zip -r ../build/dndesktop.zip dndesktop; popd
	rm -rf tmp_windows


clean:
	rm -rf tmp_{mac,windows}
	rm -rf buildcache
	rm -rf build
