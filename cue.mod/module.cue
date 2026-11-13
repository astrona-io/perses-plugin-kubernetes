module: "github.com/astrona-io/perses-plugin-kubernetes@v0"
language: {
	version: "v0.16.1"
}
source: {
	kind: "git"
}
deps: {
	"github.com/perses/spec/cue@v0": {
		v:       "v0.3.0"
		default: true
	}
}
