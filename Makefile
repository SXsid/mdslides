BINARY := mdslides
PKG := ./cmd/mdslides

# Go's own build cache already tracks source staleness; Make's file-
# timestamp tracking would just get in the way (e.g. `make build` doing
# nothing once a `mdslides` binary exists, until you delete it). So every
# target here is phony — it always runs, and `go build`/`go test` decide
# for themselves what actually needs redoing.
.PHONY: build run demo test vet fmt fmt-check tidy check clean

.DEFAULT_GOAL := build

build:
	go build -o $(BINARY) $(PKG)

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

clean:
	rm -f $(BINARY)
