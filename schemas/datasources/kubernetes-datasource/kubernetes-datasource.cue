package model

import (
	"list"
	"github.com/perses/spec/cue/datasource/proxy/http"
)

#kind: "KubernetesDatasource"

// An allow-list entry: GET only, anchored with ^ and $, and never a path to secrets or to a
// subresource that runs or streams something (exec, attach, portforward, proxy, log) or a watch.
#allowedEndpoint: {
	endpointPattern: string & =~"^\\^.*\\$$" & !~"secrets|exec|attach|portforward|proxy|/log|watch"
	method:          "GET"
}

kind: #kind
// Proxy only: there is no directUrl, so the browser never talks to the API server.
spec: close({
	proxy: http.#Proxy & {
		spec: {
			// Required and non-empty: an empty list would let the proxy forward any request.
			allowedEndpoints: list.MinItems(1) & [...#allowedEndpoint]
			// The API server must not receive the viewer's identity provider token.
			oauthPassthrough?: false
		}
	}
})

// The datasource field of the queries and the variable: a KubernetesDatasource, or a $variable.
// Written out rather than built from common.#datasourceSelector so the kind is enforced across packages.
#selector: {
	datasource?: =~"^\\$[a-zA-Z0-9_-]+$" | {
		kind:  #kind
		name?: string
	}
}
