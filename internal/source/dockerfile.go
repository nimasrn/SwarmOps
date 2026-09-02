package source

import (
	"path"
	"regexp"
	"strconv"
	"strings"
)

// A Dockerfile is the only place many repositories say what their image
// actually needs: which port it listens on, whether it probes itself, and
// whether it drops root. The scanner used to check that the file existed and
// nothing more, which meant a Compose service without a `ports:` key produced
// a port the operator had to guess at even though `EXPOSE 8080` was sitting in
// the build.
//
// This parser is deliberately a reader, never an evaluator. It resolves no
// build argument, follows no base image, and executes nothing; an instruction
// it does not recognize is skipped rather than guessed at.

var (
	dockerfileSecretKey = regexp.MustCompile(`(?i)(password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|credential)`)
	dockerfileArgRef    = regexp.MustCompile(`\$\{?[A-Za-z_][A-Za-z0-9_]*`)
)

type dockerfileInstruction struct {
	arguments string
	keyword   string
}

// analyzeDockerfile parses one Dockerfile and returns its plan together with
// the findings an operator must see before the image is built. Subject is the
// path used in every finding so the console can point at the right file.
func analyzeDockerfile(filename string, content []byte) (DockerfilePlan, []Finding) {
	plan := DockerfilePlan{Path: filename, RunsAsRoot: true}
	instructions := parseDockerfile(content)
	var findings []Finding
	stageStart := -1
	for index, instruction := range instructions {
		if instruction.keyword == "FROM" {
			plan.Stages++
			stageStart = index
			if base := dockerfileBaseImage(instruction.arguments); base != "" {
				plan.BaseImages = append(plan.BaseImages, base)
			}
		}
	}
	if plan.Stages == 0 {
		return plan, []Finding{{Code: "dockerfile_no_from", Level: FindingBlocker, Message: "Dockerfile has no FROM instruction, so it cannot be built.", Subject: filename}}
	}
	for _, base := range plan.BaseImages {
		if !immutableImage(base) {
			findings = append(findings, Finding{Code: "dockerfile_mutable_base", Level: FindingWarning, Message: "Base image " + base + " is not pinned to a version or digest, so a rebuild can produce a different image from the same commit.", Subject: filename})
		}
	}
	// Only the final stage decides what the produced image runs as, listens
	// on, and probes. Earlier stages are build scaffolding and are read only
	// for their base images.
	final := instructions[stageStart:]
	for _, instruction := range final {
		switch instruction.keyword {
		case "EXPOSE":
			plan.ExposedPorts = append(plan.ExposedPorts, dockerfilePorts(instruction.arguments)...)
		case "USER":
			plan.RunsAsRoot = dockerfileRunsAsRoot(instruction.arguments)
		case "WORKDIR":
			plan.WorkDir = strings.TrimSpace(instruction.arguments)
		case "CMD", "ENTRYPOINT":
			plan.Entrypoint = true
		case "HEALTHCHECK":
			if strings.EqualFold(strings.TrimSpace(instruction.arguments), "NONE") {
				plan.Healthcheck = false
				continue
			}
			plan.Healthcheck = true
			if match := httpTargetPattern.FindStringSubmatch(instruction.arguments); len(match) == 2 && strings.HasPrefix(match[1], "/") {
				plan.HealthPath = match[1]
			}
		}
	}
	plan.ExposedPorts = sortedUniqueUint16(plan.ExposedPorts)
	// ENV and ARG are read across every stage: a credential baked into a build
	// stage is still committed to the repository and still leaks through the
	// image history of anything that copies from it.
	for _, instruction := range instructions {
		switch instruction.keyword {
		case "ENV", "ARG":
			if key := dockerfileLiteralSecret(instruction.arguments); key != "" {
				findings = append(findings, Finding{Code: "dockerfile_secret_literal", Level: FindingBlocker, Message: "Dockerfile " + instruction.keyword + " " + key + " sets a credential-shaped value in the image. Remove it and attach a managed database or a reviewed secret instead.", Subject: filename})
			}
		case "ADD":
			if dockerfileRemoteSource(instruction.arguments) {
				findings = append(findings, Finding{Code: "dockerfile_remote_add", Level: FindingWarning, Message: "Dockerfile ADD downloads from a URL, so the built image is not fully determined by this commit.", Subject: filename})
			}
		}
	}
	if !plan.Entrypoint {
		findings = append(findings, Finding{Code: "dockerfile_no_start_command", Level: FindingWarning, Message: "The final stage declares neither CMD nor ENTRYPOINT; the image starts only if its base image supplies one.", Subject: filename})
	}
	if plan.RunsAsRoot {
		findings = append(findings, Finding{Code: "dockerfile_root_user", Level: FindingWarning, Message: "The final stage has no USER instruction, so the container runs as root.", Subject: filename})
	}
	if len(plan.ExposedPorts) == 0 {
		findings = append(findings, Finding{Code: "dockerfile_no_expose", Level: FindingInfo, Message: "No EXPOSE instruction was found, so the listening port has to come from Compose or from review.", Subject: filename})
	}
	return plan, findings
}

// parseDockerfile normalizes a Dockerfile into instructions. It honours the
// escape directive, joins continuation lines, and drops comments; anything it
// cannot classify is discarded rather than interpreted.
func parseDockerfile(content []byte) []dockerfileInstruction {
	escape := byte('\\')
	lines := strings.Split(strings.ReplaceAll(string(content), "\r\n", "\n"), "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if !strings.HasPrefix(trimmed, "#") {
			break
		}
		directive := strings.ToLower(strings.TrimSpace(strings.TrimPrefix(trimmed, "#")))
		if value, found := strings.CutPrefix(directive, "escape="); found && strings.TrimSpace(value) == "`" {
			escape = '`'
		}
	}
	var instructions []dockerfileInstruction
	var joined strings.Builder
	for _, line := range lines {
		if joined.Len() == 0 && strings.HasPrefix(strings.TrimSpace(line), "#") {
			continue
		}
		text := strings.TrimRight(line, " \t")
		if text == "" && joined.Len() == 0 {
			continue
		}
		if len(text) > 0 && text[len(text)-1] == escape {
			joined.WriteString(text[:len(text)-1])
			joined.WriteString(" ")
			continue
		}
		joined.WriteString(text)
		statement := strings.TrimSpace(joined.String())
		joined.Reset()
		keyword, arguments, _ := strings.Cut(statement, " ")
		keyword = strings.ToUpper(strings.TrimSpace(keyword))
		if keyword == "" {
			continue
		}
		instructions = append(instructions, dockerfileInstruction{arguments: strings.TrimSpace(arguments), keyword: keyword})
	}
	return instructions
}

// dockerfileBaseImage returns the image reference of one FROM, dropping the
// `--platform` flag and the `AS name` alias.
func dockerfileBaseImage(arguments string) string {
	fields := strings.Fields(arguments)
	for _, field := range fields {
		if strings.HasPrefix(field, "--") {
			continue
		}
		return field
	}
	return ""
}

func dockerfilePorts(arguments string) []uint16 {
	var result []uint16
	for _, field := range strings.Fields(arguments) {
		value := strings.SplitN(field, "/", 2)[0]
		if parsed, err := strconv.ParseUint(value, 10, 16); err == nil && parsed > 0 {
			result = append(result, uint16(parsed))
		}
	}
	return result
}

// dockerfileRunsAsRoot reads one USER instruction. An unresolved build
// argument counts as root, because the scanner cannot prove otherwise.
func dockerfileRunsAsRoot(arguments string) bool {
	user, _, _ := strings.Cut(strings.TrimSpace(arguments), ":")
	user = strings.Trim(strings.TrimSpace(user), `"'`)
	if user == "" || strings.Contains(user, "$") {
		return true
	}
	return user == "root" || user == "0"
}

// dockerfileLiteralSecret reports a credential-shaped key whose value is a
// literal rather than a reference. The value itself is never returned to the
// caller, and never reaches the plan.
func dockerfileLiteralSecret(arguments string) string {
	for _, assignment := range dockerfileAssignments(arguments) {
		key, value, found := strings.Cut(assignment, "=")
		if !found {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.Trim(strings.TrimSpace(value), `"'`)
		if value == "" || dockerfileArgRef.MatchString(value) {
			continue
		}
		if dockerfileSecretKey.MatchString(key) {
			return key
		}
	}
	return ""
}

// dockerfileAssignments splits `KEY=value KEY2="a b"` into assignments while
// respecting quotes, and also accepts the legacy `ENV KEY value` form.
func dockerfileAssignments(arguments string) []string {
	arguments = strings.TrimSpace(arguments)
	if arguments == "" {
		return nil
	}
	if !strings.Contains(arguments, "=") {
		key, value, found := strings.Cut(arguments, " ")
		if !found || strings.TrimSpace(value) == "" {
			return nil
		}
		return []string{key + "=" + strings.TrimSpace(value)}
	}
	var result []string
	var current strings.Builder
	quote := byte(0)
	for index := 0; index < len(arguments); index++ {
		character := arguments[index]
		switch {
		case quote != 0:
			if character == quote {
				quote = 0
			}
			current.WriteByte(character)
		case character == '"' || character == '\'':
			quote = character
			current.WriteByte(character)
		case character == ' ' || character == '\t':
			if current.Len() > 0 {
				result = append(result, current.String())
				current.Reset()
			}
		default:
			current.WriteByte(character)
		}
	}
	if current.Len() > 0 {
		result = append(result, current.String())
	}
	return result
}

func dockerfileRemoteSource(arguments string) bool {
	for _, field := range strings.Fields(arguments) {
		if strings.HasPrefix(field, "--") {
			continue
		}
		lowered := strings.ToLower(field)
		if strings.HasPrefix(lowered, "http://") || strings.HasPrefix(lowered, "https://") {
			return true
		}
		return false
	}
	return false
}

// dockerignorePath is the .dockerignore that governs one build context. A
// context without one ships the whole directory to the daemon, including the
// .git directory the provider archive carries.
func dockerignorePath(contextPath string) string {
	if contextPath == "" {
		return ".dockerignore"
	}
	return path.Join(contextPath, ".dockerignore")
}
