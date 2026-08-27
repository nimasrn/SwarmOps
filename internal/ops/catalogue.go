package ops

import "github.com/nimasrn/SwarmOps/internal/domain"

// CommandCatalogue is the single description of everything SwarmOps can do to
// a cluster. It is data rather than documentation: the console renders it, and
// an entry that is not here has no route, no queue action, and no argv.
//
// A confirmation shown as {name} is a template — the API derives the real
// phrase from the target, so the console can show the operator what to type.
func CommandCatalogue() []domain.CommandDefinition {
	return []domain.CommandDefinition{
		// Reads.
		{Action: "cluster.overview", Description: "Nodes and services with health, rolled up for the dashboard.", Docker: "docker node ls + docker service ls", Endpoint: "GET /api/v1/overview", Resource: "cluster", Title: "Cluster overview"},
		{Action: "cluster.insights", Description: "Fleet capacity, container and task counts, and reclaimable disk across every resource.", Docker: "docker system df + docker info", Endpoint: "GET /api/v1/insights", Resource: "cluster", Title: "Cluster insights"},
		{Action: "cluster.events", Parameters: []domain.CommandParameter{queryNumber("minutes", "Window in minutes", "15 to 1440. Longer windows are trimmed by the Engine's own retention.")}, Description: "A bounded window of the Engine event log, newest first.", Docker: "docker events --since --until", Endpoint: "GET /api/v1/events", Resource: "cluster", Title: "Engine events"},
		{Action: "cluster.df", Description: "Image, container, volume, and build-cache disk usage.", Docker: "docker system df -v", Endpoint: "GET /api/v1/system/df", Resource: "cluster", Title: "Disk usage"},
		{Action: "swarm.inspect", Description: "Cluster object, raft and orchestration settings. Join tokens are never returned.", Docker: "docker swarm inspect", Endpoint: "GET /api/v1/swarm", Resource: "swarm", Title: "Swarm settings"},
		{Action: "node.list", Description: "Every node with role, availability, and agent snapshot.", Docker: "docker node ls", Endpoint: "GET /api/v1/nodes", Resource: "node", Title: "Nodes"},
		{Action: "node.tasks", Parameters: []domain.CommandParameter{pathParam("id", "Node ID", "The Docker node ID, from the Nodes screen.")}, Description: "Tasks scheduled on one node.", Docker: "docker node ps", Endpoint: "GET /api/v1/nodes/{id}/tasks", Resource: "node", Title: "Node tasks"},
		{Action: "service.list", Description: "Services with replica counts and health.", Docker: "docker service ls", Endpoint: "GET /api/v1/services", Resource: "service", Title: "Services"},
		{Action: "service.inspect", Parameters: []domain.CommandParameter{pathParam("id", "Service ID or name", "")}, Description: "One service's full spec, ports, and update status.", Docker: "docker service inspect", Endpoint: "GET /api/v1/services/{id}", Resource: "service", Title: "Service detail"},
		{Action: "service.logs", Parameters: []domain.CommandParameter{pathParam("id", "Service ID or name", ""), queryNumber("tail", "Lines to tail", "1 to 1000. Defaults to 200.")}, Description: "Bounded tail of a service's logs.", Docker: "docker service logs --tail", Endpoint: "GET /api/v1/services/{id}/logs", Resource: "service", Title: "Service logs"},
		{Action: "task.inspect", Parameters: []domain.CommandParameter{pathParam("id", "Task ID", "")}, Description: "One task with its desired state and last status.", Docker: "docker inspect <task>", Endpoint: "GET /api/v1/tasks/{id}", Resource: "task", Title: "Task detail"},
		{Action: "container.list", Description: "Containers on the selected host, with size and state.", Docker: "docker ps -as", Endpoint: "GET /api/v1/containers", Resource: "container", Title: "Containers"},
		{Action: "container.inspect", Parameters: []domain.CommandParameter{pathParam("id", "Container ID", "")}, Description: "One container's configuration. Environment values are withheld; names only.", Docker: "docker inspect <container>", Endpoint: "GET /api/v1/containers/{id}", Resource: "container", Title: "Container detail"},
		{Action: "container.stats", Parameters: []domain.CommandParameter{pathParam("id", "Container ID", "")}, Description: "One CPU, memory, network, and block-IO sample.", Docker: "docker stats --no-stream", Endpoint: "GET /api/v1/containers/{id}/stats", Resource: "container", Title: "Container stats"},
		{Action: "image.list", Description: "Images by size, with tags and digests.", Docker: "docker image ls", Endpoint: "GET /api/v1/images", Resource: "image", Title: "Images"},
		{Action: "image.inspect", Parameters: []domain.CommandParameter{pathParam("id", "Image ID or tag", "")}, Description: "One image's layers, platform, and size.", Docker: "docker image inspect", Endpoint: "GET /api/v1/images/{id}", Resource: "image", Title: "Image detail"},
		{Action: "volume.list", Description: "Volumes with driver, mountpoint, and usage.", Docker: "docker volume ls", Endpoint: "GET /api/v1/volumes", Resource: "volume", Title: "Volumes"},
		{Action: "volume.inspect", Parameters: []domain.CommandParameter{pathParam("name", "Volume name", "")}, Description: "One volume's driver options and usage data.", Docker: "docker volume inspect", Endpoint: "GET /api/v1/volumes/{name}", Resource: "volume", Title: "Volume detail"},
		{Action: "network.list", Description: "Networks with driver, scope, and subnets.", Docker: "docker network ls", Endpoint: "GET /api/v1/networks", Resource: "network", Title: "Networks"},
		{Action: "network.inspect", Parameters: []domain.CommandParameter{pathParam("id", "Network ID or name", "")}, Description: "One network with its attached containers.", Docker: "docker network inspect", Endpoint: "GET /api/v1/networks/{id}", Resource: "network", Title: "Network detail"},
		{Action: "secret.list", Description: "Secret names and versions. A secret value is never readable.", Docker: "docker secret ls", Endpoint: "GET /api/v1/secrets", Resource: "secret", Title: "Secrets"},
		{Action: "config.list", Description: "Config names and versions. Payloads are not returned.", Docker: "docker config ls", Endpoint: "GET /api/v1/configs", Resource: "config", Title: "Configs"},

		// Mutations. Each is queued in the command ledger, CSRF-protected, and audited.
		{Action: "node.availability", AutoRetry: true, Parameters: []domain.CommandParameter{pathParam("id", "Node ID", ""), bodySelect("availability", "Availability", "active", "pause", "drain")}, Description: "Move a node between active, pause, and drain.", Docker: "docker node update --availability", Endpoint: "POST /api/v1/nodes/{id}/availability", Mutation: true, Resource: "node", Title: "Set node availability"},
		{Action: "node.role", AutoRetry: true, Parameters: []domain.CommandParameter{pathParam("id", "Node ID", ""), bodySelect("role", "Role change", "promote", "demote")}, Description: "Promote a worker to manager or demote a manager.", Docker: "docker node promote|demote", Endpoint: "POST /api/v1/nodes/{id}/role", Mutation: true, Resource: "node", Title: "Change node role"},
		{Action: "node.label", AutoRetry: true, Parameters: []domain.CommandParameter{pathParam("id", "Node ID", ""), bodyText("key", "Label key", "nim.stateful", ""), domain.CommandParameter{Hint: "Leave empty to remove the label.", In: "body", Kind: "text", Label: "Label value", Name: "value", Placeholder: "true"}}, Description: "Add or remove one placement label on a node.", Docker: "docker node update --label-add|--label-rm", Endpoint: "POST /api/v1/nodes/{id}/labels", Mutation: true, Resource: "node", Title: "Set node label"},
		{Action: "node.remove", Parameters: []domain.CommandParameter{pathParam("id", "Node ID", ""), confirmParam()}, Confirmation: "REMOVE_NODE_{ID}", Description: "Remove a node from the cluster.", Destructive: true, Docker: "docker node rm --force", Endpoint: "POST /api/v1/nodes/{id}/remove", Mutation: true, Resource: "node", Title: "Remove node"},
		{Action: "service.restart", AutoRetry: false, Parameters: []domain.CommandParameter{pathParam("id", "Service ID or name", ""), domain.CommandParameter{In: "body", Kind: "hidden", Label: "Action", Name: "action", Options: []string{"restart"}, Required: true}}, Description: "Force a rolling restart of every task.", Docker: "docker service update --force", Endpoint: "POST /api/v1/services/{id}/actions", Mutation: true, Resource: "service", Title: "Restart service"},
		{Action: "service.rollback", Parameters: []domain.CommandParameter{pathParam("id", "Service ID or name", ""), domain.CommandParameter{In: "body", Kind: "hidden", Label: "Action", Name: "action", Options: []string{"rollback"}, Required: true}}, Description: "Return a service to its previous spec.", Docker: "docker service rollback", Endpoint: "POST /api/v1/services/{id}/actions", Mutation: true, Resource: "service", Title: "Roll back service"},
		{Action: "service.scale", AutoRetry: true, Parameters: []domain.CommandParameter{pathParam("id", "Service ID or name", ""), domain.CommandParameter{In: "body", Kind: "hidden", Label: "Action", Name: "action", Options: []string{"scale"}, Required: true}, bodyNumber("replicas", "Replicas", "0 to 1000. Zero stops the service without deleting it.")}, Description: "Set the replica count of a replicated service.", Docker: "docker service scale", Endpoint: "POST /api/v1/services/{id}/actions", Mutation: true, Resource: "service", Title: "Scale service"},
		{Action: "service.image", AutoRetry: true, Parameters: []domain.CommandParameter{pathParam("id", "Service ID or name", ""), bodyText("image", "Image", "ghcr.io/org/service:2026.08.23", "An immutable tag or digest.")}, Description: "Roll a service onto another immutable image tag.", Docker: "docker service update --image", Endpoint: "POST /api/v1/services/{id}/image", Mutation: true, Resource: "service", Title: "Update service image"},
		{Action: "service.limits", AutoRetry: true, Parameters: []domain.CommandParameter{pathParam("id", "Service ID or name", ""), bodyText("cpus", "CPU limit", "1.5", "Cores, up to two whole digits and three decimals."), bodyText("memory", "Memory limit", "512M", "A whole number followed by M or G.")}, Description: "Set the CPU and memory limits of a service.", Docker: "docker service update --limit-cpu --limit-memory", Endpoint: "POST /api/v1/services/{id}/limits", Mutation: true, Resource: "service", Title: "Set service limits"},
		{Action: "service.remove", Parameters: []domain.CommandParameter{pathParam("id", "Service ID or name", ""), confirmParam()}, Confirmation: "REMOVE_SERVICE_{ID}", Description: "Delete a service and stop all of its tasks.", Destructive: true, Docker: "docker service rm", Endpoint: "POST /api/v1/services/{id}/remove", Mutation: true, Resource: "service", Title: "Remove service"},
		{Action: "stack.deploy", AutoRetry: true, Description: "Deploy a validated Compose document as a stack.", Docker: "docker stack deploy", Endpoint: "POST /api/v1/stacks/deploy", Mutation: true, Resource: "stack", Title: "Deploy stack"},
		{Action: "stack.remove", Parameters: []domain.CommandParameter{pathParam("name", "Stack name", ""), confirmParam()}, Confirmation: "REMOVE_STACK_{NAME}", Description: "Remove a stack and every service in it.", Destructive: true, Docker: "docker stack rm", Endpoint: "POST /api/v1/stacks/{name}/remove", Mutation: true, Resource: "stack", Title: "Remove stack"},
		{Action: "container.start", AutoRetry: true, Parameters: []domain.CommandParameter{pathParam("id", "Container ID", ""), domain.CommandParameter{In: "body", Kind: "hidden", Label: "Action", Name: "action", Options: []string{"start"}, Required: true}}, Description: "Start a stopped container.", Docker: "docker container start", Endpoint: "POST /api/v1/containers/{id}/actions", Mutation: true, Resource: "container", Title: "Start container"},
		{Action: "container.stop", Parameters: []domain.CommandParameter{pathParam("id", "Container ID", ""), domain.CommandParameter{In: "body", Kind: "hidden", Label: "Action", Name: "action", Options: []string{"stop"}, Required: true}}, Description: "Stop a running container.", Docker: "docker container stop", Endpoint: "POST /api/v1/containers/{id}/actions", Mutation: true, Resource: "container", Title: "Stop container"},
		{Action: "container.restart", Parameters: []domain.CommandParameter{pathParam("id", "Container ID", ""), domain.CommandParameter{In: "body", Kind: "hidden", Label: "Action", Name: "action", Options: []string{"restart"}, Required: true}}, Description: "Restart a container in place.", Docker: "docker container restart", Endpoint: "POST /api/v1/containers/{id}/actions", Mutation: true, Resource: "container", Title: "Restart container"},
		{Action: "container.remove", Parameters: []domain.CommandParameter{pathParam("id", "Container ID", ""), domain.CommandParameter{In: "body", Kind: "hidden", Label: "Action", Name: "action", Options: []string{"remove"}, Required: true}, confirmParam()}, Confirmation: "REMOVE_CONTAINER_{ID}", Description: "Force-remove a container.", Destructive: true, Docker: "docker container rm --force", Endpoint: "POST /api/v1/containers/{id}/actions", Mutation: true, Resource: "container", Title: "Remove container"},
		{Action: "image.pull", AutoRetry: true, Parameters: []domain.CommandParameter{bodyText("image", "Image reference", "ghcr.io/org/service:2026.08.23", "")}, Description: "Pull an image onto the selected host.", Docker: "docker image pull", Endpoint: "POST /api/v1/images/pull", Mutation: true, Resource: "image", Title: "Pull image"},
		{Action: "image.remove", Parameters: []domain.CommandParameter{bodyText("image", "Image reference", "ghcr.io/org/service:2026.08.23", "")}, Description: "Remove one image from the host.", Destructive: true, Docker: "docker image rm", Endpoint: "POST /api/v1/images/remove", Mutation: true, Resource: "image", Title: "Remove image"},
		{Action: "image.build", Description: "Build and optionally push an image from an uploaded context.", Docker: "docker build", Endpoint: "POST /api/v1/builds", Mutation: true, Resource: "image", Title: "Build image"},
		{Action: "network.create", AutoRetry: true, Parameters: []domain.CommandParameter{bodyText("name", "Network name", "edge", ""), bodySelect("driver", "Driver", "overlay", "bridge"), bodySwitch("attachable", "Attachable", "Lets standalone containers join, not only services."), bodySwitch("internal", "Internal", "No external routing.")}, Description: "Create an overlay or bridge network.", Docker: "docker network create", Endpoint: "POST /api/v1/networks", Mutation: true, Resource: "network", Title: "Create network"},
		{Action: "network.remove", Parameters: []domain.CommandParameter{pathParam("name", "Network name", ""), confirmParam()}, Confirmation: "REMOVE_NETWORK_{NAME}", Description: "Remove a network no service is attached to.", Destructive: true, Docker: "docker network rm", Endpoint: "POST /api/v1/networks/{name}/remove", Mutation: true, Resource: "network", Title: "Remove network"},
		{Action: "volume.create", AutoRetry: true, Parameters: []domain.CommandParameter{bodyText("name", "Volume name", "postgres-data", "")}, Description: "Create a local volume.", Docker: "docker volume create", Endpoint: "POST /api/v1/volumes", Mutation: true, Resource: "volume", Title: "Create volume"},
		{Action: "volume.remove", Parameters: []domain.CommandParameter{pathParam("name", "Volume name", ""), confirmParam()}, Confirmation: "REMOVE_VOLUME_{NAME}", Description: "Delete a volume and the data in it.", Destructive: true, Docker: "docker volume rm", Endpoint: "POST /api/v1/volumes/{name}/remove", Mutation: true, Resource: "volume", Title: "Remove volume"},
		{Action: "config.remove", Parameters: []domain.CommandParameter{pathParam("name", "Config name", ""), confirmParam()}, Confirmation: "REMOVE_CONFIG_{NAME}", Description: "Remove a config object.", Destructive: true, Docker: "docker config rm", Endpoint: "POST /api/v1/configs/{name}/remove", Mutation: true, Resource: "config", Title: "Remove config"},
		{Action: "prune.containers", Parameters: []domain.CommandParameter{confirmParam()}, Confirmation: "PRUNE_CONTAINERS", Description: "Delete every stopped container.", Destructive: true, Docker: "docker container prune --force", Endpoint: "POST /api/v1/prune/containers", Mutation: true, Resource: "cluster", Title: "Prune containers"},
		{Action: "prune.images", Parameters: []domain.CommandParameter{bodySwitch("all", "Remove every unused image", "Without this, only dangling layers go."), confirmParam()}, Confirmation: "PRUNE_IMAGES", Description: "Delete dangling images, or every unused image.", Destructive: true, Docker: "docker image prune --force [--all]", Endpoint: "POST /api/v1/prune/images", Mutation: true, Resource: "cluster", Title: "Prune images"},
		{Action: "prune.networks", Parameters: []domain.CommandParameter{confirmParam()}, Confirmation: "PRUNE_NETWORKS", Description: "Delete every unused network.", Destructive: true, Docker: "docker network prune --force", Endpoint: "POST /api/v1/prune/networks", Mutation: true, Resource: "cluster", Title: "Prune networks"},
		{Action: "prune.volumes", Parameters: []domain.CommandParameter{confirmParam()}, Confirmation: "PRUNE_VOLUMES", Description: "Delete every unreferenced volume and its data.", Destructive: true, Docker: "docker volume prune --force", Endpoint: "POST /api/v1/prune/volumes", Mutation: true, Resource: "cluster", Title: "Prune volumes"},
		{Action: "prune.build-cache", Parameters: []domain.CommandParameter{confirmParam()}, Confirmation: "PRUNE_BUILD_CACHE", Description: "Delete the builder cache.", Destructive: true, Docker: "docker builder prune --force", Endpoint: "POST /api/v1/prune/build-cache", Mutation: true, Resource: "cluster", Title: "Prune build cache"},
		{Action: "swarm.join-token.rotate", Parameters: []domain.CommandParameter{bodySelect("role", "Token", "worker", "manager"), confirmParam()}, Confirmation: "ROTATE_{ROLE}_JOIN_TOKEN", Description: "Invalidate a leaked join token. The new token is not returned.", Destructive: true, Docker: "docker swarm join-token --rotate --quiet", Endpoint: "POST /api/v1/swarm/join-token", Mutation: true, Resource: "swarm", Title: "Rotate join token"},
		{Action: "swarm.update", AutoRetry: true, Parameters: []domain.CommandParameter{bodyNumber("taskHistoryLimit", "Task history limit", "1 to 1000.")}, Description: "Set how many historical tasks the cluster keeps per slot.", Docker: "docker swarm update --task-history-limit", Endpoint: "POST /api/v1/swarm", Mutation: true, Resource: "swarm", Title: "Update swarm settings"},
	}
}

// The parameter helpers keep the catalogue readable: an operation states what
// it needs, and the console builds the same form the API will validate.
func pathParam(name, label, hint string) domain.CommandParameter {
	return domain.CommandParameter{Hint: hint, In: "path", Kind: "text", Label: label, Name: name, Required: true}
}

func bodyText(name, label, placeholder, hint string) domain.CommandParameter {
	return domain.CommandParameter{Hint: hint, In: "body", Kind: "text", Label: label, Name: name, Placeholder: placeholder, Required: true}
}

func bodyNumber(name, label, hint string) domain.CommandParameter {
	return domain.CommandParameter{Hint: hint, In: "body", Kind: "number", Label: label, Name: name, Required: true}
}

func bodySelect(name, label string, options ...string) domain.CommandParameter {
	return domain.CommandParameter{In: "body", Kind: "select", Label: label, Name: name, Options: options, Required: true}
}

func bodySwitch(name, label, hint string) domain.CommandParameter {
	return domain.CommandParameter{Hint: hint, In: "body", Kind: "switch", Label: label, Name: name}
}

// confirmParam is the typed phrase a destructive operation needs. The console
// renders it as a confirmation field and refuses to send until it matches.
func confirmParam() domain.CommandParameter {
	return domain.CommandParameter{In: "body", Kind: "confirmation", Label: "Confirmation", Name: "confirmation", Required: true}
}

func queryNumber(name, label, hint string) domain.CommandParameter {
	return domain.CommandParameter{Hint: hint, In: "query", Kind: "number", Label: label, Name: name}
}
