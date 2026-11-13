package model

import (
	"strings"
	ds "github.com/astrona-io/perses-plugin-kubernetes/schemas/datasources/kubernetes-datasource:model"
)

kind: "KubernetesResourceVariable"
spec: close({
	ds.#selector

	// The resource to list. "custom" reads customResource (group/version/resource).
	resource:        "namespaces" | "nodes" | "pods" | "deployments" | "statefulsets" | "daemonsets" | "replicasets" | "custom"
	customResource?: =~"^([a-z0-9.-]+/)?v[0-9]+((alpha|beta)[0-9]+)?/[a-z0-9-]+$" & !~"/(secrets|serviceaccounts|tokenreviews|subjectaccessreviews)$"
	// A namespace, $variable, or comma-separated list. Empty: all namespaces.
	namespace?:     string
	labelSelector?: string
	fieldSelector?: string
	// JSONPath of the option value (default .metadata.name) and of its label (default: the value).
	valueField?: strings.MinRunes(1)
	labelField?: strings.MinRunes(1)
	// Regular expression the value must match.
	filter?: strings.MinRunes(1)
})
