package model

import (
	"strings"
	ds "github.com/astrona-io/perses-plugin-kubernetes/schemas/datasources/kubernetes-datasource:model"
)

kind: "KubernetesStateQuery"
spec: close({
	ds.#selector

	// "custom" also needs customResource (checked when the query runs).
	resource:        "namespaces" | "nodes" | "pods" | "deployments" | "statefulsets" | "daemonsets" | "replicasets" | "custom"
	customResource?: =~"^([a-z0-9.-]+/)?v[0-9]+((alpha|beta)[0-9]+)?/[a-z0-9-]+$" & !~"/(secrets|serviceaccounts|tokenreviews|subjectaccessreviews)$"
	namespace?:      string
	labelSelector?:  string
	fieldSelector?:  string
	// JSONPath of the state, with || fallbacks. Default .status.phase.
	stateField?: strings.MinRunes(1)
	// State to number. Unmapped states become -1.
	stateMapping?: [...{
		value: string
		code:  number
	}]
	// Extra series labels read from each object.
	labelFields?: [...{
		name: =~"^[a-zA-Z_][a-zA-Z0-9_]*$"
		path: strings.MinRunes(1)
	}]
})
