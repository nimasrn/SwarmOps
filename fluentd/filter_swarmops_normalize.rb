require "digest"
require "json"
require "time"

module Fluent::Plugin
  class SwarmOpsNormalizeFilter < Filter
    Fluent::Plugin.register_filter("swarmops_normalize", self)
    MAX_MESSAGE = 32 * 1024
    CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/
    SECRET_KEY = /(?:authorization|cookie|password|passwd|token|api[_-]?key|client[_-]?secret|private[_-]?key|credential)/i
    SECRET_VALUE = /(?:bearer|basic)\s+[A-Za-z0-9._~+\/=:-]+|-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----|\b(?:password|passwd|token|api[_-]?key|secret)\s*[:=]\s*[^\s,;]+|https?:\/\/[^\s\/:]+:[^\s@\/]+@/im

    def filter(tag, time, record)
      raw = record.is_a?(Hash) ? record : {}
      message = raw["log"] || raw["MESSAGE"] || raw["message"] || raw.to_json
      parsed = parse_message(message)
      message = parsed["message"] || parsed["msg"] || message
      timestamp = parse_time(raw["time"] || raw["__REALTIME_TIMESTAMP"] || parsed["timestamp"], time)
      container_id = raw["container_id"] || raw["CONTAINER_ID_FULL"] || container_from_path(raw["source_path"])
      unit = clean(raw["_SYSTEMD_UNIT"] || raw["UNIT"])
      identifier = clean(raw["SYSLOG_IDENTIFIER"] || parsed["logger"] || parsed["component"])
      service = clean(raw["service"] || parsed["service"])
      stack = clean(raw["stack"] || parsed["stack"])
      normalized_message = redact(clean(message.to_s, MAX_MESSAGE))
      node = clean(raw["node"] || ENV.fetch("NODE_NAME", "unknown"))
      level = normalize_level(raw["PRIORITY"] || parsed["level"] || parsed["severity"], raw["stream"])
      id_seed = [timestamp, node, container_id, unit, normalized_message].join("\0")
      {"id"=>Digest::SHA256.hexdigest(id_seed)[0,32], "timestamp"=>timestamp, "level"=>level,
       "sourceKind"=>source_kind(tag, unit, service, identifier), "node"=>node, "stack"=>stack,
       "service"=>service, "containerId"=>clean(container_id), "stream"=>clean(raw["stream"]),
       "unit"=>unit, "identifier"=>identifier, "message"=>normalized_message}.delete_if { |_k,v| v.nil? || v == "" }
    rescue StandardError => error
      now = Time.at(time).utc.iso8601(6)
      {"id"=>Digest::SHA256.hexdigest("#{now}\0#{error.class}")[0,32], "timestamp"=>now, "level"=>"error", "sourceKind"=>"fluentd", "node"=>ENV.fetch("NODE_NAME", "unknown"), "message"=>"Fluentd normalization failed: #{error.class}"}
    end

    private
    def parse_message(value); parsed=JSON.parse(value.to_s); parsed.is_a?(Hash) ? parsed : {}; rescue JSON::ParserError; {}; end
    def parse_time(value, fallback); return Time.at(value.to_i/1_000_000.0).utc.iso8601(6) if value.to_s.match?(/\A\d{13,}\z/); Time.parse(value.to_s).utc.iso8601(6); rescue ArgumentError; Time.at(fallback).utc.iso8601(6); end
    def clean(value, limit=512); value.to_s.encode("UTF-8", invalid: :replace, undef: :replace, replace: "").gsub(CONTROL, "")[0,limit]; end
    def redact(value); value.gsub(SECRET_VALUE,"[REDACTED]").gsub(/(["']?[^"'\s:=]+["']?\s*[:=]\s*)(["'][^"']*["']|[^\s,}]+)/) { SECRET_KEY.match?($1) ? "#{$1}[REDACTED]" : $& }; end
    def container_from_path(path); path.to_s[%r{/containers/([0-9a-f]{12,64})/},1]; end
    def normalize_level(value, stream); priorities={"0"=>"fatal","1"=>"fatal","2"=>"error","3"=>"error","4"=>"warn","5"=>"info","6"=>"info","7"=>"debug"}; level=priorities.fetch(value.to_s,value.to_s.downcase); return level if %w[trace debug info warn error fatal].include?(level); stream=="stderr" ? "error" : "info"; end
    def source_kind(tag, unit, service, identifier)
      text=[unit,service,identifier].compact.join(" ").downcase
      return "docker" if text.include?("docker") || text.include?("containerd")
      return "traefik" if text.include?("traefik")
      return "core" if text.include?("swarmops-control") || text.include?("swarmops-core")
      return "agent" if text.include?("swarmops-agent")
      return "fluentd" if text.include?("fluent")
      tag.start_with?("journal") ? "host" : "container"
    end
  end
end
