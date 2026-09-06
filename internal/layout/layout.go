package layout

// Kind is a CSS grid shape a Page's images get arranged into.
type Kind int

const (
	// Text is a page with no images — content just fills the screen.
	Text Kind = iota
	// Split is one image: two columns, text and image side by side. The
	// renderer decides which column is which using Page.ImagesFirst —
	// Classify only decides the shape, never the order.
	Split
	// Stack is two images stacked in one column, text filling the other.
	Stack
	// Bento3 is one large image plus two smaller ones, with text as a
	// card filling the remaining grid cell.
	Bento3
	// Bento4 is a 2x2 grid of images, with text as a header/caption
	// strip above it.
	Bento4
)

// MaxPerPage is the most images Classify ever designs a shape for. A page
// with more images than this is not this package's problem to solve —
// deciding to split it into continuation pages happens in the renderer,
// which is the only package that depends on both markdown (to see the
// Page) and layout (to know this limit). Keeping the split out of here
// keeps Classify a pure function of a count, and keeps the Parser package
// from ever needing to import layout at all.
const MaxPerPage = 4

// Classify maps an image count to a grid shape. Counts above MaxPerPage
// clamp to Bento4 — the renderer is expected to never actually call
// Classify with more than MaxPerPage in the first place, once it's
// chunking overflow pages itself.
func Classify(n int) Kind {
	switch {
	case n <= 0:
		return Text
	case n == 1:
		return Split
	case n == 2:
		return Stack
	case n == 3:
		return Bento3
	default:
		return Bento4
	}
}

// String names a Kind for use as a CSS class or template output, e.g.
// class="layout-{{.String}}".
func (k Kind) String() string {
	switch k {
	case Text:
		return "text"
	case Split:
		return "split"
	case Stack:
		return "stack"
	case Bento3:
		return "bento-3"
	case Bento4:
		return "bento-4"
	default:
		return "text"
	}
}
