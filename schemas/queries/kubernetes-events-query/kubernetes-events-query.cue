package model

import (
	ds "github.com/astrona-io/perses-plugin-kubernetes/schemas/datasources/kubernetes-datasource:model"
)

kind: "KubernetesEventsQuery"
spec: close({
	ds.#selector

	// A namespace, $variable, or comma-separated list. Empty: all namespaces.
	namespace?: string
	// The object the events are about (involvedObject.kind and involvedObject.name).
	involvedObjectKind?: string
	involvedObjectName?: string
	type?:               "Normal" | "Warning"
	// Regular expression on the reason.
	reason?: string
	// Most recent events to keep (default 1000).
	limit?: int & >=1 & <=5000
})
