// Checks the default allow-list with Go's regexp engine, the one the Perses proxy uses.
//
// The Perses proxy forwards a request when the method is equal and the endpoint pattern matches
// the path (regexp.MatchString, unanchored). This test reads the patterns from the schema example
// so it always checks the list the plugin ships.
package allowlist

import (
	"encoding/json"
	"os"
	"regexp"
	"testing"
)

type endpoint struct {
	EndpointPattern string `json:"endpointPattern"`
	Method          string `json:"method"`
}

type compiled struct {
	pattern *regexp.Regexp
	method  string
}

func load(t *testing.T) []compiled {
	t.Helper()
	raw, err := os.ReadFile("../../schemas/datasources/kubernetes-datasource/kubernetes-datasource.json")
	if err != nil {
		t.Fatal(err)
	}
	var ds struct {
		Spec struct {
			Proxy struct {
				Spec struct {
					AllowedEndpoints []endpoint `json:"allowedEndpoints"`
				} `json:"spec"`
			} `json:"proxy"`
		} `json:"spec"`
	}
	if err := json.Unmarshal(raw, &ds); err != nil {
		t.Fatal(err)
	}
	eps := ds.Spec.Proxy.Spec.AllowedEndpoints
	if len(eps) == 0 {
		t.Fatal("no allowed endpoints in the schema example")
	}
	out := make([]compiled, 0, len(eps))
	for _, e := range eps {
		out = append(out, compiled{regexp.MustCompile(e.EndpointPattern), e.Method})
	}
	return out
}

// allowed mirrors the Perses proxy check.
func allowed(eps []compiled, method, path string) bool {
	for _, e := range eps {
		if e.method == method && e.pattern.MatchString(path) {
			return true
		}
	}
	return false
}

func TestAllowed(t *testing.T) {
	eps := load(t)
	for _, path := range []string{
		"/api/v1/namespaces",
		"/api/v1/nodes",
		"/api/v1/pods",
		"/api/v1/events",
		"/api/v1/namespaces/shop-1/pods",
		"/api/v1/namespaces/shop/events",
		"/apis/apps/v1/deployments",
		"/apis/apps/v1/namespaces/shop/deployments",
		"/apis/apps/v1/namespaces/shop/statefulsets",
		"/apis/apps/v1/namespaces/shop/daemonsets",
		"/apis/apps/v1/namespaces/shop/replicasets",
	} {
		if !allowed(eps, "GET", path) {
			t.Errorf("GET %s should be allowed", path)
		}
	}
}

func TestDeniedMethods(t *testing.T) {
	eps := load(t)
	for _, m := range []string{"POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "CONNECT", "get"} {
		if allowed(eps, m, "/api/v1/pods") {
			t.Errorf("%s /api/v1/pods should be refused", m)
		}
	}
}

func TestDeniedPaths(t *testing.T) {
	eps := load(t)
	for _, path := range []string{
		"/api/v1/secrets",
		"/api/v1/namespaces/shop/secrets",
		"/api/v1/namespaces/shop/secrets/db",
		"/api/v1/namespaces/shop/pods/web-1",
		"/api/v1/namespaces/shop/pods/web-1/exec",
		"/api/v1/namespaces/shop/pods/web-1/attach",
		"/api/v1/namespaces/shop/pods/web-1/log",
		"/api/v1/namespaces/shop/pods/web-1/portforward",
		"/api/v1/namespaces/shop/pods/web-1/proxy",
		"/api/v1/namespaces/shop/services/web:80/proxy/",
		"/api/v1/nodes/node-1/proxy/metrics",
		"/api/v1/namespaces/shop",
		"/api/v1/namespaces/shop/configmaps",
		"/api/v1/namespaces/shop/serviceaccounts/default/token",
		"/api/v1/watch/pods",
		"/api/v1/watch/namespaces/shop/pods",
		"/apis/apps/v1/namespaces/shop/deployments/web",
		"/apis/apps/v1/namespaces/shop/deployments/web/scale",
		"/apis/rbac.authorization.k8s.io/v1/clusterroles",
		"/apis/authentication.k8s.io/v1/tokenreviews",
		"/api/v1/namespaces/../secrets",
		"/api/v1/namespaces/a/b/pods",
		"/api/v1/pods/",
		"/api/v1/pods\n",
		"/x/api/v1/pods",
		"/version",
		"/",
	} {
		if allowed(eps, "GET", path) {
			t.Errorf("GET %q should be refused", path)
		}
	}
}
