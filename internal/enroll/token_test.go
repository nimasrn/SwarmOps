package enroll

import "testing"

func TestEncodeDecodeRoundTrip(t *testing.T) {
	token := Token{Fingerprint: "SHA256:" + repeat("A", 64), Host: "10.0.0.5", Port: 9180, Secret: repeat("a", 43)}
	encoded, err := Encode(token)
	if err != nil {
		t.Fatalf("encode: %v", err)
	}
	decoded, err := Decode(encoded)
	if err != nil {
		t.Fatalf("decode: %v", err)
	}
	if decoded != token {
		t.Fatalf("round trip changed the token: %+v", decoded)
	}
	if decoded.Scheme() != "https" {
		t.Fatalf("a pinned token must imply HTTPS, got %q", decoded.Scheme())
	}
}

func TestDecodeRejectsUnsafeTokens(t *testing.T) {
	fingerprint := "SHA256:" + repeat("A", 64)
	secret := repeat("a", 43)
	cases := map[string]Token{
		"remote host without a certificate pin": {Host: "10.0.0.5", Port: 9180, Secret: secret},
		"missing port":                          {Fingerprint: fingerprint, Host: "10.0.0.5", Secret: secret},
		"short secret":                          {Fingerprint: fingerprint, Host: "10.0.0.5", Port: 9180, Secret: "abc"},
		"host that is not a name or address":    {Fingerprint: fingerprint, Host: "not a host", Port: 9180, Secret: secret},
	}
	for name, token := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := Encode(token); err == nil {
				t.Fatalf("expected %s to be rejected", name)
			}
		})
	}
}

func TestLoopbackTokenMayOmitFingerprint(t *testing.T) {
	token := Token{Host: "127.0.0.1", Port: 9180, Secret: repeat("a", 43)}
	encoded, err := Encode(token)
	if err != nil {
		t.Fatalf("encode: %v", err)
	}
	decoded, err := Decode(encoded)
	if err != nil {
		t.Fatalf("decode: %v", err)
	}
	if decoded.Scheme() != "http" {
		t.Fatalf("an unpinned loopback token must use HTTP, got %q", decoded.Scheme())
	}
}

func TestDecodeRejectsForeignPrefixAndGarbage(t *testing.T) {
	for _, value := range []string{"", "swarmops0.abc", "swarmops1.!!!", Prefix + "eyJoIjoiIn0"} {
		if _, err := Decode(value); err == nil {
			t.Fatalf("expected %q to be rejected", value)
		}
	}
}

func repeat(value string, count int) string {
	out := make([]byte, 0, count)
	for range count {
		out = append(out, value[0])
	}
	return string(out)
}
