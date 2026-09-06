BINARY := mdslides
PKG := ./cmd/mdslides
DIST := dist

# -s -w strip the debugger symbol table and DWARF info. Nothing in this
# project has needed delve/pprof so far (tests + prints have been
# enough), and it's a real win: ~15MB -> ~10MB on this machine. If you
# ever do need `dlv debug`, build without LDFLAGS for that one run.
LDFLAGS := -s -w

# linux/amd64 covers this machine; the rest are what "push for
# Windows/Mac" needs. Go cross-compiles by just setting GOOS/GOARCH —
# no toolchain to install, no Docker, CGO is off by default for this
# module so there's no C compiler dependency to worry about per target.
PLATFORMS := linux/amd64 linux/arm64 darwin/amd64 darwin/arm64 windows/amd64

# Go's own build cache already tracks source staleness; Make's file-
# timestamp tracking would just get in the way (e.g. `make build` doing
# nothing once a `mdslides` binary exists, until you delete it). So every
# target here is phony — it always runs, and `go build`/`go test` decide
# for themselves what actually needs redoing.
.PHONY: build run demo test vet fmt fmt-check tidy check clean dist

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

# The sequence run by hand before every commit so far: format, vet,
# test, then confirm it still builds.
check: fmt-check vet test build

# One binary per platform in PLATFORMS, into dist/. $(1)/$(2) below are
# GOOS/GOARCH split from each "os/arch" entry; windows gets the .exe
# suffix it actually needs to be runnable there.
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

clean:
	rm -f $(BINARY)
	rm -rf $(DIST)
