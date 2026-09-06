package layout

import "testing"

func TestClassify(t *testing.T) {
	cases := []struct {
		n    int
		want Kind
	}{
		{-1, Text}, // defensive: a negative count shouldn't be possible, but don't panic on it
		{0, Text},
		{1, Split},
		{2, Stack},
		{3, Bento3},
		{4, Bento4},
		{5, Bento4},  // beyond MaxPerPage: clamps, doesn't error — renderer's job to have split first
		{12, Bento4},
	}
	for _, c := range cases {
		if got := Classify(c.n); got != c.want {
			t.Errorf("Classify(%d) = %v, want %v", c.n, got, c.want)
		}
	}
}

func TestKindString(t *testing.T) {
	cases := []struct {
		k    Kind
		want string
	}{
		{Text, "text"},
		{Split, "split"},
		{Stack, "stack"},
		{Bento3, "bento-3"},
		{Bento4, "bento-4"},
	}
	for _, c := range cases {
		if got := c.k.String(); got != c.want {
			t.Errorf("%v.String() = %q, want %q", int(c.k), got, c.want)
		}
	}
}
