BINARY := mdslides
PKG := ./cmd/mdslides
DIST := dist
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")

# -s -w strip the debugger symbol table and DWARF info (~15MB -> ~10MB).
# -X main.version injects the git tag/version into the compiled binary.
LDFLAGS := -s -w -X main.version=$(VERSION)

# Cross-compilation target platforms
PLATFORMS := linux/amd64 linux/arm64 darwin/amd64 darwin/arm64 windows/amd64 windows/arm64

.PHONY: build run demo test vet fmt fmt-check tidy check clean dist release-local

.DEFAULT_GOAL := build

build:
	go build -ldflags="$(LDFLAGS)" -o $(BINARY) $(PKG)

# make run ARGS=testdata/sample.md
run: build
	./$(BINARY) $(ARGS)

demo: build
	./$(BINARY) testdata/sample.md

test:
	go test ./...

vet:
	go vet ./...

fmt:
	gofmt -w .

fmt-check:
	@test -z "$$(gofmt -l .)" || (echo "gofmt needs to be run on:"; gofmt -l .; exit 1)

tidy:
	go mod tidy

# Pre-commit sequence: format check, vet, test, build
check: fmt-check vet test build

# Build raw binaries for every target platform into dist/
dist:
	@mkdir -p $(DIST)
	@for p in $(PLATFORMS); do \
		os=$$(echo $$p | cut -d/ -f1); \
		arch=$$(echo $$p | cut -d/ -f2); \
		out=$(DIST)/$(BINARY)-$$os-$$arch; \
		if [ "$$os" = "windows" ]; then out=$$out.exe; fi; \
		echo "building $$out"; \
		GOOS=$$os GOARCH=$$arch go build -ldflags="$(LDFLAGS)" -o $$out $(PKG) || exit 1; \
	done

# Package binaries into compressed archives (.tar.gz / .zip) with sha256 checksums
release-local: dist
	@cd $(DIST) && \
	for p in $(PLATFORMS); do \
		os=$$(echo $$p | cut -d/ -f1); \
		arch=$$(echo $$p | cut -d/ -f2); \
		bin=$(BINARY)-$$os-$$arch; \
		if [ "$$os" = "windows" ]; then \
			bin=$$bin.exe; \
			zip -q $(BINARY)-$$os-$$arch.zip $$bin 2>/dev/null || tar -czf $(BINARY)-$$os-$$arch.tar.gz $$bin; \
		else \
			tar -czf $(BINARY)-$$os-$$arch.tar.gz $$bin; \
		fi; \
	done && \
	sha256sum *.tar.gz *.zip 2>/dev/null > checksums.txt || true; \
	echo "packaged release archives in $(DIST)/"

clean:
	rm -f $(BINARY)
	rm -rf $(DIST)

