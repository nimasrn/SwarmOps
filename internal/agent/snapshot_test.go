package agent

import (
	"strings"
	"testing"
)

func TestSnapshotParsers(t *testing.T) {
	t.Parallel()
	memory, err := memoryInfoFromText("MemTotal:       16384 kB\nMemAvailable:    4096 kB\n")
	if err != nil || memory.total != 16<<20 || memory.available != 4<<20 {
		t.Fatalf("memory = %#v, %v", memory, err)
	}
	load, err := loadAverageFromText("1.50 0.75 0.25 1/100 10\n")
	if err != nil || load[0] != 1.5 || load[2] != 0.25 {
		t.Fatalf("load = %#v, %v", load, err)
	}
	values, err := keyValues(strings.NewReader("PRETTY_NAME=\"Test OS\"\n"))
	if err != nil || values["PRETTY_NAME"] != "\"Test OS\"" {
		t.Fatalf("values = %#v, %v", values, err)
	}
}
