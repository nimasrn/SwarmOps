require "minitest/autorun"

module Fluent
  module Plugin
    class Filter; end
    def self.register_filter(_name, _type); end
  end
end

load File.expand_path("filter_swarmops_normalize.rb", __dir__)

class SwarmOpsNormalizeFilterTest < Minitest::Test
  def setup
    @filter = Fluent::Plugin::SwarmOpsNormalizeFilter.new
  end

  def test_normalizes_multiline_container_record
    record = @filter.filter("container", Time.now.to_i, {"log"=>"first\nsecond\u0001", "stream"=>"stderr", "source_path"=>"/var/lib/docker/containers/#{'a'*64}/x.log", "time"=>"2026-08-28T10:00:00Z"})
    assert_equal "container", record["sourceKind"]
    assert_equal "error", record["level"]
    assert_equal "first\nsecond", record["message"]
    assert_equal "a"*64, record["containerId"]
  end

  def test_redacts_secrets_and_truncates_before_storage
    message = "Authorization: Bearer abc.def password=hunter2 https://name:pass@example.com/ " + ("x" * 40_000)
    record = @filter.filter("journal.persistent", Time.now.to_i, {"MESSAGE"=>message, "_SYSTEMD_UNIT"=>"swarmops-agent.service", "PRIORITY"=>"6"})
    refute_includes record["message"], "abc.def"
    refute_includes record["message"], "hunter2"
    refute_includes record["message"], "name:pass"
    assert_operator record["message"].bytesize, :<=, 32 * 1024
    assert_equal "agent", record["sourceKind"]
  end

  def test_discards_unapproved_journal_fields
    record = @filter.filter("journal.runtime", Time.now.to_i, {"MESSAGE"=>"ok", "UNSAFE_RAW_FIELD"=>"must-not-escape", "_SYSTEMD_UNIT"=>"ssh.service"})
    refute record.key?("UNSAFE_RAW_FIELD")
    allowed = %w[id identifier level message node sourceKind stack stream timestamp unit containerId service]
    assert_empty record.keys - allowed
  end

  def test_aggregator_normalization_preserves_forwarder_identity
    forwarded = @filter.filter("journal.persistent", Time.now.to_i, {
      "MESSAGE"=>"service ready",
      "CONTAINER_ID_FULL"=>"b"*64,
      "_SYSTEMD_UNIT"=>"swarmops-agent.service",
      "SYSLOG_IDENTIFIER"=>"swarmops-agent",
    })
    stored = @filter.filter("journal.persistent", Time.now.to_i, forwarded)
    assert_equal "b"*64, stored["containerId"]
    assert_equal "swarmops-agent.service", stored["unit"]
    assert_equal "swarmops-agent", stored["identifier"]
    assert_equal "agent", stored["sourceKind"]
  end
end
